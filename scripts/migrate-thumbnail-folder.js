/**
 * Migration Script: Fix Thumbnail Folder for Existing Broadcasts
 * 
 * This script:
 * 1. Adds template_id column to youtube_broadcast_settings if not exists
 * 2. Shows current state of templates and broadcast settings
 * 3. Updates existing broadcast settings with thumbnail_folder from their source template
 * 
 * Run this script on VPS after deploying the new code:
 * node scripts/migrate-thumbnail-folder.js
 */

const { db } = require('../db/database');

async function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
}

async function getAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

async function getOne(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function migrate() {
  console.log('=== Thumbnail Folder Migration Script ===\n');
  
  try {
    // Step 1: Check and add template_id column
    console.log('Step 1: Checking youtube_broadcast_settings table...');
    const columns = await getAll("PRAGMA table_info(youtube_broadcast_settings)");
    console.log('  Current columns:', columns.map(c => c.name).join(', '));
    
    const hasTemplateId = columns.some(col => col.name === 'template_id');
    const hasThumbnailFolder = columns.some(col => col.name === 'thumbnail_folder');
    
    if (!hasThumbnailFolder) {
      console.log('  Adding thumbnail_folder column...');
      await runQuery('ALTER TABLE youtube_broadcast_settings ADD COLUMN thumbnail_folder TEXT');
      console.log('  ✓ thumbnail_folder column added');
    } else {
      console.log('  ✓ thumbnail_folder column exists');
    }
    
    if (!hasTemplateId) {
      console.log('  Adding template_id column...');
      await runQuery('ALTER TABLE youtube_broadcast_settings ADD COLUMN template_id TEXT');
      console.log('  ✓ template_id column added');
    } else {
      console.log('  ✓ template_id column exists');
    }
    
    // Step 2: Show all templates
    console.log('\n' + '='.repeat(50));
    console.log('Step 2: All Templates in Database');
    console.log('='.repeat(50));
    const allTemplates = await getAll(`
      SELECT id, name, user_id, account_id, thumbnail_folder, recurring_enabled, last_run_at
      FROM broadcast_templates 
      ORDER BY last_run_at DESC NULLS LAST
    `);
    
    if (allTemplates.length === 0) {
      console.log('  ⚠ No templates found in database!');
    } else {
      console.log(`  Found ${allTemplates.length} templates:\n`);
      allTemplates.forEach((t, i) => {
        const folder = t.thumbnail_folder === null ? 'NULL (not set)' : 
                       t.thumbnail_folder === '' ? '"" (root)' : 
                       `"${t.thumbnail_folder}"`;
        console.log(`  ${i + 1}. ${t.name}`);
        console.log(`     ID: ${t.id}`);
        console.log(`     thumbnail_folder: ${folder}`);
        console.log(`     recurring: ${t.recurring_enabled ? 'YES' : 'NO'}`);
        console.log(`     last_run: ${t.last_run_at || 'never'}`);
        console.log('');
      });
    }
    
    // Step 3: Show all broadcast settings
    console.log('='.repeat(50));
    console.log('Step 3: All Broadcast Settings in Database');
    console.log('='.repeat(50));
    const allSettings = await getAll(`
      SELECT bs.*, bt.name as template_name, bt.thumbnail_folder as template_folder
      FROM youtube_broadcast_settings bs
      LEFT JOIN broadcast_templates bt ON bs.template_id = bt.id
      ORDER BY bs.created_at DESC
    `);
    
    if (allSettings.length === 0) {
      console.log('  ⚠ No broadcast settings found in database!');
      console.log('  This means broadcasts were created before settings were saved.');
    } else {
      console.log(`  Found ${allSettings.length} broadcast settings:\n`);
      allSettings.forEach((s, i) => {
        const folder = s.thumbnail_folder === null ? 'NULL' : 
                       s.thumbnail_folder === '' ? '"" (root)' : 
                       `"${s.thumbnail_folder}"`;
        console.log(`  ${i + 1}. Broadcast: ${s.broadcast_id}`);
        console.log(`     thumbnail_folder: ${folder}`);
        console.log(`     template_id: ${s.template_id || 'none'}`);
        console.log(`     template_name: ${s.template_name || 'none'}`);
        console.log('');
      });
    }
    
    // Step 4: Fix broadcast settings without thumbnail_folder
    console.log('='.repeat(50));
    console.log('Step 4: Fixing Broadcast Settings');
    console.log('='.repeat(50));
    
    const settingsToFix = await getAll(`
      SELECT id, broadcast_id, user_id, account_id, thumbnail_folder, template_id
      FROM youtube_broadcast_settings 
      WHERE thumbnail_folder IS NULL
    `);
    
    console.log(`  Found ${settingsToFix.length} settings with NULL thumbnail_folder`);
    
    let fixed = 0;
    for (const setting of settingsToFix) {
      // Try to find matching template
      let matchingTemplate = null;
      
      // First try by template_id if exists
      if (setting.template_id) {
        matchingTemplate = await getOne(
          'SELECT * FROM broadcast_templates WHERE id = ?',
          [setting.template_id]
        );
      }
      
      // If no template_id, try to match by user_id and account_id
      if (!matchingTemplate) {
        matchingTemplate = await getOne(`
          SELECT * FROM broadcast_templates 
          WHERE user_id = ? AND account_id = ?
          ORDER BY last_run_at DESC NULLS LAST
          LIMIT 1
        `, [setting.user_id, setting.account_id]);
      }
      
      if (matchingTemplate && matchingTemplate.thumbnail_folder !== null) {
        await runQuery(`
          UPDATE youtube_broadcast_settings 
          SET thumbnail_folder = ?, template_id = ?
          WHERE id = ?
        `, [matchingTemplate.thumbnail_folder, matchingTemplate.id, setting.id]);
        
        console.log(`  ✓ Fixed ${setting.broadcast_id}: folder="${matchingTemplate.thumbnail_folder || 'root'}" from template "${matchingTemplate.name}"`);
        fixed++;
      } else {
        console.log(`  ⚠ Could not fix ${setting.broadcast_id}: no matching template found`);
      }
    }
    
    console.log(`\n  Fixed ${fixed} of ${settingsToFix.length} settings`);
    
    // Step 5: Summary
    console.log('\n' + '='.repeat(50));
    console.log('SUMMARY');
    console.log('='.repeat(50));
    
    const finalSettings = await getAll(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN thumbnail_folder IS NOT NULL THEN 1 ELSE 0 END) as with_folder,
        SUM(CASE WHEN thumbnail_folder IS NULL THEN 1 ELSE 0 END) as without_folder
      FROM youtube_broadcast_settings
    `);
    
    const stats = finalSettings[0];
    console.log(`  Total broadcast settings: ${stats.total}`);
    console.log(`  With thumbnail_folder: ${stats.with_folder}`);
    console.log(`  Without thumbnail_folder: ${stats.without_folder}`);
    
    if (stats.without_folder > 0) {
      console.log('\n  ⚠ Some broadcasts still have no thumbnail_folder.');
      console.log('  These broadcasts were created before any template was set up.');
      console.log('  They will use the most recent template\'s folder as fallback.');
    }
    
    console.log('\n=== Migration Complete ===\n');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error.stack);
  }
  
  process.exit(0);
}

// Wait for database to initialize
setTimeout(migrate, 1000);
