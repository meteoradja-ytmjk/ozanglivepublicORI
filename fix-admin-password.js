const bcrypt = require('bcrypt');
const { db } = require('./db/database');

const newPassword = 'Admin123'; // Password baru

async function resetAdminPassword() {
  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    db.run(
      'UPDATE users SET password = ? WHERE username = ?',
      [hashedPassword, 'ozang88'],
      function(err) {
        if (err) {
          console.error('Error:', err);
        } else {
          console.log('Password admin berhasil direset!');
          console.log('Username: ozang88');
          console.log('Password: Admin123');
        }
        process.exit();
      }
    );
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

resetAdminPassword();
