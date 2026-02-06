const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/streamflow.db');

console.log('Checking all relevant data...\n');

// Check youtube_broadcast_settings
db.all('SELECT * FROM youtube_broadcast_settings ORDER BY created_at DESC LIMIT 5', [], (err, rows) => {
  console.log('=== YOUTUBE BROADCAST SETTINGS ===');
  if (err) {
    console.log('Error:', err.message);
  } else if (rows.length === 0) {
    console.log('No data');
  } else {
    rows.forEach(r => {
      console.log(`Broadcast: ${r.broadcast_id}`);
      console.log(`  thumbnail_folder: ${r.thumbnail_folder}`);
      console.log(`  thumbnail_index: ${r.thumbnail_index}`);
      console.log(`  thumbnail_path: ${r.thumbnail_path}`);
      console.log('');
    });
  }
  
  // Check stream_key_folder_mapping
  db.all('SELECT * FROM stream_key_folder_mapping', [], (err, rows) => {
    console.log('\n=== STREAM KEY FOLDER MAPPING ===');
    if (err) {
      console.log('Error:', err.message);
    } else if (rows.length === 0) {
      console.log('No data - THIS IS THE PROBLEM!');
      console.log('Thumbnail index is not being saved for stream keys.');
    } else {
      rows.forEach(r => {
        console.log(`Stream Key: ${r.stream_key_id}`);
        console.log(`  folder_name: ${r.folder_name}`);
        console.log(`  thumbnail_index: ${r.thumbnail_index}`);
        console.log('');
      });
    }
    
    // Check broadcast_templates
    db.all('SELECT id, name, stream_id, thumbnail_folder, thumbnail_index FROM broadcast_templates LIMIT 5', [], (err, rows) => {
      console.log('\n=== BROADCAST TEMPLATES ===');
      if (err) {
        console.log('Error:', err.message);
      } else if (rows.length === 0) {
        console.log('No templates');
      } else {
        rows.forEach(r => {
          console.log(`Template: ${r.name}`);
          console.log(`  stream_id: ${r.stream_id}`);
          console.log(`  thumbnail_folder: ${r.thumbnail_folder}`);
          console.log(`  thumbnail_index: ${r.thumbnail_index}`);
          console.log('');
        });
      }
      
      db.close();
    });
  });
});
