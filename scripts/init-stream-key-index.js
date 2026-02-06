/**
 * Script untuk menginisialisasi thumbnail_index untuk semua stream key
 * 
 * Script ini akan:
 * 1. Melihat semua stream key yang sudah ada di stream_key_folder_mapping
 * 2. Menampilkan status thumbnail_index saat ini
 * 3. Opsi untuk set index awal yang berbeda untuk setiap stream key
 * 
 * Cara pakai:
 * 1. Lihat semua: node scripts/init-stream-key-index.js
 * 2. Set index: node scripts/init-stream-key-index.js set "STREAM_KEY_ID" INDEX
 * 3. Set semua ke 0: node scripts/init-stream-key-index.js reset
 * 
 * Contoh:
 * node scripts/init-stream-key-index.js set "xpaf-egck-zbh0-dm8p" 3
 */

const { db } = require('../db/database');
const fs = require('fs');
const path = require('path');

async function getAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

async function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
}

// Count thumbnails in a folder
function countThumbnailsInFolder(userId, folderName) {
  try {
    const basePath = path.join(__dirname, '..', 'public', 'uploads', 'thumbnails', userId);
    let targetPath = basePath;
    
    if (folderName && folderName.trim()) {
      targetPath = path.join(basePath, folderName);
    }
    
    if (!fs.existsSync(targetPath)) {
      return 0;
    }
    
    const files = fs.readdirSync(targetPath).filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png'].includes(ext);
    });
    
    return files.length;
  } catch (e) {
    return 0;
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         STREAM KEY THUMBNAIL INDEX MANAGER                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  
  try {
    // Get all stream key mappings
    const mappings = await getAll(`
      SELECT skfm.*, u.username
      FROM stream_key_folder_mapping skfm
      LEFT JOIN users u ON skfm.user_id = u.id
      ORDER BY skfm.user_id, skfm.stream_key_id
    `);
    
    console.log('STREAM KEY THUMBNAIL INDEX STATUS:');
    console.log('─'.repeat(90));
    
    if (mappings.length === 0) {
      console.log('  (tidak ada stream key mapping)');
      console.log('');
      console.log('  Stream key mapping akan dibuat otomatis saat:');
      console.log('  1. User mengikat stream key ke folder thumbnail');
      console.log('  2. Broadcast dibuat dengan stream key dan folder thumbnail');
      process.exit(0);
    }
    
    // Group by user
    const byUser = {};
    for (const m of mappings) {
      if (!byUser[m.user_id]) {
        byUser[m.user_id] = { username: m.username, mappings: [] };
      }
      byUser[m.user_id].mappings.push(m);
    }
    
    for (const userId of Object.keys(byUser)) {
      const user = byUser[userId];
      console.log(`\n  User: ${user.username || userId}`);
      console.log('  ' + '─'.repeat(85));
      
      for (const m of user.mappings) {
        const folder = m.folder_name === '' ? 'root' : m.folder_name;
        const thumbCount = countThumbnailsInFolder(userId, m.folder_name);
        const currentIndex = m.thumbnail_index || 0;
        const nextThumb = thumbCount > 0 ? (currentIndex % thumbCount) + 1 : '-';
        
        console.log(`  Stream Key: ${m.stream_key_id}`);
        console.log(`    Folder: ${folder} (${thumbCount} thumbnails)`);
        console.log(`    Current Index: ${currentIndex} → Next thumbnail: #${nextThumb}`);
        console.log(`    Updated: ${m.updated_at}`);
        console.log('');
      }
    }
    
    // Handle commands
    if (args[0] === 'set' && args.length >= 3) {
      const streamKeyId = args[1];
      const newIndex = parseInt(args[2]);
      
      if (isNaN(newIndex) || newIndex < 0) {
        console.log('❌ ERROR: Index harus berupa angka >= 0');
        process.exit(1);
      }
      
      console.log('─'.repeat(90));
      console.log(`SETTING: "${streamKeyId}" → index ${newIndex}`);
      
      const result = await runQuery(
        'UPDATE stream_key_folder_mapping SET thumbnail_index = ?, updated_at = CURRENT_TIMESTAMP WHERE stream_key_id = ?',
        [newIndex, streamKeyId]
      );
      
      if (result.changes > 0) {
        console.log(`✅ BERHASIL! Stream key "${streamKeyId}" sekarang index ${newIndex}`);
      } else {
        console.log(`❌ Stream key "${streamKeyId}" tidak ditemukan`);
      }
    } else if (args[0] === 'reset') {
      console.log('─'.repeat(90));
      console.log('RESETTING semua thumbnail_index ke 0...');
      
      const result = await runQuery(
        'UPDATE stream_key_folder_mapping SET thumbnail_index = 0, updated_at = CURRENT_TIMESTAMP'
      );
      
      console.log(`✅ BERHASIL! ${result.changes} stream key di-reset ke index 0`);
    } else if (args.length > 0 && args[0] !== 'set' && args[0] !== 'reset') {
      console.log('❌ ERROR: Command tidak dikenal');
      console.log('');
      console.log('CARA PAKAI:');
      console.log('  node scripts/init-stream-key-index.js              # Lihat semua');
      console.log('  node scripts/init-stream-key-index.js set "ID" N   # Set index');
      console.log('  node scripts/init-stream-key-index.js reset        # Reset semua ke 0');
    } else if (args.length === 0) {
      console.log('─'.repeat(90));
      console.log('CARA SET INDEX:');
      console.log('  node scripts/init-stream-key-index.js set "STREAM_KEY_ID" INDEX');
      console.log('');
      console.log('CONTOH:');
      if (mappings.length > 0) {
        console.log(`  node scripts/init-stream-key-index.js set "${mappings[0].stream_key_id}" 5`);
      }
      console.log('');
      console.log('RESET SEMUA KE 0:');
      console.log('  node scripts/init-stream-key-index.js reset');
    }
    
    console.log('');
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
  }
  
  process.exit(0);
}

setTimeout(main, 1000);
