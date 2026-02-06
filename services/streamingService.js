const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const schedulerService = require('./schedulerService');
const LiveLimitService = require('./liveLimitService');
const youtubeStatusSync = require('./youtubeStatusSync');
const rtmpHealthMonitor = require('./rtmpHealthMonitor');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db/database');
const Stream = require('../models/Stream');
const Playlist = require('../models/Playlist');
const { calculateDurationSeconds, calculateRemainingDuration, formatDuration } = require('../utils/durationCalculator');
let ffmpegPath;
if (fs.existsSync('/usr/bin/ffmpeg')) {
  ffmpegPath = '/usr/bin/ffmpeg';
  console.log('Using system FFmpeg at:', ffmpegPath);
} else {
  ffmpegPath = ffmpegInstaller.path;
  console.log('Using bundled FFmpeg at:', ffmpegPath);
}
const Video = require('../models/Video');
const Audio = require('../models/Audio');
const activeStreams = new Map();
const streamLogs = new Map();
const streamRetryCount = new Map();
const MAX_RETRY_ATTEMPTS = 3;
const manuallyStoppingStreams = new Set();
const MAX_LOG_LINES = 50; // OPTIMIZED: Reduced from 100 to 50 to save memory

// Duration tracking for automatic stream termination
// Structure: { streamId: { startTime: Date, durationMs: number, expectedEndTime: Date } }
const streamDurationInfo = new Map();

// PID tracking for FFmpeg process verification
// Structure: { streamId: pid }
const streamPids = new Map();

// MEMORY MANAGEMENT: Periodic cleanup of stale entries
// This prevents memory leaks from orphaned entries
const CLEANUP_INTERVAL = 4 * 60 * 60 * 1000; // Every 4 hours (was 2 hours)

// PROCESS HEALTH CHECK: Verify FFmpeg processes are still running
// This catches cases where FFmpeg dies without triggering exit event
const PROCESS_CHECK_INTERVAL = 60 * 60 * 1000; // Every 60 minutes (was 30 minutes) - FFmpeg exit event handles normal cases

/**
 * Handle unlist replay on stream end
 * Checks if the stream has YouTube broadcast settings with unlistReplayOnEnd enabled
 * Uses delayed retry mechanism to wait for YouTube replay processing
 * @param {Object} stream - Stream object from database
 */
async function handleUnlistReplayOnEnd(stream) {
  if (!stream || !stream.youtube_broadcast_id) return;
  
  try {
    // Lazy require to avoid circular dependency
    const unlistReplayService = require('./unlistReplayService');
    
    // Use the new service which handles delayed retry logic
    await unlistReplayService.handleStreamEnd(stream);
  } catch (err) {
    console.error(`[StreamingService] Error handling unlist replay:`, err.message);
  }
}

/**
 * Clean up stale entries from Maps to prevent memory leaks
 * Only removes entries for streams that are no longer active
 */
function cleanupStaleMaps() {
  try {
    const activeIds = new Set(activeStreams.keys());
    let cleaned = 0;
    
    // Clean streamLogs for inactive streams (keep last 10 entries for debugging)
    for (const [id] of streamLogs) {
      if (!activeIds.has(id)) {
        streamLogs.delete(id);
        cleaned++;
      }
    }
    
    // Clean streamRetryCount for inactive streams
    for (const [id] of streamRetryCount) {
      if (!activeIds.has(id)) {
        streamRetryCount.delete(id);
        cleaned++;
      }
    }
    
    // Clean streamDurationInfo for inactive streams
    for (const [id] of streamDurationInfo) {
      if (!activeIds.has(id)) {
        streamDurationInfo.delete(id);
        cleaned++;
      }
    }
    
    // Clean streamPids for inactive streams
    for (const [id] of streamPids) {
      if (!activeIds.has(id)) {
        streamPids.delete(id);
        cleaned++;
      }
    }
    
    // Clean manuallyStoppingStreams for inactive streams
    for (const id of manuallyStoppingStreams) {
      if (!activeIds.has(id)) {
        manuallyStoppingStreams.delete(id);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`[StreamingService] Cleaned ${cleaned} stale entries from Maps`);
    }
  } catch (error) {
    console.error('[StreamingService] Error during cleanup:', error.message);
  }
}

// Start cleanup interval (will be tracked by app.js global override)
setInterval(cleanupStaleMaps, CLEANUP_INTERVAL);

/**
 * Check if a specific process is still running by PID
 * @param {number} pid - Process ID to check
 * @returns {Promise<boolean>} True if process is running
 */
async function isProcessRunning(pid) {
  if (!pid) return false;
  
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const cmd = isWindows 
      ? `tasklist /FI "PID eq ${pid}" /NH`
      : `ps -p ${pid} -o pid=`;
    
    exec(cmd, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        resolve(false);
        return;
      }
      // Check if PID is in output
      const hasProcess = stdout && stdout.includes(pid.toString());
      resolve(hasProcess);
    });
  });
}

/**
 * Periodic health check for all active streams
 * Verifies FFmpeg processes are still running and updates status if not
 * OPTIMIZED: Uses lightweight process.kill(pid, 0) first, only spawns external commands if needed
 */
async function checkStreamProcessHealth() {
  try {
    const activeStreamIds = Array.from(activeStreams.keys());
    
    if (activeStreamIds.length === 0) {
      return; // No active streams to check
    }
    
    console.log(`[ProcessHealthCheck] Checking ${activeStreamIds.length} active streams...`);
    
    for (const streamId of activeStreamIds) {
      try {
        const ffmpegProcess = activeStreams.get(streamId);
        
        // OPTIMIZED: Method 1 only - use process.kill(pid, 0) which is very lightweight
        // This is sufficient for processes we spawned ourselves
        let processAlive = false;
        if (ffmpegProcess && !ffmpegProcess.killed && ffmpegProcess.pid) {
          try {
            // Sending signal 0 checks if process exists without killing it
            // This is a synchronous, lightweight operation
            process.kill(ffmpegProcess.pid, 0);
            processAlive = true;
          } catch (e) {
            // Process doesn't exist (ESRCH) or no permission (EPERM)
            processAlive = false;
          }
        }
        
        if (!processAlive) {
          console.log(`[ProcessHealthCheck] Stream ${streamId}: FFmpeg process NOT running, updating status`);
          
          // Clean up
          activeStreams.delete(streamId);
          streamPids.delete(streamId);
          clearDurationInfo(streamId);
          
          // Update database status
          const stream = await Stream.findById(streamId);
          if (stream && stream.status === 'live') {
            const newStatus = getStatusAfterStreamEnd(stream);
            await Stream.updateStatus(streamId, newStatus, stream.user_id);
            console.log(`[ProcessHealthCheck] Updated stream ${streamId} status to '${newStatus}'`);
            addStreamLog(streamId, `Process health check: FFmpeg not running, status updated to '${newStatus}'`);
            
            // Save history
            const updatedStream = await Stream.findById(streamId);
            await saveStreamHistory(updatedStream);
            
            // Cancel any scheduled termination
            if (typeof schedulerService !== 'undefined' && schedulerService.handleStreamStopped) {
              schedulerService.handleStreamStopped(streamId);
            }
          }
        } else {
          // Process is alive, log occasionally for debugging
          const durationInfo = getDurationInfo(streamId);
          if (durationInfo) {
            const remainingMs = getRemainingTime(streamId);
            const remainingMin = remainingMs ? (remainingMs / 60000).toFixed(1) : 'unlimited';
            console.log(`[ProcessHealthCheck] Stream ${streamId}: OK (remaining: ${remainingMin} min)`);
          }
        }
      } catch (streamError) {
        console.error(`[ProcessHealthCheck] Error checking stream ${streamId}:`, streamError.message);
      }
    }
    
    // OPTIMIZED: Removed heavy database check for "live" streams not in memory
    // This was spawning external processes for each orphaned stream
    // The cleanup is now handled by cleanupStaleMaps() which runs less frequently
  } catch (error) {
    console.error('[ProcessHealthCheck] Error during health check:', error.message);
  }
}

