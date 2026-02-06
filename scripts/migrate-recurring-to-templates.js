/**
 * Migration Script: Convert recurring_schedules to template-based recurring
 * 
 * This script migrates existing recurring_schedules records to broadcast_templates
 * with recurring enabled. After migration, the recurring_schedules table can be
 * deprecated and eventually removed.
 * 
 * Usage: node scripts/migrate-recurring-to-templates.js [--dry-run]
 * 
 * Options:
 *   --dry-run    Preview changes without modifying database
 */

const { db, waitForDbInit } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

const isDryRun = process.argv.includes('--dry-run');

/**
 * Get all recurring schedules from database
 * @returns {Promise<Array>} Array of recurring schedule records
 */
function getRecurringSchedules() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT rs.*, yc.channel_name
       FROM recurring_schedules rs
       LEFT JOIN youtube_credentials yc ON rs.account_id = yc.id
       ORDER BY rs.created_at ASC`,
      [],
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      }
    );
  });
}

/**
 * Check if a template with the same name exists for user
 * @param {string} userId - User ID
 * @param {string} name - Template name
 * @returns {Promise<boolean>}
 */
function templateNameExists(userId, name) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT COUNT(*) as count FROM broadcast_templates WHERE user_id = ? AND name = ?',
      [userId, name],
      (err, row) => {
        if (err) reject(err);
        else resolve(row.count > 0);
      }
    );
  });
}

/**
 * Generate unique template name
 * @param {string} userId - User ID
 * @param {string} baseName - Base name for template
 * @returns {Promise<string>} Unique template name
 */
async function generateUniqueName(userId, baseName) {
  let name = baseName;
  let counter = 1;
  
  while (await templateNameExists(userId, name)) {
    name = `${baseName} (${counter})`;
    counter++;
  }
  
  return name;
}

/**
 * Convert recurring_schedule days_of_week to template recurring_days format
 * @param {string|Array} daysOfWeek - Days from recurring_schedule
 * @returns {Array} Array of day names
 */
function convertDays(daysOfWeek) {
  if (!daysOfWeek) return null;
  
  try {
    const days = typeof daysOfWeek === 'string' ? JSON.parse(daysOfWeek) : daysOfWeek;
    return Array.isArray(days) ? days : null;
  } catch (e) {
    return null;
  }
}

/**
 * Convert tags to proper format
 * @param {string|Array} tags - Tags from recurring_schedule
 * @returns {string|null} JSON string of tags
 */
function convertTags(tags) {
  if (!tags) return null;
  
  try {
    const tagsArray = typeof tags === 'string' ? JSON.parse(tags) : tags;
    return Array.isArray(tagsArray) ? JSON.stringify(tagsArray) : null;
  } catch (e) {
    return null;
  }
}

/**
 * Create template from recurring schedule
 * @param {Object} schedule - Recurring schedule record
 * @returns {Promise<Object>} Created template
 */
function createTemplateFromSchedule(schedule) {
  return new Promise((resolve, reject) => {
    const id = uuidv4();
    const recurringDays = convertDays(schedule.days_of_week);
    const tags = convertTags(schedule.tags);
    
    db.run(
      `INSERT INTO broadcast_templates (
        id, user_id, account_id, name, title, description,
        privacy_status, tags, category_id, thumbnail_path, stream_id,
        recurring_enabled, recurring_pattern, recurring_time, recurring_days,
        last_run_at, next_run_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        schedule.user_id,
        schedule.account_id,
        schedule.name,
        schedule.title_template || `Broadcast {date}`,
        schedule.description,
        schedule.privacy_status || 'unlisted',
        tags,
        schedule.category_id || '20',
        null, // thumbnail_path
        null, // stream_id
        schedule.is_active ? 1 : 0, // recurring_enabled
        schedule.pattern, // recurring_pattern
        schedule.schedule_time, // recurring_time
        recurringDays ? JSON.stringify(recurringDays) : null, // recurring_days
        schedule.last_run_at,
        schedule.next_run_at,
        schedule.created_at || new Date().toISOString()
      ],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({
            id,
            name: schedule.name,
            changes: this.changes
          });
        }
      }
    );
  });
}

