const { db } = require('../db/database');

class YouTubeCredentials {
  /**
   * Create new YouTube credentials for a user (supports multiple accounts)
   * @param {string} userId - User ID
   * @param {Object} data - Credentials data
   * @returns {Promise<Object>} Created credentials
   */
  static async create(userId, { clientId, clientSecret, refreshToken, channelName, channelId }) {
    return new Promise(async (resolve, reject) => {
      try {
        // Check if this channel is already connected for this user
        const exists = await this.existsByChannel(userId, channelId);
        if (exists) {
          reject(new Error('This YouTube channel is already connected'));
          return;
        }

        // Check if this is the first account for the user (will be primary)
        const existingAccounts = await this.findAllByUserId(userId);
        const isPrimary = existingAccounts.length === 0 ? 1 : 0;

        db.run(
          `INSERT INTO youtube_credentials 
           (user_id, client_id, client_secret, refresh_token, channel_name, channel_id, is_primary)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [userId, clientId, clientSecret, refreshToken, channelName, channelId, isPrimary],
          function(err) {
            if (err) {
              reject(err);
              return;
            }
            resolve({
              id: this.lastID,
              userId,
              clientId,
              clientSecret,
              refreshToken,
              channelName,
              channelId,
              isPrimary
            });
          }
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Save or update YouTube credentials for a user (legacy method for backward compatibility)
   * @param {string} userId - User ID
   * @param {Object} data - Credentials data
   * @returns {Promise<Object>} Saved credentials
   * @deprecated Use create() for new accounts or update() for existing
   */
  static async save(userId, { clientId, clientSecret, refreshToken, channelName, channelId }) {
    return new Promise((resolve, reject) => {
      // Check if credentials already exist for this user and channel
      db.get(
        'SELECT id FROM youtube_credentials WHERE user_id = ? AND channel_id = ?',
        [userId, channelId],
        (err, existing) => {
          if (err) {
            reject(err);
            return;
          }

          if (existing) {
            // Update existing credentials
            db.run(
              `UPDATE youtube_credentials 
               SET client_id = ?, client_secret = ?, refresh_token = ?, 
                   channel_name = ?, channel_id = ?
               WHERE id = ?`,
              [clientId, clientSecret, refreshToken, channelName, channelId, existing.id],
              function(err) {
                if (err) {
                  reject(err);
                  return;
                }
                resolve({
                  id: existing.id,
                  userId,
                  clientId,
                  clientSecret,
                  refreshToken,
                  channelName,
                  channelId
                });
              }
            );
          } else {
            // Create new credentials
            this.create(userId, { clientId, clientSecret, refreshToken, channelName, channelId })
              .then(resolve)
              .catch(reject);
          }
        }
      );
    });
  }

  /**
   * Find all YouTube credentials for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of credentials
   */
  static async findAllByUserId(userId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT id, user_id, client_id, client_secret, refresh_token, 
                channel_name, channel_id, is_primary, created_at
         FROM youtube_credentials 
         WHERE user_id = ?
         ORDER BY is_primary DESC, created_at ASC`,
        [userId],
        (err, rows) => {
          if (err) {
            reject(err);
            return;
          }
          resolve((rows || []).map(row => ({
            id: row.id,
            userId: row.user_id,
            clientId: row.client_id,
            clientSecret: row.client_secret,
            refreshToken: row.refresh_token,
            channelName: row.channel_name,
            channelId: row.channel_id,
            isPrimary: row.is_primary === 1,
            createdAt: row.created_at
          })));
        }
      );
    });
  }

  /**
   * Find YouTube credentials by credential ID
   * @param {number} id - Credential ID
   * @returns {Promise<Object|null>} Credentials or null if not found
   */
  static async findById(id) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT id, user_id, client_id, client_secret, refresh_token, 
                channel_name, channel_id, is_primary, created_at
         FROM youtube_credentials 
         WHERE id = ?`,
        [id],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          if (!row) {
            resolve(null);
            return;
          }
          resolve({
            id: row.id,
            userId: row.user_id,
            clientId: row.client_id,
            clientSecret: row.client_secret,
            refreshToken: row.refresh_token,
            channelName: row.channel_name,
            channelId: row.channel_id,
            isPrimary: row.is_primary === 1,
            createdAt: row.created_at
          });
        }
      );
    });
  }

  /**
   * Find YouTube credentials by user ID (returns primary or first account)
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Credentials or null if not found
   */
  static async findByUserId(userId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT id, user_id, client_id, client_secret, refresh_token, 
                channel_name, channel_id, is_primary, created_at
         FROM youtube_credentials 
         WHERE user_id = ?
         ORDER BY is_primary DESC, created_at ASC
         LIMIT 1`,
        [userId],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          if (!row) {
            resolve(null);
            return;
          }
          resolve({
            id: row.id,
            userId: row.user_id,
            clientId: row.client_id,
            clientSecret: row.client_secret,
            refreshToken: row.refresh_token,
            channelName: row.channel_name,
            channelId: row.channel_id,
            isPrimary: row.is_primary === 1,
            createdAt: row.created_at
          });
        }
      );
    });
  }

  /**
   * Update existing credentials by ID
   * @param {number} id - Credential ID
   * @param {Object} data - Data to update
   * @returns {Promise<Object>} Updated credentials
   */
  static async update(id, { clientId, clientSecret, refreshToken, channelName, channelId }) {
    return new Promise((resolve, reject) => {
      const updates = [];
      const values = [];

      if (clientId !== undefined) {
        updates.push('client_id = ?');
        values.push(clientId);
      }
      if (clientSecret !== undefined) {
        updates.push('client_secret = ?');
        values.push(clientSecret);
      }
      if (refreshToken !== undefined) {
        updates.push('refresh_token = ?');
        values.push(refreshToken);
      }
      if (channelName !== undefined) {
        updates.push('channel_name = ?');
        values.push(channelName);
      }
      if (channelId !== undefined) {
        updates.push('channel_id = ?');
        values.push(channelId);
      }

      if (updates.length === 0) {
        resolve(this.findById(id));
        return;
      }

      values.push(id);

      db.run(
        `UPDATE youtube_credentials SET ${updates.join(', ')} WHERE id = ?`,
        values,
        function(err) {
          if (err) {
            reject(err);
            return;
          }
          YouTubeCredentials.findById(id).then(resolve).catch(reject);
        }
      );
    });
  }

  /**
   * Delete YouTube credentials by ID
   * @param {number} id - Credential ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  static async deleteById(id) {
    return new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM youtube_credentials WHERE id = ?',
        [id],
        function(err) {
          if (err) {
            reject(err);
            return;
          }
          resolve(this.changes > 0);
        }
      );
    });
  }

  /**
   * Delete all YouTube credentials for a user
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  static async delete(userId) {
    return new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM youtube_credentials WHERE user_id = ?',
        [userId],
        function(err) {
          if (err) {
            reject(err);
            return;
          }
          resolve(this.changes > 0);
        }
      );
    });
  }

  /**
   * Set a credential as primary for a user
   * @param {string} userId - User ID
   * @param {number} credentialId - Credential ID to set as primary
   * @returns {Promise<boolean>} True if successful
   */
  static async setPrimary(userId, credentialId) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        // First, unset all primary flags for this user
        db.run(
          'UPDATE youtube_credentials SET is_primary = 0 WHERE user_id = ?',
          [userId],
          (err) => {
            if (err) {
              reject(err);
              return;
            }
          }
        );

        // Then set the specified credential as primary
        db.run(
          'UPDATE youtube_credentials SET is_primary = 1 WHERE id = ? AND user_id = ?',
          [credentialId, userId],
          function(err) {
            if (err) {
              reject(err);
              return;
            }
            resolve(this.changes > 0);
          }
        );
      });
    });
  }

  /**
   * Get primary credential for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Primary credentials or null
   */
  static async getPrimary(userId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT id, user_id, client_id, client_secret, refresh_token, 
                channel_name, channel_id, is_primary, created_at
         FROM youtube_credentials 
         WHERE user_id = ? AND is_primary = 1`,
        [userId],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          if (!row) {
            // If no primary, return first account
            this.findByUserId(userId).then(resolve).catch(reject);
            return;
          }
          resolve({
            id: row.id,
            userId: row.user_id,
            clientId: row.client_id,
            clientSecret: row.client_secret,
            refreshToken: row.refresh_token,
            channelName: row.channel_name,
            channelId: row.channel_id,
            isPrimary: true,
            createdAt: row.created_at
          });
        }
      );
    });
  }

  /**
   * Check if a channel is already connected for a user
   * @param {string} userId - User ID
   * @param {string} channelId - YouTube Channel ID
   * @returns {Promise<boolean>} True if channel exists
   */
  static async existsByChannel(userId, channelId) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT 1 FROM youtube_credentials WHERE user_id = ? AND channel_id = ?',
        [userId, channelId],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(!!row);
        }
      );
    });
  }

  /**
   * Check if user has any YouTube credentials
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} True if credentials exist
   */
  static async exists(userId) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT 1 FROM youtube_credentials WHERE user_id = ?',
        [userId],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(!!row);
        }
      );
    });
  }

  /**
   * Count credentials for a user
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of credentials
   */
  static async count(userId) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT COUNT(*) as count FROM youtube_credentials WHERE user_id = ?',
        [userId],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(row ? row.count : 0);
        }
      );
    });
  }

  /**
   * Update channel name for a credential
   * @param {number} id - Credential ID
   * @param {string} channelName - New channel name
   * @returns {Promise<boolean>} True if updated
   */
  static async updateChannelName(id, channelName) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE youtube_credentials SET channel_name = ? WHERE id = ?',
        [channelName, id],
        function(err) {
          if (err) {
            reject(err);
            return;
          }
          resolve(this.changes > 0);
        }
      );
    });
  }

  /**
   * Refresh channel info from YouTube API and update database
   * @param {number} id - Credential ID
   * @param {Object} youtubeService - YouTube service instance
   * @returns {Promise<{success: boolean, channelName?: string, error?: string}>}
   */
  static async refreshChannelInfo(id, youtubeService) {
    try {
      const credentials = await this.findById(id);
      if (!credentials) {
        return { success: false, error: 'Credentials not found' };
      }

      // Try to get access token and channel info
      const accessToken = await youtubeService.getAccessTokenSafe(
        credentials.clientId,
        credentials.clientSecret,
        credentials.refreshToken
      );

      if (!accessToken) {
        return { success: false, error: 'Failed to get access token' };
      }

      const channelInfo = await youtubeService.getChannelInfo(accessToken);
      
      // Update channel name in database
      await this.updateChannelName(id, channelInfo.title);
      
      return { success: true, channelName: channelInfo.title };
    } catch (error) {
      console.error(`[YouTubeCredentials.refreshChannelInfo] Error for credential ${id}:`, error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = YouTubeCredentials;
