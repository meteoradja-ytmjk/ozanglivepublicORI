const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/streamflow.db');

console.log('Checkpointing WAL...');

db.run('PRAGMA wal_checkpoint(FULL)', function(err) {
  if (err) {
    console.log('Error:', err.message);
  } else {
    console.log('Checkpoint complete');
  }
  
  // Now check data
  db.all('SELECT * FROM youtube_credentials', [], (err, rows) => {
    console.log('\nyoutube_credentials:', rows ? rows.length : 0, 'records');
    if (rows) {
      rows.forEach(r => {
        console.log(`  - ${r.channel_name || r.id} (user: ${r.user_id})`);
      });
    }
    
    db.all('SELECT id, username FROM users', [], (err, rows) => {
      console.log('\nusers:', rows ? rows.length : 0, 'records');
      if (rows) {
        rows.forEach(r => {
          console.log(`  - ${r.username} (${r.id})`);
        });
      }
      
      db.all('SELECT * FROM stream_key_folder_mapping', [], (err, rows) => {
        console.log('\nstream_key_folder_mapping:', rows ? rows.length : 0, 'records');
        if (rows) {
          rows.forEach(r => {
            console.log(`  - ${r.stream_key_id}: folder="${r.folder_name}", index=${r.thumbnail_index}`);
          });
        }
        
        db.close();
      });
    });
  });
});
