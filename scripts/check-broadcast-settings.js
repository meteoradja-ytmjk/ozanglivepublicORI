const {getDb} = require('../db/database');
const db = getDb();

db.all("SELECT * FROM youtube_broadcast_settings ORDER BY created_at DESC LIMIT 10", [], (err, rows) => {
  console.log('Broadcast Settings:', JSON.stringify(rows, null, 2));
  
  db.all("SELECT * FROM stream_key_folder_mapping", [], (err2, rows2) => {
    console.log('\nStream Key Folder Mapping:', JSON.stringify(rows2, null, 2));
    
    db.all("SELECT id, name, thumbnail_folder, thumbnail_index, thumbnail_path, pinned_thumbnail FROM broadcast_templates", [], (err3, rows3) => {
      console.log('\nBroadcast Templates (thumbnail info):', JSON.stringify(rows3, null, 2));
      process.exit(0);
    });
  });
});
