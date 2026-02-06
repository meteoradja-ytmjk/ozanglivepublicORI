/**
 * Script to check scheduled streams in the database
 * Run with: node check-schedules.js
 */

const { db, waitForDbInit } = require('./db/database');

async function checkSchedules() {
  await waitForDbInit();
  
  console.log('\n=== CHECKING SCHEDULED STREAMS ===\n');
  
  // Check all streams with schedules
  const query = `
    SELECT id, title, status, schedule_type, schedule_time, recurring_time, 
           recurring_enabled, schedule_days, stream_duration_minutes
    FROM streams 
    WHERE schedule_type IS NOT NULL
    ORDER BY schedule_type, schedule_time
  `;
  
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Error:', err.message);
      process.exit(1);
    }
    
    if (!rows || rows.length === 0) {
      console.log('No scheduled streams found.');
      process.exit(0);
    }
    
    const now = new Date();
    console.log(`Current time: ${now.toISOString()}`);
    console.log(`Current local: ${now.toLocaleString()}\n`);
    
    // Group by schedule type
    const once = rows.filter(r => r.schedule_type === 'once');
    const daily = rows.filter(r => r.schedule_type === 'daily');
    const weekly = rows.filter(r => r.schedule_type === 'weekly');
    
    if (once.length > 0) {
      console.log('=== ONCE SCHEDULES ===');
      once.forEach(stream => {
        const schedTime = stream.schedule_time ? new Date(stream.schedule_time) : null;
        const diff = schedTime ? (schedTime.getTime() - now.getTime()) / 60000 : null;
        console.log(`  ID: ${stream.id}`);
        console.log(`  Title: ${stream.title}`);
        console.log(`  Status: ${stream.status}`);
        console.log(`  Schedule Time: ${stream.schedule_time}`);
        console.log(`  Schedule Local: ${schedTime ? schedTime.toLocaleString() : 'N/A'}`);
        console.log(`  Time Diff: ${diff ? diff.toFixed(1) + ' minutes' : 'N/A'} ${diff && diff < 0 ? '(PAST)' : diff && diff > 0 ? '(FUTURE)' : ''}`);
        console.log(`  Duration: ${stream.stream_duration_minutes || 'unlimited'} minutes`);
        console.log('');
      });
    }
    
    if (daily.length > 0) {
      console.log('=== DAILY SCHEDULES ===');
      daily.forEach(stream => {
        console.log(`  ID: ${stream.id}`);
        console.log(`  Title: ${stream.title}`);
        console.log(`  Status: ${stream.status}`);
        console.log(`  Recurring Time: ${stream.recurring_time}`);
        console.log(`  Recurring Enabled: ${stream.recurring_enabled}`);
        console.log(`  Duration: ${stream.stream_duration_minutes || 'unlimited'} minutes`);
        console.log('');
      });
    }
    
    if (weekly.length > 0) {
      console.log('=== WEEKLY SCHEDULES ===');
      weekly.forEach(stream => {
        let days = [];
        try {
          days = JSON.parse(stream.schedule_days || '[]');
        } catch (e) {}
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        console.log(`  ID: ${stream.id}`);
        console.log(`  Title: ${stream.title}`);
        console.log(`  Status: ${stream.status}`);
        console.log(`  Recurring Time: ${stream.recurring_time}`);
        console.log(`  Schedule Days: ${days.map(d => dayNames[d]).join(', ')}`);
        console.log(`  Recurring Enabled: ${stream.recurring_enabled}`);
        console.log(`  Duration: ${stream.stream_duration_minutes || 'unlimited'} minutes`);
        console.log('');
      });
    }
    
    console.log('=== SUMMARY ===');
    console.log(`Total: ${rows.length} scheduled streams`);
    console.log(`Once: ${once.length}`);
    console.log(`Daily: ${daily.length}`);
    console.log(`Weekly: ${weekly.length}`);
    
    process.exit(0);
  });
}

checkSchedules().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
