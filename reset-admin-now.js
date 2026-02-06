const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./db/streamflow.db');

async function resetPassword() {
  const newPassword = 'Admin123';
  const hash = await bcrypt.hash(newPassword, 10);
  
  console.log('Generated hash:', hash);
  
  db.run('UPDATE users SET password = ? WHERE username = ?', [hash, 'ozang88'], function(err) {
    if (err) {
      console.error('Error:', err);
    } else {
      console.log('Password updated! Rows affected:', this.changes);
      
      // Verify
      db.get('SELECT password FROM users WHERE username = ?', ['ozang88'], async (err, row) => {
        if (row) {
          const match = await bcrypt.compare(newPassword, row.password);
          console.log('Verification - Password match:', match);
        }
        db.close();
        process.exit(0);
      });
    }
  });
}

resetPassword();
