/**
 * Script untuk mengecek thumbnail_folder di template
 * Jalankan di VPS: node scripts/check-template-folder.js
 */

const { db } = require('../db/database');

async function getAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

async function check() {
  console.log('=== Cek Template Thumbnail Folder ===\n');
  
  try {
    // Cek semua template
    const templates = await getAll(`
      SELECT id, name, account_id, thumbnail_folder, recurring_enabled
      FROM broadcast_templates
    `);
    
    console.log('TEMPLATES:');
    console.log('-'.repeat(60));
    
    if (templates.length === 0) {
      console.log('Tidak ada template!');
    } else {
      templates.forEach(t => {
        const folder = t.thumbnail_folder === null ? 'NULL' : 
                       t.thumbnail_folder === '' ? '""(root)' : 
                       `"${t.thumbnail_folder}"`;
        console.log(`${t.name}`);
        console.log(`  ID: ${t.id}`);
        console.log(`  account_id: ${t.account_id}`);
        console.log(`  thumbnail_folder: ${folder}`);
        console.log(`  recurring: ${t.recurring_enabled ? 'YES' : 'NO'}`);
        console.log('');
      });
    }
    
    // Cek broadcast settings
    console.log('\nBROADCAST SETTINGS:');
    console.log('-'.repeat(60));
    
    const settings = await getAll(`
      SELECT broadcast_id, thumbnail_folder, template_id
      FROM youtube_broadcast_settings
      ORDER BY id DESC
      LIMIT 10
    `);
    
    if (settings.length === 0) {
      console.log('Tidak ada broadcast settings!');
    } else {
      settings.forEach(s => {
        const folder = s.thumbnail_folder === null ? 'NULL' : 
                       s.thumbnail_folder === '' ? '""(root)' : 
                       `"${s.thumbnail_folder}"`;
        console.log(`Broadcast: ${s.broadcast_id}`);
        console.log(`  thumbnail_folder: ${folder}`);
        console.log(`  template_id: ${s.template_id || 'none'}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  process.exit(0);
}

setTimeout(check, 1000);
