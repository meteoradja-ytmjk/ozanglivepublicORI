/**
 * Script untuk menguji thumbnail rotation
 * Jalankan dengan: node scripts/test-thumbnail-rotation.js
 */

const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'db', 'streamflow.db');
const db = new sqlite3.Database(dbPath);

const userId = '86ffd1bf-a5bd-42f6-8c8e-da1ca17a7979';
const streamKeyId = 'ea25a076-7c68-42cc-b1e6-0ca10f4edb4d'; // tes 05

console.log('='.repeat(60));
console.log('TEST THUMBNAIL ROTATION');
console.log('='.repeat(60));

// Get thumbnails in root folder
const thumbnailsDir = path.join(__dirname, '..', 'public', 'uploads', 'thumbnails', userId);
const thumbnails = fs.readdirSync(thumbnailsDir)
  .filter(f => {
    const ext = path.extname(f).toLowerCase();
    return ['.jpg', '.jpeg', '.png'].includes(ext);
  })
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

console.log(`\n📁 Thumbnails in root folder: ${thumbnails.length}`);
thumbnails.forEach((t, i) => console.log(`  ${i}: ${t}`));

// Get current index for stream key
db.get(`SELECT thumbnail_index, folder_name FROM stream_key_folder_mapping WHERE user_id = ? AND stream_key_id = ?`,
  [userId, streamKeyId], (err, row) => {
    if (err) {
      console.error('Error:', err.message);
      db.close();
      return;
    }
    
    const currentIndex = row ? row.thumbnail_index : 0;
    console.log(`\n📊 Current state for stream key "${streamKeyId}":`);
    console.log(`  Thumbnail Index: ${currentIndex}`);
    console.log(`  Folder: ${row?.folder_name || '(root)'}`);
    
    // Calculate which thumbnail would be selected
    const actualIndex = currentIndex % thumbnails.length;
    const selectedThumbnail = thumbnails[actualIndex];
    const nextIndex = currentIndex + 1;
    const nextActualIndex = nextIndex % thumbnails.length;
    const nextThumbnail = thumbnails[nextActualIndex];
    
    console.log(`\n🎯 Rotation simulation:`);
    console.log(`  Current index: ${currentIndex} (actual: ${actualIndex})`);
    console.log(`  Selected thumbnail: ${selectedThumbnail}`);
    console.log(`  Next index after use: ${nextIndex} (actual: ${nextActualIndex})`);
    console.log(`  Next thumbnail will be: ${nextThumbnail}`);
    
    // Simulate updating the index
    console.log(`\n🔄 Simulating broadcast creation...`);
    db.run(`UPDATE stream_key_folder_mapping SET thumbnail_index = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND stream_key_id = ?`,
      [nextIndex, userId, streamKeyId], function(err) {
        if (err) {
          console.error('Error updating:', err.message);
        } else {
          console.log(`  ✅ Updated thumbnail_index: ${currentIndex} -> ${nextIndex}`);
        }
        
        // Verify the update
        db.get(`SELECT thumbnail_index FROM stream_key_folder_mapping WHERE user_id = ? AND stream_key_id = ?`,
          [userId, streamKeyId], (err, newRow) => {
            if (err) {
              console.error('Error verifying:', err.message);
            } else {
              console.log(`  ✅ Verified new index: ${newRow.thumbnail_index}`);
              
              // Calculate next thumbnail
              const newActualIndex = newRow.thumbnail_index % thumbnails.length;
              console.log(`\n📌 Next broadcast will use:`);
              console.log(`  Index: ${newRow.thumbnail_index} (actual: ${newActualIndex})`);
              console.log(`  Thumbnail: ${thumbnails[newActualIndex]}`);
            }
            
            console.log('\n' + '='.repeat(60));
            console.log('TEST COMPLETE');
            console.log('='.repeat(60));
            
            db.close();
          });
      });
  });
