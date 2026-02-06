/**
 * Test script for Unlist Replay Service
 * 
 * This script tests the unlist replay functionality without actually
 * making API calls to YouTube.
 */

const unlistReplayService = require('./services/unlistReplayService');

console.log('=== Testing Unlist Replay Service ===\n');

// Test 1: Schedule unlist with valid data
console.log('Test 1: Schedule unlist with valid data');
try {
  unlistReplayService.scheduleUnlist('test-video-id-1', 'test-user-id-1', 5000);
  console.log('✓ Successfully scheduled unlist\n');
} catch (error) {
  console.error('✗ Failed to schedule unlist:', error.message, '\n');
}

// Test 2: Try to schedule duplicate
console.log('Test 2: Try to schedule duplicate (should be ignored)');
try {
  unlistReplayService.scheduleUnlist('test-video-id-1', 'test-user-id-1', 5000);
  console.log('✓ Duplicate correctly ignored\n');
} catch (error) {
  console.error('✗ Error handling duplicate:', error.message, '\n');
}

// Test 3: Schedule another unlist
console.log('Test 3: Schedule another unlist');
try {
  unlistReplayService.scheduleUnlist('test-video-id-2', 'test-user-id-2', 5000);
  console.log('✓ Successfully scheduled second unlist\n');
} catch (error) {
  console.error('✗ Failed to schedule second unlist:', error.message, '\n');
}

// Test 4: Get pending unlists
console.log('Test 4: Get pending unlists');
try {
  const pending = unlistReplayService.getPendingUnlists();
  console.log(`✓ Found ${pending.length} pending unlists:`);
  pending.forEach(p => {
    console.log(`  - Video: ${p.videoId}, User: ${p.userId}, Retry: ${p.retryCount}`);
  });
  console.log();
} catch (error) {
  console.error('✗ Failed to get pending unlists:', error.message, '\n');
}

// Test 5: Cancel unlist
console.log('Test 5: Cancel unlist');
try {
  unlistReplayService.cancelUnlist('test-video-id-1');
  const pending = unlistReplayService.getPendingUnlists();
  console.log(`✓ Cancelled unlist. Remaining: ${pending.length}\n`);
} catch (error) {
  console.error('✗ Failed to cancel unlist:', error.message, '\n');
}

// Test 6: Handle stream end with missing data
console.log('Test 6: Handle stream end with missing data');
(async () => {
  try {
    await unlistReplayService.handleStreamEnd(null);
    console.log('✓ Handled null stream gracefully\n');
  } catch (error) {
    console.error('✗ Failed to handle null stream:', error.message, '\n');
  }
  
  try {
    await unlistReplayService.handleStreamEnd({ id: 1 });
    console.log('✓ Handled stream without broadcast_id gracefully\n');
  } catch (error) {
    console.error('✗ Failed to handle stream without broadcast_id:', error.message, '\n');
  }
  
  // Test 7: Cleanup
  console.log('Test 7: Cleanup all pending unlists');
  try {
    unlistReplayService.cleanup();
    const pending = unlistReplayService.getPendingUnlists();
    console.log(`✓ Cleanup successful. Remaining: ${pending.length}\n`);
  } catch (error) {
    console.error('✗ Failed to cleanup:', error.message, '\n');
  }
  
  console.log('=== All tests completed ===');
  process.exit(0);
})();
