const { v4: uuidv4 } = require('uuid');
const { db } = require('../db/database');

class BroadcastTemplate {
  /**
   * Parse row data to proper format (JSON fields, booleans)
   * @param {Object} row - Database row
   * @returns {Object} Parsed row
   */
  static parseRow(row) {
    if (!row) return null;
    
    // Parse tags JSON
    if (row.tags) {
      try {
        row.tags = JSON.parse(row.tags);
      } catch (e) {
        row.tags = [];
      }
    }
    
    // Parse recurring_days JSON
    if (row.recurring_days) {
      try {
        row.recurring_days = JSON.parse(row.recurring_days);
      } catch (e) {
        row.recurring_days = [];
      }
    }
    
    // Parse stream_key_folder_mapping JSON
    if (row.stream_key_folder_mapping) {
      try {
        row.stream_key_folder_mapping = JSON.parse(row.stream_key_folder_mapping);
      } catch (e) {
        row.stream_key_folder_mapping = {};
      }
    } else {
      row.stream_key_folder_mapping = {};
    }
    
    // Convert recurring_enabled to boolean
    row.recurring_enabled = !!row.recurring_enabled;
    
    // Ensure title_index has default value
    if (row.title_index === undefined || row.title_index === null) {
      row.title_index = 0;
    }
    
    // Ensure pinned_title_id is properly set
    if (row.pinned_title_id === undefined) {
      row.pinned_title_id = null;
    }
    
    // Ensure title_folder_id is properly set
    if (row.title_folder_id === undefined) {
      row.title_folder_id = null;
    }
    
    // Ensure thumbnail_index has default value
    if (row.thumbnail_index === undefined || row.thumbnail_index === null) {
      row.thumbnail_index = 0;
    }
    
    return row;
  }

