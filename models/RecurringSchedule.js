const { v4: uuidv4 } = require('uuid');
const { db } = require('../db/database');

class RecurringSchedule {
  /**
   * Create a new recurring schedule
   * @param {Object} scheduleData - Schedule data
   * @returns {Promise<Object>} Created schedule
   */
  static async create(scheduleData) {
    const id = uuidv4();
    let {
      user_id,
      account_id,
      name,
      pattern,
      schedule_time,
      days_of_week = null,
      template_id = null,
      title_template = null,
      description = null,
      privacy_status = 'unlisted',
      tags = null,
      category_id = '20',
      is_active = 1,
      next_run_at = null
    } = scheduleData;

    // Validate required fields
    if (!user_id || !account_id || !name || !pattern || !schedule_time) {
      return Promise.reject(new Error('Missing required fields'));
    }

    // If template_id is provided, fetch template data for title_template
    if (template_id && !title_template) {
      const template = await RecurringSchedule.getTemplateById(template_id);
      if (template) {
        title_template = template.title || 'Broadcast {date}';
        if (!description) description = template.description;
        if (!privacy_status || privacy_status === 'unlisted') privacy_status = template.privacy_status || 'unlisted';
        if (!tags) tags = template.tags;
        if (!category_id || category_id === '20') category_id = template.category_id || '20';
      } else {
        title_template = 'Broadcast {date}'; // Default fallback
      }
    }

    // Must have title_template at this point
    if (!title_template) {
      return Promise.reject(new Error('Either template_id or title_template is required'));
    }

    // Validate pattern
    if (!['daily', 'weekly'].includes(pattern)) {
      return Promise.reject(new Error('Pattern must be daily or weekly'));
    }

    // Validate weekly schedule has days selected
    if (pattern === 'weekly') {
      const days = days_of_week ? (typeof days_of_week === 'string' ? JSON.parse(days_of_week) : days_of_week) : [];
      if (!Array.isArray(days) || days.length === 0) {
        return Promise.reject(new Error('Weekly schedule requires at least one day selected'));
      }
    }

    const tagsJson = Array.isArray(tags) ? JSON.stringify(tags) : tags;
    const daysJson = Array.isArray(days_of_week) ? JSON.stringify(days_of_week) : days_of_week;

    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO recurring_schedules (
          id, user_id, account_id, name, pattern, schedule_time, days_of_week,
          template_id, title_template, description, privacy_status, tags, category_id,
          is_active, next_run_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, user_id, account_id, name, pattern, schedule_time, daysJson,
          template_id, title_template, description, privacy_status, tagsJson, category_id,
          is_active ? 1 : 0, next_run_at
        ],
        function (err) {
          if (err) {
            console.error('Error creating recurring schedule:', err.message);
            return reject(err);
          }
          resolve({
            id, user_id, account_id, name, pattern, schedule_time,
            days_of_week: daysJson ? JSON.parse(daysJson) : null,
            template_id, title_template, description, privacy_status,
            tags: tagsJson ? JSON.parse(tagsJson) : null,
            category_id, is_active: !!is_active, next_run_at,
            created_at: new Date().toISOString()
          });
        }
      );
    });
  }


  /**
   * Find schedule by ID
   * @param {string} id - Schedule ID
   * @returns {Promise<Object|null>} Schedule or null
   */
  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT rs.*, yc.channel_name, bt.name as template_name
         FROM recurring_schedules rs
         LEFT JOIN youtube_credentials yc ON rs.account_id = yc.id
         LEFT JOIN broadcast_templates bt ON rs.template_id = bt.id
         WHERE rs.id = ?`,
        [id],
        (err, row) => {
          if (err) {
            console.error('Error finding recurring schedule:', err.message);
            return reject(err);
          }
          if (row) {
            row = RecurringSchedule.parseRow(row);
          }
          resolve(row || null);
        }
      );
    });
  }

  /**
   * Find all schedules for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of schedules
   */
  static findByUserId(userId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT rs.*, yc.channel_name, bt.name as template_name
         FROM recurring_schedules rs
         LEFT JOIN youtube_credentials yc ON rs.account_id = yc.id
         LEFT JOIN broadcast_templates bt ON rs.template_id = bt.id
         WHERE rs.user_id = ?
         ORDER BY rs.created_at DESC`,
        [userId],
        (err, rows) => {
          if (err) {
            console.error('Error finding recurring schedules:', err.message);
            return reject(err);
          }
          resolve((rows || []).map(row => RecurringSchedule.parseRow(row)));
        }
      );
    });
  }

  /**
   * Find all active schedules
   * @returns {Promise<Array>} Array of active schedules
   */
  static findActiveSchedules() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT rs.*, yc.channel_name, yc.client_id, yc.client_secret, yc.refresh_token,
                bt.name as template_name, bt.title as bt_title, 
                bt.description as bt_description, bt.privacy_status as bt_privacy_status,
                bt.tags as bt_tags, bt.category_id as bt_category_id, bt.stream_id as bt_stream_id
         FROM recurring_schedules rs
         LEFT JOIN youtube_credentials yc ON rs.account_id = yc.id
         LEFT JOIN broadcast_templates bt ON rs.template_id = bt.id
         WHERE rs.is_active = 1`,
        [],
        (err, rows) => {
          if (err) {
            console.error('Error finding active schedules:', err.message);
            return reject(err);
          }
          resolve((rows || []).map(row => RecurringSchedule.parseRow(row)));
        }
      );
    });
  }

  /**
   * Update a schedule
   * @param {string} id - Schedule ID
   * @param {Object} scheduleData - Updated schedule data
   * @returns {Promise<Object>} Updated schedule
   */
  static update(id, scheduleData) {
    const fields = [];
    const values = [];

    // Validate weekly schedule if pattern is being updated
    if (scheduleData.pattern === 'weekly') {
      const days = scheduleData.days_of_week;
      const daysArray = Array.isArray(days) ? days : (days ? JSON.parse(days) : []);
      if (daysArray.length === 0) {
        return Promise.reject(new Error('Weekly schedule requires at least one day selected'));
      }
    }

    Object.entries(scheduleData).forEach(([key, value]) => {
      if (key === 'tags' && Array.isArray(value)) {
        fields.push(`${key} = ?`);
        values.push(JSON.stringify(value));
      } else if (key === 'days_of_week' && Array.isArray(value)) {
        fields.push(`${key} = ?`);
        values.push(JSON.stringify(value));
      } else if (key === 'is_active') {
        fields.push(`${key} = ?`);
        values.push(value ? 1 : 0);
      } else if (key !== 'id' && key !== 'user_id' && key !== 'created_at') {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const query = `UPDATE recurring_schedules SET ${fields.join(', ')} WHERE id = ?`;

    return new Promise((resolve, reject) => {
      db.run(query, values, function (err) {
        if (err) {
          console.error('Error updating recurring schedule:', err.message);
          return reject(err);
        }
        resolve({ id, ...scheduleData, updated: this.changes > 0 });
      });
    });
  }

  /**
   * Delete a schedule
   * @param {string} id - Schedule ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Deletion result
   */
  static delete(id, userId) {
    return new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM recurring_schedules WHERE id = ? AND user_id = ?',
        [id, userId],
        function (err) {
          if (err) {
            console.error('Error deleting recurring schedule:', err.message);
            return reject(err);
          }
          resolve({ success: true, deleted: this.changes > 0 });
        }
      );
    });
  }

  /**
   * Update last run timestamp
   * @param {string} id - Schedule ID
   * @param {string} lastRunAt - Last run timestamp
   * @param {string} nextRunAt - Next run timestamp
   * @returns {Promise<Object>} Update result
   */
  static updateLastRun(id, lastRunAt, nextRunAt) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE recurring_schedules 
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
   * Toggle schedule active status
   * @param {string} id - Schedule ID
   * @param {boolean} isActive - New active status
   * @returns {Promise<Object>} Update result
   */
  static toggleActive(id, isActive) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE recurring_schedules 
         SET is_active = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [isActive ? 1 : 0, id],
        function (err) {
          if (err) {
            console.error('Error toggling schedule:', err.message);
            return reject(err);
          }
          resolve({ success: true, updated: this.changes > 0, is_active: isActive });
        }
      );
    });
  }

  /**
   * Parse database row to proper object format
   * @param {Object} row - Database row
   * @returns {Object} Parsed schedule object
   */
  static parseRow(row) {
    if (!row) return null;
    
    if (row.tags) {
      try { row.tags = JSON.parse(row.tags); } catch (e) { row.tags = []; }
    }
    if (row.days_of_week) {
      try { row.days_of_week = JSON.parse(row.days_of_week); } catch (e) { row.days_of_week = []; }
    }
    // Parse bt_tags from joined broadcast_templates
    if (row.bt_tags && typeof row.bt_tags === 'string') {
      try { row.bt_tags = JSON.parse(row.bt_tags); } catch (e) { row.bt_tags = []; }
    }
    row.is_active = !!row.is_active;
    
    return row;
  }

  /**
   * Get template by ID (helper for fetching template data)
   * @param {string} templateId - Template ID
   * @returns {Promise<Object|null>} Template or null
   */
  static getTemplateById(templateId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM broadcast_templates WHERE id = ?`,
        [templateId],
        (err, row) => {
          if (err) {
            console.error('Error fetching template:', err.message);
            return resolve(null); // Don't reject, just return null
          }
          if (row && row.tags) {
            try { row.tags = JSON.parse(row.tags); } catch (e) { row.tags = []; }
          }
          resolve(row || null);
        }
      );
    });
  }
}

module.exports = RecurringSchedule;
