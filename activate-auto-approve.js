const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'db', 'streamflow.db');
const db = new sqlite3.Database(dbPath);

console.log('=== Setup Auto-Approve & Live Limit ===\n');

db.serialize(() => {
    // 1. Create system_settings table if not exists
    db.run(
        `CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
        function (err) {
            if (err) {
                console.error('❌ Error creating table:', err.message);
                db.close();
                return;
            }
            console.log('✅ Table system_settings ready');

            // 2. Insert/Update auto-approve setting
            db.run(
                `INSERT INTO system_settings (key, value, updated_at) 
         VALUES ('auto_approve_registration', 'enabled', CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = 'enabled', updated_at = CURRENT_TIMESTAMP`,
                function (err) {
                    if (err) {
                        console.error('❌ Error setting auto_approve:', err.message);
                    } else {
                        console.log('✅ Auto-approve: ENABLED');
                    }
                }
            );

            // 3. Insert/Update live limit setting
            db.run(
                `INSERT INTO system_settings (key, value, updated_at) 
         VALUES ('default_live_limit_registration', '2', CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = '2', updated_at = CURRENT_TIMESTAMP`,
                function (err) {
                    if (err) {
                        console.error('❌ Error setting live limit:', err.message);
                    } else {
                        console.log('✅ Live limit default: 2');
                    }
                }
            );

            // 4. Verify
            setTimeout(() => {
                db.all(
                    `SELECT key, value FROM system_settings WHERE key IN ('auto_approve_registration', 'default_live_limit_registration')`,
                    [],
                    (err, rows) => {
                        if (err) {
                            console.error('❌ Error verifying:', err.message);
                        } else {
                            console.log('\n📋 Settings aktif:');
                            rows.forEach(row => {
                                console.log(`   ${row.key} = ${row.value}`);
                            });
                        }

                        console.log('\n🎉 DONE! User baru sekarang:');
                        console.log('   ✅ Otomatis diapprove (langsung aktif)');
                        console.log('   ✅ Mendapat live limit 2 streams');
                        console.log('\n💡 Coba sign up user baru untuk test!\n');

                        db.close();
                    }
                );
            }, 1000);
        }
    );
});
