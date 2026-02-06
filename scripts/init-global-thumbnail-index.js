/**
 * Script to initialize GLOBAL thumbnail index for a folder
 * 
 * Usage:
 *   node scripts/init-global-thumbnail-index.js <user_id> <folder_name> <index>
 * 
 * Example:
 *   node scripts/init-global-thumbnail-index.js 86ffd1bf-a5bd-42f6-8c8e-da1ca17a7979 italo 3
 *   (This sets NEXT thumbnail to #4, meaning #3 was the last used)
 */

const {getDb} = require('../db/database');

async function initGlobalIndex(userId, folderName, index) {
  const globalStreamKeyId = '__GLOBAL__' + (folderName || '');
  const db = getDb();
  
  return new Promise((resolve, reject) => {
    db.run(`
      INSERT INTO stream_key_folder_mapping (user_id, stream_key_id, folder_name, thumbnail_index, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, stream_key_id) DO UPDATE SET
        thumbnail_index = excluded.thumbnail_index,
        folder_name = excluded.folder_name,
        updated_at = CURRENT_TIMESTAMP
    `, [userId, globalStreamKeyId, folderName || '', index], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this.changes);
      }
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.log('Usage: node scripts/init-global-thumbnail-index.js <user_id> <folder_name> <index>');
    console.log('');
    console.log('Example:');
    console.log('  node scripts/init-global-thumbnail-index.js 86ffd1bf-a5bd-42f6-8c8e-da1ca17a7979 italo 3');
    console.log('  (This sets NEXT thumbnail to #4, meaning #3 was the last used)');
    process.exit(1);
  }
  
  const userId = args[0];
  const folderName = args[1] === '""' || args[1] === "''" ? '' : args[1];
  const index = parseInt(args[2]);
  
  if (isNaN(index) || index < 0) {
    console.error('Error: index must be a non-negative number');
    process.exit(1);
  }
  
  console.log(`Initializing GLOBAL thumbnail index:`);
  console.log(`  User ID: ${userId}`);
  console.log(`  Folder: ${folderName || '(root)'}`);
  console.log(`  Index: ${index}`);
  console.log(`  NEXT thumbnail will be: #${(index % 20) + 1}`);
  console.log('');
  
  try {
    await initGlobalIndex(userId, folderName, index);
    console.log('✅ GLOBAL thumbnail index initialized successfully!');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
  
  process.exit(0);
}

main();
