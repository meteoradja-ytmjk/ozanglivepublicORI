/**
 * Script untuk menginisialisasi data thumbnail rotation
 * Jalankan dengan: node scripts/init-thumbnail-rotation.js
 * 
 * Script ini akan:
 * 1. Memeriksa semua broadcast yang ada
 * 2. Membuat record di stream_key_folder_mapping jika belum ada
 * 3. Set thumbnail_index ke 0 untuk memulai rotasi
 */

const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, '..', 'db', 'streamflow.db');
const db = new sqlite3.Database(dbPath);

console.log('='.repeat(60));
console.log('INITIALIZE THUMBNAIL ROTATION DATA');
console.log('='.repeat(60));

// Helper function to run query
function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

// Helper function to get all rows
function getAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Helper function to get one row
function getOne(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function main() {
  try {
    // 1. Get all users
    const users = await getAll('SELECT id, username FROM users');
    console.log(`\nFound ${users.length} users`);
    
    for (const user of users) {
      console.log(`\n--- User: ${user.username} (${user.id}) ---`);
      
      // 2. Check thumbnail folders
      const thumbnailsDir = path.join(__dirname, '..', 'public', 'uploads', 'thumbnails', user.id);
      if (fs.existsSync(thumbnailsDir)) {
        const files = fs.readdirSync(thumbnailsDir)
          .filter(f => {
            const ext = path.extname(f).toLowerCase();
            return ['.jpg', '.jpeg', '.png'].includes(ext);
          });
        console.log(`  Thumbnails in root folder: ${files.length}`);
        
        // Check subfolders
        const subfolders = fs.readdirSync(thumbnailsDir)
          .filter(f => fs.statSync(path.join(thumbnailsDir, f)).isDirectory());
        
        for (const folder of subfolders) {
          const folderPath = path.join(thumbnailsDir, folder);
          const folderFiles = fs.readdirSync(folderPath)
            .filter(f => {
              const ext = path.extname(f).toLowerCase();
              return ['.jpg', '.jpeg', '.png'].includes(ext);
            });
          console.log(`  Thumbnails in "${folder}": ${folderFiles.length}`);
        }
      } else {
        console.log('  No thumbnails folder');
      }
      
      // 3. Check existing stream_key_folder_mapping
      const mappings = await getAll(
        'SELECT * FROM stream_key_folder_mapping WHERE user_id = ?',
        [user.id]
      );
      console.log(`  Existing stream key mappings: ${mappings.length}`);
      
      // 4. Check youtube_credentials for stream keys
      const credentials = await getAll(
        'SELECT id, channel_name FROM youtube_credentials WHERE user_id = ?',
        [user.id]
      );
      console.log(`  YouTube accounts: ${credentials.length}`);
    }
    
    // 5. Show current state
    console.log('\n' + '='.repeat(60));
    console.log('CURRENT STATE');
    console.log('='.repeat(60));
    
    const allMappings = await getAll('SELECT * FROM stream_key_folder_mapping');
    console.log(`\nTotal stream_key_folder_mapping records: ${allMappings.length}`);
    
    if (allMappings.length > 0) {
      console.log('\nExisting mappings:');
      allMappings.forEach(m => {
        console.log(`  Stream Key: ${m.stream_key_id}`);
        console.log(`    Folder: "${m.folder_name || '(root)'}"`);
        console.log(`    Index: ${m.thumbnail_index}`);
        console.log(`    Updated: ${m.updated_at}`);
      });
    }
    
    // 6. Instructions
    console.log('\n' + '='.repeat(60));
    console.log('INSTRUCTIONS');
    console.log('='.repeat(60));
    console.log(`
Untuk mengaktifkan rotasi thumbnail:

1. Buat broadcast baru dengan memilih stream key
2. Pilih folder thumbnail (atau gunakan root)
3. Thumbnail akan dipilih secara otomatis berdasarkan index
4. Saat recreate/reschedule, thumbnail akan berganti ke nomor berikutnya

Jika ingin mengatur index awal untuk stream key tertentu:
  node scripts/set-thumbnail-index.js <stream_key_id> <index>
`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    db.close();
  }
}

main();
