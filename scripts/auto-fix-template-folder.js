/**
 * Script untuk AUTO-FIX semua template yang memiliki thumbnail_folder = NULL
 * 
 * Script ini akan:
 * 1. Mencari semua template dengan thumbnail_folder = NULL
 * 2. Mengisi dengan folder pertama yang tersedia
 * 
 * Jalankan di VPS:
 * node scripts/auto-fix-template-folder.js
 */

const { db } = require('../db/database');
const fs = require('fs');
const path = require('path');

async function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
}

async function getAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

async function main() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     AUTO-FIX TEMPLATE THUMBNAIL FOLDER                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  
  try {
    // Get available folders
    const thumbnailDir = path.join(__dirname, '..', 'public', 'thumbnails');
    let folders = [];
    
    if (fs.existsSync(thumbnailDir)) {
      folders = fs.readdirSync(thumbnailDir)
        .filter(f => fs.statSync(path.join(thumbnailDir, f)).isDirectory());
    }
    
    console.log('FOLDER TERSEDIA:');
    console.log('─'.repeat(40));
    if (folders.length === 0) {
      console.log('❌ Tidak ada folder thumbnail!');
      console.log('   Buat folder dulu di public/thumbnails/');
      process.exit(1);
    }
    folders.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
    console.log('');
    
    // Get templates with NULL thumbnail_folder
    const templates = await getAll(`
      SELECT id, name, thumbnail_folder
      FROM broadcast_templates
      WHERE thumbnail_folder IS NULL OR thumbnail_folder = ''
    `);
    
    console.log('TEMPLATE YANG PERLU DIPERBAIKI:');
    console.log('─'.repeat(40));
    
    if (templates.length === 0) {
      console.log('✅ Semua template sudah memiliki thumbnail_folder!');
      process.exit(0);
    }
    
    templates.forEach((t, i) => {
      console.log(`  ${i + 1}. ${t.name} (thumbnail_folder: ${t.thumbnail_folder === null ? 'NULL' : '""'})`);
    });
    console.log('');
    
    // Fix all templates - use first folder
    const firstFolder = folders[0];
    console.log(`MEMPERBAIKI dengan folder: "${firstFolder}"`);
    console.log('─'.repeat(40));
    
    let fixed = 0;
    for (const template of templates) {
      const result = await runQuery(
        'UPDATE broadcast_templates SET thumbnail_folder = ? WHERE id = ?',
        [firstFolder, template.id]
      );
      if (result.changes > 0) {
        console.log(`  ✅ ${template.name} → "${firstFolder}"`);
        fixed++;
      }
    }
    
    console.log('');
    console.log('═'.repeat(40));
    console.log(`SELESAI! ${fixed} template diperbaiki.`);
    console.log('');
    console.log('LANGKAH SELANJUTNYA:');
    console.log('1. pm2 restart streamflow');
    console.log('2. Clear browser cache (Ctrl+Shift+R)');
    console.log('3. Test edit broadcast');
    console.log('');
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
  }
  
  process.exit(0);
}

setTimeout(main, 1000);
