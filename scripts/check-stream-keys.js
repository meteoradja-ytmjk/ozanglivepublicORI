/**
 * Script untuk memeriksa stream keys yang ada di database
 * Jalankan dengan: node scripts/check-stream-keys.js
 */

const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, '..', 'db', 'streamflow.db');
const db = new sqlite3.Database(dbPath);

console.log('='.repeat(60));
console.log('STREAM KEYS CHECK');
console.log('='.repeat(60));

// Check streams table
db.all(`SELECT id, title, stream_key, platform, user_id, status FROM streams ORDER BY created_at DESC`, [], (err, rows) => {
  if (err) {
    console.error('Error reading streams:', err.message);
  } else {
    console.log('\n📺 STREAMS:');
    console.log('-'.repeat(60));
    if (rows.length === 0) {
      console.log('  (No streams found)');
    } else {
      rows.forEach(row => {
        console.log(`  ID: ${row.id}`);
        console.log(`    Title: ${row.title}`);
        console.log(`    Stream Key: ${row.stream_key ? row.stream_key.substring(0, 20) + '...' : '(none)'}`);
        console.log(`    Platform: ${row.platform || '(none)'}`);
        console.log(`    User ID: ${row.user_id}`);
        console.log(`    Status: ${row.status}`);
        console.log('');
      });
    }
  }
  
  // Check youtube_credentials
  db.all(`SELECT id, user_id, channel_name, channel_id FROM youtube_credentials`, [], (err, creds) => {
    if (err) {
      console.error('Error reading youtube_credentials:', err.message);
    } else {
      console.log('\n🔑 YOUTUBE CREDENTIALS:');
      console.log('-'.repeat(60));
      if (creds.length === 0) {
        console.log('  (No credentials found)');
      } else {
        creds.forEach(c => {
          console.log(`  ID: ${c.id}`);
          console.log(`    User ID: ${c.user_id}`);
          console.log(`    Channel: ${c.channel_name || '(none)'}`);
          console.log(`    Channel ID: ${c.channel_id || '(none)'}`);
          console.log('');
        });
      }
    }
    
    // Check users
    db.all(`SELECT id, username FROM users`, [], (err, users) => {
      if (err) {
        console.error('Error reading users:', err.message);
      } else {
        console.log('\n👤 USERS:');
        console.log('-'.repeat(60));
        if (users.length === 0) {
          console.log('  (No users found)');
        } else {
          users.forEach(u => {
            console.log(`  ID: ${u.id}`);
            console.log(`    Username: ${u.username}`);
            console.log('');
          });
        }
      }
      
      console.log('='.repeat(60));
      console.log('CHECK COMPLETE');
      console.log('='.repeat(60));
      
      db.close();
    });
  });
});
