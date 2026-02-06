/**
 * Script to check template recurring schedules
 * Run with: node check-template-schedules.js
 */

const { db, waitForDbInit } = require('./db/database');

/**
 * Get current time in Asia/Jakarta timezone (WIB)
 */
function getWIBTime(date = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Jakarta',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      weekday: 'short',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour12: false
    });
    
    const parts = formatter.formatToParts(date);
    let hours = 0, minutes = 0, seconds = 0, dayName = '', year = 0, month = 0, dayOfMonth = 0;
    
    for (const part of parts) {
      if (part.type === 'hour') hours = parseInt(part.value, 10);
      if (part.type === 'minute') minutes = parseInt(part.value, 10);
      if (part.type === 'second') seconds = parseInt(part.value, 10);
      if (part.type === 'weekday') dayName = part.value;
      if (part.type === 'year') year = parseInt(part.value, 10);
      if (part.type === 'month') month = parseInt(part.value, 10);
      if (part.type === 'day') dayOfMonth = parseInt(part.value, 10);
    }
    
    const dayMap = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
    const day = dayMap[dayName] ?? date.getDay();
    
    return { hours, minutes, seconds, day, dayName, year, month, dayOfMonth };
  } catch (e) {
    console.error('Error getting WIB time:', e.message);
    return null;
  }
}

