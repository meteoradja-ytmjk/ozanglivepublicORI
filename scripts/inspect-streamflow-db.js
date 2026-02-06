const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../db/streamflow.db');
const db = new sqlite3.Database(dbPath);

console.log('Inspecting streamflow.db...\n');

// Check all tables
db.all(
  "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
  [],
  (err, tables) => {
    if (err) {
      console.error('Error:', err.message);
      process.exit(1);
    }
    
    console.log('📋 All Tables:');
    tables.forEach(t => console.log('   -', t.name));
    
    // Check users
    db.all('SELECT id, username FROM users', [], (err, users) => {
      if (err) {
        console.error('Error:', err.message);
      } else {
        console.log('\n👥 Users:', users.length);
        users.forEach(u => console.log(`   - ${u.username} (${u.id})`));
      }
      
      // Check title_suggestions for all users
      db.all('SELECT * FROM title_suggestions ORDER BY user_id, sort_order', [], (err, titles) => {
        if (err) {
          console.error('Error:', err.message);
        } else {
          console.log('\n📝 Title Suggestions:', titles.length);
          
          if (titles.length > 0) {
            // Group by user
            const byUser = {};
            titles.forEach(t => {
              if (!byUser[t.user_id]) byUser[t.user_id] = [];
              byUser[t.user_id].push(t);
            });
            
            Object.entries(byUser).forEach(([userId, userTitles]) => {
              const user = users.find(u => u.id === userId);
              console.log(`\n   User: ${user ? user.username : userId}`);
              userTitles.forEach((t, i) => {
                const pinned = t.is_pinned ? '📌' : '  ';
                console.log(`   ${pinned} ${i + 1}. [Order: ${t.sort_order}] "${t.title}"`);
                console.log(`      Folder: ${t.folder_id || '(none)'} | Use: ${t.use_count}`);
              });
            });
          } else {
            console.log('   (No titles found)');
          }
        }
        
        // Check title_folders
        db.all('SELECT * FROM title_folders ORDER BY user_id, name', [], (err, folders) => {
          if (err) {
            console.error('Error:', err.message);
          } else {
            console.log('\n📁 Title Folders:', folders.length);
            
            if (folders.length > 0) {
              const byUser = {};
              folders.forEach(f => {
                if (!byUser[f.user_id]) byUser[f.user_id] = [];
                byUser[f.user_id].push(f);
              });
              
              Object.entries(byUser).forEach(([userId, userFolders]) => {
                const user = users.find(u => u.id === userId);
                console.log(`\n   User: ${user ? user.username : userId}`);
                userFolders.forEach((f, i) => {
                  console.log(`   ${i + 1}. "${f.name}" (ID: ${f.id})`);
                });
              });
            } else {
              console.log('   (No folders found)');
            }
          }
          
          // Check user_title_rotation_settings
          db.all('SELECT * FROM user_title_rotation_settings', [], (err, settings) => {
            if (err) {
              console.error('Error:', err.message);
            } else {
              console.log('\n⚙️ User Title Rotation Settings:', settings.length);
              
              if (settings.length > 0) {
                settings.forEach(s => {
                  const user = users.find(u => u.id === s.user_id);
                  console.log(`\n   User: ${user ? user.username : s.user_id}`);
                  console.log(`   - Enabled: ${s.enabled ? 'YES' : 'NO'}`);
                  console.log(`   - Folder: ${s.folder_id || '(all)'}`);
                  console.log(`   - Current Index: ${s.current_index}`);
                  console.log(`   - Updated: ${s.updated_at}`);
                });
              } else {
                console.log('   (No settings found)');
              }
            }
            
            db.close();
          });
        });
      });
    });
  }
);
