const { db } = require('./db/database');

db.all('SELECT id, username, user_role, status FROM users', (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Users in database:');
    rows.forEach(row => {
      console.log(`- Username: ${row.username}, Role: ${row.user_role}, Status: ${row.status}`);
    });
  }
  process.exit();
});
