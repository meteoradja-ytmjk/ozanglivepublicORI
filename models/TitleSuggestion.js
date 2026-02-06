const { v4: uuidv4 } = require('uuid');
const { db } = require('../db/database');

class TitleSuggestion {
  /**
   * Create a new title suggestion
   * @param {Object} data - Title data
   * @returns {Promise<Object>} Created title
   */
  static create(data) {
    const id = uuidv4();
    const { user_id, title, stream_key_id = null, folder_id = null } = data;

    if (!user_id || !title) {
      return Promise.reject(new Error('user_id and title are required'));
    }

    return new Promise((resolve, reject) => {
      // Get max sort_order for this user
      db.get(
        `SELECT MAX(sort_order) as max_order FROM title_suggestions WHERE user_id = ?`,
        [user_id],
        (err, row) => {
          if (err) {
            console.error('Error getting max sort_order:', err.message);
            return reject(err);
          }
          
          const sortOrder = (row?.max_order || 0) + 1;
          
          db.run(
            `INSERT INTO title_suggestions (id, user_id, title, stream_key_id, folder_id, use_count, sort_order, is_pinned)
             VALUES (?, ?, ?, ?, ?, 0, ?, 0)`,
            [id, user_id, title.trim(), stream_key_id, folder_id, sortOrder],
            function (err) {
              if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                  return reject(new Error('Title already exists'));
                }
                console.error('Error creating title suggestion:', err.message);
                return reject(err);
              }
              resolve({ 
                id, 
                user_id, 
                title: title.trim(), 
                stream_key_id,
                folder_id,
                use_count: 0, 
                sort_order: sortOrder,
                is_pinned: 0
              });
            }
          );
        }
      );
    });
  }

  /**
   * Find all titles for a user
   * @param {string} userId - User ID
   * @param {string} streamKeyId - Optional stream key filter
   * @param {string} folderId - Optional folder filter
   * @returns {Promise<Array>} Array of titles
   */
  static findByUserId(userId, streamKeyId = null, folderId = null) {
    return new Promise((resolve, reject) => {
      let query = `SELECT * FROM title_suggestions WHERE user_id = ?`;
      const params = [userId];

      if (streamKeyId) {
        query += ` AND (stream_key_id = ? OR stream_key_id IS NULL)`;
        params.push(streamKeyId);
      }

      if (folderId) {
        query += ` AND folder_id = ?`;
        params.push(folderId);
      }

      // Order: pinned first, then by sort_order
      query += ` ORDER BY is_pinned DESC, sort_order ASC, created_at DESC`;

      db.all(query, params, (err, rows) => {
        if (err) {
          console.error('Error finding title suggestions:', err.message);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }

  /**
   * Move title to folder
   * @param {string} id - Title ID
   * @param {string} userId - User ID
   * @param {string} folderId - Folder ID (null to remove from folder)
   * @returns {Promise<Object>} Update result
   */
  static moveToFolder(id, userId, folderId) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE title_suggestions SET folder_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
        [folderId, id, userId],
        function(err) {
          if (err) {
            console.error('Error moving title to folder:', err.message);
            return reject(err);
          }
          resolve({ success: true, updated: this.changes > 0 });
        }
      );
    });
  }

  /**
   * Find titles by stream key
   * @param {string} userId - User ID
   * @param {string} streamKeyId - Stream key ID
   * @returns {Promise<Array>} Array of titles for this stream key
   */
  static findByStreamKey(userId, streamKeyId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM title_suggestions 
         WHERE user_id = ? AND stream_key_id = ?
         ORDER BY is_pinned DESC, sort_order ASC`,
        [userId, streamKeyId],
        (err, rows) => {
          if (err) {
            console.error('Error finding titles by stream key:', err.message);
            return reject(err);
          }
          resolve(rows || []);
        }
      );
    });
  }

  /**
   * Get next title in rotation for a user
   * @param {string} userId - User ID
   * @param {number} currentIndex - Current title index
   * @param {string} folderId - Optional folder ID to filter titles
   * @returns {Promise<{title: Object|null, nextIndex: number}>} Next title and index
   */
  static async getNextTitle(userId, currentIndex = 0, folderId = null) {
    return new Promise((resolve, reject) => {
      // First check for pinned title (optionally in folder)
      let pinnedQuery = `SELECT * FROM title_suggestions WHERE user_id = ? AND is_pinned = 1`;
      const pinnedParams = [userId];
      
      if (folderId) {
        pinnedQuery += ` AND folder_id = ?`;
        pinnedParams.push(folderId);
      }
      pinnedQuery += ` LIMIT 1`;
      
      db.get(pinnedQuery, pinnedParams, (err, pinnedTitle) => {
        if (err) {
          console.error('Error finding pinned title:', err.message);
          return reject(err);
        }
        
        // If pinned title exists, always use it
        if (pinnedTitle) {
          return resolve({ title: pinnedTitle, nextIndex: currentIndex, isPinned: true });
        }
        
        // Get all titles for this user (optionally filtered by folder), ordered by sort_order
        let query = `SELECT * FROM title_suggestions WHERE user_id = ?`;
        const params = [userId];
        
        if (folderId) {
          query += ` AND folder_id = ?`;
          params.push(folderId);
        }
        query += ` ORDER BY sort_order ASC`;
        
        db.all(query, params, (err, titles) => {
          if (err) {
            console.error('Error finding titles:', err.message);
            return reject(err);
          }
          
          if (!titles || titles.length === 0) {
            return resolve({ title: null, nextIndex: 0, isPinned: false });
          }
          
          // Calculate actual index (wrap around)
          const actualIndex = currentIndex % titles.length;
          const selectedTitle = titles[actualIndex];
          const nextIndex = (actualIndex + 1) % titles.length;
          
          resolve({ 
            title: selectedTitle, 
            nextIndex, 
            isPinned: false,
            totalCount: titles.length,
            currentPosition: actualIndex + 1
          });
        });
      });
    });
  }

  /**
   * Search titles by keyword
   * @param {string} userId - User ID
   * @param {string} keyword - Search keyword
   * @returns {Promise<Array>} Array of matching titles
   */
  static search(userId, keyword) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM title_suggestions 
         WHERE user_id = ? AND title LIKE ?
         ORDER BY is_pinned DESC, use_count DESC, created_at DESC
         LIMIT 20`,
        [userId, `%${keyword}%`],
        (err, rows) => {
          if (err) {
            console.error('Error searching title suggestions:', err.message);
            return reject(err);
          }
          resolve(rows || []);
        }
      );
    });
  }

  /**
   * Increment use count for a title
   * @param {string} id - Title ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Update result
   */
  static incrementUseCount(id, userId) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE title_suggestions 
         SET use_count = use_count + 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_id = ?`,
        [id, userId],
        function (err) {
          if (err) {
            console.error('Error incrementing use count:', err.message);
            return reject(err);
          }
          resolve({ success: true, updated: this.changes > 0 });
        }
      );
    });
  }

  /**
   * Toggle pin status for a title
   * @param {string} id - Title ID
   * @param {string} userId - User ID
   * @param {boolean} isPinned - New pin status
   * @returns {Promise<Object>} Update result
   */
  static togglePin(id, userId, isPinned) {
    return new Promise((resolve, reject) => {
      // If pinning, first unpin all other titles for this user
      if (isPinned) {
        // Unpin all titles for this user first
        db.run(
          `UPDATE title_suggestions SET is_pinned = 0 WHERE user_id = ?`,
          [userId],
          (err) => {
            if (err) {
              console.error('Error unpinning titles:', err.message);
              return reject(err);
            }
            
            // Now pin the selected title
            db.run(
              `UPDATE title_suggestions SET is_pinned = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
              [id, userId],
              function (err) {
                if (err) {
                  console.error('Error pinning title:', err.message);
                  return reject(err);
                }
                resolve({ success: true, updated: this.changes > 0, is_pinned: true });
              }
            );
          }
        );
      } else {
        // Just unpin
        db.run(
          `UPDATE title_suggestions SET is_pinned = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
          [id, userId],
          function (err) {
            if (err) {
              console.error('Error unpinning title:', err.message);
              return reject(err);
            }
            resolve({ success: true, updated: this.changes > 0, is_pinned: false });
          }
        );
      }
    });
  }

  /**
   * Update stream key binding for a title
   * @param {string} id - Title ID
   * @param {string} userId - User ID
   * @param {string} streamKeyId - Stream key ID to bind
   * @returns {Promise<Object>} Update result
   */
  static updateStreamKey(id, userId, streamKeyId) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE title_suggestions SET stream_key_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
        [streamKeyId, id, userId],
        function (err) {
          if (err) {
            console.error('Error updating stream key:', err.message);
            return reject(err);
          }
          resolve({ success: true, updated: this.changes > 0 });
        }
      );
    });
  }

  /**
   * Update a title
   * @param {string} id - Title ID
   * @param {string} userId - User ID
   * @param {Object} data - Updated data
   * @returns {Promise<Object>} Update result
   */
  static update(id, userId, data) {
    const fields = [];
    const values = [];

    if (data.title) {
      fields.push('title = ?');
      values.push(data.title.trim());
    }
    if (data.stream_key_id !== undefined) {
      fields.push('stream_key_id = ?');
      values.push(data.stream_key_id);
    }
    if (data.sort_order !== undefined) {
      fields.push('sort_order = ?');
      values.push(data.sort_order);
    }

    if (fields.length === 0) {
      return Promise.resolve({ success: true, updated: false });
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id, userId);

    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE title_suggestions SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
        values,
        function (err) {
          if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
              return reject(new Error('Title already exists'));
            }
            console.error('Error updating title suggestion:', err.message);
            return reject(err);
          }
          resolve({ success: true, updated: this.changes > 0 });
        }
      );
    });
  }

  /**
   * Delete a title
   * @param {string} id - Title ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Delete result
   */
  static delete(id, userId) {
    return new Promise((resolve, reject) => {
      db.run(
        `DELETE FROM title_suggestions WHERE id = ? AND user_id = ?`,
        [id, userId],
        function (err) {
          if (err) {
            console.error('Error deleting title suggestion:', err.message);
            return reject(err);
          }
          resolve({ success: true, deleted: this.changes > 0 });
        }
      );
    });
  }

  /**
   * Get popular titles (most used)
   * @param {string} userId - User ID
   * @param {number} limit - Max results
   * @returns {Promise<Array>} Array of popular titles
   */
  static getPopular(userId, limit = 10) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM title_suggestions 
         WHERE user_id = ? AND use_count > 0
         ORDER BY use_count DESC
         LIMIT ?`,
        [userId, limit],
        (err, rows) => {
          if (err) {
            console.error('Error getting popular titles:', err.message);
            return reject(err);
          }
          resolve(rows || []);
        }
      );
    });
  }
}

module.exports = TitleSuggestion;
