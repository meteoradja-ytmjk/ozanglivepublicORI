const { db, checkIfUsersExist } = require('../db/database');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { validateUsername } = require('../utils/usernameValidator');

class User {
  static findByEmail(email) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
        if (err) {
          return reject(err);
        }
        resolve(row);
      });
    });
  }
  static findByUsername(username) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
        if (err) {
          return reject(err);
        }
        resolve(row);
      });
    });
  }
  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
        if (err) {
          console.error('Database error in findById:', err);
          return reject(err);
        }
        resolve(row);
      });
    });
  }
  static async create(userData) {
    try {
      // Validate username before creating user
      const usernameValidation = validateUsername(userData.username);
      if (!usernameValidation.isValid) {
        throw new Error(usernameValidation.error);
      }

      // Get default storage limit from system settings
      const StorageService = require('../services/storageService');
      const defaultStorageLimit = await StorageService.getDefaultStorageLimit();

      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const userId = uuidv4();
      
      // Handle live_limit - use provided value or null for unlimited
      const liveLimit = userData.live_limit !== undefined ? userData.live_limit : null;
      
      return new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO users (id, username, password, avatar_path, user_role, status, storage_limit, live_limit) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [userId, userData.username, hashedPassword, userData.avatar_path || null, userData.user_role || 'admin', userData.status || 'active', defaultStorageLimit, liveLimit],
          function (err) {
            if (err) {
              console.error("DB error during user creation:", err);
              return reject(err);
            }
            console.log("User created successfully with ID:", userId);
            resolve({ id: userId, username: userData.username, user_role: userData.user_role || 'admin', status: userData.status || 'active', storage_limit: defaultStorageLimit, live_limit: liveLimit });
          }
        );
      });
    } catch (error) {
      console.error("Error in User.create:", error);
      throw error;
    }
  }
  static update(userId, userData) {
    const fields = [];
    const values = [];
    Object.entries(userData).forEach(([key, value]) => {
      fields.push(`${key} = ?`);
      values.push(value);
    });
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);
    const query = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
    return new Promise((resolve, reject) => {
      db.run(query, values, function (err) {
        if (err) {
          return reject(err);
        }
        resolve({ id: userId, ...userData });
      });
    });
  }
  static async verifyPassword(plainPassword, hashedPassword) {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  static findAll() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM users ORDER BY created_at DESC', [], (err, rows) => {
        if (err) {
          console.error('Database error in findAll:', err);
          return reject(err);
        }
        resolve(rows);
      });
    });
  }

  static updateStatus(userId, status) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, userId],
        function (err) {
          if (err) {
            console.error('Database error in updateStatus:', err);
            return reject(err);
          }
          resolve({ id: userId, status });
        }
      );
    });
  }

  static updateRole(userId, role) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET user_role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [role, userId],
        function (err) {
          if (err) {
            console.error('Database error in updateRole:', err);
            return reject(err);
          }
          resolve({ id: userId, user_role: role });
        }
      );
    });
  }

  static delete(userId) {
    return new Promise(async (resolve, reject) => {
      try {
        const Video = require('./Video');
        const Stream = require('./Stream');
        
        const userVideos = await Video.findAll(userId);
        const userStreams = await Stream.findAll(userId);
        
        for (const video of userVideos) {
          try {
            await Video.delete(video.id);
          } catch (videoDeleteError) {
            console.error(`Error deleting video ${video.id}:`, videoDeleteError);
          }
        }
        
        for (const stream of userStreams) {
          try {
            await Stream.delete(stream.id, userId);
          } catch (streamDeleteError) {
            console.error(`Error deleting stream ${stream.id}:`, streamDeleteError);
          }
        }
        
        db.run('DELETE FROM users WHERE id = ?', [userId], function (err) {
          if (err) {
            console.error('Database error in delete:', err);
            return reject(err);
          }
          resolve({ 
            id: userId, 
            deleted: true, 
            videosDeleted: userVideos.length,
            streamsDeleted: userStreams.length 
          });
        });
      } catch (error) {
        console.error('Error in user deletion process:', error);
        reject(error);
      }
    });
  }

  static updateProfile(userId, updateData) {
    return new Promise((resolve, reject) => {
      const fields = [];
      const values = [];
      
      if (updateData.username) {
        // Validate username before updating
        const usernameValidation = validateUsername(updateData.username);
        if (!usernameValidation.isValid) {
          return reject(new Error(usernameValidation.error));
        }
        fields.push('username = ?');
        values.push(updateData.username);
      }
      
      if (updateData.user_role) {
        fields.push('user_role = ?');
        values.push(updateData.user_role);
      }
      
      if (updateData.status) {
        fields.push('status = ?');
        values.push(updateData.status);
      }
      
      if (updateData.avatar_path !== undefined) {
        fields.push('avatar_path = ?');
        values.push(updateData.avatar_path);
      }
      
      if (updateData.password) {
        fields.push('password = ?');
        values.push(updateData.password);
      }

      if (updateData.live_limit !== undefined) {
        fields.push('live_limit = ?');
        values.push(updateData.live_limit);
      }

      if (updateData.storage_limit !== undefined) {
        fields.push('storage_limit = ?');
        values.push(updateData.storage_limit);
      }
      
      if (fields.length === 0) {
        return resolve({ id: userId, message: 'No fields to update' });
      }
      
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(userId);
      
      const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
      
      db.run(sql, values, function (err) {
        if (err) {
          console.error('Database error in updateProfile:', err);
          return reject(err);
        }
        resolve({ id: userId, changes: this.changes });
      });
    });
  }

  /**
   * Update user's custom live streaming limit
   * @param {string} userId - User ID
   * @param {number|null} limit - Custom limit (null to use default)
   * @returns {Promise<Object>} Updated user info
   */
  static updateLiveLimit(userId, limit) {
    return new Promise((resolve, reject) => {
      const validLimit = limit === null || limit === '' || limit === 0 ? null : parseInt(limit, 10);
      db.run(
        'UPDATE users SET live_limit = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [validLimit, userId],
        function (err) {
          if (err) {
            console.error('Database error in updateLiveLimit:', err);
            return reject(err);
          }
          resolve({ id: userId, live_limit: validLimit, changes: this.changes });
        }
      );
    });
  }

  /**
   * Get user's custom live streaming limit
   * @param {string} userId - User ID
   * @returns {Promise<number|null>} Custom limit or null if using default
   */
  static getLiveLimit(userId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT live_limit FROM users WHERE id = ?', [userId], (err, row) => {
        if (err) {
          console.error('Database error in getLiveLimit:', err);
          return reject(err);
        }
        resolve(row ? row.live_limit : null);
      });
    });
  }

  /**
   * Update a single permission for a user
   * @param {string} userId - User ID
   * @param {string} permission - Permission name (can_view_videos, can_download_videos, can_delete_videos)
   * @param {boolean} value - Permission value (true = enabled, false = disabled)
   * @returns {Promise<Object>} Updated permission info
   */
  static updatePermission(userId, permission, value) {
    const validPermissions = ['can_view_videos', 'can_download_videos', 'can_delete_videos'];
    if (!validPermissions.includes(permission)) {
      return Promise.reject(new Error('Invalid permission type'));
    }
    
    return new Promise((resolve, reject) => {
      const permValue = value ? 1 : 0;
      db.run(
        `UPDATE users SET ${permission} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [permValue, userId],
        function (err) {
          if (err) {
            console.error('Database error in updatePermission:', err);
            return reject(err);
          }
          resolve({ id: userId, [permission]: permValue, changes: this.changes });
        }
      );
    });
  }

  /**
   * Update permissions for multiple users (bulk operation)
   * @param {string[]} userIds - Array of user IDs
   * @param {Object} permissions - Object with permission values
   * @returns {Promise<Object>} Result with updated count
   */
  static bulkUpdatePermissions(userIds, permissions) {
    if (!userIds || userIds.length === 0) {
      return Promise.reject(new Error('No users selected'));
    }

    const validPermissions = ['can_view_videos', 'can_download_videos', 'can_delete_videos'];
    const updates = [];
    const values = [];

    for (const [key, value] of Object.entries(permissions)) {
      if (validPermissions.includes(key)) {
        updates.push(`${key} = ?`);
        values.push(value ? 1 : 0);
      }
    }

    if (updates.length === 0) {
      return Promise.reject(new Error('No valid permissions to update'));
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    const placeholders = userIds.map(() => '?').join(',');
    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id IN (${placeholders})`;
    
    return new Promise((resolve, reject) => {
      db.run(sql, [...values, ...userIds], function (err) {
        if (err) {
          console.error('Database error in bulkUpdatePermissions:', err);
          return reject(err);
        }
        resolve({ updatedCount: this.changes, userIds });
      });
    });
  }

  /**
   * Get user permissions
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User permissions
   */
  static getPermissions(userId) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT can_view_videos, can_download_videos, can_delete_videos FROM users WHERE id = ?',
        [userId],
        (err, row) => {
          if (err) {
            console.error('Database error in getPermissions:', err);
            return reject(err);
          }
          if (!row) {
            return resolve(null);
          }
          resolve({
            can_view_videos: row.can_view_videos === 1,
            can_download_videos: row.can_download_videos === 1,
            can_delete_videos: row.can_delete_videos === 1
          });
        }
      );
    });
  }

  /**
   * Update user's storage limit
   * @param {string} userId - User ID
   * @param {number|null} limit - Storage limit in bytes (null for unlimited)
   * @returns {Promise<Object>} Updated user info
   */
  static updateStorageLimit(userId, limit) {
    return new Promise((resolve, reject) => {
      // Validate limit: must be positive integer or null
      let validLimit = null;
      if (limit !== null && limit !== '' && limit !== undefined) {
        const parsed = parseInt(limit, 10);
        if (isNaN(parsed) || parsed < 0) {
          return reject(new Error('Invalid storage limit. Must be a positive number or null'));
        }
        validLimit = parsed === 0 ? null : parsed;
      }

      db.run(
        'UPDATE users SET storage_limit = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [validLimit, userId],
        function (err) {
          if (err) {
            console.error('Database error in updateStorageLimit:', err);
            return reject(err);
          }
          resolve({ id: userId, storage_limit: validLimit, changes: this.changes });
        }
      );
    });
  }

  /**
   * Get user's storage limit
   * @param {string} userId - User ID
   * @returns {Promise<number|null>} Storage limit in bytes or null if unlimited
   */
  static getStorageLimit(userId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT storage_limit FROM users WHERE id = ?', [userId], (err, row) => {
        if (err) {
          console.error('Database error in getStorageLimit:', err);
          return reject(err);
        }
        resolve(row ? row.storage_limit : null);
      });
    });
  }
}
module.exports = User;