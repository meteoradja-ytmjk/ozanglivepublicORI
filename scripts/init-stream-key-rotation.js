/**
 * Script untuk menginisialisasi data thumbnail rotation untuk stream keys yang ada
 * Jalankan dengan: node scripts/init-stream-key-rotation.js
 */

const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, '..', 'db', 'streamflow.db');
const db = new sqlite3.Database(dbPath);

console.log('='.repeat(60));
console.log('INITIALIZE STREAM KEY THUMBNAIL ROTATION');
console.log('='.repeat(60));

// Get all streams
db.all(`SELECT id, title, user_id FROM streams`, [], (err, streams) => {
  if (err) {
    console.error('Error reading streams:', err.message);
    db.close();
    return;
  }
  
  console.log(`\nFound ${streams.length} streams`);
  
  if (streams.length === 0) {
    console.log('No streams to initialize');
    db.close();
    return;
  }
  
  let initialized = 0;
  let skipped = 0;
  
  const processStream = (index) => {
    if (index >= streams.length) {
      console.log('\n' + '='.repeat(60));
      console.log(`COMPLETE: Initialized ${initialized}, Skipped ${skipped}`);
      console.log('='.repeat(60));
      db.close();
      return;
    }
    
    const stream = streams[index];
    
    // Check if mapping already exists
    db.get(`SELECT * FROM stream_key_folder_mapping WHERE user_id = ? AND stream_key_id = ?`,
      [stream.user_id, stream.id], (err, existing) => {
        if (err) {
          console.error(`Error checking stream ${stream.id}:`, err.message);
          processStream(index + 1);
          return;
        }
        
        if (existing) {
          console.log(`  [SKIP] Stream "${stream.title}" (${stream.id}) - already has mapping`);
          skipped++;
          processStream(index + 1);
          return;
        }
        
        // Initialize with index 0 and root folder
        db.run(`INSERT INTO stream_key_folder_mapping (user_id, stream_key_id, folder_name, thumbnail_index, updated_at)
                VALUES (?, ?, '', 0, CURRENT_TIMESTAMP)`,
          [stream.user_id, stream.id], function(err) {
            if (err) {
              console.error(`Error initializing stream ${stream.id}:`, err.message);
            } else {
              console.log(`  [INIT] Stream "${stream.title}" (${stream.id}) -> index 0, folder: root`);
              initialized++;
            }
            processStream(index + 1);
          });
      });
  };
  
  processStream(0);
});
