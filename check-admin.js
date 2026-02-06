const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/streamflow.db');

db.all('SELECT id, username, user_role, status FROM users', (err, rows) => {
  if (err) {
    console.error('Error:', err);
    db.close();
    return;
  }
  
  console.log('=== All Users ===');
  console.log(JSON.stringify(rows, null, 2));
  
  db.get("SELECT COUNT(*) as count FROM users WHERE user_role = 'admin' AND status = 'active'", (err, r) => {
    if (err) {
      console.error('Error counting admins:', err);
    } else {
      console.log('\n=== Active Admins Count ===');
      console.log('Count:', r ? r.count : 0);
      
      if (r && r.count === 0) {
        console.log('\n⚠️  NO ACTIVE ADMIN FOUND!');
        console.log('This is why you are redirected to /setup-account');
      }
    }
    db.close();
  });
});
