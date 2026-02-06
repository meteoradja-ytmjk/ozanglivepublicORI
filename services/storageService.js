const { db } = require('../db/database');

// Simple in-memory cache for storage limits
const storageLimitCache = new Map();
const CACHE_TTL = 60000; // 1 minute cache

class StorageService {
  /**
   * Calculate total storage usage for a user
   * @param {string} userId - User ID
   * @returns {Promise<{totalBytes: number, videoBytes: number, audioBytes: number}>}
   */
  static async calculateUsage(userId) {
    return new Promise((resolve, reject) => {
      // Use single query with UNION for better performance
      const query = `
        SELECT 
          COALESCE((SELECT SUM(file_size) FROM videos WHERE user_id = ?), 0) as videoBytes,
          COALESCE((SELECT SUM(file_size) FROM audios WHERE user_id = ?), 0) as audioBytes
      `;

      db.get(query, [userId, userId], (err, result) => {
        if (err) {
          console.error('Error calculating storage:', err.message);
          return reject(err);
        }

        const videoBytes = result?.videoBytes || 0;
        const audioBytes = result?.audioBytes || 0;
        const totalBytes = videoBytes + audioBytes;

        resolve({
          totalBytes,
          videoBytes,
          audioBytes
        });
      });
    });
  }

  /**
   * Format bytes to human-readable string
   * @param {number} bytes - Size in bytes
   * @returns {string} - Formatted string (e.g., "1.5 GB")
   */
  static formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    if (bytes === null || bytes === undefined) return 'Unlimited';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const value = parseFloat((bytes / Math.pow(k, i)).toFixed(2));

    return `${value} ${sizes[i]}`;
  }


  /**
   * Check if user can upload a file of given size
   * @param {string} userId - User ID
   * @param {number} fileSize - Size of file to upload in bytes
   * @returns {Promise<{allowed: boolean, currentUsage: number, limit: number|null, remaining: number|null}>}
   */
  static async canUpload(userId, fileSize) {
    const usage = await this.calculateUsage(userId);
    const limit = await this.getUserStorageLimit(userId);

    // If limit is null or 0, user has unlimited storage
    if (!limit || limit === 0) {
      return {
        allowed: true,
        currentUsage: usage.totalBytes,
        limit: null,
        remaining: null
      };
    }

    const remaining = limit - usage.totalBytes;
    const allowed = (usage.totalBytes + fileSize) <= limit;

    return {
      allowed,
      currentUsage: usage.totalBytes,
      limit,
      remaining: Math.max(0, remaining)
    };
  }

  /**
   * Get user's storage limit from database (with caching)
   * @param {string} userId - User ID
   * @returns {Promise<number|null>}
   */
  static async getUserStorageLimit(userId) {
    // Check cache first
    const cached = storageLimitCache.get(userId);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      return cached.limit;
    }

    return new Promise((resolve, reject) => {
      db.get('SELECT storage_limit FROM users WHERE id = ?', [userId], (err, row) => {
        if (err) {
          console.error('Error getting storage limit:', err.message);
          return reject(err);
        }
        const limit = row?.storage_limit || null;
        
        // Cache the result
        storageLimitCache.set(userId, { limit, timestamp: Date.now() });
        
        resolve(limit);
      });
    });
  }

  /**
   * Clear storage limit cache for a user
   * @param {string} userId - User ID
   */
  static clearCache(userId) {
    if (userId) {
      storageLimitCache.delete(userId);
    } else {
      storageLimitCache.clear();
    }
  }

  /**
   * Get storage info for display
   * @param {string} userId - User ID
   * @returns {Promise<Object>}
   */
  static async getStorageInfo(userId) {
    const usage = await this.calculateUsage(userId);
    const limit = await this.getUserStorageLimit(userId);

    let percentage = null;
    let status = 'normal';
    let remaining = null;

    if (limit && limit > 0) {
      percentage = Math.round((usage.totalBytes / limit) * 100);
      remaining = Math.max(0, limit - usage.totalBytes);

      if (percentage >= 100) {
        status = 'critical';
      } else if (percentage >= 80) {
        status = 'warning';
      }
    }

    return {
      userId,
      usage: {
        total: usage.totalBytes,
        videos: usage.videoBytes,
        audios: usage.audioBytes
      },
      limit,
      remaining,
      percentage,
      formatted: {
        usage: this.formatBytes(usage.totalBytes),
        limit: limit ? this.formatBytes(limit) : 'Unlimited',
        remaining: remaining !== null ? this.formatBytes(remaining) : 'Unlimited',
        videos: this.formatBytes(usage.videoBytes),
        audios: this.formatBytes(usage.audioBytes)
      },
      status
    };
  }

  /**
   * Get default storage limit from system settings
   * @returns {Promise<number|null>}
   */
  static async getDefaultStorageLimit() {
    return new Promise((resolve, reject) => {
      db.get('SELECT value FROM system_settings WHERE key = ?', ['default_storage_limit'], (err, row) => {
        if (err) {
          console.error('Error getting default storage limit:', err.message);
          return reject(err);
        }
        
        if (!row || row.value === 'null' || row.value === '') {
          return resolve(null);
        }
        
        const limit = parseInt(row.value, 10);
        resolve(isNaN(limit) ? null : limit);
      });
    });
  }

  /**
   * Set default storage limit in system settings
   * @param {number|null} limit - Default limit in bytes
   * @returns {Promise<void>}
   */
  static async setDefaultStorageLimit(limit) {
    return new Promise((resolve, reject) => {
      const value = limit === null || limit === 0 ? 'null' : String(limit);
      
      db.run(
        `INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)`,
        ['default_storage_limit', value],
        function(err) {
          if (err) {
            console.error('Error setting default storage limit:', err.message);
            return reject(err);
          }
          resolve();
        }
      );
    });
  }
}

module.exports = StorageService;
