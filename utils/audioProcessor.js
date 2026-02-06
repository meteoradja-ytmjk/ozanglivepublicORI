/**
 * Audio Processor Utility
 * 
 * Pre-processes audio files for optimal streaming:
 * - Converts to AAC format with clean timestamps
 * - Normalizes sample rate to 44100Hz
 * - Ensures stereo output
 * - Removes metadata that can cause timestamp issues
 * 
 * This allows streaming with copy mode (0% CPU) instead of re-encoding
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

// Use system FFmpeg if available, otherwise use bundled
let ffmpegPath;
if (fs.existsSync('/usr/bin/ffmpeg')) {
  ffmpegPath = '/usr/bin/ffmpeg';
} else {
  ffmpegPath = ffmpegInstaller.path;
}

/**
 * Process audio file for optimal streaming
 * Converts to AAC with clean timestamps
 * 
 * @param {string} inputPath - Path to input audio file
 * @param {string} outputPath - Path for processed output (optional, will overwrite input if not provided)
 * @returns {Promise<{success: boolean, outputPath: string, message: string, skipped: boolean}>}
 */
async function processAudioForStreaming(inputPath, outputPath = null) {
  const ext = path.extname(inputPath).toLowerCase();
  
  // For AAC files, check if needs cleaning
  if (ext === '.aac') {
    const needsClean = await checkAACNeedsCleaning(inputPath);
    if (!needsClean.needsCleaning) {
      console.log(`[AudioProcessor] AAC already clean: ${inputPath}`);
      return {
        success: true,
        outputPath: inputPath,
        message: 'AAC already clean, skipped processing',
        skipped: true
      };
    }
    console.log(`[AudioProcessor] AAC needs cleaning: ${needsClean.reason}`);
  }
  
  return new Promise((resolve, reject) => {
    // If no output path, create temp file then replace original
    const tempOutput = outputPath || inputPath.replace(/\.[^.]+$/, '_processed.aac');
    const shouldReplace = !outputPath;
    
    const args = [
      '-y',                    // Overwrite output
      '-i', inputPath,
      '-c:a', 'aac',          // AAC codec
      '-b:a', '128k',         // 128kbps bitrate
      '-ar', '44100',         // 44.1kHz sample rate
      '-ac', '2',             // Stereo
      '-af', 'aresample=async=1:first_pts=0', // Clean timestamps
      '-fflags', '+genpts',   // Generate clean PTS
      '-map_metadata', '-1',  // Remove all metadata (can cause issues)
      tempOutput
    ];
    
    console.log(`[AudioProcessor] Processing: ${inputPath}`);
    console.log(`[AudioProcessor] Command: ffmpeg ${args.join(' ')}`);
    
    const ffmpeg = spawn(ffmpegPath, args);
    
    let stderr = '';
    
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        // Success
        if (shouldReplace) {
          // Replace original with processed file
          try {
            fs.unlinkSync(inputPath);
            fs.renameSync(tempOutput, inputPath.replace(/\.[^.]+$/, '.aac'));
            const finalPath = inputPath.replace(/\.[^.]+$/, '.aac');
            console.log(`[AudioProcessor] Success: ${finalPath}`);
            resolve({
              success: true,
              outputPath: finalPath,
              message: 'Audio processed successfully'
            });
          } catch (err) {
            reject(new Error(`Failed to replace original file: ${err.message}`));
          }
        } else {
          console.log(`[AudioProcessor] Success: ${tempOutput}`);
          resolve({
            success: true,
            outputPath: tempOutput,
            message: 'Audio processed successfully'
          });
        }
      } else {
        console.error(`[AudioProcessor] Failed with code ${code}`);
        console.error(`[AudioProcessor] stderr: ${stderr}`);
        
        // Clean up temp file if exists
        if (fs.existsSync(tempOutput)) {
          fs.unlinkSync(tempOutput);
        }
        
        reject(new Error(`FFmpeg failed with code ${code}: ${stderr.slice(-500)}`));
      }
    });
    
    ffmpeg.on('error', (err) => {
      console.error(`[AudioProcessor] Spawn error: ${err.message}`);
      reject(err);
    });
  });
}

