const { db } = require('../db/database');
const User = require('../models/User');
const SystemSettings = require('../models/SystemSettings');

class LiveLimitService {
  /**
   * Check if user is admin
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} True if user is admin
   */
  static isAdmin(userId) {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT user_role FROM users WHERE id = ?",
        [userId],
        (err, row) => {
          if (err) {
            console.error('Error checking admin role:', err.message);
            return reject(err);
          }
          resolve(row && row.user_role === 'admin');
        }
      );
    });
  }

  /**
   * Get the effective live limit for a user
   * Returns unlimited (Infinity) for admin, custom limit if set, otherwise returns default limit
   * @param {string} userId - User ID
   * @returns {Promise<number>} Effective live limit
   */
  static async getEffectiveLimit(userId) {
    // Admin always has unlimited
    const isAdmin = await this.isAdmin(userId);
    if (isAdmin) {
      return Infinity;
    }

    const customLimit = await User.getLiveLimit(userId);
    if (customLimit !== null && customLimit > 0) {
      return customLimit;
    }
    return await SystemSettings.getDefaultLiveLimit();
  }

  /**
   * Count the number of active (live) streams for a user
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of active streams
   */
  static countActiveStreams(userId) {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT COUNT(*) as count FROM streams WHERE user_id = ? AND status = 'live'",
        [userId],
        (err, row) => {
          if (err) {
            console.error('Error counting active streams:', err.message);
            return reject(err);
          }
          resolve(row ? row.count : 0);
        }
      );
    });
  }

  /**
   * Check if a user can start a new stream
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} True if user can start a new stream
   */
  static async canStartStream(userId) {
    const limit = await this.getEffectiveLimit(userId);
    const activeCount = await this.countActiveStreams(userId);
    return activeCount < limit;
  }

  /**
   * Get full validation info for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Validation info object
   */
  static async validateAndGetInfo(userId) {
    const isAdmin = await this.isAdmin(userId);

    // Admin always has unlimited
    if (isAdmin) {
      const activeStreams = await this.countActiveStreams(userId);
      return {
        userId,
        effectiveLimit: Infinity,
        activeStreams,
        canStart: true,
        isCustomLimit: false,
        isAdmin: true,
        defaultLimit: await SystemSettings.getDefaultLiveLimit(),
        customLimit: null,
        message: null,
        displayLimit: 'Unlimited'
      };
    }

    const customLimit = await User.getLiveLimit(userId);
    const defaultLimit = await SystemSettings.getDefaultLiveLimit();
    const isCustomLimit = customLimit !== null && customLimit > 0;
    const effectiveLimit = isCustomLimit ? customLimit : defaultLimit;
    const activeStreams = await this.countActiveStreams(userId);
    const canStart = activeStreams < effectiveLimit;

    return {
      userId,
      effectiveLimit,
      activeStreams,
      canStart,
      isCustomLimit,
      isAdmin: false,
      defaultLimit,
      customLimit,
      message: canStart ? null : null,
      displayLimit: effectiveLimit.toString()
    };
  }
}

module.exports = LiveLimitService;