  /**
   * Create a new broadcast template
   * @param {Object} templateData - Template data
   * @returns {Promise<Object>} Created template
   */
  static create(templateData) {
    const id = uuidv4();
    const {
      user_id,
      account_id,
      name,
      title,
      description = null,
      privacy_status = 'unlisted',
      tags = null,
      category_id = '20',
      thumbnail_path = null,
      thumbnail_folder = null,
      thumbnail_index = 0,
      pinned_thumbnail = null,
      stream_key_folder_mapping = null,
      stream_id = null,
      // Title rotation fields
      title_index = 0,
      pinned_title_id = null,
      title_folder_id = null,
      // Recurring fields
      recurring_enabled = false,
      recurring_pattern = null,
      recurring_time = null,
      recurring_days = null,
      next_run_at = null
    } = templateData;

    // Validate required fields
    if (!user_id || !account_id || !name || !title) {
      return Promise.reject(new Error('Missing required fields: user_id, account_id, name, and title are required'));
    }

    // Validate name is not empty or whitespace
    if (!name.trim()) {
      return Promise.reject(new Error('Template name cannot be empty'));
    }

    // Validate recurring configuration
    if (recurring_enabled) {
      if (!recurring_pattern || !['daily', 'weekly'].includes(recurring_pattern)) {
        return Promise.reject(new Error('Recurring pattern must be daily or weekly'));
      }
      if (!recurring_time) {
        return Promise.reject(new Error('Recurring time is required when recurring is enabled'));
      }
      if (recurring_pattern === 'weekly') {
        const days = Array.isArray(recurring_days) ? recurring_days : [];
        if (days.length === 0) {
          return Promise.reject(new Error('Weekly schedule requires at least one day selected'));
        }
      }
    }

    const tagsJson = Array.isArray(tags) ? JSON.stringify(tags) : tags;
    const daysJson = Array.isArray(recurring_days) ? JSON.stringify(recurring_days) : recurring_days;
    const streamKeyFolderMappingJson = stream_key_folder_mapping ? 
      (typeof stream_key_folder_mapping === 'string' ? stream_key_folder_mapping : JSON.stringify(stream_key_folder_mapping)) : null;

    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO broadcast_templates (
          id, user_id, account_id, name, title, description,
          privacy_status, tags, category_id, thumbnail_path, thumbnail_folder, 
          thumbnail_index, pinned_thumbnail, stream_key_folder_mapping, stream_id,
          title_index, pinned_title_id, title_folder_id,
          recurring_enabled, recurring_pattern, recurring_time, recurring_days, next_run_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, user_id, account_id, name.trim(), title, description,
          privacy_status, tagsJson, category_id, thumbnail_path, thumbnail_folder,
          thumbnail_index || 0, pinned_thumbnail, streamKeyFolderMappingJson, stream_id,
          title_index || 0, pinned_title_id, title_folder_id,
          recurring_enabled ? 1 : 0, recurring_pattern, recurring_time, daysJson, next_run_at
        ],
        function (err) {
          if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
              return reject(new Error('Template name already exists'));
            }
            console.error('Error creating broadcast template:', err.message);
            return reject(err);
          }
          resolve({
            id,
            user_id,
            account_id,
            name: name.trim(),
            title,
            description,
            privacy_status,
            tags: Array.isArray(tags) ? tags : (tags ? JSON.parse(tags) : null),
            category_id,
            thumbnail_path,
            thumbnail_folder,
            thumbnail_index: thumbnail_index || 0,
            pinned_thumbnail,
            stream_key_folder_mapping: stream_key_folder_mapping || {},
            stream_id,
            title_index: title_index || 0,
            pinned_title_id,
            title_folder_id,
            recurring_enabled: !!recurring_enabled,
            recurring_pattern,
            recurring_time,
            recurring_days: Array.isArray(recurring_days) ? recurring_days : null,
            next_run_at,
            last_run_at: null,
            created_at: new Date().toISOString()
          });
        }
      );
    });
  }

  /**
   * Find template by ID
   * @param {string} id - Template ID
   * @returns {Promise<Object|null>} Template or null
   */
  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT bt.*, yc.channel_name
         FROM broadcast_templates bt
         LEFT JOIN youtube_credentials yc ON bt.account_id = yc.id
         WHERE bt.id = ?`,
        [id],
        (err, row) => {
          if (err) {
            console.error('Error finding broadcast template:', err.message);
            return reject(err);
          }
          resolve(BroadcastTemplate.parseRow(row));
        }
      );
    });
  }

  /**
   * Find all templates for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of templates
   */
  static findByUserId(userId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT bt.*, yc.channel_name
         FROM broadcast_templates bt
         LEFT JOIN youtube_credentials yc ON bt.account_id = yc.id
         WHERE bt.user_id = ?
         ORDER BY bt.created_at DESC`,
        [userId],
        (err, rows) => {
          if (err) {
            console.error('Error finding broadcast templates:', err.message);
            return reject(err);
          }
          resolve((rows || []).map(row => BroadcastTemplate.parseRow(row)));
        }
      );
    });
  }

  /**
   * Find template by name for a user
   * @param {string} userId - User ID
   * @param {string} name - Template name
   * @returns {Promise<Object|null>} Template or null
   */
  static findByName(userId, name) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT bt.*, yc.channel_name
         FROM broadcast_templates bt
         LEFT JOIN youtube_credentials yc ON bt.account_id = yc.id
         WHERE bt.user_id = ? AND bt.name = ?`,
        [userId, name],
        (err, row) => {
          if (err) {
            console.error('Error finding broadcast template by name:', err.message);
            return reject(err);
          }
          resolve(BroadcastTemplate.parseRow(row));
        }
      );
    });
  }

  /**
   * Update a template
   * @param {string} id - Template ID
   * @param {Object} templateData - Updated template data
   * @returns {Promise<Object>} Updated template
   */
  static update(id, templateData) {
    const fields = [];
    const values = [];

    Object.entries(templateData).forEach(([key, value]) => {
      if (key === 'tags' && Array.isArray(value)) {
        fields.push(`${key} = ?`);
        values.push(JSON.stringify(value));
      } else if (key === 'recurring_days' && Array.isArray(value)) {
        fields.push(`${key} = ?`);
        values.push(JSON.stringify(value));
      } else if (key === 'recurring_enabled') {
        fields.push(`${key} = ?`);
        values.push(value ? 1 : 0);
      } else if (key === 'name' && typeof value === 'string') {
        if (!value.trim()) {
          throw new Error('Template name cannot be empty');
        }
        fields.push(`${key} = ?`);
        values.push(value.trim());
      } else if (key !== 'id' && key !== 'user_id' && key !== 'created_at') {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const query = `UPDATE broadcast_templates SET ${fields.join(', ')} WHERE id = ?`;

    return new Promise((resolve, reject) => {
      db.run(query, values, function (err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return reject(new Error('Template name already exists'));
          }
          console.error('Error updating broadcast template:', err.message);
          return reject(err);
        }
        resolve({ id, ...templateData, updated: this.changes > 0 });
      });
    });
  }

  /**
   * Delete a template
   * @param {string} id - Template ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Deletion result
   */
  static delete(id, userId) {
    return new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM broadcast_templates WHERE id = ? AND user_id = ?',
        [id, userId],
        function (err) {
          if (err) {
            console.error('Error deleting broadcast template:', err.message);
            return reject(err);
          }
          resolve({ success: true, deleted: this.changes > 0 });
        }
      );
    });
  }

  /**
   * Check if template name exists for user
   * @param {string} userId - User ID
   * @param {string} name - Template name
   * @param {string} excludeId - Template ID to exclude (for updates)
   * @returns {Promise<boolean>} True if exists
   */
  static async nameExists(userId, name, excludeId = null) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT COUNT(*) as count FROM broadcast_templates WHERE user_id = ? AND name = ?';
      const params = [userId, name];

      if (excludeId) {
        query += ' AND id != ?';
        params.push(excludeId);
      }

      db.get(query, params, (err, row) => {
        if (err) {
          console.error('Error checking template name:', err.message);
          return reject(err);
        }
        resolve(row.count > 0);
      });
    });
  }

  /**
   * Count templates for a user
   * @param {string} userId - User ID
   * @returns {Promise<number>} Count of templates
   */
  static countByUserId(userId) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT COUNT(*) as count FROM broadcast_templates WHERE user_id = ?',
        [userId],
        (err, row) => {
          if (err) {
            console.error('Error counting broadcast templates:', err.message);
            return reject(err);
          }
          resolve(row.count);
        }
      );
    });
  }

  /**
   * Find all templates with recurring enabled
   * @returns {Promise<Array>} Array of templates with recurring enabled
   */
  static findWithRecurringEnabled() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT bt.*, yc.channel_name, yc.client_id, yc.client_secret, yc.refresh_token
         FROM broadcast_templates bt
         LEFT JOIN youtube_credentials yc ON bt.account_id = yc.id
         WHERE bt.recurring_enabled = 1
         ORDER BY bt.next_run_at ASC`,
        [],
        (err, rows) => {
          if (err) {
            console.error('Error finding recurring templates:', err.message);
            return reject(err);
          }
          resolve((rows || []).map(row => BroadcastTemplate.parseRow(row)));
        }
      );
    });
  }

  /**
   * Update recurring configuration for a template
   * @param {string} id - Template ID
   * @param {Object} recurringData - Recurring configuration
   * @returns {Promise<Object>} Updated template
   */
  static updateRecurring(id, recurringData) {
    const {
      recurring_enabled,
      recurring_pattern,
      recurring_time,
      recurring_days,
      next_run_at
    } = recurringData;

    // Validate recurring configuration if enabling
    if (recurring_enabled) {
      if (!recurring_pattern || !['daily', 'weekly'].includes(recurring_pattern)) {
        return Promise.reject(new Error('Recurring pattern must be daily or weekly'));
      }
      if (!recurring_time) {
        return Promise.reject(new Error('Recurring time is required'));
      }
      if (recurring_pattern === 'weekly') {
        const days = Array.isArray(recurring_days) ? recurring_days : [];
        if (days.length === 0) {
          return Promise.reject(new Error('Weekly schedule requires at least one day selected'));
        }
      }
    }

    // Handle recurring_days: convert array to JSON string, or set to null
    let daysJson = null;
    if (Array.isArray(recurring_days) && recurring_days.length > 0) {
      daysJson = JSON.stringify(recurring_days);
    }

    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE broadcast_templates 
         SET recurring_enabled = ?, recurring_pattern = ?, recurring_time = ?, 
             recurring_days = ?, next_run_at = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [recurring_enabled ? 1 : 0, recurring_pattern, recurring_time, daysJson, next_run_at, id],
        function (err) {
          if (err) {
            console.error('Error updating recurring config:', err.message);
            return reject(err);
          }
          resolve({ 
            id, 
            recurring_enabled: !!recurring_enabled,
            recurring_pattern,
            recurring_time,
            recurring_days: Array.isArray(recurring_days) ? recurring_days : null,
            next_run_at,
            updated: this.changes > 0 
          });
        }
      );
    });
  }

  /**
   * Toggle recurring enabled status
   * @param {string} id - Template ID
   * @param {boolean} enabled - New enabled status
   * @param {string} nextRunAt - Next run timestamp (required when enabling)
   * @returns {Promise<Object>} Update result
   */
  static toggleRecurring(id, enabled, nextRunAt = null) {
    return new Promise((resolve, reject) => {
      const query = enabled
        ? `UPDATE broadcast_templates 
           SET recurring_enabled = 1, next_run_at = ?, updated_at = CURRENT_TIMESTAMP 
           WHERE id = ?`
        : `UPDATE broadcast_templates 
           SET recurring_enabled = 0, updated_at = CURRENT_TIMESTAMP 
           WHERE id = ?`;
      
      const params = enabled ? [nextRunAt, id] : [id];

      db.run(query, params, function (err) {
        if (err) {
          console.error('Error toggling recurring:', err.message);
          return reject(err);
        }
        resolve({ 
          success: true, 
          updated: this.changes > 0, 
          recurring_enabled: enabled,
          next_run_at: enabled ? nextRunAt : null
        });
      });
    });
  }

  /**
   * Update last run timestamp and calculate next run
   * @param {string} id - Template ID
   * @param {string} lastRunAt - Last run timestamp
   * @param {string} nextRunAt - Next run timestamp
   * @returns {Promise<Object>} Update result
   */
  static updateLastRun(id, lastRunAt, nextRunAt) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE broadcast_templates 
         SET last_run_at = ?, next_run_at = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [lastRunAt, nextRunAt, id],
        function (err) {
          if (err) {
            console.error('Error updating last run:', err.message);
            return reject(err);
          }
          resolve({ success: true, updated: this.changes > 0 });
        }
      );
    });
  }

  /**
   * Update thumbnail index for sequential selection
   * @param {string} id - Template ID
   * @param {number} newIndex - New thumbnail index
   * @returns {Promise<Object>} Update result
   */
  static updateThumbnailIndex(id, newIndex) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE broadcast_templates 
         SET thumbnail_index = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [newIndex, id],
        function (err) {
          if (err) {
            console.error('Error updating thumbnail index:', err.message);
            return reject(err);
          }
          resolve({ success: true, updated: this.changes > 0, thumbnail_index: newIndex });
        }
      );
    });
  }

  /**
   * Update pinned thumbnail
   * @param {string} id - Template ID
   * @param {string|null} pinnedThumbnail - Pinned thumbnail path or null to unpin
   * @returns {Promise<Object>} Update result
   */
  static updatePinnedThumbnail(id, pinnedThumbnail) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE broadcast_templates 
         SET pinned_thumbnail = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [pinnedThumbnail, id],
        function (err) {
          if (err) {
            console.error('Error updating pinned thumbnail:', err.message);
            return reject(err);
          }
          resolve({ success: true, updated: this.changes > 0, pinned_thumbnail: pinnedThumbnail });
        }
      );
    });
  }

  /**
   * Update stream key to folder mapping
   * @param {string} id - Template ID
   * @param {Object} mapping - Stream key to folder mapping object
   * @returns {Promise<Object>} Update result
   */
  static updateStreamKeyFolderMapping(id, mapping) {
    const mappingJson = mapping ? JSON.stringify(mapping) : null;
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE broadcast_templates 
         SET stream_key_folder_mapping = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [mappingJson, id],
        function (err) {
          if (err) {
            console.error('Error updating stream key folder mapping:', err.message);
            return reject(err);
          }
          resolve({ success: true, updated: this.changes > 0, stream_key_folder_mapping: mapping });
        }
      );
    });
  }

  /**
   * Update title index for sequential title rotation
   * @param {string} id - Template ID
   * @param {number} newIndex - New title index
   * @returns {Promise<Object>} Update result
   */
  static updateTitleIndex(id, newIndex) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE broadcast_templates 
         SET title_index = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [newIndex, id],
        function (err) {
          if (err) {
            console.error('Error updating title index:', err.message);
            return reject(err);
          }
          resolve({ success: true, updated: this.changes > 0, title_index: newIndex });
        }
      );
    });
  }

  /**
   * Update pinned title ID
   * @param {string} id - Template ID
   * @param {string|null} pinnedTitleId - Pinned title ID or null to unpin
   * @returns {Promise<Object>} Update result
   */
  static updatePinnedTitleId(id, pinnedTitleId) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE broadcast_templates 
         SET pinned_title_id = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [pinnedTitleId, id],
        function (err) {
          if (err) {
            console.error('Error updating pinned title ID:', err.message);
            return reject(err);
          }
          resolve({ success: true, updated: this.changes > 0, pinned_title_id: pinnedTitleId });
        }
      );
    });
  }
}

module.exports = BroadcastTemplate;