// Start process health check interval
setInterval(checkStreamProcessHealth, PROCESS_CHECK_INTERVAL);

/**
 * Check if any FFmpeg process is currently running
 * @returns {Promise<boolean>} True if any FFmpeg process is running
 */
async function isAnyFFmpegRunning() {
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const cmd = isWindows 
      ? `tasklist /FI "IMAGENAME eq ffmpeg.exe" /NH`
      : `pgrep -x ffmpeg`;
    
    exec(cmd, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        resolve(false);
        return;
      }
      // Check if any FFmpeg process found
      const hasFFmpeg = stdout && stdout.trim().length > 0;
      resolve(hasFFmpeg);
    });
  });
}

/**
 * Check if FFmpeg is streaming to a specific RTMP URL
 * Uses multiple methods to detect running FFmpeg processes
 * @param {string} streamKey - The stream key to search for
 * @returns {Promise<boolean>} True if FFmpeg process found streaming to this key
 */
async function isFFmpegStreamingToKey(streamKey) {
  if (!streamKey) return false;
  
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    
    // On Linux, use ps with wide output to see full command line
    // Escape special characters in stream key for grep
    const escapedKey = streamKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    const cmd = isWindows 
      ? `wmic process where "name='ffmpeg.exe'" get commandline /format:list`
      : `ps auxww | grep ffmpeg | grep -v grep`;
    
    exec(cmd, { timeout: 10000, maxBuffer: 1024 * 1024 }, (error, stdout) => {
      if (error) {
        // Command failed - assume FFmpeg might still be running
        // Don't change status on error
        console.log(`[StreamingService] FFmpeg check command failed: ${error.message}`);
        resolve(true); // Assume running to be safe
        return;
      }
      
      if (!stdout || stdout.trim().length === 0) {
        // No FFmpeg processes at all
        resolve(false);
        return;
      }
      
      // Check if output contains the stream key
      const found = stdout.includes(streamKey);
      if (found) {
        console.log(`[StreamingService] Found FFmpeg process with stream key: ${streamKey.substring(0, 8)}...`);
      }
      resolve(found);
    });
  });
}

/**
 * Determine the correct status after a stream ends
 * For recurring streams (daily/weekly), status should be 'scheduled' so they can run again
 * For one-time streams, status should be 'offline'
 * 
 * @param {Object} stream - Stream object from database
 * @returns {string} The status to set ('offline' or 'scheduled')
 */
function getStatusAfterStreamEnd(stream) {
  if (!stream) return 'offline';
  
  // Handle recurring_enabled as both boolean and integer (SQLite stores as 0/1)
  const isRecurringEnabled = stream.recurring_enabled === true || stream.recurring_enabled === 1;
  
  // For recurring streams (daily/weekly) that are enabled, set back to 'scheduled'
  if ((stream.schedule_type === 'daily' || stream.schedule_type === 'weekly') && isRecurringEnabled) {
    console.log(`[StreamingService] Recurring stream ${stream.id} (${stream.schedule_type}) - setting status to 'scheduled'`);
    return 'scheduled';
  }
  
  // For one-time streams or disabled recurring streams, set to 'offline'
  return 'offline';
}

/**
 * Set duration info for a stream
 * @param {string} streamId - Stream ID
 * @param {Date} startTime - Stream start time
 * @param {number} durationMs - Duration in milliseconds
 * @returns {boolean} True if duration was set successfully
 */
function setDurationInfo(streamId, startTime, durationMs) {
  // Validate durationMs is positive
  if (!durationMs || durationMs <= 0) {
    console.log(`[StreamingService] Duration tracking skipped for stream ${streamId}: invalid duration (${durationMs}ms)`);
    return false;
  }
  
  const expectedEndTime = new Date(startTime.getTime() + durationMs);
  const minutes = durationMs / 60000;
  const seconds = durationMs / 1000;
  
  streamDurationInfo.set(streamId, {
    startTime,
    durationMs,
    expectedEndTime,
    originalDurationMs: durationMs // Store original for restart calculation
  });
  
  // Log with consistent format: "Duration set: X minutes (Y seconds)"
  console.log(`[StreamingService] Duration set: ${minutes.toFixed(1)} minutes (${seconds} seconds)`);
  console.log(`[StreamingService] Stream ${streamId} expected end: ${expectedEndTime.toISOString()}`);
  
  return true;
}

/**
 * Get duration info for a stream
 * @param {string} streamId - Stream ID
 * @returns {Object|null} Duration info or null if not set
 */
function getDurationInfo(streamId) {
  return streamDurationInfo.get(streamId) || null;
}

/**
 * Clear duration info for a stream
 * @param {string} streamId - Stream ID
 */
function clearDurationInfo(streamId) {
  if (streamDurationInfo.has(streamId)) {
    streamDurationInfo.delete(streamId);
    console.log(`[StreamingService] Duration tracking cleared for stream ${streamId}`);
  }
}

/**
 * Check if stream duration has been exceeded
 * @param {string} streamId - Stream ID
 * @returns {boolean} True if duration exceeded
 */
function isStreamDurationExceeded(streamId) {
  const info = getDurationInfo(streamId);
  if (!info || !info.expectedEndTime) return false;
  return new Date() >= info.expectedEndTime;
}

/**
 * Get remaining time for a stream in milliseconds
 * @param {string} streamId - Stream ID
 * @returns {number|null} Remaining time in ms, or null if no duration set
 */
function getRemainingTime(streamId) {
  const info = getDurationInfo(streamId);
  if (!info || !info.expectedEndTime) return null;
  return Math.max(0, info.expectedEndTime.getTime() - Date.now());
}

/**
 * Check if stream is ending soon (less than 5 minutes remaining)
 * @param {string} streamId - Stream ID
 * @returns {boolean} True if ending soon
 */
function isStreamEndingSoon(streamId) {
  const remainingMs = getRemainingTime(streamId);
  if (remainingMs === null) return false;
  return remainingMs < 300000; // 5 minutes in ms
}

/**
 * Get original duration for a stream (for restart calculation)
 * @param {string} streamId - Stream ID
 * @returns {number|null} Original duration in ms, or null if not set
 */
function getOriginalDurationMs(streamId) {
  const info = getDurationInfo(streamId);
  if (!info) return null;
  return info.originalDurationMs || info.durationMs || null;
}

/**
 * Calculate remaining duration for stream restart
 * Uses the original start time and duration to calculate how much time is left
 * @param {string} streamId - Stream ID
 * @returns {number} Remaining duration in milliseconds (minimum 0)
 */
