/**
 * Script to check and fix template privacy status
 * Run with: node scripts/check-template-privacy.js
 */

const { db, initializeDatabase } = require('../db/database');

async function checkTemplates() {
  await initializeDatabase();
  
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT id, name, title, privacy_status, description 
       FROM broadcast_templates 
       WHERE recurring_enabled = 1`,
      [],
      (err, rows) => {
        if (err) {
          console.error('Error:', err.message);
          return reject(err);
        }
        
        console.log('\n=== Templates with Recurring Enabled ===\n');
        
        rows.forEach(row => {
          console.log(`ID: ${row.id}`);
          console.log(`Name: ${row.name}`);
          console.log(`Title: ${row.title}`);
          console.log(`Privacy Status: ${row.privacy_status || 'NULL (will default to unlisted)'}`);
          
          // Check if it's a multi-broadcast template
          if (row.description && row.description.startsWith('[')) {
            try {
              const broadcasts = JSON.parse(row.description);
              console.log(`Multi-broadcast template with ${broadcasts.length} broadcasts:`);
              broadcasts.forEach((b, i) => {
                console.log(`  ${i + 1}. ${b.title} - privacyStatus: ${b.privacyStatus || 'NULL'}`);
              });
            } catch (e) {
              console.log('Description: (not multi-broadcast)');
            }
          }
          console.log('---');
        });
        
        resolve(rows);
      }
    );
  });
}

async function fixPrivacyStatus(templateId, newStatus = 'unlisted') {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE broadcast_templates SET privacy_status = ? WHERE id = ?`,
      [newStatus, templateId],
      function(err) {
        if (err) {
          console.error('Error updating:', err.message);
          return reject(err);
        }
        console.log(`Updated template ${templateId} to privacy_status: ${newStatus}`);
        resolve({ success: true, changes: this.changes });
      }
    );
  });
}

async function fixMultiBroadcastPrivacy(templateId, newStatus = 'unlisted') {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT description FROM broadcast_templates WHERE id = ?`,
      [templateId],
      async (err, row) => {
        if (err) {
          console.error('Error:', err.message);
          return reject(err);
        }
        
        if (!row || !row.description || !row.description.startsWith('[')) {
          console.log('Not a multi-broadcast template');
          return resolve({ success: false });
        }
        
        try {
          const broadcasts = JSON.parse(row.description);
          const updatedBroadcasts = broadcasts.map(b => ({
            ...b,
            privacyStatus: newStatus
          }));
          
          db.run(
            `UPDATE broadcast_templates SET description = ?, privacy_status = ? WHERE id = ?`,
            [JSON.stringify(updatedBroadcasts), newStatus, templateId],
            function(err) {
              if (err) {
                console.error('Error updating:', err.message);
                return reject(err);
              }
              console.log(`Updated multi-broadcast template ${templateId} to privacyStatus: ${newStatus}`);
              resolve({ success: true, changes: this.changes });
            }
          );
        } catch (e) {
          console.error('Error parsing description:', e.message);
          reject(e);
        }
      }
    );
  });
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args[0] === 'fix' && args[1]) {
    const templateId = args[1];
    const newStatus = args[2] || 'unlisted';
    
    console.log(`Fixing template ${templateId} to ${newStatus}...`);
    await fixPrivacyStatus(templateId, newStatus);
    await fixMultiBroadcastPrivacy(templateId, newStatus);
    console.log('Done!');
  } else if (args[0] === 'fix-all') {
    const newStatus = args[1] || 'unlisted';
    const templates = await checkTemplates();
    
    console.log(`\nFixing all templates to ${newStatus}...`);
    for (const template of templates) {
      if (template.privacy_status === 'private') {
        await fixPrivacyStatus(template.id, newStatus);
        await fixMultiBroadcastPrivacy(template.id, newStatus);
      }
    }
    console.log('Done!');
  } else {
    await checkTemplates();
    console.log('\nUsage:');
    console.log('  node scripts/check-template-privacy.js              - Check all templates');
    console.log('  node scripts/check-template-privacy.js fix <id>     - Fix specific template to unlisted');
    console.log('  node scripts/check-template-privacy.js fix <id> public - Fix specific template to public');
    console.log('  node scripts/check-template-privacy.js fix-all      - Fix all private templates to unlisted');
  }
  
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
