const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/ozanglive.db');

console.log('Checking ozanglive.db...\n');

db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
  if (err) {
    console.log('Error:', err.message);
    db.close();
    return;
  }
  
  console.log('Tables:', tables.map(t => t.name).join(', '));
  
  // Check youtube_credentials
  db.all('SELECT * FROM youtube_credentials', [], (err, rows) => {
    if (err) {
      console.log('\nyoutube_credentials error:', err.message);
    } else {
      console.log('\nyoutube_credentials:', rows.length, 'records');
      rows.forEach(r => {
        console.log(`  - ${r.channel_name || r.id} (user: ${r.user_id})`);
      });
    }
    
    // Check users
    db.all('SELECT id, username FROM users', [], (err, rows) => {
      if (err) {
        console.log('\nusers error:', err.message);
      } else {
        console.log('\nusers:', rows.length, 'records');
        rows.forEach(r => {
          console.log(`  - ${r.username} (${r.id})`);
        });
      }
      
      db.close();
    });
  });
});
