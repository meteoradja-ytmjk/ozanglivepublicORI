const { db } = require('../db/database');

// Check title-related tables
db.all(
  `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%title%'`,
  [],
  (err, tables) => {
    if (err) {
      console.error('Error:', err.message);
      process.exit(1);
    }
    
    console.log('Title-related tables:', tables);
    
    // Check if title_suggestions table exists and has data
    db.all('SELECT COUNT(*) as count FROM title_suggestions', [], (err, result) => {
      if (err) {
        console.error('Error checking title_suggestions:', err.message);
      } else {
        console.log('\nTitle suggestions count:', result[0].count);
      }
      
      // Check users table
      db.all('SELECT id, username FROM users LIMIT 5', [], (err, users) => {
        if (err) {
          console.error('Error checking users:', err.message);
        } else {
          console.log('\nUsers:', users);
        }
        
        // Check title_folders table
        db.all('SELECT * FROM title_folders', [], (err, folders) => {
          if (err) {
            console.error('Error checking title_folders:', err.message);
          } else {
            console.log('\nTitle folders:', folders);
          }
          
          process.exit(0);
        });
      });
    });
  }
);