async function checkTemplateSchedules() {
  await waitForDbInit();
  
  console.log('\n========================================');
  console.log('   TEMPLATE RECURRING SCHEDULE CHECK');
  console.log('========================================\n');
  
  const now = new Date();
  const wibTime = getWIBTime(now);
  
  console.log('CURRENT TIME:');
  console.log(`  UTC: ${now.toISOString()}`);
  console.log(`  WIB: ${wibTime.hours}:${String(wibTime.minutes).padStart(2,'0')}:${String(wibTime.seconds).padStart(2,'0')} (${wibTime.dayName}, ${wibTime.dayOfMonth}/${wibTime.month}/${wibTime.year})`);
  console.log('');
  
  // Check YouTube credentials first
  const credentials = await new Promise((resolve, reject) => {
    db.all('SELECT id, user_id, channel_name FROM youtube_credentials', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
  
  console.log(`YOUTUBE CREDENTIALS: ${credentials.length}`);
  if (credentials.length === 0) {
    console.log('  ⚠️  No YouTube accounts connected!');
    console.log('  → Please connect a YouTube account in Settings first.');
  } else {
    credentials.forEach(c => console.log(`  ✓ ${c.channel_name || 'Unknown'} (id: ${c.id})`));
  }
  console.log('');
  
  // Check ALL templates
  const allTemplates = await new Promise((resolve, reject) => {
    db.all(`
      SELECT bt.*, yc.channel_name, yc.client_id
      FROM broadcast_templates bt
      LEFT JOIN youtube_credentials yc ON bt.account_id = yc.id
      ORDER BY bt.name ASC
    `, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
  
  console.log(`ALL TEMPLATES: ${allTemplates.length}`);
  if (allTemplates.length === 0) {
    console.log('  ⚠️  No templates found in database!');
    console.log('');
    console.log('HOW TO CREATE A TEMPLATE:');
    console.log('  1. Go to YouTube page');
    console.log('  2. Click "Templates" button');
    console.log('  3. Click "Create Template"');
    console.log('  4. Fill in the form');
    console.log('  5. Enable "Recurring Schedule"');
    console.log('  6. Set pattern (daily/weekly) and time');
    console.log('  7. Click "Create Template"');
    process.exit(0);
  }
  
  allTemplates.forEach((t, i) => {
    const hasCredentials = !!t.client_id;
    const status = t.recurring_enabled ? '🟢 ENABLED' : '⚪ disabled';
    console.log(`  ${i + 1}. ${t.name} [${status}]`);
    console.log(`     Channel: ${t.channel_name || '⚠️ Unknown'} ${!hasCredentials ? '(credentials missing!)' : ''}`);
    console.log(`     Pattern: ${t.recurring_pattern || '-'}, Time: ${t.recurring_time || '-'} WIB`);
    console.log(`     Next Run: ${t.next_run_at || 'Not set'}`);
    console.log(`     Stream ID: ${t.stream_id || 'Not set'}`);
    console.log(`     Thumbnail Folder: ${t.thumbnail_folder !== null ? (t.thumbnail_folder || 'root') : 'Not set'}`);
  });
  console.log('');
  
  // Check enabled templates
  const enabledTemplates = allTemplates.filter(t => t.recurring_enabled === 1);
  
  if (enabledTemplates.length === 0) {
    console.log('⚠️  No templates with recurring ENABLED!');
    console.log('   → Edit a template and enable recurring schedule.');
    process.exit(0);
  }
  
  console.log(`TEMPLATES WITH RECURRING ENABLED: ${enabledTemplates.length}`);
  console.log('');
  
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const todayName = dayNames[wibTime.day];
  
  enabledTemplates.forEach((template, index) => {
    console.log(`━━━ ${template.name} ━━━`);
    
    // Check credentials
    if (!template.client_id) {
      console.log('  ❌ PROBLEM: YouTube credentials missing!');
      console.log('     → Reconnect YouTube account or select valid account.');
      return;
    }
    
    // Parse recurring_days
    let recurringDays = [];
    try {
      recurringDays = JSON.parse(template.recurring_days || '[]');
    } catch (e) {}
    
    console.log(`  Pattern: ${template.recurring_pattern}`);
    console.log(`  Time: ${template.recurring_time} WIB`);
    
    if (template.recurring_pattern === 'weekly') {
      console.log(`  Days: ${recurringDays.join(', ') || 'None'}`);
      const isTodayScheduled = recurringDays.map(d => d.toLowerCase()).includes(todayName);
      console.log(`  Today (${todayName}): ${isTodayScheduled ? '✓ SCHEDULED' : '✗ not scheduled'}`);
    }
    
    console.log(`  Next Run: ${template.next_run_at || 'Not set'}`);
    console.log(`  Last Run: ${template.last_run_at || 'Never'}`);
    
    // Check trigger conditions
    if (template.recurring_time) {
      const [schedHour, schedMin] = template.recurring_time.split(':').map(Number);
      const scheduleMinutes = schedHour * 60 + schedMin;
      const currentMinutes = wibTime.hours * 60 + wibTime.minutes;
      const timeDiff = currentMinutes - scheduleMinutes;
      
      console.log('');
      console.log(`  SCHEDULE CHECK:`);
      console.log(`    Scheduled: ${schedHour}:${String(schedMin).padStart(2,'0')} WIB`);
      console.log(`    Current:   ${wibTime.hours}:${String(wibTime.minutes).padStart(2,'0')} WIB`);
      console.log(`    Diff:      ${timeDiff} minutes`);
      
      // Check shouldExecute (0-1 min window)
      let shouldExecute = false;
      if (timeDiff >= 0 && timeDiff <= 1) {
        if (template.recurring_pattern === 'daily') {
          shouldExecute = true;
        } else if (template.recurring_pattern === 'weekly') {
          const isTodayScheduled = recurringDays.map(d => d.toLowerCase()).includes(todayName);
          shouldExecute = isTodayScheduled;
        }
      }
      
      // Check shouldExecuteMissed (overdue)
      let shouldExecuteMissed = false;
      if (timeDiff > 1) {
        if (template.recurring_pattern === 'daily') {
          shouldExecuteMissed = true;
        } else if (template.recurring_pattern === 'weekly') {
          const isTodayScheduled = recurringDays.map(d => d.toLowerCase()).includes(todayName);
          shouldExecuteMissed = isTodayScheduled;
        }
      }
      
      if (shouldExecute) {
        console.log(`    ✓ SHOULD EXECUTE NOW!`);
      } else if (shouldExecuteMissed) {
        console.log(`    ⚠️ OVERDUE - should execute missed schedule`);
      } else if (timeDiff < 0) {
        console.log(`    ⏳ Waiting... (${Math.abs(timeDiff)} minutes until scheduled time)`);
      } else {
        console.log(`    ✗ Not time yet`);
      }
    }
    
    console.log('');
  });
  
  console.log('========================================');
  console.log('If schedules are not running:');
  console.log('1. Make sure app is running (node app.js or pm2)');
  console.log('2. Check logs for [ScheduleService] messages');
  console.log('3. Verify YouTube credentials are valid');
  console.log('4. Restart app after making changes');
  console.log('========================================');
  
  process.exit(0);
}

checkTemplateSchedules().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