/**
 * Mark recurring schedule as migrated (add migrated_at timestamp)
 * @param {string} scheduleId - Schedule ID
 * @returns {Promise<void>}
 */
function markScheduleAsMigrated(scheduleId) {
  return new Promise((resolve, reject) => {
    // We'll deactivate the schedule instead of deleting
    db.run(
      `UPDATE recurring_schedules SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [scheduleId],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

/**
 * Main migration function
 */
async function migrate() {
  console.log('='.repeat(60));
  console.log('Migration: Recurring Schedules to Template-based Recurring');
  console.log('='.repeat(60));
  
  if (isDryRun) {
    console.log('\n⚠️  DRY RUN MODE - No changes will be made\n');
  }
  
  try {
    // Wait for database initialization
    await waitForDbInit();
    console.log('✓ Database connected\n');
    
    // Get all recurring schedules
    const schedules = await getRecurringSchedules();
    console.log(`Found ${schedules.length} recurring schedule(s) to migrate\n`);
    
    if (schedules.length === 0) {
      console.log('No recurring schedules to migrate. Done!');
      return { success: true, migrated: 0, failed: 0 };
    }
    
    const results = {
      success: true,
      migrated: 0,
      failed: 0,
      details: []
    };
    
    for (const schedule of schedules) {
      console.log(`Processing: "${schedule.name}" (ID: ${schedule.id})`);
      console.log(`  Pattern: ${schedule.pattern}`);
      console.log(`  Time: ${schedule.schedule_time}`);
      if (schedule.days_of_week) {
        console.log(`  Days: ${schedule.days_of_week}`);
      }
      console.log(`  Active: ${schedule.is_active ? 'Yes' : 'No'}`);
      
      try {
        // Generate unique name if needed
        const uniqueName = await generateUniqueName(schedule.user_id, schedule.name);
        if (uniqueName !== schedule.name) {
          console.log(`  ⚠️  Name conflict, using: "${uniqueName}"`);
          schedule.name = uniqueName;
        }
        
        if (!isDryRun) {
          // Create template with recurring enabled
          const template = await createTemplateFromSchedule(schedule);
          console.log(`  ✓ Created template: ${template.id}`);
          
          // Mark original schedule as migrated (deactivate)
          await markScheduleAsMigrated(schedule.id);
          console.log(`  ✓ Original schedule deactivated`);
        } else {
          console.log(`  [DRY RUN] Would create template and deactivate schedule`);
        }
        
        results.migrated++;
        results.details.push({
          scheduleId: schedule.id,
          scheduleName: schedule.name,
          status: 'migrated'
        });
        
      } catch (err) {
        console.log(`  ✗ Error: ${err.message}`);
        results.failed++;
        results.success = false;
        results.details.push({
          scheduleId: schedule.id,
          scheduleName: schedule.name,
          status: 'failed',
          error: err.message
        });
      }
      
      console.log('');
    }
    
    // Summary
    console.log('='.repeat(60));
    console.log('Migration Summary');
    console.log('='.repeat(60));
    console.log(`Total schedules: ${schedules.length}`);
    console.log(`Migrated: ${results.migrated}`);
    console.log(`Failed: ${results.failed}`);
    
    if (isDryRun) {
      console.log('\n⚠️  This was a dry run. Run without --dry-run to apply changes.');
    }
    
    return results;
    
  } catch (err) {
    console.error('Migration failed:', err.message);
    return { success: false, error: err.message };
  }
}

// Run migration if called directly
if (require.main === module) {
  migrate()
    .then((results) => {
      process.exit(results.success ? 0 : 1);
    })
    .catch((err) => {
      console.error('Unexpected error:', err);
      process.exit(1);
    });
}

module.exports = { migrate, getRecurringSchedules, createTemplateFromSchedule };
