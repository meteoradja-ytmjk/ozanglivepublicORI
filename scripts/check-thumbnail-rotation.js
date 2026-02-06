/**
 * Script untuk memeriksa data thumbnail rotation di database
 * Jalankan dengan: node scripts/check-thumbnail-rotation.js
 */

const path = require('path');
const fs = require('fs');

// Initialize database
const dbPath = path.join(__dirname, '..', 'db', 'streamflow.db');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(dbPath);

console.log('='.repeat(60));
console.log('THUMBNAIL ROTATION DATA CHECK');
console.log('='.repeat(60));

// Check stream_key_folder_mapping table
db.all(`SELECT * FROM stream_key_folder_mapping ORDER BY updated_at DESC`, [], (err, rows) => {
  if (err) {
    console.error('Error reading stream_key_folder_mapping:', err.message);
  } else {
    console.log('\n📁 STREAM KEY FOLDER MAPPING:');
    console.log('-'.repeat(60));
    if (rows.length === 0) {
      console.log('  (No data found)');
    } else {
      rows.forEach(row => {
        console.log(`  Stream Key: ${row.stream_key_id}`);
        console.log(`    User ID: ${row.user_id}`);
        console.log(`    Folder: "${row.folder_name || '(root)'}" `);
        console.log(`    Thumbnail Index: ${row.thumbnail_index}`);
        console.log(`    Updated: ${row.updated_at}`);
        console.log('');
      });
    }
  }
  
  // Check broadcast_templates table
  db.all(`SELECT id, name, stream_id, thumbnail_folder, thumbnail_index, stream_key_folder_mapping FROM broadcast_templates`, [], (err, templates) => {
    if (err) {
      console.error('Error reading broadcast_templates:', err.message);
    } else {
      console.log('\n📋 BROADCAST TEMPLATES:');
      console.log('-'.repeat(60));
      if (templates.length === 0) {
        console.log('  (No templates found)');
      } else {
        templates.forEach(t => {
          console.log(`  Template: ${t.name} (${t.id})`);
          console.log(`    Stream ID: ${t.stream_id || '(none)'}`);
          console.log(`    Thumbnail Folder: "${t.thumbnail_folder || '(root)'}"`);
          console.log(`    Thumbnail Index: ${t.thumbnail_index}`);
          if (t.stream_key_folder_mapping) {
            try {
              const mapping = JSON.parse(t.stream_key_folder_mapping);
              console.log(`    Stream Key Folder Mapping: ${JSON.stringify(mapping)}`);
            } catch (e) {
              console.log(`    Stream Key Folder Mapping: ${t.stream_key_folder_mapping}`);
            }
          }
          console.log('');
        });
      }
    }
    
    // Check youtube_broadcast_settings table
    db.all(`SELECT broadcast_id, thumbnail_folder, thumbnail_index, thumbnail_path FROM youtube_broadcast_settings ORDER BY created_at DESC LIMIT 10`, [], (err, settings) => {
      if (err) {
        console.error('Error reading youtube_broadcast_settings:', err.message);
      } else {
        console.log('\n📺 RECENT BROADCAST SETTINGS (last 10):');
        console.log('-'.repeat(60));
        if (settings.length === 0) {
          console.log('  (No settings found)');
        } else {
          settings.forEach(s => {
            console.log(`  Broadcast: ${s.broadcast_id}`);
            console.log(`    Thumbnail Folder: "${s.thumbnail_folder || '(none)'}"`);
            console.log(`    Thumbnail Index: ${s.thumbnail_index}`);
            console.log(`    Thumbnail Path: ${s.thumbnail_path || '(none)'}`);
            console.log('');
          });
        }
      }
      
      // Check thumbnail files
      const thumbnailsDir = path.join(__dirname, '..', 'public', 'uploads', 'thumbnails');
      console.log('\n🖼️ THUMBNAIL FILES:');
      console.log('-'.repeat(60));
      
      if (fs.existsSync(thumbnailsDir)) {
        const users = fs.readdirSync(thumbnailsDir);
        users.forEach(userId => {
          const userDir = path.join(thumbnailsDir, userId);
          if (fs.statSync(userDir).isDirectory()) {
            console.log(`  User: ${userId}`);
            
            // Root thumbnails
            const rootFiles = fs.readdirSync(userDir)
              .filter(f => {
                const ext = path.extname(f).toLowerCase();
                return ['.jpg', '.jpeg', '.png'].includes(ext);
              })
              .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
            
            if (rootFiles.length > 0) {
              console.log(`    Root folder: ${rootFiles.length} thumbnails`);
              rootFiles.forEach((f, i) => console.log(`      ${i}: ${f}`));
            }
            
            // Subfolders
            const subfolders = fs.readdirSync(userDir)
              .filter(f => fs.statSync(path.join(userDir, f)).isDirectory());
            
            subfolders.forEach(folder => {
              const folderPath = path.join(userDir, folder);
              const files = fs.readdirSync(folderPath)
                .filter(f => {
                  const ext = path.extname(f).toLowerCase();
                  return ['.jpg', '.jpeg', '.png'].includes(ext);
                })
                .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
              
              if (files.length > 0) {
                console.log(`    Folder "${folder}": ${files.length} thumbnails`);
                files.forEach((f, i) => console.log(`      ${i}: ${f}`));
              }
            });
            console.log('');
          }
        });
      } else {
        console.log('  (Thumbnails directory not found)');
      }
      
      console.log('='.repeat(60));
      console.log('CHECK COMPLETE');
      console.log('='.repeat(60));
      
      db.close();
    });
  });
});
