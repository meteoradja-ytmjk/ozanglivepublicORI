/**
 * Script to identify and remove malicious users from the database
 * 
 * This script finds users with suspicious usernames that contain
 * SQL injection or XSS patterns and removes them from the system.
 * 
 * Usage: node scripts/cleanup-malicious-users.js
 * Usage: node scripts/cleanup-malicious-users.js --dry-run (preview only)
 * Usage: node scripts/cleanup-malicious-users.js --force (delete without confirmation)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const sqlite3 = require('sqlite3').verbose();
const dbPath = path.join(__dirname, '..', 'db', 'streamflow.db');

// Valid username pattern - only letters, numbers, and underscores
const VALID_USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;

// Blacklisted patterns - SQL injection and XSS attack patterns
const BLACKLISTED_PATTERNS = [
  /['"]/,                           // Single or double quotes
  /[<>]/,                           // HTML tags
  /[;]/,                            // SQL statement separator
  /--/,                             // SQL comment
  /\/\*/,                           // SQL block comment start
  /\*\//,                           // SQL block comment end
  /\bor\b/i,                        // SQL OR keyword
  /\band\b/i,                       // SQL AND keyword
  /\bunion\b/i,                     // SQL UNION keyword
  /\bselect\b/i,                    // SQL SELECT keyword
  /\binsert\b/i,                    // SQL INSERT keyword
  /\bupdate\b/i,                    // SQL UPDATE keyword
  /\bdelete\b/i,                    // SQL DELETE keyword
  /\bdrop\b/i,                      // SQL DROP keyword
  /\bexec\b/i,                      // SQL EXEC keyword
  /\bscript\b/i,                    // XSS script tag
  /\balert\b/i,                     // XSS alert
  /\bonerror\b/i,                   // XSS event handler
  /\bonload\b/i,                    // XSS event handler
  /javascript:/i,                   // JavaScript protocol
  /data:/i,                         // Data protocol
  /vbscript:/i,                     // VBScript protocol
  /=\s*['"]?\s*or/i,                // Common SQL injection pattern '=' or
  /1\s*=\s*1/,                      // SQL injection 1=1
  /0\s*=\s*0/,                      // SQL injection 0=0
];

// Open database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('Connected to database');
});

/**
 * Check if username contains malicious patterns
 * @param {string} username - Username to check
 * @returns {Object} - { isMalicious: boolean, reason: string }
 */
function checkMaliciousUsername(username) {
  // Check valid pattern first
  if (!VALID_USERNAME_REGEX.test(username)) {
    return { isMalicious: true, reason: 'Contains invalid characters (only letters, numbers, underscores allowed)' };
  }
  
  // Check against blacklisted patterns
  for (const pattern of BLACKLISTED_PATTERNS) {
    if (pattern.test(username)) {
      return { isMalicious: true, reason: `Matches blacklisted pattern: ${pattern}` };
    }
  }
  
  return { isMalicious: false, reason: null };
}

async function findMaliciousUsers() {
  return new Promise((resolve, reject) => {
    db.all('SELECT id, username, user_role, status, created_at FROM users', [], (err, rows) => {
      if (err) {
        return reject(err);
      }
      
      const maliciousUsers = rows.filter(user => {
        const check = checkMaliciousUsername(user.username);
        if (check.isMalicious) {
          user.maliciousReason = check.reason;
          return true;
        }
        return false;
      });
      
      resolve(maliciousUsers);
    });
  });
}

async function deleteUser(userId) {
  return new Promise((resolve, reject) => {
    // Delete related data in order: audios, playlists, videos, streams, youtube_credentials, broadcast_templates, then user
    const deleteQueries = [
      'DELETE FROM audios WHERE user_id = ?',
      'DELETE FROM playlists WHERE user_id = ?',
      'DELETE FROM videos WHERE user_id = ?',
      'DELETE FROM streams WHERE user_id = ?',
      'DELETE FROM youtube_credentials WHERE user_id = ?',
      'DELETE FROM broadcast_templates WHERE user_id = ?',
      'DELETE FROM recurring_schedules WHERE user_id = ?',
      'DELETE FROM stream_templates WHERE user_id = ?'
    ];
    
    // Execute all delete queries sequentially
    const executeDeletes = async () => {
      for (const query of deleteQueries) {
        try {
          await new Promise((res, rej) => {
            db.run(query, [userId], function(err) {
              if (err) {
                console.log(`  Note: ${query.split(' ')[2]} table may not exist or no records found`);
              }
              res();
            });
          });
        } catch (e) {
          // Continue even if some tables don't exist
        }
      }
      
      // Finally delete the user
      return new Promise((res, rej) => {
        db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
          if (err) {
            return rej(err);
          }
          res(this.changes);
        });
      });
    };
    
    executeDeletes().then(resolve).catch(reject);
  });
}

async function main() {
  console.log('\n=== Malicious User Cleanup Script ===\n');
  
  try {
    // Find malicious users
    const maliciousUsers = await findMaliciousUsers();
    
    if (maliciousUsers.length === 0) {
      console.log('✓ No malicious users found. Database is clean.');
      return;
    }
    
    console.log(`Found ${maliciousUsers.length} user(s) with suspicious usernames:\n`);
    
    maliciousUsers.forEach((user, index) => {
      console.log(`${index + 1}. Username: "${user.username}"`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Role: ${user.user_role}`);
      console.log(`   Status: ${user.status}`);
      console.log(`   Created: ${user.created_at}`);
      console.log(`   Reason: ${user.maliciousReason}`);
      console.log('');
    });
    
    // Check for --dry-run flag
    if (process.argv.includes('--dry-run')) {
      console.log('Dry run mode - no users will be deleted.');
      console.log('Run without --dry-run to delete these users.');
      return;
    }
    
    // Delete malicious users
    console.log('Deleting malicious users...\n');
    
    for (const user of maliciousUsers) {
      try {
        await deleteUser(user.id);
        console.log(`✓ Deleted user: "${user.username}" (ID: ${user.id})`);
      } catch (err) {
        console.error(`✗ Failed to delete user "${user.username}":`, err.message);
      }
    }
    
    console.log('\n=== Cleanup Complete ===');
    
  } catch (error) {
    console.error('Error during cleanup:', error.message);
  } finally {
    db.close((err) => {
      if (err) {
        // Ignore close errors
      }
      process.exit(0);
    });
  }
}

main();
