/**
 * Script untuk memperbaiki admin login
 * Jalankan: node fix-admin-complete.js
 */

const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path
const dbPath = path.join(__dirname, 'db', 'streamflow.db');
const db = new sqlite3.Database(dbPath);

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'Admin123';

async function fixAdmin() {
  console.log('=== Fix Admin Script ===\n');
  console.log('Database path:', dbPath);
  
  // 1. Check current users
  console.log('\n1. Checking current users...');
  
  const users = await new Promise((resolve, reject) => {
    db.all('SELECT id, username, user_role, status FROM users', (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
  
  console.log('Current users:', JSON.stringify(users, null, 2));
  
  // 2. Check if admin exists
  const existingAdmin = users.find(u => u.user_role === 'admin' && u.status === 'active');
  
  if (existingAdmin) {
    console.log('\n2. Found existing admin:', existingAdmin.username);
    console.log('   Resetting password...');
    
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    
    await new Promise((resolve, reject) => {
      db.run('UPDATE users SET password = ? WHERE id = ?', [hash, existingAdmin.id], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
    
    console.log('   Password reset successful!');
    console.log('\n   Login dengan:');
    console.log('   Username:', existingAdmin.username);
    console.log('   Password:', ADMIN_PASSWORD);
    
  } else {
    console.log('\n2. No active admin found. Creating new admin...');
    
    const { v4: uuidv4 } = require('uuid');
    const userId = uuidv4();
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO users (id, username, password, user_role, status) VALUES (?, ?, ?, ?, ?)',
        [userId, ADMIN_USERNAME, hash, 'admin', 'active'],
        function(err) {
          if (err) {
            if (err.message.includes('UNIQUE constraint')) {
              // Username exists but not active admin, update it
              db.run(
                'UPDATE users SET password = ?, user_role = ?, status = ? WHERE username = ?',
                [hash, 'admin', 'active', ADMIN_USERNAME],
                function(err2) {
                  if (err2) reject(err2);
                  else resolve(this.changes);
                }
              );
            } else {
              reject(err);
            }
          } else {
            resolve(this.changes);
          }
        }
      );
    });
    
    console.log('   Admin created!');
    console.log('\n   Login dengan:');
    console.log('   Username:', ADMIN_USERNAME);
    console.log('   Password:', ADMIN_PASSWORD);
  }
  
  // 3. Verify
  console.log('\n3. Verifying...');
  
  const adminUser = await new Promise((resolve, reject) => {
    db.get("SELECT * FROM users WHERE user_role = 'admin' AND status = 'active' LIMIT 1", (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
  
  if (adminUser) {
    const match = await bcrypt.compare(ADMIN_PASSWORD, adminUser.password);
    console.log('   Admin exists:', adminUser.username);
    console.log('   Password verification:', match ? '✓ OK' : '✗ FAILED');
    
    if (!match) {
      console.log('\n   ERROR: Password verification failed!');
    }
  } else {
    console.log('   ERROR: No admin found after fix!');
  }
  
  console.log('\n=== Done ===');
  console.log('\nSetelah menjalankan script ini:');
  console.log('1. Restart aplikasi (pm2 restart all atau restart container)');
  console.log('2. Buka halaman login');
  console.log('3. Login dengan username dan password di atas');
  
  db.close();
}

fixAdmin().catch(err => {
  console.error('Error:', err);
  db.close();
  process.exit(1);
});
