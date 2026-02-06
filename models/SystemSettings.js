const { db } = require('../db/database');

class SystemSettings {
  /**
   * Get a setting value by key
   * @param {string} key - Setting key
   * @returns {Promise<string|null>} Setting value or null if not found
   */
  static get(key) {
    return new Promise((resolve, reject) => {
      db.get('SELECT value FROM system_settings WHERE key = ?', [key], (err, row) => {
        if (err) {
          console.error('Error getting system setting:', err.message);
          return reject(err);
        }
        resolve(row ? row.value : null);
      });
    });
  }

  /**
   * Set a setting value
   * @param {string} key - Setting key
   * @param {string} value - Setting value
   * @returns {Promise<Object>} Result with key and value
   */
  static set(key, value) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO system_settings (key, value, updated_at) 
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP`,
        [key, value, value],
        function (err) {
          if (err) {
            console.error('Error setting system setting:', err.message);
            return reject(err);
          }
          resolve({ key, value });
        }
      );
    });
  }

  /**
   * Get the default live limit for all members
   * @returns {Promise<number>} Default live limit (1 if not configured)
   */
  static async getDefaultLiveLimit() {
    const value = await this.get('default_live_limit');
    if (value === null) {
      return 1; // Default value
    }
    const parsed = parseInt(value, 10);
    return isNaN(parsed) || parsed < 1 ? 1 : parsed;
  }

  /**
   * Set the default live limit for all members
   * @param {number} limit - Live limit value (must be >= 1)
   * @returns {Promise<Object>} Result with key and value
   */
  static async setDefaultLiveLimit(limit) {
    const validLimit = Math.max(1, parseInt(limit, 10) || 1);
    return this.set('default_live_limit', validLimit.toString());
  }

  /**
   * Get auto-approve registration setting
   * @returns {Promise<boolean>} True if auto-approve is enabled, false otherwise
   */
  static async getAutoApproveRegistration() {
    const value = await this.get('auto_approve_registration');
    return value === 'enabled';
  }

  /**
   * Set auto-approve registration setting
   * @param {boolean} enabled - Whether to enable auto-approve
   * @returns {Promise<Object>} Result with key and value
   */
  static async setAutoApproveRegistration(enabled) {
    return this.set('auto_approve_registration', enabled ? 'enabled' : 'disabled');
  }

  /**
   * Get default live limit for new user registrations
   * @returns {Promise<number>} Default live limit (0 = unlimited)
   */
  static async getDefaultLiveLimitForRegistration() {
    const value = await this.get('default_live_limit_registration');
    if (value === null) {
      return 0; // Default unlimited
    }
    const parsed = parseInt(value, 10);
    return isNaN(parsed) || parsed < 0 ? 0 : parsed;
  }

  /**
   * Set default live limit for new user registrations
   * @param {number} limit - Live limit value (0 = unlimited)
   * @returns {Promise<Object>} Result with key and value
   */
  static async setDefaultLiveLimitForRegistration(limit) {
    const validLimit = Math.max(0, parseInt(limit, 10) || 0);
    return this.set('default_live_limit_registration', validLimit.toString());
  }
}

module.exports = SystemSettings;
