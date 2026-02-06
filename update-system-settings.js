/**
 * Update system settings untuk auto-approve dan live limit default
 * Jalankan: node update-system-settings.js
 */

const { db, waitForDbInit } = require('./db/database');

async function updateSystemSettings() {
    try {
        await waitForDbInit();

        console.log('[System Settings] Updating default settings...\n');

        // Set auto-approve registration to enabled
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO system_settings (key, value, updated_at) 
         VALUES ('auto_approve_registration', 'enabled', CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = 'enabled', updated_at = CURRENT_TIMESTAMP`,
                function (err) {
                    if (err) {
                        console.error('Error setting auto_approve_registration:', err.message);
                        reject(err);
                    } else {
                        console.log('✅ Auto-approve registration: ENABLED');
                        resolve();
                    }
                }
            );
        });

        // Set default live limit for registration to 2
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO system_settings (key, value, updated_at) 
         VALUES ('default_live_limit_registration', '2', CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = '2', updated_at = CURRENT_TIMESTAMP`,
                function (err) {
                    if (err) {
                        console.error('Error setting default_live_limit_registration:', err.message);
                        reject(err);
                    } else {
                        console.log('✅ Default live limit for new users: 2');
                        resolve();
                    }
                }
            );
        });

        // Verify settings
        console.log('\n[System Settings] Verifying settings...\n');

        await new Promise((resolve, reject) => {
            db.all(
                `SELECT key, value FROM system_settings WHERE key IN ('auto_approve_registration', 'default_live_limit_registration')`,
                [],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        rows.forEach(row => {
                            console.log(`  ${row.key}: ${row.value}`);
                        });
                        resolve();
                    }
                }
            );
        });

        console.log('\n[System Settings] Update complete!');
        console.log('\nℹ️  Sekarang setiap user baru yang signup akan:');
        console.log('   1. Otomatis di-approve (status = active)');
        console.log('   2. Mendapat live limit = 2 livestreaming simultan');
        console.log('\n💡 Anda bisa mengubah setting ini di menu System Settings');

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Error updating system settings:', error.message);
        process.exit(1);
    }
}

updateSystemSettings();
