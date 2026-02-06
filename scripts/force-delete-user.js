/**
 * Force Delete User Script
 * 
 * Menghapus user berdasarkan ID secara paksa, termasuk semua data terkait.
 * Berguna untuk menghapus user yang tidak bisa dihapus dari UI (misal: username berbahaya)
 * 
 * Usage: 
 *   node scripts/force-delete-user.js <user_id>
 *   node scripts/force-delete-user.js f53ed9e0-ba33-4fd1-8626-b4b51a4bc8da
 *   node scripts/force-delete-user.js --list (untuk melihat semua user)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const sqlite3 = require('sqlite3').verbose();
const dbPath = path.join(__dirname, '..', 'db', 'streamflow.db');

// Open database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
});

/**
 * List all users in the database
 */
async function listUsers() {
  return new Promise((resolve, reject) => {
    db.all('SELECT id, username, user_role, status, created_at FROM users ORDER BY created_at DESC', [], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

/**
 * Get user by ID
 */
async function getUserById(userId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

/**
 * Force delete user and all related data
 */
async function forceDeleteUser(userId) {
  const tables = [
    { name: 'audios', column: 'user_id' },
    { name: 'playlists', column: 'user_id' },
    { name: 'videos', column: 'user_id' },
    { name: 'streams', column: 'user_id' },
    { name: 'youtube_credentials', column: 'user_id' },
    { name: 'broadcast_templates', column: 'user_id' },
    { name: 'recurring_schedules', column: 'user_id' },
    { name: 'stream_templates', column: 'user_id' }
  ];

  const results = { deletedFrom: [], errors: [] };

  // Delete from related tables
  for (const table of tables) {
    try {
      await new Promise((resolve, reject) => {
        db.run(`DELETE FROM ${table.name} WHERE ${table.column} = ?`, [userId], function(err) {
          if (err) {
            // Table might not exist, continue anyway
            results.errors.push(`${table.name}: ${err.message}`);
          } else if (this.changes > 0) {
            results.deletedFrom.push(`${table.name}: ${this.changes} record(s)`);
          }
          resolve();
        });
      });
    } catch (e) {
      results.errors.push(`${table.name}: ${e.message}`);
    }
  }

  // Delete the user
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
      if (err) {
        return reject(err);
      }
      results.userDeleted = this.changes > 0;
      resolve(results);
    });
  });
}

async function main() {
  const args = process.argv.slice(2);

  console.log('\n=== Force Delete User Script ===\n');

  // Show help
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log('Usage:');
    console.log('  node scripts/force-delete-user.js <user_id>    - Delete user by ID');
    console.log('  node scripts/force-delete-user.js --list       - List all users');
    console.log('  node scripts/force-delete-user.js --help       - Show this help');
    console.log('\nExample:');
    console.log('  node scripts/force-delete-user.js f53ed9e0-ba33-4fd1-8626-b4b51a4bc8da');
    db.close();
    return;
  }

  // List all users
  if (args[0] === '--list' || args[0] === '-l') {
    try {
      const users = await listUsers();
      if (users.length === 0) {
        console.log('No users found in database.');
      } else {
        console.log(`Found ${users.length} user(s):\n`);
        users.forEach((user, i) => {
          console.log(`${i + 1}. ID: ${user.id}`);
          console.log(`   Username: "${user.username}"`);
          console.log(`   Role: ${user.user_role}`);
          console.log(`   Status: ${user.status}`);
          console.log(`   Created: ${user.created_at}`);
          console.log('');
        });
      }
    } catch (err) {
      console.error('Error listing users:', err.message);
    }
    db.close();
    return;
  }

  // Delete user by ID
  const userId = args[0];
  
  // Validate UUID format (basic check)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    console.error('Error: Invalid user ID format. Expected UUID format.');
    console.error('Example: f53ed9e0-ba33-4fd1-8626-b4b51a4bc8da');
    db.close();
    process.exit(1);
  }

  try {
    // Check if user exists
    const user = await getUserById(userId);
    if (!user) {
      console.error(`Error: User with ID "${userId}" not found.`);
      console.log('\nUse --list to see all users.');
      db.close();
      process.exit(1);
    }

    console.log('User found:');
    console.log(`  ID: ${user.id}`);
    console.log(`  Username: "${user.username}"`);
    console.log(`  Role: ${user.user_role}`);
    console.log(`  Status: ${user.status}`);
    console.log(`  Created: ${user.created_at}`);
    console.log('');

    // Delete user
    console.log('Deleting user and all related data...\n');
    const results = await forceDeleteUser(userId);

    if (results.userDeleted) {
      console.log('✓ User deleted successfully!');
      
      if (results.deletedFrom.length > 0) {
        console.log('\nRelated data deleted:');
        results.deletedFrom.forEach(item => console.log(`  - ${item}`));
      }
    } else {
      console.log('✗ Failed to delete user.');
    }

    if (results.errors.length > 0) {
      console.log('\nNotes (some tables may not exist):');
      results.errors.forEach(err => console.log(`  - ${err}`));
    }

  } catch (err) {
    console.error('Error:', err.message);
  }

  db.close();
}

main();
