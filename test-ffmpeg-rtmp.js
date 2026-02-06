const { spawn } = require('child_process');
const Stream = require('./models/Stream');
const Video = require('./models/Video');
const path = require('path');

async function testRTMP() {
  console.log('=== TESTING RTMP CONNECTION ===\n');
  
  try {
    const streams = await Stream.findAll();
    const testStream = streams.find(s => s.status === 'scheduled' && s.video_id);
    
    if (!testStream) {
      console.log('No test stream found');
      process.exit(0);
    }
    
    const video = await Video.findById(testStream.video_id);
    
    console.log('Stream:', testStream.title);
    console.log('RTMP URL:', testStream.rtmp_url);
    console.log('Stream Key:', testStream.stream_key ? '***' + testStream.stream_key.slice(-8) : 'MISSING');
    console.log('');
    
    if (!testStream.stream_key) {
      console.log('❌ STREAM KEY IS MISSING!');
      console.log('This is why the stream cannot start.');
      console.log('\nTo fix:');
      console.log('1. Go to YouTube Studio');
      console.log('2. Get a valid stream key');
      console.log('3. Update the stream with the new key');
      process.exit(1);
    }
    
    const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
    const projectRoot = path.resolve(__dirname);
    const relativeVideoPath = video.filepath.startsWith('/') ? video.filepath.substring(1) : video.filepath;
    const videoPath = relativeVideoPath.startsWith('public/') 
      ? path.join(projectRoot, relativeVideoPath)
      : path.join(projectRoot, 'public', relativeVideoPath);
    
    const rtmpUrl = `${testStream.rtmp_url.replace(/\/$/, '')}/${testStream.stream_key}`;
    
    console.log('Testing FFmpeg command...');
    console.log('Video path:', videoPath);
    console.log('Full RTMP URL:', rtmpUrl.replace(testStream.stream_key, '***' + testStream.stream_key.slice(-8)));
    console.log('');
    
    // Test with a very short duration (5 seconds)
    const args = [
      '-re',
      '-i', videoPath,
      '-c', 'copy',
      '-t', '5',
      '-f', 'flv',
      rtmpUrl
    ];
    
    console.log('Command:', ffmpegPath, args.join(' '));
    console.log('\nStarting FFmpeg (5 second test)...\n');
    
    const ffmpegProcess = spawn(ffmpegPath, args);
    
    let output = '';
    let errorOutput = '';
    
    ffmpegProcess.stdout.on('data', (data) => {
      output += data.toString();
      process.stdout.write(data);
    });
    
    ffmpegProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      process.stderr.write(data);
    });
    
    ffmpegProcess.on('exit', (code, signal) => {
      console.log('\n\n=== RESULT ===');
      console.log('Exit code:', code);
      console.log('Signal:', signal);
      
      if (code === 0) {
        console.log('\n✅ SUCCESS! FFmpeg can connect to RTMP server');
        console.log('The stream key is valid and working');
      } else {
        console.log('\n❌ FAILED! FFmpeg cannot connect');
        
        if (errorOutput.includes('Connection refused')) {
          console.log('\nProblem: RTMP server refused connection');
          console.log('Possible causes:');
          console.log('- RTMP URL is incorrect');
          console.log('- YouTube server is down');
          console.log('- Network/firewall blocking connection');
        } else if (errorOutput.includes('401') || errorOutput.includes('403') || errorOutput.includes('Unauthorized')) {
          console.log('\nProblem: Stream key is invalid or expired');
          console.log('Solution: Get a new stream key from YouTube Studio');
        } else if (errorOutput.includes('404')) {
          console.log('\nProblem: Stream endpoint not found');
          console.log('Solution: Check RTMP URL is correct');
        } else {
          console.log('\nCheck the error output above for details');
        }
      }
      
      process.exit(code);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

testRTMP();
