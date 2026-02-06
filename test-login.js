const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./db/streamflow.db');

async function testLogin() {
  const username = 'ozang88';
  const password = 'Admin123';
  
  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err) {
      console.error('DB Error:', err);
      db.close();
      return;
    }
    
    if (!user) {
      console.log('User not found!');
      db.close();
      return;
    }
    
    console.log('User found:');
    console.log('- ID:', user.id);
    console.log('- Username:', user.username);
    console.log('- Role:', user.user_role);
    console.log('- Status:', user.status);
    console.log('- Password hash:', user.password);
    console.log('- Password hash length:', user.password ? user.password.length : 0);
    
    try {
      const match = await bcrypt.compare(password, user.password);
      console.log('\nPassword verification:', match ? '✅ MATCH' : '❌ NO MATCH');
      
      if (!match) {
        // Try to see if password is stored differently
        console.log('\nDebug: Testing if password was stored as plain text...');
        console.log('Plain match:', user.password === password);
      }
    } catch (e) {
      console.error('bcrypt error:', e);
    }
    
    db.close();
  });
}

testLogin();
