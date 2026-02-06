const { db } = require('../db/database');

const userId = '86ffd1bf-a5bd-42f6-8c8e-da1ca17a7979'; // ozang88

console.log('Checking data for user:', userId);
console.log('='.repeat(60));

// Check title_suggestions
db.all(
  'SELECT * FROM title_suggestions WHERE user_id = ? ORDER BY sort_order ASC',
  [userId],
  (err, titles) => {
    if (err) {
      console.error('Error:', err.message);
    } else {
      console.log('\n📝 Title Suggestions:', titles.length);
      titles.forEach((t, i) => {
        console.log(`${i + 1}. [Order: ${t.sort_order}] "${t.title}"`);
        console.log(`   - ID: ${t.id}`);
        console.log(`   - Folder: ${t.folder_id || '(none)'}`);
        console.log(`   - Pinned: ${t.is_pinned ? 'YES' : 'NO'}`);
        console.log(`   - Use Count: ${t.use_count}`);
      });
    }
    
    // Check title_folders
    db.all(
      'SELECT * FROM title_folders WHERE user_id = ?',
      [userId],
      (err, folders) => {
        if (err) {
          console.error('Error:', err.message);
        } else {
          console.log('\n📁 Title Folders:', folders.length);
          folders.forEach((f, i) => {
            console.log(`${i + 1}. "${f.name}" (ID: ${f.id})`);
          });
        }
        
        // Check user_title_rotation_settings
        db.get(
          'SELECT * FROM user_title_rotation_settings WHERE user_id = ?',
          [userId],
          (err, settings) => {
            if (err) {
              console.error('Error:', err.message);
            } else {
              console.log('\n⚙️ User Rotation Settings:');
              if (settings) {
                console.log('   - Enabled:', settings.enabled ? 'YES' : 'NO');
                console.log('   - Folder ID:', settings.folder_id || '(all)');
                console.log('   - Current Index:', settings.current_index);
                console.log('   - Updated:', settings.updated_at);
              } else {
                console.log('   (No settings found)');
              }
            }
            
            // Check broadcast_templates
            db.all(
              'SELECT id, name, title, title_folder_id, title_index, recurring_enabled FROM broadcast_templates WHERE user_id = ?',
              [userId],
              (err, templates) => {
                if (err) {
                  console.error('Error:', err.message);
                } else {
                  console.log('\n📺 Broadcast Templates:', templates.length);
                  templates.forEach((t, i) => {
                    console.log(`${i + 1}. "${t.name}"`);
                    console.log(`   - Recurring: ${t.recurring_enabled ? 'YES' : 'NO'}`);
                    console.log(`   - Title Index: ${t.title_index || 0}`);
                    console.log(`   - Title Folder: ${t.title_folder_id || '(user settings)'}`);
                  });
                }
                
                process.exit(0);
              }
            );
          }
        );
      }
    );
  }
);
