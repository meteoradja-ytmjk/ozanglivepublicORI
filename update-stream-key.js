const { db } = require('./db/database');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function updateStreamKey() {
  console.log('=== UPDATE STREAM KEY ===\n');
  
  // Get all streams
  db.all('SELECT id, title, stream_key, rtmp_url FROM streams ORDER BY created_at DESC', [], async (err, streams) => {
    if (err) {
      console.error('Error:', err.message);
      process.exit(1);
    }
    
    if (streams.length === 0) {
      console.log('No streams found');
      process.exit(0);
    }
    
    console.log('Available streams:\n');
    streams.forEach((stream, index) => {
      const keyPreview = stream.stream_key ? '***' + stream.stream_key.slice(-8) : 'MISSING';
      console.log(`${index + 1}. ${stream.title}`);
      console.log(`   ID: ${stream.id}`);
      console.log(`   Current key: ${keyPreview}`);
      console.log(`   RTMP URL: ${stream.rtmp_url}`);
      console.log('');
    });
    
    const choice = await question('Enter stream number to update (or 0 to cancel): ');
    const streamIndex = parseInt(choice) - 1;
    
    if (streamIndex < 0 || streamIndex >= streams.length) {
      console.log('Cancelled');
      rl.close();
      process.exit(0);
    }
    
    const selectedStream = streams[streamIndex];
    console.log(`\nSelected: ${selectedStream.title}`);
    
    const newKey = await question('\nEnter new stream key (from YouTube Studio): ');
    
    if (!newKey || newKey.trim() === '') {
      console.log('No key entered, cancelled');
      rl.close();
      process.exit(0);
    }
    
    const trimmedKey = newKey.trim();
    
    // Update the stream key
    db.run('UPDATE streams SET stream_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
      [trimmedKey, selectedStream.id], 
      function(err) {
        if (err) {
          console.error('Error updating:', err.message);
          rl.close();
          process.exit(1);
        }
        
        console.log('\n✅ Stream key updated successfully!');
        console.log(`Stream: ${selectedStream.title}`);
        console.log(`New key: ***${trimmedKey.slice(-8)}`);
        console.log('\nYou can now try to start the stream.');
        
        rl.close();
        db.close();
        process.exit(0);
      }
    );
  });
}

updateStreamKey();
