/**
 * Migration script for Title Folders feature
 * Run this script to add folder support to title_suggestions table
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'db', 'streamflow.db');
const db = new sqlite3.Database(dbPath);

console.log('Starting Title Folders migration...');

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
      UNIQUE(user_id, name),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `, (err) => {
    if (err) {
      console.error('Error creating title_folders table:', err.message);
    } else {
      console.log('✓ title_folders table created/verified');
    }
  });

  // Add folder_id column to title_suggestions
  db.run(`ALTER TABLE title_suggestions ADD COLUMN folder_id TEXT REFERENCES title_folders(id) ON DELETE SET NULL`, (err) => {
    if (err) {
      if (err.message.includes('duplicate column')) {
        console.log('✓ folder_id column already exists');
      } else {
        console.error('Error adding folder_id column:', err.message);
      }
    } else {
      console.log('✓ folder_id column added to title_suggestions');
    }
  });

  // Create index for title_folders
  db.run(`CREATE INDEX IF NOT EXISTS idx_title_folders_user ON title_folders(user_id)`, (err) => {
    if (err) {
      console.error('Error creating index:', err.message);
    } else {
      console.log('✓ Index idx_title_folders_user created/verified');
    }
  });

  // Create index for folder_id in title_suggestions
  db.run(`CREATE INDEX IF NOT EXISTS idx_title_suggestions_folder ON title_suggestions(folder_id)`, (err) => {
    if (err) {
      console.error('Error creating folder index:', err.message);
    } else {
      console.log('✓ Index idx_title_suggestions_folder created/verified');
    }
  });
});

db.close((err) => {
  if (err) {
    console.error('Error closing database:', err.message);
  } else {
    console.log('\n✓ Title Folders migration completed successfully!');
    console.log('You can now use folders to organize your broadcast titles.');
  }
});
