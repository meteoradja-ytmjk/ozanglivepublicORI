const { v4: uuidv4 } = require('uuid');
const { db } = require('../db/database');

class TitleFolder {
  /**
   * Initialize title_folders table
   */
  static initTable() {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        // Create title_folders table
        db.run(`
          CREATE TABLE IF NOT EXISTS title_folders (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            color TEXT DEFAULT '#8B5CF6',
            sort_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, name)
          )
        `, (err) => {
          if (err) {
            console.error('Error creating title_folders table:', err.message);
            return reject(err);
          }
        });

        // Add folder_id column to title_suggestions if not exists
        db.run(`ALTER TABLE title_suggestions ADD COLUMN folder_id TEXT REFERENCES title_folders(id) ON DELETE SET NULL`, (err) => {
          // Ignore error if column already exists
          if (err && !err.message.includes('duplicate column')) {
            console.log('folder_id column may already exist');
          }
        });

        // Create index for faster queries
        db.run(`CREATE INDEX IF NOT EXISTS idx_title_folders_user ON title_folders(user_id)`, (err) => {
          if (err) {
            console.error('Error creating index:', err.message);
          }
          resolve();
        });
      });
    });
  }

  /**
   * Create a new folder
   */
  static create(data) {
    const id = uuidv4();
    const { user_id, name, color = '#8B5CF6' } = data;

    if (!user_id || !name) {
      return Promise.reject(new Error('user_id and name are required'));
    }

    return new Promise((resolve, reject) => {
      db.get(
        `SELECT MAX(sort_order) as max_order FROM title_folders WHERE user_id = ?`,
        [user_id],
        (err, row) => {
          if (err) return reject(err);
          
          const sortOrder = (row?.max_order || 0) + 1;
          
          db.run(
            `INSERT INTO title_folders (id, user_id, name, color, sort_order)
             VALUES (?, ?, ?, ?, ?)`,
            [id, user_id, name.trim(), color, sortOrder],
            function(err) {
              if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                  return reject(new Error('Folder name already exists'));
                }
                return reject(err);
              }
              resolve({ id, user_id, name: name.trim(), color, sort_order: sortOrder });
            }
          );
        }
      );
    });
  }

  /**
   * Get all folders for a user
   */
  static findByUserId(userId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT f.*, 
          (SELECT COUNT(*) FROM title_suggestions WHERE folder_id = f.id) as title_count
         FROM title_folders f
         WHERE f.user_id = ?
         ORDER BY f.sort_order ASC`,
        [userId],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        }
      );
    });
  }

  /**
   * Get folder by ID
   */
  static findById(id, userId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM title_folders WHERE id = ? AND user_id = ?`,
        [id, userId],
        (err, row) => {
          if (err) return reject(err);
          resolve(row);
        }
      );
    });
  }

  /**
   * Update folder
   */
  static update(id, userId, data) {
    const fields = [];
    const values = [];

    if (data.name) {
      fields.push('name = ?');
      values.push(data.name.trim());
    }
    if (data.color) {
      fields.push('color = ?');
      values.push(data.color);
    }

    if (fields.length === 0) {
      return Promise.resolve({ success: true, updated: false });
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id, userId);

    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE title_folders SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
        values,
        function(err) {
          if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
              return reject(new Error('Folder name already exists'));
            }
            return reject(err);
          }
          resolve({ success: true, updated: this.changes > 0 });
        }
      );
    });
  }

  /**
   * Delete folder (titles will have folder_id set to NULL)
   */
  static delete(id, userId) {
    return new Promise((resolve, reject) => {
      db.run(
        `DELETE FROM title_folders WHERE id = ? AND user_id = ?`,
        [id, userId],
        function(err) {
          if (err) return reject(err);
          resolve({ success: true, deleted: this.changes > 0 });
        }
      );
    });
  }
}

module.exports = TitleFolder;
