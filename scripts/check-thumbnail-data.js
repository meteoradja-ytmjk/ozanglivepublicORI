/**
 * Script untuk memeriksa data thumbnail_folder di database
 */

const { db } = require('../db/database');

async function checkData() {
  console.log('=== BROADCAST TEMPLATES ===\n');
  
  return new Promise((resolve, reject) => {
    db.all('SELECT id, name, thumbnail_folder, thumbnail_index, pinned_thumbnail, recurring_enabled FROM broadcast_templates', [], (err, rows) => {
      if (err) {
        console.error('Error:', err);
        return reject(err);
      }
      
      rows.forEach(r => {
        console.log('Template:', r.name);
        console.log('  thumbnail_folder:', r.thumbnail_folder === null ? 'NULL' : (r.thumbnail_folder === '' ? '"" (empty string/root)' : r.thumbnail_folder));
        console.log('  thumbnail_index:', r.thumbnail_index);
        console.log('  pinned_thumbnail:', r.pinned_thumbnail || 'NULL');
        console.log('  recurring_enabled:', r.recurring_enabled);
        console.log('');
      });
      
      console.log('\n=== RECENT BROADCAST SETTINGS ===\n');
      
      db.all('SELECT broadcast_id, thumbnail_folder, template_id FROM youtube_broadcast_settings ORDER BY created_at DESC LIMIT 10', [], (err2, rows2) => {
        if (err2) {
          console.error('Error:', err2);
          return reject(err2);
        }
        
        rows2.forEach(r => {
          console.log('Broadcast:', r.broadcast_id);
          console.log('  thumbnail_folder:', r.thumbnail_folder === null ? 'NULL' : (r.thumbnail_folder === '' ? '"" (empty string/root)' : r.thumbnail_folder));
          console.log('  template_id:', r.template_id || 'NULL');
          console.log('');
        });
        
        resolve();
      });
    });
  });
}

checkData()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
