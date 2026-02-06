/**
 * Script to fix GLOBAL thumbnail index
 * 
 * This script helps fix the GLOBAL thumbnail index when it's out of sync.
 * 
 * Usage:
 *   node scripts/fix-global-thumbnail-index.js                    # List all indexes
 *   node scripts/fix-global-thumbnail-index.js <folder> <index>   # Set index for folder
 * 
 * Examples:
 *   node scripts/fix-global-thumbnail-index.js italo 3
 *   node scripts/fix-global-thumbnail-index.js "" 0  (for root folder)
 * 
 * Note: The index is the NEXT thumbnail to use (0-based).
 * If you want NEXT to be thumbnail #4, set index to 3.
 */

const { db, getDb } = require('../db/database');

async function listAllIndexes() {
  return new Promise((resolve, reject) => {
    const database = getDb();
    database.all(
      `SELECT user_id, stream_key_id, folder_name, thumbnail_index, updated_at 
       FROM stream_key_folder_mapping 
       ORDER BY user_id, stream_key_id`,
      [],
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      }
    );
  });
}

async function getUsers() {
  return new Promise((resolve, reject) => {
    const database = getDb();
    database.all(`SELECT id, username FROM users`, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

async function updateGlobalIndex(userId, folderName, newIndex) {
  const globalStreamKeyId = '__GLOBAL__' + (folderName || '');
  return new Promise((resolve, reject) => {
    const database = getDb();
    database.run(
      `INSERT INTO stream_key_folder_mapping (user_id, stream_key_id, folder_name, thumbnail_index, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id, stream_key_id) DO UPDATE SET
         thumbnail_index = excluded.thumbnail_index,
         folder_name = excluded.folder_name,
         updated_at = CURRENT_TIMESTAMP`,
      [userId, globalStreamKeyId, folderName || '', newIndex],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      }
    );
  });
}

async function main() {
  const args = process.argv.slice(2);
  
  console.log('=== Thumbnail Index Manager ===\n');
  
  // Get users
  const users = await getUsers();
  console.log('Users:', users.map(u => `${u.username} (${u.id})`).join(', '));
  console.log('');
  
  // List all indexes
  const indexes = await listAllIndexes();
  
  if (indexes.length === 0) {
    console.log('No thumbnail indexes found in database.');
  } else {
    console.log('Current thumbnail indexes:');
    console.log('-'.repeat(80));
    
    // Group by type (GLOBAL vs per-stream-key)
    const globalIndexes = indexes.filter(r => r.stream_key_id.startsWith('__GLOBAL__'));
    const streamKeyIndexes = indexes.filter(r => !r.stream_key_id.startsWith('__GLOBAL__'));
    
    if (globalIndexes.length > 0) {
      console.log('\n📁 GLOBAL Indexes (shared across all stream keys):');
      for (const row of globalIndexes) {
        const folderDisplay = row.folder_name || '(root)';
        console.log(`  Folder: ${folderDisplay}`);
        console.log(`    Index: ${row.thumbnail_index} → NEXT will be thumbnail #${(row.thumbnail_index % 20) + 1}`);
        console.log(`    Updated: ${row.updated_at}`);
      }
    }
    
    if (streamKeyIndexes.length > 0) {
      console.log('\n🔑 Per-Stream-Key Indexes (legacy):');
      for (const row of streamKeyIndexes) {
        const folderDisplay = row.folder_name || '(root)';
        console.log(`  Stream Key: ${row.stream_key_id.substring(0, 8)}...`);
        console.log(`    Folder: ${folderDisplay}, Index: ${row.thumbnail_index}`);
      }
    }
  }
  
  // If arguments provided, update the index
  if (args.length >= 2) {
    const folderName = args[0] === '""' || args[0] === "''" ? '' : args[0];
    const newIndex = parseInt(args[1]);
    
    if (isNaN(newIndex) || newIndex < 0) {
      console.error('\nError: index must be a non-negative number');
      process.exit(1);
    }
    
    // Get first user ID
    if (users.length === 0) {
      console.error('\nError: No users found in database');
      process.exit(1);
    }
    
    const userId = users[0].id;
    
    console.log('\n' + '-'.repeat(80));
    console.log(`\nUpdating GLOBAL index for folder "${folderName || '(root)'}" to ${newIndex}...`);
    console.log(`  User: ${users[0].username} (${userId})`);
    console.log(`  NEXT thumbnail will be: #${(newIndex % 20) + 1}`);
    
    await updateGlobalIndex(userId, folderName, newIndex);
    
    console.log(`\n✅ Successfully updated GLOBAL index!`);
  } else if (args.length === 0) {
    console.log('\n' + '-'.repeat(80));
    console.log('\nTo update an index, run:');
    console.log('  node scripts/fix-global-thumbnail-index.js <folder_name> <index>');
    console.log('\nExamples:');
    console.log('  node scripts/fix-global-thumbnail-index.js italo 3');
    console.log('    → Sets NEXT thumbnail to #4 for folder "italo"');
    console.log('  node scripts/fix-global-thumbnail-index.js "" 0');
    console.log('    → Sets NEXT thumbnail to #1 for root folder');
  }
  
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
