const { v4: uuidv4 } = require('uuid');
const { db } = require('../db/database');

class StreamTemplate {
  /**
   * Create a new stream template
   * @param {Object} templateData - Template data
   * @returns {Promise<Object>} Created template
   */
  static create(templateData) {
    const id = uuidv4();
    const {
      user_id,
      name,
      video_id = null,
      audio_id = null,
      duration_hours = 0,
      duration_minutes = 0,
      loop_video = true,
      schedule_type = 'once',
      recurring_time = null,
      schedule_days = null
    } = templateData;

    const loop_video_int = loop_video ? 1 : 0;
    const schedule_days_json = schedule_days ? JSON.stringify(schedule_days) : null;

    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO stream_templates (
          id, user_id, name, video_id, audio_id,
          duration_hours, duration_minutes, loop_video,
          schedule_type, recurring_time, schedule_days
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, user_id, name, video_id, audio_id,
          duration_hours, duration_minutes, loop_video_int,
          schedule_type, recurring_time, schedule_days_json
        ],
        function (err) {
          if (err) {
            console.error('Error creating stream template:', err.message);
            return reject(err);
          }
          resolve({
            id,
            user_id,
            name,
            video_id,
            audio_id,
            duration_hours,
            duration_minutes,
            loop_video,
            schedule_type,
            recurring_time,
            schedule_days,
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
        `SELECT st.*,
                v.title AS video_title,
                a.title AS audio_title
         FROM stream_templates st
         LEFT JOIN videos v ON st.video_id = v.id
         LEFT JOIN audios a ON st.audio_id = a.id
         WHERE st.id = ?`,
        [id],
        (err, row) => {
          if (err) {
            console.error('Error finding stream template:', err.message);
            return reject(err);
          }
          if (row) {
            row.loop_video = row.loop_video === 1;
            if (row.schedule_days) {
              try {
                row.schedule_days = JSON.parse(row.schedule_days);
              } catch (e) {
                row.schedule_days = [];
              }
            }
          }
          resolve(row);
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
        `SELECT st.*,
                v.title AS video_title,
                a.title AS audio_title
         FROM stream_templates st
         LEFT JOIN videos v ON st.video_id = v.id
         LEFT JOIN audios a ON st.audio_id = a.id
         WHERE st.user_id = ?
         ORDER BY st.created_at DESC`,
        [userId],
        (err, rows) => {
          if (err) {
            console.error('Error finding stream templates:', err.message);
            return reject(err);
          }
          if (rows) {
            rows.forEach(row => {
              row.loop_video = row.loop_video === 1;
              if (row.schedule_days) {
                try {
                  row.schedule_days = JSON.parse(row.schedule_days);
                } catch (e) {
                  row.schedule_days = [];
                }
              }
            });
          }
          resolve(rows || []);
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
        `SELECT * FROM stream_templates WHERE user_id = ? AND name = ?`,
        [userId, name],
        (err, row) => {
          if (err) {
            console.error('Error finding stream template by name:', err.message);
            return reject(err);
          }
          if (row) {
            row.loop_video = row.loop_video === 1;
            if (row.schedule_days) {
              try {
                row.schedule_days = JSON.parse(row.schedule_days);
              } catch (e) {
                row.schedule_days = [];
              }
            }
          }
          resolve(row);
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
      if (key === 'loop_video' && typeof value === 'boolean') {
        fields.push(`${key} = ?`);
        values.push(value ? 1 : 0);
      } else if (key === 'schedule_days' && Array.isArray(value)) {
        fields.push(`${key} = ?`);
        values.push(JSON.stringify(value));
      } else if (key !== 'id' && key !== 'user_id' && key !== 'created_at') {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const query = `UPDATE stream_templates SET ${fields.join(', ')} WHERE id = ?`;

    return new Promise((resolve, reject) => {
      db.run(query, values, function (err) {
        if (err) {
          console.error('Error updating stream template:', err.message);
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
        'DELETE FROM stream_templates WHERE id = ? AND user_id = ?',
        [id, userId],
        function (err) {
          if (err) {
            console.error('Error deleting stream template:', err.message);
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
      let query = 'SELECT COUNT(*) as count FROM stream_templates WHERE user_id = ? AND name = ?';
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
}

module.exports = StreamTemplate;