/**
 * Check if audio file needs processing
 * Returns true if file is not AAC or has non-standard settings
 * 
 * @param {string} filePath - Path to audio file
 * @returns {Promise<{needsProcessing: boolean, reason: string}>}
 */
async function checkAudioNeedsProcessing(filePath) {
  return new Promise((resolve) => {
    const ffprobePath = ffmpegPath.replace('ffmpeg', 'ffprobe');
    
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_streams',
      '-select_streams', 'a:0',
      filePath
    ];
    
    const ffprobe = spawn(ffprobePath, args);
    
    let stdout = '';
    
    ffprobe.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    ffprobe.on('close', (code) => {
      if (code !== 0) {
        resolve({ needsProcessing: true, reason: 'Cannot probe file' });
        return;
      }
      
      try {
        const info = JSON.parse(stdout);
        const stream = info.streams && info.streams[0];
        
        if (!stream) {
          resolve({ needsProcessing: true, reason: 'No audio stream found' });
          return;
        }
        
        const codec = stream.codec_name;
        const sampleRate = parseInt(stream.sample_rate);
        const channels = stream.channels;
        
        // Check if already optimal
        if (codec === 'aac' && sampleRate === 44100 && channels === 2) {
          resolve({ needsProcessing: false, reason: 'Already optimized' });
        } else {
          let reasons = [];
          if (codec !== 'aac') reasons.push(`codec: ${codec}`);
          if (sampleRate !== 44100) reasons.push(`sample_rate: ${sampleRate}`);
          if (channels !== 2) reasons.push(`channels: ${channels}`);
          resolve({ needsProcessing: true, reason: reasons.join(', ') });
        }
      } catch (err) {
        resolve({ needsProcessing: true, reason: 'Parse error' });
      }
    });
    
    ffprobe.on('error', () => {
      resolve({ needsProcessing: true, reason: 'Probe failed' });
    });
  });
}

/**
 * Check if AAC file needs cleaning (timestamps/metadata issues)
 * 
 * @param {string} filePath - Path to AAC file
 * @returns {Promise<{needsCleaning: boolean, reason: string}>}
 */
async function checkAACNeedsCleaning(filePath) {
  return new Promise((resolve) => {
    const ffprobePath = ffmpegPath.replace('ffmpeg', 'ffprobe');
    
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      '-select_streams', 'a:0',
      filePath
    ];
    
    const ffprobe = spawn(ffprobePath, args);
    
    let stdout = '';
    
    ffprobe.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    ffprobe.on('close', (code) => {
      if (code !== 0) {
        resolve({ needsCleaning: true, reason: 'Cannot probe file' });
        return;
      }
      
      try {
        const info = JSON.parse(stdout);
        const stream = info.streams && info.streams[0];
        const format = info.format || {};
        
        if (!stream) {
          resolve({ needsCleaning: true, reason: 'No audio stream found' });
          return;
        }
        
        let reasons = [];
        
        // Check sample rate (should be 44100 for optimal streaming)
        const sampleRate = parseInt(stream.sample_rate);
        if (sampleRate !== 44100) {
          reasons.push(`sample_rate: ${sampleRate}`);
        }
        
        // Check channels (should be stereo)
        if (stream.channels !== 2) {
          reasons.push(`channels: ${stream.channels}`);
        }
        
        // Check for metadata (can cause issues)
        const tags = format.tags || {};
        const hasMetadata = Object.keys(tags).length > 0;
        if (hasMetadata) {
          reasons.push('has metadata');
        }
        
        // Check start_time (should be 0 or very close)
        const startTime = parseFloat(stream.start_time || '0');
        if (Math.abs(startTime) > 0.1) {
          reasons.push(`start_time: ${startTime}`);
        }
        
        if (reasons.length > 0) {
          resolve({ needsCleaning: true, reason: reasons.join(', ') });
        } else {
          resolve({ needsCleaning: false, reason: 'Clean' });
        }
      } catch (err) {
        resolve({ needsCleaning: true, reason: 'Parse error' });
      }
    });
    
    ffprobe.on('error', () => {
      resolve({ needsCleaning: true, reason: 'Probe failed' });
    });
  });
}

module.exports = {
  processAudioForStreaming,
  checkAudioNeedsProcessing,
  checkAACNeedsCleaning
};
