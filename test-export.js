/**
 * Simple test script to verify export functionality
 */

const backupService = require('./services/backupService');

async function testExport() {
  try {
    console.log('Testing export functionality...');
    
    // Test with a sample user ID (replace with actual user ID from your database)
    const userId = '1'; // Change this to a valid user ID
    
    console.log(`\nExporting data for user ${userId}...`);
    
    // Test exporting all categories
    const categories = [
      'streams',
      'youtube_credentials',
      'broadcast_templates',
      'recurring_schedules',
      'stream_templates',
      'playlists',
      'title_folders',
      'title_suggestions',
      'thumbnail_files'
    ];
    
    const backup = await backupService.comprehensiveExport(userId, categories);
    
    console.log('\n=== Export Results ===');
    console.log('Metadata:', JSON.stringify(backup.metadata, null, 2));
    
    // Format and check size
    const jsonString = backupService.formatBackupJson(backup);
    const sizeInMB = Buffer.byteLength(jsonString, 'utf8') / (1024 * 1024);
    
    console.log(`\nTotal export size: ${sizeInMB.toFixed(2)} MB`);
    
    if (sizeInMB > 50) {
      console.error('ERROR: Export size exceeds 50MB limit!');
    } else {
      console.log('SUCCESS: Export size is within limits');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Export test failed:', error);
    process.exit(1);
  }
}

testExport();
