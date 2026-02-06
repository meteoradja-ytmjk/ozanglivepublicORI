/**
 * Script untuk memeriksa isi file backup JSON
 * Usage: node scripts/check-backup-file.js <path-to-backup.json>
 */

const fs = require('fs');
const path = require('path');

const backupPath = process.argv[2];

if (!backupPath) {
  console.log('Usage: node scripts/check-backup-file.js <path-to-backup.json>');
  process.exit(1);
}

try {
  const content = fs.readFileSync(backupPath, 'utf8');
  const backup = JSON.parse(content);
  
  console.log('=== Backup File Analysis ===\n');
  console.log('File:', backupPath);
  console.log('Size:', (content.length / 1024 / 1024).toFixed(2), 'MB');
  
  if (backup.metadata) {
    console.log('\nMetadata:');
    console.log('  Export Date:', backup.metadata.exportDate);
    console.log('  App Version:', backup.metadata.appVersion);
    console.log('  Export Type:', backup.metadata.exportType);
  }
  
  console.log('\n=== Categories Found ===');
  
  const categories = [
    'streams', 'youtube_credentials', 'broadcast_templates',
    'recurring_schedules', 'stream_templates', 'playlists',
    'title_folders', 'title_suggestions', 'thumbnail_files'
  ];
  
  categories.forEach(cat => {
    if (backup[cat]) {
      if (cat === 'thumbnail_files') {
        const tf = backup.thumbnail_files;
        console.log(`\n${cat}:`);
        console.log('  folders:', tf.folders ? tf.folders.length : 0);
        console.log('  files:', tf.files ? tf.files.length : 0);
        console.log('  template_folder_mapping:', tf.template_folder_mapping ? tf.template_folder_mapping.length : 0);
        
        if (tf.folders && tf.folders.length > 0) {
          console.log('\n  Folder details:');
          tf.folders.forEach(folder => {
            console.log('    Folder ID:', folder.folder_id);
            console.log('    Template:', folder.template_name || 'N/A');
            console.log('    Files:', folder.files ? folder.files.length : 0);
            if (folder.files) {
              folder.files.forEach(f => {
                const hasData = f.data && f.data.length > 0;
                console.log('      -', f.filename, hasData ? `(${f.data.length} chars)` : '(NO DATA!)');
              });
            }
          });
        }
        
        if (tf.files && tf.files.length > 0) {
          console.log('\n  Standalone files:');
          tf.files.forEach(f => {
            const hasData = f.data && f.data.length > 0;
            console.log('    -', f.filename, hasData ? `(${f.data.length} chars)` : '(NO DATA!)');
          });
        }
      } else if (Array.isArray(backup[cat])) {
        console.log(`${cat}: ${backup[cat].length} items`);
      } else {
        console.log(`${cat}: present (object)`);
      }
    }
  });
  
  console.log('\n=== Analysis Complete ===');
  
} catch (err) {
  console.error('Error reading backup file:', err.message);
}
