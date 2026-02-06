const { db } = require('../db/database');
const TitleSuggestion = require('../models/TitleSuggestion');

/**
 * Script untuk memeriksa apakah rotasi judul berjalan sesuai urutan
 */

async function checkTitleRotation() {
  console.log('=== PEMERIKSAAN ROTASI JUDUL ===\n');

  // 1. Cek semua user yang memiliki title suggestions
  const users = await new Promise((resolve, reject) => {
    db.all(
      `SELECT DISTINCT user_id FROM title_suggestions ORDER BY user_id`,
      [],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      }
    );
  });

  console.log(`Ditemukan ${users.length} user dengan title suggestions\n`);

  for (const user of users) {
    const userId = user.user_id;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`USER ID: ${userId}`);
    console.log('='.repeat(60));

    // Cek user rotation settings
    const userSettings = await new Promise((resolve) => {
      db.get(
        `SELECT * FROM user_title_rotation_settings WHERE user_id = ?`,
        [userId],
        (err, row) => {
          if (err) {
            console.error('Error:', err.message);
            resolve(null);
          } else {
            resolve(row);
          }
        }
      );
    });

    if (userSettings) {
      console.log('\n📋 User Rotation Settings:');
      console.log(`   - Enabled: ${userSettings.enabled ? '✅ YA' : '❌ TIDAK'}`);
      console.log(`   - Folder ID: ${userSettings.folder_id || '(Semua folder)'}`);
      console.log(`   - Current Index: ${userSettings.current_index}`);
      console.log(`   - Updated: ${userSettings.updated_at}`);
    } else {
      console.log('\n📋 User Rotation Settings: ❌ Tidak ada (menggunakan template-level rotation)');
    }

    // Cek semua folders untuk user ini
    const folders = await new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM title_folders WHERE user_id = ? ORDER BY name`,
        [userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    console.log(`\n📁 Folders: ${folders.length} folder`);
    folders.forEach(folder => {
      console.log(`   - ${folder.name} (ID: ${folder.id})`);
    });

    // Cek semua titles untuk user ini
    const allTitles = await TitleSuggestion.findByUserId(userId);
    console.log(`\n📝 Total Titles: ${allTitles.length}`);

    // Cek pinned title
    const pinnedTitle = allTitles.find(t => t.is_pinned === 1);
    if (pinnedTitle) {
      console.log(`\n📌 PINNED TITLE (akan selalu digunakan):`);
      console.log(`   "${pinnedTitle.title}"`);
      console.log(`   - Folder: ${pinnedTitle.folder_id || '(Tidak ada folder)'}`);
      console.log(`   - Use Count: ${pinnedTitle.use_count}`);
    }

    // Grouping titles by folder
    const titlesByFolder = {};
    allTitles.forEach(title => {
      const folderId = title.folder_id || 'NO_FOLDER';
      if (!titlesByFolder[folderId]) {
        titlesByFolder[folderId] = [];
      }
      titlesByFolder[folderId].push(title);
    });

    // Display titles by folder
    console.log('\n📋 URUTAN ROTASI JUDUL:\n');
    
    for (const [folderId, titles] of Object.entries(titlesByFolder)) {
      const folderName = folderId === 'NO_FOLDER' 
        ? '(Tanpa Folder)' 
        : folders.find(f => f.id === folderId)?.name || folderId;
      
      console.log(`\n   📁 ${folderName} (${titles.length} judul):`);
      console.log('   ' + '-'.repeat(55));
      
      titles.forEach((title, index) => {
        const isPinned = title.is_pinned === 1 ? '📌 ' : '   ';
        const sortOrder = title.sort_order || 0;
        console.log(`   ${isPinned}${index + 1}. [Order: ${sortOrder}] "${title.title}"`);
        console.log(`      Use Count: ${title.use_count} | Created: ${title.created_at}`);
      });
    }

    // Test rotasi untuk setiap folder
    console.log('\n\n🔄 TEST ROTASI (5 broadcast berikutnya):');
    console.log('='.repeat(60));

    // Test untuk semua titles (no folder filter)
    console.log('\n   📁 Semua Titles (No Folder Filter):');
    await testRotation(userId, null, 5);

    // Test untuk setiap folder
    for (const folder of folders) {
      console.log(`\n   📁 Folder: ${folder.name}`);
      const folderTitles = allTitles.filter(t => t.folder_id === folder.id);
      if (folderTitles.length > 0) {
        await testRotation(userId, folder.id, 5);
      } else {
        console.log('      ⚠️ Tidak ada judul di folder ini');
      }
    }

    // Cek broadcast templates yang menggunakan title rotation
    const templates = await new Promise((resolve, reject) => {
      db.all(
        `SELECT id, name, title, title_folder_id, title_index, pinned_title_id, recurring_enabled 
         FROM broadcast_templates 
         WHERE user_id = ?
         ORDER BY name`,
        [userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    if (templates.length > 0) {
      console.log('\n\n📺 BROADCAST TEMPLATES:');
      console.log('='.repeat(60));
      templates.forEach(template => {
        console.log(`\n   Template: ${template.name}`);
        console.log(`   - ID: ${template.id}`);
        console.log(`   - Recurring: ${template.recurring_enabled ? '✅ Aktif' : '❌ Tidak aktif'}`);
        console.log(`   - Title Index: ${template.title_index || 0}`);
        console.log(`   - Title Folder: ${template.title_folder_id || '(Menggunakan user settings atau semua titles)'}`);
        console.log(`   - Pinned Title ID: ${template.pinned_title_id || '(Tidak ada)'}`);
        console.log(`   - Default Title: "${template.title}"`);
      });
    }
  }

  console.log('\n\n' + '='.repeat(60));
  console.log('PEMERIKSAAN SELESAI');
  console.log('='.repeat(60));
}

/**
 * Test rotasi untuk folder tertentu
 */
async function testRotation(userId, folderId, count = 5) {
  let currentIndex = 0;
  
  // Get user rotation settings if no folder specified
  if (!folderId) {
    const userSettings = await new Promise((resolve) => {
      db.get(
        `SELECT * FROM user_title_rotation_settings WHERE user_id = ?`,
        [userId],
        (err, row) => {
          if (err) resolve(null);
          else resolve(row);
        }
      );
    });
    
    if (userSettings && userSettings.enabled) {
      currentIndex = userSettings.current_index || 0;
      console.log(`      (Menggunakan user rotation index: ${currentIndex})`);
    }
  }

  for (let i = 0; i < count; i++) {
    const result = await TitleSuggestion.getNextTitle(userId, currentIndex, folderId);
    
    if (!result.title) {
      console.log(`      ${i + 1}. ❌ Tidak ada judul tersedia`);
      break;
    }

    const pinnedIndicator = result.isPinned ? '📌 PINNED' : '';
    const position = result.currentPosition ? `${result.currentPosition}/${result.totalCount}` : '';
    
    console.log(`      ${i + 1}. [Index: ${currentIndex} → ${result.nextIndex}] ${pinnedIndicator}`);
    console.log(`         "${result.title.title}"`);
    if (position) {
      console.log(`         Posisi: ${position}`);
    }
    
    // Update index untuk iterasi berikutnya (kecuali jika pinned)
    if (!result.isPinned) {
      currentIndex = result.nextIndex;
    }
  }
}

// Run the check
checkTitleRotation()
  .then(() => {
    console.log('\n✅ Script selesai');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  });
