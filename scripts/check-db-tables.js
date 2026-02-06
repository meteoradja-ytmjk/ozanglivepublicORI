const {getDb} = require('../db/database');
const db = getDb();

db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, rows) => {
  console.log('Tables:', JSON.stringify(rows, null, 2));
  process.exit(0);
});
