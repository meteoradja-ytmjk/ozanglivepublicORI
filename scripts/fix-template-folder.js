/**
 * Script untuk meng-update thumbnail_folder di template
 * 
 * PENTING: Jalankan script ini di VPS untuk memperbaiki template!
 * 
 * Cara pakai:
 * 1. Lihat semua template: node scripts/fix-template-folder.js
 * 2. Update template: node scripts/fix-template-folder.js "NAMA_TEMPLATE" "NAMA_FOLDER"
 * 
 * Contoh:
 * node scripts/fix-template-folder.js "La Davina Melodia" "DAVINA"
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
  const args = process.argv.slice(2);
  
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         FIX TEMPLATE THUMBNAIL FOLDER                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  
  try {
    // Show all templates
    const templates = await getAll(`
      SELECT id, name, account_id, thumbnail_folder, recurring_enabled
      FROM broadcast_templates
    `);
    
    // Show all thumbnail folders
    const thumbnailDir = path.join(__dirname, '..', 'public', 'thumbnails');
    let folders = [];
    
    if (fs.existsSync(thumbnailDir)) {
      folders = fs.readdirSync(thumbnailDir)
        .filter(f => fs.statSync(path.join(thumbnailDir, f)).isDirectory());
    }
    
    console.log('FOLDER THUMBNAIL YANG TERSEDIA:');
    console.log('─'.repeat(40));
    if (folders.length === 0) {
      console.log('  (tidak ada folder)');
    } else {
      folders.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
    }
    console.log('');
    
    console.log('TEMPLATE SAAT INI:');
    console.log('─'.repeat(60));
    
    if (templates.length === 0) {
      console.log('  (tidak ada template)');
      process.exit(0);
    }
    
    templates.forEach((t, i) => {
      const folder = t.thumbnail_folder === null ? '❌ NULL (PERLU DISET!)' : 
                     t.thumbnail_folder === '' ? '⚠️  "" (kosong/root)' : 
                     `✅ "${t.thumbnail_folder}"`;
      console.log(`  ${i + 1}. ${t.name}`);
      console.log(`     thumbnail_folder: ${folder}`);
      console.log(`     recurring: ${t.recurring_enabled ? '🔄 YES' : '⏸️  NO'}`);
      console.log('');
    });
    
    // If arguments provided, update template
    if (args.length >= 2) {
      const templateName = args[0];
      const folderName = args[1];
      
      console.log('─'.repeat(60));
      console.log(`UPDATING: "${templateName}" → folder "${folderName}"`);
      
      const result = await runQuery(
        'UPDATE broadcast_templates SET thumbnail_folder = ? WHERE name = ?',
        [folderName, templateName]
      );
      
      if (result.changes > 0) {
        console.log(`✅ BERHASIL! Template "${templateName}" sekarang menggunakan folder "${folderName}"`);
        console.log('');
        console.log('LANGKAH SELANJUTNYA:');
        console.log('1. Restart aplikasi: pm2 restart streamflow');
        console.log('2. Clear browser cache: Ctrl+Shift+R');
        console.log('3. Test edit broadcast');
      } else {
        console.log(`❌ GAGAL! Template "${templateName}" tidak ditemukan`);
      }
    } else if (args.length === 1) {
      console.log('❌ ERROR: Butuh 2 parameter');
      console.log('   Contoh: node scripts/fix-template-folder.js "La Davina Melodia" "DAVINA"');
    } else {
      console.log('─'.repeat(60));
      console.log('CARA UPDATE TEMPLATE:');
      console.log('  node scripts/fix-template-folder.js "NAMA_TEMPLATE" "NAMA_FOLDER"');
      console.log('');
      console.log('CONTOH:');
      if (templates.length > 0 && folders.length > 0) {
        console.log(`  node scripts/fix-template-folder.js "${templates[0].name}" "${folders[0]}"`);
      } else {
        console.log('  node scripts/fix-template-folder.js "La Davina Melodia" "DAVINA"');
      }
    }
    
    console.log('');
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
  }
  
  process.exit(0);
}

setTimeout(main, 1000);
