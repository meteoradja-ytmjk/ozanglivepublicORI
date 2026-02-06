/**
 * Script untuk memperbaiki thumbnail_index di youtube_broadcast_settings
 * 
 * Masalah: thumbnail_index tidak di-set dengan benar sehingga NEXT selalu di #1
 * 
 * Script ini akan:
 * 1. Melihat semua broadcast settings yang ada
 * 2. Menghitung index berdasarkan thumbnail_path
 * 3. Update thumbnail_index dengan nilai yang benar
 * 
 * Cara pakai:
 * node scripts/fix-thumbnail-index.js
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

async function getOne(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
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

// Get thumbnails in a folder sorted alphabetically
function getThumbnailsInFolder(userId, folderName) {
  try {
    const basePath = path.join(__dirname, '..', 'public', 'uploads', 'thumbnails', userId);
    let targetPath = basePath;
    
    if (folderName && folderName.trim()) {
      targetPath = path.join(basePath, folderName);
    }
    
    if (!fs.existsSync(targetPath)) {
      return [];
    }
    
    const files = fs.readdirSync(targetPath)
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.jpg', '.jpeg', '.png'].includes(ext);
      })
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    
    return files.map((file, index) => ({
      filename: file,
      index: index,
      path: folderName && folderName.trim() 
        ? `/uploads/thumbnails/${userId}/${folderName}/${file}`
        : `/uploads/thumbnails/${userId}/${file}`
    }));
  } catch (e) {
    return [];
  }
}

async function main() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         FIX THUMBNAIL INDEX                                ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  
  try {
    // Get all broadcast settings with thumbnail info
    const settings = await getAll(`
      SELECT ybs.*, u.username
      FROM youtube_broadcast_settings ybs
      LEFT JOIN users u ON ybs.user_id = u.id
      WHERE ybs.thumbnail_folder IS NOT NULL
      ORDER BY ybs.user_id, ybs.created_at DESC
    `);
    
    console.log(`Found ${settings.length} broadcast settings with thumbnail folder`);
    console.log('');
    
    let updatedCount = 0;
    
    for (const setting of settings) {
      console.log(`─────────────────────────────────────────────────────────────`);
      console.log(`Broadcast: ${setting.broadcast_id}`);
      console.log(`User: ${setting.username || setting.user_id}`);
      console.log(`Folder: ${setting.thumbnail_folder === '' ? 'root' : setting.thumbnail_folder}`);
      console.log(`Current Index: ${setting.thumbnail_index || 0}`);
      console.log(`Thumbnail Path: ${setting.thumbnail_path || 'none'}`);
      
      if (!setting.thumbnail_path) {
        console.log(`  → No thumbnail path, skipping`);
        continue;
      }
      
      // Get thumbnails in folder
      const thumbnails = getThumbnailsInFolder(setting.user_id, setting.thumbnail_folder);
      console.log(`Thumbnails in folder: ${thumbnails.length}`);
      
      if (thumbnails.length === 0) {
        console.log(`  → No thumbnails found, skipping`);
        continue;
      }
      
      // Find index of the saved thumbnail
      const thumbIndex = thumbnails.findIndex(t => t.path === setting.thumbnail_path);
      
      if (thumbIndex >= 0) {
        console.log(`  Found thumbnail at index: ${thumbIndex}`);
        
        if (setting.thumbnail_index !== thumbIndex) {
          console.log(`  → UPDATING: ${setting.thumbnail_index} → ${thumbIndex}`);
          await runQuery(
            'UPDATE youtube_broadcast_settings SET thumbnail_index = ? WHERE broadcast_id = ?',
            [thumbIndex, setting.broadcast_id]
          );
          console.log(`  ✓ Updated!`);
          updatedCount++;
        } else {
          console.log(`  → Already correct`);
        }
      } else {
        console.log(`  → Thumbnail path not found in folder, skipping`);
      }
    }
    
    console.log('');
    console.log('═════════════════════════════════════════════════════════════');
    console.log(`Done! Updated ${updatedCount} broadcast settings.`);
    console.log('');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  process.exit(0);
}

setTimeout(main, 1000);