function calculateStreamRemainingDuration(streamId) {
  const info = getDurationInfo(streamId);
  if (!info || !info.startTime || !info.originalDurationMs) {
    return 0;
  }
  return calculateRemainingDuration(info.startTime, info.originalDurationMs);
}
function addStreamLog(streamId, message) {
  if (!streamLogs.has(streamId)) {
    streamLogs.set(streamId, []);
  }
  const logs = streamLogs.get(streamId);
  logs.push({
    timestamp: new Date().toISOString(),
    message
  });
  if (logs.length > MAX_LOG_LINES) {
    logs.shift();
  }
}
async function buildFFmpegArgsForPlaylist(stream, playlist) {
  if (!playlist.videos || playlist.videos.length === 0) {
    throw new Error(`Playlist is empty for playlist_id: ${stream.video_id}`);
  }
  
  const projectRoot = path.resolve(__dirname, '..');
  const rtmpUrl = `${stream.rtmp_url.replace(/\/$/, '')}/${stream.stream_key}`;
  
  // Calculate duration - prioritize stream_duration_minutes directly
  // This is critical for recurring streams where schedule_time/end_time may be stale
  let durationSeconds = null;
  
  // Priority 1: stream_duration_minutes (most reliable)
  if (stream.stream_duration_minutes && stream.stream_duration_minutes > 0) {
    durationSeconds = stream.stream_duration_minutes * 60;
    console.log(`[StreamingService] Playlist using stream_duration_minutes: ${stream.stream_duration_minutes} minutes (${durationSeconds} seconds)`);
  } else {
    // Fallback to centralized calculator
    durationSeconds = calculateDurationSeconds(stream);
    if (durationSeconds) {
      console.log(`[StreamingService] Playlist using calculated duration: ${formatDuration(durationSeconds)}`);
    }
  }
  
  if (durationSeconds) {
    console.log(`[StreamingService] Playlist FFmpeg -t will be set to: ${durationSeconds} seconds (${durationSeconds / 60} minutes)`);
  } else {
    console.log('[StreamingService] No duration set for playlist - stream will run until playlist ends or loop exhausts');
  }
  
  let videoPaths = [];
  
  if (playlist.is_shuffle || playlist.shuffle) {
    const shuffledVideos = [...playlist.videos].sort(() => Math.random() - 0.5);
    videoPaths = shuffledVideos.map(video => {
      const relativeVideoPath = video.filepath.startsWith('/') ? video.filepath.substring(1) : video.filepath;
      return path.join(projectRoot, 'public', relativeVideoPath);
    });
  } else {
    videoPaths = playlist.videos.map(video => {
      const relativeVideoPath = video.filepath.startsWith('/') ? video.filepath.substring(1) : video.filepath;
      return path.join(projectRoot, 'public', relativeVideoPath);
    });
  }
  
  for (const videoPath of videoPaths) {
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found: ${videoPath}`);
    }
  }
  
  const concatFile = path.join(projectRoot, 'temp', `playlist_${stream.id}.txt`);
  
  const tempDir = path.dirname(concatFile);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  let concatContent = '';
  if (stream.loop_video) {
    for (let i = 0; i < 1000; i++) {
      videoPaths.forEach(videoPath => {
        concatContent += `file '${videoPath.replace(/\\/g, '/')}'\n`;
      });
    }
  } else {
    videoPaths.forEach(videoPath => {
      concatContent += `file '${videoPath.replace(/\\/g, '/')}'\n`;
    });
  }
  
  fs.writeFileSync(concatFile, concatContent);
  
  // Non-advanced mode - minimal copy
  if (!stream.use_advanced_settings) {
    const args = [
      '-re',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatFile,
      '-c', 'copy'
    ];
    
    // CRITICAL: -t must be placed BEFORE -f flv and output URL
    if (durationSeconds && durationSeconds > 0) {
      args.push('-t', durationSeconds.toString());
    }
    
    args.push('-f', 'flv');
    args.push(rtmpUrl);
    console.log('[StreamingService] Playlist: minimal copy');
    return args;
  }
  
  // Advanced mode - encode video, copy audio
  const resolution = stream.resolution || '1280x720';
  const bitrate = stream.bitrate || 2500;
  const fps = stream.fps || 30;
  
  const advancedArgs = [
    '-re',
    '-f', 'concat',
    '-safe', '0',
    '-i', concatFile,
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-tune', 'zerolatency',
    '-b:v', `${bitrate}k`,
    '-bufsize', `${bitrate * 2}k`,
    '-maxrate', `${Math.floor(bitrate * 1.5)}k`,
    '-pix_fmt', 'yuv420p',
    '-g', `${fps * 2}`,
    '-s', resolution,
    '-r', fps.toString(),
    '-c:a', 'copy'
  ];
  
  // CRITICAL: -t must be placed BEFORE -f flv and output URL
  if (durationSeconds && durationSeconds > 0) {
    advancedArgs.push('-t', durationSeconds.toString());
  }
  
  advancedArgs.push('-f', 'flv');
  advancedArgs.push(rtmpUrl);
  console.log('[StreamingService] Playlist: encoding mode');
  return advancedArgs;
}

async function buildFFmpegArgs(stream) {
  const streamWithVideo = await Stream.getStreamWithVideo(stream.id);
  
  if (streamWithVideo && streamWithVideo.video_type === 'playlist') {
    const Playlist = require('../models/Playlist');
    const playlist = await Playlist.findByIdWithVideos(stream.video_id);
    
    if (!playlist) {
      throw new Error(`Playlist not found for playlist_id: ${stream.video_id}`);
    }
    
    return await buildFFmpegArgsForPlaylist(stream, playlist);
  }
  
  const video = await Video.findById(stream.video_id);
  if (!video) {
    throw new Error(`Video record not found in database for video_id: ${stream.video_id}`);
  }
  
  const relativeVideoPath = video.filepath.startsWith('/') ? video.filepath.substring(1) : video.filepath;
  const projectRoot = path.resolve(__dirname, '..');
  // FIXED: Don't add 'public' if relativeVideoPath already starts with 'public/'
  const videoPath = relativeVideoPath.startsWith('public/') 
    ? path.join(projectRoot, relativeVideoPath)
    : path.join(projectRoot, 'public', relativeVideoPath);
  
  if (!fs.existsSync(videoPath)) {
    console.error(`[StreamingService] CRITICAL: Video file not found on disk.`);
    console.error(`[StreamingService] Checked path: ${videoPath}`);
    console.error(`[StreamingService] stream.video_id: ${stream.video_id}`);
    console.error(`[StreamingService] video.filepath (from DB): ${video.filepath}`);
    console.error(`[StreamingService] Calculated relativeVideoPath: ${relativeVideoPath}`);
    console.error(`[StreamingService] process.cwd(): ${process.cwd()}`);
    throw new Error('Video file not found on disk. Please check paths and file existence.');
  }
  
  // Check if audio is selected
  let audioPath = null;
  if (stream.audio_id) {
    const audio = await Audio.findById(stream.audio_id);
    if (!audio) {
      throw new Error(`Audio not found for audio_id: ${stream.audio_id}`);
    }
    const relativeAudioPath = audio.filepath.startsWith('/') ? audio.filepath.substring(1) : audio.filepath;
    // FIXED: Don't add 'public' if relativeAudioPath already starts with 'public/'
    audioPath = relativeAudioPath.startsWith('public/') 
      ? path.join(projectRoot, relativeAudioPath)
      : path.join(projectRoot, 'public', relativeAudioPath);
    if (!fs.existsSync(audioPath)) {
      console.error(`[StreamingService] CRITICAL: Audio file not found on disk.`);
      console.error(`[StreamingService] Checked path: ${audioPath}`);
      throw new Error('Audio file not found on disk. Please check paths and file existence.');
    }
  }
  
  const rtmpUrl = `${stream.rtmp_url.replace(/\/$/, '')}/${stream.stream_key}`;
  
  // Calculate duration - prioritize stream_duration_minutes directly
  // This is critical for recurring streams where schedule_time/end_time may be stale
  let durationSeconds = null;
  
  // Priority 1: stream_duration_minutes (most reliable)
  if (stream.stream_duration_minutes && stream.stream_duration_minutes > 0) {
    durationSeconds = stream.stream_duration_minutes * 60;
    console.log(`[StreamingService] FFmpeg using stream_duration_minutes: ${stream.stream_duration_minutes} minutes (${durationSeconds} seconds)`);
  } else {
    // Fallback to centralized calculator for other cases
    durationSeconds = calculateDurationSeconds(stream);
    if (durationSeconds) {
      console.log(`[StreamingService] FFmpeg using calculated duration: ${formatDuration(durationSeconds)}`);
    }
  }
  
  if (durationSeconds) {
    console.log(`[StreamingService] FFmpeg -t will be set to: ${durationSeconds} seconds (${durationSeconds / 60} minutes)`);
  } else {
    console.log('[StreamingService] No duration set for FFmpeg - stream will run indefinitely');
  }
  
  // Build FFmpeg args based on whether audio is selected
  if (audioPath) {
    // Video + Audio merge with looping
    return buildFFmpegArgsWithAudio(videoPath, audioPath, rtmpUrl, durationSeconds, stream.loop_video);
  } else {
    // Video only (preserve original audio)
    return buildFFmpegArgsVideoOnly(videoPath, rtmpUrl, durationSeconds, stream.loop_video);
  }
}

/**
 * Build FFmpeg args for video + separate audio streaming
 * 
 * MINIMAL CPU (~1%) - Full copy mode
 * 
 * IMPORTANT: -t parameter must be placed BEFORE the output URL to limit output duration
 * When using -stream_loop -1, FFmpeg will loop input infinitely, but -t limits the OUTPUT duration
 */
function buildFFmpegArgsWithAudio(videoPath, audioPath, rtmpUrl, durationSeconds, loopVideo) {
  const args = ['-re'];
  
  // Video input
  if (loopVideo) {
    args.push('-stream_loop', '-1');
  }
  args.push('-i', videoPath);
  
  // Audio input with loop
  args.push('-stream_loop', '-1');
  args.push('-i', audioPath);
  
  args.push('-map', '0:v:0', '-map', '1:a:0');
  args.push('-c', 'copy');  // Copy both
  args.push('-shortest');
  
  // CRITICAL: -t must be placed BEFORE -f flv and output URL
  // This limits the OUTPUT duration correctly
  if (durationSeconds && durationSeconds > 0) {
    args.push('-t', durationSeconds.toString());
    console.log(`[StreamingService] Audio-merge: duration limit set to ${durationSeconds} seconds (${durationSeconds / 60} minutes)`);
  }
  
  args.push('-f', 'flv');
  args.push(rtmpUrl);
  console.log('[StreamingService] Audio-merge: minimal copy');
  return args;
}

/**
 * Build FFmpeg args for video only streaming
 * 
 * MINIMAL CPU (~1%) - Full copy mode
 * 
 * IMPORTANT: -t parameter must be placed BEFORE the output URL to limit output duration
 * When using -stream_loop -1, FFmpeg will loop input infinitely, but -t limits the OUTPUT duration
 */
function buildFFmpegArgsVideoOnly(videoPath, rtmpUrl, durationSeconds, loopVideo) {
  const args = ['-re'];
  
  if (loopVideo) {
    args.push('-stream_loop', '-1');
  }
  args.push('-i', videoPath);
  args.push('-c', 'copy');
  
  // CRITICAL: -t must be placed BEFORE -f flv and output URL
  // This limits the OUTPUT duration correctly
  if (durationSeconds && durationSeconds > 0) {
    args.push('-t', durationSeconds.toString());
    console.log(`[StreamingService] Video-only: duration limit set to ${durationSeconds} seconds (${durationSeconds / 60} minutes)`);
  }
  
  args.push('-f', 'flv');
  args.push(rtmpUrl);
  console.log('[StreamingService] Video-only: minimal copy');
  return args;
}
async function startStream(streamId) {
  try {
    streamRetryCount.set(streamId, 0);
    if (activeStreams.has(streamId)) {
      return { success: false, error: 'Stream is already active' };
    }
    const stream = await Stream.findById(streamId);
    if (!stream) {
      return { success: false, error: 'Stream not found' };
    }
    
    // Check live limit before starting stream
    const limitInfo = await LiveLimitService.validateAndGetInfo(stream.user_id);
    if (!limitInfo.canStart) {
      console.log(`[StreamingService] User ${stream.user_id} has reached live limit (${limitInfo.activeStreams}/${limitInfo.effectiveLimit})`);
      return { 
        success: false, 
        error: limitInfo.message,
        limitReached: true,
        activeStreams: limitInfo.activeStreams,
        effectiveLimit: limitInfo.effectiveLimit
      };
    }
    
    const startTimeIso = new Date().toISOString();
    const streamStartTime = new Date(startTimeIso);
    const ffmpegArgs = await buildFFmpegArgs(stream);
    const fullCommand = `${ffmpegPath} ${ffmpegArgs.join(' ')}`;
    addStreamLog(streamId, `Starting stream with command: ${fullCommand}`);
    console.log(`Starting stream: ${fullCommand}`);
    const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs, {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    // Wait for FFmpeg to confirm it's running before updating status
    let streamConfirmed = false;
    let earlyExitError = null;
    
    // Set up early exit detection
    const earlyExitPromise = new Promise((resolve) => {
      ffmpegProcess.once('exit', (code, signal) => {
        if (!streamConfirmed) {
          earlyExitError = `FFmpeg exited early with code ${code}, signal: ${signal}`;
          resolve(false);
        }
      });
      ffmpegProcess.once('error', (err) => {
        if (!streamConfirmed) {
          earlyExitError = `FFmpeg error: ${err.message}`;
          resolve(false);
        }
      });
    });
    
    // Wait a short time to detect early failures
    const confirmationTimeout = new Promise((resolve) => {
      setTimeout(() => {
        if (!earlyExitError) {
          streamConfirmed = true;
          resolve(true);
        }
      }, 2000); // Wait 2 seconds to confirm FFmpeg is running
    });
    
    const isRunning = await Promise.race([earlyExitPromise, confirmationTimeout]);
    
    if (!isRunning || earlyExitError) {
      console.error(`[StreamingService] FFmpeg failed to start for stream ${streamId}: ${earlyExitError}`);
      addStreamLog(streamId, `Failed to start: ${earlyExitError}`);
      activeStreams.delete(streamId);
      streamPids.delete(streamId);
      return { success: false, error: earlyExitError || 'FFmpeg failed to start' };
    }
    
    // FFmpeg is confirmed running, now update status
    activeStreams.set(streamId, ffmpegProcess);
    // Track PID for process health monitoring
    if (ffmpegProcess.pid) {
      streamPids.set(streamId, ffmpegProcess.pid);
      console.log(`[StreamingService] Stream ${streamId} PID: ${ffmpegProcess.pid}`);
    }
    await Stream.updateStatus(streamId, 'live', stream.user_id, { startTimeOverride: startTimeIso });
    console.log(`[StreamingService] Stream ${streamId} confirmed running, status updated to live`);
    
    // CRITICAL: Set duration tracking for automatic termination
    // Use stream_duration_minutes as the primary source (most reliable for recurring streams)
    if (stream.stream_duration_minutes && stream.stream_duration_minutes > 0) {
      const durationMs = stream.stream_duration_minutes * 60 * 1000;
      setDurationInfo(streamId, streamStartTime, durationMs);
      console.log(`[StreamingService] Duration tracking set for stream ${streamId}: ${stream.stream_duration_minutes} minutes (${durationMs}ms)`);
      addStreamLog(streamId, `Duration tracking set: ${stream.stream_duration_minutes} minutes`);
    } else {
      // Fallback to calculated duration from durationCalculator
      const durationSeconds = calculateDurationSeconds(stream);
      if (durationSeconds && durationSeconds > 0) {
        const durationMs = durationSeconds * 1000;
        setDurationInfo(streamId, streamStartTime, durationMs);
        console.log(`[StreamingService] Duration tracking set for stream ${streamId}: ${durationSeconds / 60} minutes (${durationMs}ms) [calculated]`);
        addStreamLog(streamId, `Duration tracking set: ${durationSeconds / 60} minutes (calculated)`);
      } else {
        console.log(`[StreamingService] No duration set for stream ${streamId} - will run indefinitely`);
        addStreamLog(streamId, `No duration set - stream will run indefinitely`);
      }
    }
    
    // Start YouTube status sync if platform is YouTube
    if (stream.platform === 'YouTube' && stream.stream_key) {
      try {
        youtubeStatusSync.setStreamingService(module.exports);
        youtubeStatusSync.setRTMPHealthMonitor(rtmpHealthMonitor);
        await youtubeStatusSync.startMonitoring(streamId, stream.user_id, stream.stream_key);
      } catch (ytErr) {
        console.log(`[StreamingService] YouTube status sync not started: ${ytErr.message}`);
        // Continue without sync - not critical
      }
    }
    
    // Start RTMP health monitoring for auto-reconnect
    // This ensures the stream stays connected for the full duration
    try {
      rtmpHealthMonitor.setStreamingService(module.exports);
      const durationForMonitor = stream.stream_duration_minutes 
        ? stream.stream_duration_minutes * 60 * 1000 
        : (calculateDurationSeconds(stream) ? calculateDurationSeconds(stream) * 1000 : null);
      rtmpHealthMonitor.startMonitoring(streamId, streamStartTime, durationForMonitor);
      console.log(`[StreamingService] RTMP health monitoring started for stream ${streamId}`);
    } catch (healthErr) {
      console.log(`[StreamingService] RTMP health monitor not started: ${healthErr.message}`);
      // Continue without health monitoring - not critical
    }
    
    ffmpegProcess.stdout.on('data', (data) => {
      const message = data.toString().trim();
      if (message) {
        addStreamLog(streamId, `[OUTPUT] ${message}`);
        console.log(`[FFMPEG_STDOUT] ${streamId}: ${message}`);
      }
    });
    ffmpegProcess.stderr.on('data', (data) => {
      const message = data.toString().trim();
      if (message) {
        addStreamLog(streamId, `[FFmpeg] ${message}`);
        if (!message.includes('frame=')) {
          console.error(`[FFMPEG_STDERR] ${streamId}: ${message}`);
        }
        
        // Detect RTMP connection errors that might cause YouTube to disconnect
        const connectionErrors = [
          'Connection refused',
          'Connection timed out',
          'Connection reset',
          'Broken pipe',
          'RTMP_Connect',
          'RTMP_ReadPacket',
          'Server error',
          'Failed to connect'
        ];
        
        const hasConnectionError = connectionErrors.some(err => 
          message.toLowerCase().includes(err.toLowerCase())
        );
        
        if (hasConnectionError) {
          console.error(`[StreamingService] RTMP connection error detected for stream ${streamId}: ${message}`);
          addStreamLog(streamId, `[WARNING] RTMP connection error detected - may need reconnect`);
        }
      }
    });
    ffmpegProcess.on('exit', async (code, signal) => {
      addStreamLog(streamId, `Stream ended with code ${code}, signal: ${signal}`);
      console.log(`[FFMPEG_EXIT] ${streamId}: Code=${code}, Signal=${signal}`);
      const wasActive = activeStreams.delete(streamId);
      streamPids.delete(streamId); // Clean up PID tracking
      
      // Stop RTMP health monitoring on exit
      rtmpHealthMonitor.stopMonitoring(streamId);
      
      const isManualStop = manuallyStoppingStreams.has(streamId);
      
      // Check if duration was exceeded - if so, this is a normal termination
      const durationExceeded = isStreamDurationExceeded(streamId);
      if (durationExceeded) {
        console.log(`[StreamingService] Stream ${streamId} stop reason: duration reached`);
        addStreamLog(streamId, `Stream stop reason: duration reached`);
        clearDurationInfo(streamId);
        if (wasActive) {
          try {
            const streamData = await Stream.findById(streamId);
            if (streamData) {
              // FIXED: Use correct status based on schedule type
              const newStatus = getStatusAfterStreamEnd(streamData);
              await Stream.updateStatus(streamId, newStatus, streamData.user_id);
              const updatedStream = await Stream.findById(streamId);
              await saveStreamHistory(updatedStream);
            }
            if (typeof schedulerService !== 'undefined' && schedulerService.cancelStreamTermination) {
              schedulerService.handleStreamStopped(streamId);
            }
          } catch (error) {
            console.error(`[StreamingService] Error updating stream status after duration completion: ${error.message}`);
          }
        }
        return;
      }
      
      if (isManualStop) {
        console.log(`[StreamingService] Stream ${streamId} stop reason: manual stop`);
        addStreamLog(streamId, `Stream stop reason: manual stop`);
        manuallyStoppingStreams.delete(streamId);
        clearDurationInfo(streamId);
        if (wasActive) {
          try {
            // FIXED: Use correct status based on schedule type
            const streamData = await Stream.findById(streamId);
            const newStatus = getStatusAfterStreamEnd(streamData);
            await Stream.updateStatus(streamId, newStatus, streamData?.user_id);
            if (typeof schedulerService !== 'undefined' && schedulerService.cancelStreamTermination) {
              schedulerService.handleStreamStopped(streamId);
            }
          } catch (error) {
            console.error(`[StreamingService] Error updating stream status after manual stop: ${error.message}`);
          }
        }
        return;
      }
      
      // For SIGSEGV or error exits, check if duration is close to being exceeded
      // If remaining time is less than 1 minute, don't restart
      const remainingTime = getRemainingTime(streamId);
      const shouldNotRestart = remainingTime !== null && remainingTime < 60000; // Less than 1 minute
      
      if (signal === 'SIGSEGV') {
        if (shouldNotRestart) {
          console.log(`[StreamingService] Stream ${streamId} crashed but duration almost reached (${remainingTime}ms remaining) - NOT restarting`);
          addStreamLog(streamId, `Stream crashed but duration almost reached - not restarting`);
          clearDurationInfo(streamId);
          if (wasActive) {
            try {
              const streamData = await Stream.findById(streamId);
              if (streamData) {
                // FIXED: Use correct status based on schedule type
                const newStatus = getStatusAfterStreamEnd(streamData);
                await Stream.updateStatus(streamId, newStatus, streamData.user_id);
              }
              if (typeof schedulerService !== 'undefined' && schedulerService.cancelStreamTermination) {
                schedulerService.handleStreamStopped(streamId);
              }
            } catch (error) {
              console.error(`[StreamingService] Error updating stream status: ${error.message}`);
            }
          }
          return;
        }
        
        const retryCount = streamRetryCount.get(streamId) || 0;
        if (retryCount < MAX_RETRY_ATTEMPTS) {
          streamRetryCount.set(streamId, retryCount + 1);
          console.log(`[StreamingService] FFmpeg crashed with SIGSEGV. Attempting restart #${retryCount + 1} for stream ${streamId}`);
          addStreamLog(streamId, `FFmpeg crashed with SIGSEGV. Attempting restart #${retryCount + 1}`);
          // Clear duration info before restart - it will be recalculated
          clearDurationInfo(streamId);
          setTimeout(async () => {
            try {
              const streamInfo = await Stream.findById(streamId);
              if (streamInfo) {
                const result = await startStream(streamId);
                if (!result.success) {
                  console.error(`[StreamingService] Failed to restart stream: ${result.error}`);
                  // FIXED: Use correct status based on schedule type
                  const newStatus = getStatusAfterStreamEnd(streamInfo);
                  await Stream.updateStatus(streamId, newStatus);
                }
              } else {
                console.error(`[StreamingService] Cannot restart stream ${streamId}: not found in database`);
              }
            } catch (error) {
              console.error(`[StreamingService] Error during stream restart: ${error.message}`);
              try {
                // Fallback to offline if we can't determine schedule type
                await Stream.updateStatus(streamId, 'offline');
              } catch (dbError) {
                console.error(`Error updating stream status: ${dbError.message}`);
              }
            }
          }, 3000);
          return;
        } else {
          console.error(`[StreamingService] Maximum retry attempts (${MAX_RETRY_ATTEMPTS}) reached for stream ${streamId}`);
          addStreamLog(streamId, `Maximum retry attempts (${MAX_RETRY_ATTEMPTS}) reached, stopping stream`);
          clearDurationInfo(streamId);
        }
      }
      else {
        let errorMessage = '';
        if (code !== 0 && code !== null) {
          // Check if we should not restart due to duration
          if (shouldNotRestart) {
            console.log(`[StreamingService] Stream ${streamId} exited with error but duration almost reached - NOT restarting`);
            addStreamLog(streamId, `Stream exited with error but duration almost reached - not restarting`);
            clearDurationInfo(streamId);
            if (wasActive) {
              try {
                const streamData = await Stream.findById(streamId);
                if (streamData) {
                  // FIXED: Use correct status based on schedule type
                  const newStatus = getStatusAfterStreamEnd(streamData);
                  await Stream.updateStatus(streamId, newStatus, streamData.user_id);
                }
                if (typeof schedulerService !== 'undefined' && schedulerService.cancelStreamTermination) {
                  schedulerService.handleStreamStopped(streamId);
                }
              } catch (error) {
                console.error(`[StreamingService] Error updating stream status: ${error.message}`);
              }
            }
            return;
          }
          
          errorMessage = `FFmpeg process exited with error code ${code}`;
          addStreamLog(streamId, errorMessage);
          console.error(`[StreamingService] ${errorMessage} for stream ${streamId}`);
          const retryCount = streamRetryCount.get(streamId) || 0;
          if (retryCount < MAX_RETRY_ATTEMPTS) {
            streamRetryCount.set(streamId, retryCount + 1);
            console.log(`[StreamingService] FFmpeg exited with code ${code}. Attempting restart #${retryCount + 1} for stream ${streamId}`);
            // Clear duration info before restart
            clearDurationInfo(streamId);
            setTimeout(async () => {
              try {
                const streamInfo = await Stream.findById(streamId);
                if (streamInfo) {
                  const result = await startStream(streamId);
                  if (!result.success) {
                    console.error(`[StreamingService] Failed to restart stream: ${result.error}`);
                    // FIXED: Use correct status based on schedule type
                    const newStatus = getStatusAfterStreamEnd(streamInfo);
                    await Stream.updateStatus(streamId, newStatus);
                  }
                }
              } catch (error) {
                console.error(`[StreamingService] Error during stream restart: ${error.message}`);
                await Stream.updateStatus(streamId, 'offline');
              }
            }, 3000);
            return;
          }
        }
        
        // Normal exit (code 0) - this could be FFmpeg -t parameter working correctly
        if (code === 0) {
          console.log(`[StreamingService] Stream ${streamId} ended normally with exit code 0`);
          addStreamLog(streamId, `Stream ended normally`);
        }
        
        clearDurationInfo(streamId);
        if (wasActive) {
          try {
            const streamData = await Stream.findById(streamId);
            // FIXED: Use correct status based on schedule type
            const newStatus = getStatusAfterStreamEnd(streamData);
            console.log(`[StreamingService] Updating stream ${streamId} status to '${newStatus}' after FFmpeg exit`);
            if (streamData) {
              await Stream.updateStatus(streamId, newStatus, streamData.user_id);
              const updatedStream = await Stream.findById(streamId);
              await saveStreamHistory(updatedStream);
            }
            if (typeof schedulerService !== 'undefined' && schedulerService.cancelStreamTermination) {
              schedulerService.handleStreamStopped(streamId);
            }
          } catch (error) {
            console.error(`[StreamingService] Error updating stream status after exit: ${error.message}`);
          }
        }
      }
    });
    ffmpegProcess.on('error', async (err) => {
      addStreamLog(streamId, `Error in stream process: ${err.message}`);
      console.error(`[FFMPEG_PROCESS_ERROR] ${streamId}: ${err.message}`);
      activeStreams.delete(streamId);
      streamPids.delete(streamId); // Clean up PID tracking
      clearDurationInfo(streamId); // Clean up duration tracking
      try {
        // FIXED: Try to get stream data to determine correct status
        const streamData = await Stream.findById(streamId);
        const newStatus = getStatusAfterStreamEnd(streamData);
        await Stream.updateStatus(streamId, newStatus);
      } catch (error) {
        console.error(`Error updating stream status: ${error.message}`);
      }
    });
    ffmpegProcess.unref();
    
    // Calculate and track stream duration
    // IMPORTANT: For recurring streams, prioritize stream_duration_minutes directly
    // because schedule_time/end_time may contain old values from previous runs
    const now = Date.now();
    let durationSeconds = null;
    
    // Priority 1: stream_duration_minutes (most reliable)
    if (stream.stream_duration_minutes && stream.stream_duration_minutes > 0) {
      durationSeconds = stream.stream_duration_minutes * 60;
      console.log(`[StreamingService] Using stream_duration_minutes: ${stream.stream_duration_minutes} minutes (${durationSeconds} seconds)`);
    } else {
      // Fallback to centralized calculator
      durationSeconds = calculateDurationSeconds(stream);
    }
    
    const durationMs = durationSeconds ? durationSeconds * 1000 : null;
    
    // Log all duration-related fields for debugging
    console.log(`[StreamingService] Stream ${streamId} duration fields: stream_duration_minutes=${stream.stream_duration_minutes}, schedule_time=${stream.schedule_time}, end_time=${stream.end_time}, duration=${stream.duration}`);
    console.log(`[StreamingService] Stream ${streamId} calculated duration: ${durationSeconds ? formatDuration(durationSeconds) : 'not set'}`);
    
    // Set duration tracking if duration is specified
    if (durationMs && durationMs > 0) {
      const trackingSet = setDurationInfo(streamId, streamStartTime, durationMs);
      if (trackingSet) {
        addStreamLog(streamId, `Duration tracking enabled: ${formatDuration(durationSeconds)}`);
        console.log(`[StreamingService] Duration tracking set: stream will end at ${new Date(streamStartTime.getTime() + durationMs).toISOString()}`);
      }
    } else {
      addStreamLog(streamId, `No duration set - stream will run indefinitely`);
      console.log(`[StreamingService] WARNING: No duration set for stream ${streamId} - will run indefinitely`);
    }
    
    // Schedule stream termination based on duration
    // FIXED: No buffer added - FFmpeg -t parameter handles exact duration
    // The scheduler termination is a backup in case FFmpeg -t fails
    if (typeof schedulerService !== 'undefined' && durationMs && durationMs > 0) {
      const shouldEndAt = new Date(streamStartTime.getTime() + durationMs);
      const remainingMs = Math.max(0, shouldEndAt.getTime() - now);
      // FIXED: No buffer - use exact remaining time
      // FFmpeg -t parameter is the primary duration control
      // This scheduled termination is only a safety backup
      const remainingMinutes = remainingMs / 60000;
      
      console.log(`[StreamingService] Scheduling termination for stream ${streamId} at ${shouldEndAt.toISOString()} (${remainingMinutes.toFixed(2)} minutes exact)`);
      schedulerService.scheduleStreamTermination(streamId, remainingMinutes);
    }
    return {
      success: true,
      message: 'Stream started successfully',
      isAdvancedMode: stream.use_advanced_settings
    };
  } catch (error) {
    addStreamLog(streamId, `Failed to start stream: ${error.message}`);
    console.error(`Error starting stream ${streamId}:`, error);
    return { success: false, error: error.message };
  }
}
async function stopStream(streamId) {
  try {
    // Stop YouTube status sync monitoring first
    youtubeStatusSync.stopMonitoring(streamId);
    
    // Stop RTMP health monitoring
    rtmpHealthMonitor.stopMonitoring(streamId);
    
    const ffmpegProcess = activeStreams.get(streamId);
    const isActive = ffmpegProcess !== undefined;
    console.log(`[StreamingService] Stop request for stream ${streamId}, isActive: ${isActive}`);
    
    // Get stream info first - we need it for both active and inactive cases
    const stream = await Stream.findById(streamId);
    
    if (!isActive) {
      if (stream && stream.status === 'live') {
        console.log(`[StreamingService] Stream ${streamId} not active in memory but status is 'live' in DB.`);
        
        // CRITICAL FIX: Try to kill any FFmpeg process streaming to this key
        // This handles cases where app restarted but FFmpeg is still running
        if (stream.stream_key) {
          const killed = await killFFmpegByStreamKey(stream.stream_key);
          if (killed) {
            console.log(`[StreamingService] Successfully killed FFmpeg process for stream key: ${stream.stream_key.substring(0, 8)}...`);
          } else {
            console.log(`[StreamingService] No FFmpeg process found for stream key (may have already stopped)`);
          }
        }
        
        // FIXED: Use correct status based on schedule type
        const newStatus = getStatusAfterStreamEnd(stream);
        await Stream.updateStatus(streamId, newStatus, stream.user_id);
        // Clean up duration tracking
        clearDurationInfo(streamId);
        if (typeof schedulerService !== 'undefined' && schedulerService.cancelStreamTermination) {
          schedulerService.handleStreamStopped(streamId);
        }
        
        // Save history
        const updatedStream = await Stream.findById(streamId);
        await saveStreamHistory(updatedStream);
        
        // Handle unlist replay on end for YouTube streams
        await handleUnlistReplayOnEnd(stream);
        
        return { success: true, message: 'Stream stopped (was not in memory but FFmpeg killed if running)' };
      }
      return { success: false, error: 'Stream is not active' };
    }
    addStreamLog(streamId, 'Stopping stream...');
    console.log(`[StreamingService] Stopping active stream ${streamId}`);
    manuallyStoppingStreams.add(streamId);
    try {
      ffmpegProcess.kill('SIGTERM');
      
      // Wait a bit and force kill if still running
      await new Promise(resolve => setTimeout(resolve, 2000));
      if (!ffmpegProcess.killed) {
        console.log(`[StreamingService] FFmpeg didn't respond to SIGTERM, sending SIGKILL`);
        ffmpegProcess.kill('SIGKILL');
      }
    } catch (killError) {
      console.error(`[StreamingService] Error killing FFmpeg process: ${killError.message}`);
      manuallyStoppingStreams.delete(streamId);
      
      // Fallback: try to kill by stream key
      if (stream && stream.stream_key) {
        await killFFmpegByStreamKey(stream.stream_key);
      }
    }
    activeStreams.delete(streamId);
    streamPids.delete(streamId); // Clean up PID tracking
    
    // Clean up duration tracking
    clearDurationInfo(streamId);
    
    const tempConcatFile = path.join(__dirname, '..', 'temp', `playlist_${streamId}.txt`);
    try {
      if (fs.existsSync(tempConcatFile)) {
        fs.unlinkSync(tempConcatFile);
        console.log(`[StreamingService] Cleaned up temporary playlist file: ${tempConcatFile}`);
      }
    } catch (cleanupError) {
      console.error(`[StreamingService] Error cleaning up temporary file: ${cleanupError.message}`);
    }
    
    if (stream) {
      // FIXED: Use correct status based on schedule type
      const newStatus = getStatusAfterStreamEnd(stream);
      await Stream.updateStatus(streamId, newStatus, stream.user_id);
      const updatedStream = await Stream.findById(streamId);
      await saveStreamHistory(updatedStream);
      
      // Handle unlist replay on end for YouTube streams
      await handleUnlistReplayOnEnd(stream);
    }
    if (typeof schedulerService !== 'undefined' && schedulerService.cancelStreamTermination) {
      schedulerService.handleStreamStopped(streamId);
    }
    return { success: true, message: 'Stream stopped successfully' };
  } catch (error) {
    manuallyStoppingStreams.delete(streamId);
    // Clean up duration tracking even on error
    clearDurationInfo(streamId);
    console.error(`[StreamingService] Error stopping stream ${streamId}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Kill FFmpeg process by stream key
 * This is used when the process is not tracked in memory (e.g., after app restart)
 * @param {string} streamKey - The stream key to search for
 * @returns {Promise<boolean>} True if a process was killed
 */
async function killFFmpegByStreamKey(streamKey) {
  if (!streamKey) return false;
  
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    
    if (isWindows) {
      // On Windows, use wmic to find and kill FFmpeg processes with this stream key
      exec(`wmic process where "name='ffmpeg.exe'" get processid,commandline /format:csv`, { timeout: 10000 }, (err, stdout) => {
        if (err || !stdout) {
          resolve(false);
          return;
        }
        
        // Parse CSV output to find PIDs with matching stream key
        const lines = stdout.split('\n').filter(line => line.includes(streamKey));
        if (lines.length === 0) {
          resolve(false);
          return;
        }
        
        // Extract PIDs and kill them
        let killed = false;
        for (const line of lines) {
          const parts = line.split(',');
          const pid = parts[parts.length - 1]?.trim();
          if (pid && /^\d+$/.test(pid)) {
            try {
              exec(`taskkill /F /PID ${pid}`, (killErr) => {
                if (!killErr) {
                  console.log(`[StreamingService] Killed FFmpeg process PID ${pid}`);
                  killed = true;
                }
              });
            } catch (e) {
              // Ignore kill errors
            }
          }
        }
        
        // Wait a bit for kills to complete
        setTimeout(() => resolve(killed), 1000);
      });
    } else {
      // On Linux/Mac, use pkill with pattern matching
      exec(`pkill -f "ffmpeg.*${streamKey}"`, { timeout: 5000 }, (err) => {
        // pkill returns 0 if processes were killed, 1 if no processes matched
        resolve(!err);
      });
    }
  });
}

async function syncStreamStatuses() {
  try {
    console.log('[StreamingService] Syncing stream statuses...');
    
    // First check if ANY FFmpeg is running
    const anyFFmpegRunning = await isAnyFFmpegRunning();
    console.log(`[StreamingService] Any FFmpeg running: ${anyFFmpegRunning}`);
    
    let liveStreams = [];
    try {
      liveStreams = await Stream.findAll(null, 'live');
    } catch (dbError) {
      console.error('[StreamingService] Database error finding live streams:', dbError.message);
      return; // Don't crash, just skip this sync
    }
    
    if (liveStreams.length === 0) {
      console.log('[StreamingService] No live streams in database');
    } else {
      console.log(`[StreamingService] Found ${liveStreams.length} live streams in database`);
    }
    
    for (const stream of liveStreams) {
      try {
        const isInMemory = activeStreams.has(stream.id);
        
        if (isInMemory) {
          // Stream is in memory - it's definitely running from this app instance
          console.log(`[StreamingService] Stream ${stream.id} is active in memory - status OK`);
          continue;
        }
        
        // Stream not in memory - be VERY careful before changing status
        // If ANY FFmpeg is running, check if it's this stream's key
        if (anyFFmpegRunning) {
          const isThisStreamRunning = await isFFmpegStreamingToKey(stream.stream_key);
          
          if (isThisStreamRunning) {
            // FFmpeg is running with this stream key - keep status as 'live'
            console.log(`[StreamingService] Stream ${stream.id} - FFmpeg running with this key - keeping 'live'`);
            continue;
          }
          
          // FFmpeg is running but not with this stream's key
          // Still be conservative - maybe the check failed
          // Only update if stream has been "live" for more than 30 minutes without activity
          const startTime = stream.start_time ? new Date(stream.start_time) : null;
          const now = new Date();
          const runningMinutes = startTime ? (now - startTime) / 60000 : 0;
          
          // If stream started recently (< 30 min), don't change status
          // This prevents false positives during app restarts
          if (runningMinutes < 30) {
            console.log(`[StreamingService] Stream ${stream.id} started ${runningMinutes.toFixed(0)} min ago - keeping 'live' (conservative)`);
            continue;
          }
        }
        
        // No FFmpeg running at all, or stream has been "live" for a long time
        // Safe to update status
        console.log(`[StreamingService] Stream ${stream.id}: no FFmpeg detected - updating status`);
        const newStatus = getStatusAfterStreamEnd(stream);
        await Stream.updateStatus(stream.id, newStatus);
        console.log(`[StreamingService] Updated stream ${stream.id} status to '${newStatus}'`);
        
      } catch (streamError) {
        console.error(`[StreamingService] Error syncing stream ${stream.id}:`, streamError.message);
        // On error, DON'T change status - be conservative
      }
    }
    
    const activeStreamIds = Array.from(activeStreams.keys());
    for (const streamId of activeStreamIds) {
      try {
        const stream = await Stream.findById(streamId);
        if (!stream || stream.status !== 'live') {
          console.log(`[StreamingService] Found inconsistent stream ${streamId}: active in memory but not 'live' in DB`);
          if (stream) {
            await Stream.updateStatus(streamId, 'live');
            console.log(`[StreamingService] Updated stream ${streamId} status to 'live'`);
          } else {
            console.log(`[StreamingService] Stream ${streamId} not found in DB, removing from active streams`);
            const ffmpegProcess = activeStreams.get(streamId);
            if (ffmpegProcess) {
              try {
                ffmpegProcess.kill('SIGTERM');
              } catch (killError) {
                console.error(`[StreamingService] Error killing orphaned process: ${killError.message}`);
              }
            }
            activeStreams.delete(streamId);
            streamPids.delete(streamId); // Clean up PID tracking
          }
        }
      } catch (streamError) {
        console.error(`[StreamingService] Error syncing active stream ${streamId}:`, streamError.message);
        // Continue with next stream
      }
    }
    console.log(`[StreamingService] Stream status sync completed. Active streams: ${activeStreamIds.length}`);
  } catch (error) {
    console.error('[StreamingService] Error syncing stream statuses:', error.message);
    // Don't rethrow - let the sync continue on next interval
  }
}

// Process health check runs every 30 seconds to detect dead FFmpeg processes
// This catches cases where FFmpeg dies without triggering exit event
// Status is now managed by:
// 1. startStream() - sets to 'live'
// 2. stopStream() - sets to 'offline' or 'scheduled'
// 3. FFmpeg exit event - handles normal exits
// 4. checkStreamProcessHealth() - catches zombie/dead processes
// syncStreamStatuses() can still be called manually if needed
function isStreamActive(streamId) {
  return activeStreams.has(streamId);
}
function getActiveStreams() {
  return Array.from(activeStreams.keys());
}
function getStreamLogs(streamId) {
  return streamLogs.get(streamId) || [];
}
async function saveStreamHistory(stream) {
  try {
    if (!stream.start_time) {
      console.log(`[StreamingService] Not saving history for stream ${stream.id} - no start time recorded`);
      return false;
    }
    const startTime = new Date(stream.start_time);
    const endTime = stream.end_time ? new Date(stream.end_time) : new Date();
    const durationSeconds = Math.floor((endTime - startTime) / 1000);
    if (durationSeconds < 1) {
      console.log(`[StreamingService] Not saving history for stream ${stream.id} - duration too short (${durationSeconds}s)`);
      return false;
    }
    const videoDetails = stream.video_id ? await Video.findById(stream.video_id) : null;
    const historyData = {
      id: uuidv4(),
      stream_id: stream.id,
      title: stream.title,
      platform: stream.platform || 'Custom',
      platform_icon: stream.platform_icon,
      video_id: stream.video_id,
      video_title: videoDetails ? videoDetails.title : null,
      resolution: stream.resolution,
      bitrate: stream.bitrate,
      fps: stream.fps,
      start_time: stream.start_time,
      end_time: stream.end_time || new Date().toISOString(),
      duration: durationSeconds,
      use_advanced_settings: stream.use_advanced_settings ? 1 : 0,
      schedule_type: stream.schedule_type || 'once',
      user_id: stream.user_id
    };
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO stream_history (
          id, stream_id, title, platform, platform_icon, video_id, video_title,
          resolution, bitrate, fps, start_time, end_time, duration, use_advanced_settings, schedule_type, user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          historyData.id, historyData.stream_id, historyData.title,
          historyData.platform, historyData.platform_icon, historyData.video_id, historyData.video_title,
          historyData.resolution, historyData.bitrate, historyData.fps,
          historyData.start_time, historyData.end_time, historyData.duration,
          historyData.use_advanced_settings, historyData.schedule_type, historyData.user_id
        ],
        function (err) {
          if (err) {
            console.error('[StreamingService] Error saving stream history:', err.message);
            return reject(err);
          }
          console.log(`[StreamingService] Stream history saved for stream ${stream.id}, duration: ${durationSeconds}s`);
          resolve(historyData);
        }
      );
    });
  } catch (error) {
    console.error('[StreamingService] Failed to save stream history:', error);
    return false;
  }
}
/**
 * Get YouTube status for a stream
 * @param {string} streamId - Stream ID
 * @returns {{lifeCycleStatus: string, displayStatus: string, lastChecked: Date} | null}
 */
function getYouTubeStatus(streamId) {
  return youtubeStatusSync.getYouTubeStatus(streamId);
}

/**
 * Check if a stream is being monitored for YouTube status
 * @param {string} streamId - Stream ID
 * @returns {boolean}
 */
function isYouTubeMonitored(streamId) {
  return youtubeStatusSync.isMonitoring(streamId);
}

/**
 * Get RTMP health monitor status for a stream
 * @param {string} streamId - Stream ID
 * @returns {Object|null}
 */
function getRTMPHealthStatus(streamId) {
  return rtmpHealthMonitor.getMonitorStatus(streamId);
}

/**
 * Check if a stream is being monitored for RTMP health
 * @param {string} streamId - Stream ID
 * @returns {boolean}
 */
function isRTMPHealthMonitored(streamId) {
  return rtmpHealthMonitor.isMonitoring(streamId);
}

module.exports = {
  startStream,
  stopStream,
  isStreamActive,
  getActiveStreams,
  getStreamLogs,
  syncStreamStatuses,
  saveStreamHistory,
  isFFmpegStreamingToKey, // Check if FFmpeg is running for a stream key
  isAnyFFmpegRunning, // Check if any FFmpeg process is running
  // Duration tracking exports
  getDurationInfo,
  getRemainingTime,
  isStreamEndingSoon,
  isStreamDurationExceeded,
  // YouTube status sync exports
  getYouTubeStatus,
  isYouTubeMonitored,
  // RTMP health monitor exports
  getRTMPHealthStatus,
  isRTMPHealthMonitored,
  // Export for testing
  buildFFmpegArgsWithAudio,
  buildFFmpegArgsVideoOnly
};
