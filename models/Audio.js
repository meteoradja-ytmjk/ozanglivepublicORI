const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { db } = require('../db/database');

class Audio {
  static async create(data) {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const now = new Date().toISOString();
      db.run(
        `INSERT INTO audios (
          id, title, filepath, file_size, duration, format, user_id, 
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, data.title, data.filepath, data.file_size,
          data.duration, data.format, data.user_id,
          now, now
        ],
        function (err) {
          if (err) {
            console.error('Error creating audio:', err.message);
            return reject(err);
          }
          resolve({ id, ...data, created_at: now, updated_at: now });
        }
      );
    });
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM audios WHERE id = ?', [id], (err, row) => {
        if (err) {
          console.error('Error finding audio:', err.message);
          return reject(err);
        }
        resolve(row);
      });
    });
  }

  static findAll(userId = null) {
    return new Promise((resolve, reject) => {
      const query = userId ?
        'SELECT * FROM audios WHERE user_id = ? ORDER BY upload_date DESC' :
        'SELECT * FROM audios ORDER BY upload_date DESC';
      const params = userId ? [userId] : [];
      db.all(query, params, (err, rows) => {
        if (err) {
          console.error('Error finding audios:', err.message);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }

  static update(id, audioData) {
    const fields = [];
    const values = [];
    Object.entries(audioData).forEach(([key, value]) => {
      fields.push(`${key} = ?`);
      values.push(value);
    });
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    const query = `UPDATE audios SET ${fields.join(', ')} WHERE id = ?`;
    return new Promise((resolve, reject) => {
      db.run(query, values, function (err) {
        if (err) {
          console.error('Error updating audio:', err.message);
          return reject(err);
        }
        resolve({ id, ...audioData });
      });
    });
  }

  static delete(id) {
    return new Promise((resolve, reject) => {
      Audio.findById(id)
        .then(audio => {
          if (!audio) {
            return reject(new Error('Audio not found'));
          }
          db.run('DELETE FROM audios WHERE id = ?', [id], function (err) {
            if (err) {
              console.error('Error deleting audio from database:', err.message);
              return reject(err);
            }
            if (audio.filepath) {
              const fullPath = path.join(process.cwd(), 'public', audio.filepath);
              try {
                if (fs.existsSync(fullPath)) {
                  fs.unlinkSync(fullPath);
                }
              } catch (fileErr) {
                console.error('Error deleting audio file:', fileErr);
              }
            }
            resolve({ success: true, id });
          });
        })
        .catch(err => reject(err));
    });
  }
}

module.exports = Audio;
