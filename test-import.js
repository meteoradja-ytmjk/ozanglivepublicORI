/**
 * Test script to verify import functionality
 * This script simulates the import API call to test if the fix works
 */

const fs = require('fs');
const path = require('path');

// Import the backupService
const backupService = require('./services/backupService');

async function testImport() {
    console.log('=== Testing Import Functionality ===\n');

    try {
        // Read the backup file
        const backupFilePath = 'c:\\Users\\meteo\\Downloads\\ozanglive-full-backup-2026-02-06 (1).json';
        console.log(`Reading backup file: ${backupFilePath}`);

        const fileContent = fs.readFileSync(backupFilePath, 'utf8');
        const backupData = JSON.parse(fileContent);

        console.log('✓ Backup file loaded successfully');
        console.log(`  - Export date: ${backupData.metadata?.exportDate}`);
        console.log(`  - Export type: ${backupData.metadata?.exportType}`);
        console.log(`  - Categories in backup:`);

        const categories = ['streams', 'youtube_credentials', 'broadcast_templates',
            'recurring_schedules', 'stream_templates', 'playlists',
            'title_folders', 'title_suggestions', 'thumbnail_files'];

        categories.forEach(cat => {
            if (backupData[cat]) {
                if (Array.isArray(backupData[cat])) {
                    console.log(`    - ${cat}: ${backupData[cat].length} items`);
                } else if (typeof backupData[cat] === 'object') {
                    console.log(`    - ${cat}: object`);
                }
            }
        });

        console.log('\n=== Testing comprehensiveImport Function ===\n');

        // Test with a dummy user ID (1)
        const userId = 1;
        const options = {
            skipDuplicates: true
        };

        console.log('Calling comprehensiveImport...');
        const result = await backupService.comprehensiveImport(backupData, userId, options);

        console.log('\n=== Import Results ===\n');

        if (result.success) {
            console.log('✓ Import completed successfully!\n');

            console.log('Results by category:');
            Object.keys(result.results || {}).forEach(category => {
                const catResult = result.results[category];
                console.log(`\n  ${category}:`);
                console.log(`    - Imported: ${catResult.imported || 0}`);
                console.log(`    - Skipped: ${catResult.skipped || 0}`);
                if (catResult.errors && catResult.errors.length > 0) {
                    console.log(`    - Errors: ${catResult.errors.length}`);
                    catResult.errors.slice(0, 3).forEach(err => {
                        console.log(`      • ${err}`);
                    });
                    if (catResult.errors.length > 3) {
                        console.log(`      ... and ${catResult.errors.length - 3} more`);
                    }
                }
            });

            if (result.warnings && result.warnings.length > 0) {
                console.log('\nWarnings:');
                result.warnings.forEach(warning => {
                    console.log(`  ⚠ ${warning}`);
                });
            }

            console.log('\n✓ TEST PASSED: Import function works correctly!');
        } else {
            console.log('✗ Import failed!');
            console.log(`Error: ${result.error}`);
            if (result.details) {
                console.log('Details:', result.details);
            }
            console.log('\n✗ TEST FAILED');
            process.exit(1);
        }

    } catch (error) {
        console.error('\n✗ TEST FAILED with exception:');
        console.error(`Error: ${error.message}`);
        console.error(`Stack: ${error.stack}`);
        process.exit(1);
    }
}

// Run the test
testImport().then(() => {
    console.log('\nTest completed. Exiting...');
    process.exit(0);
}).catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
});
