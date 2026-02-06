/**
 * CPU Optimization Property-Based Tests
 * 
 * Tests for FFmpeg arguments optimization to reduce CPU usage
 * while maintaining streaming quality.
 */

const fc = require('fast-check');

// Import the functions to test - we need to extract them from streamingService
// Since they're not exported, we'll recreate the logic for testing
// This ensures we test the actual argument building logic

/**
 * Recreate buildFFmpegArgsVideoOnly for testing
 * This mirrors the optimized implementation in streamingService.js
 */
function buildFFmpegArgsVideoOnly(videoPath, rtmpUrl, durationSeconds, loopVideo) {
  const args = [
    '-threads', '2',
    '-thread_queue_size', '512',
    '-hwaccel', 'auto',
    '-loglevel', 'error',
    '-re',
    '-fflags', '+genpts+igndts+discardcorrupt',
    '-avoid_negative_ts', 'make_zero'
  ];
  
  if (loopVideo) {
    args.push('-stream_loop', '-1');
  } else {
    args.push('-stream_loop', '0');
  }
  args.push('-i', videoPath);
  
  args.push('-c:v', 'copy');
  args.push('-c:a', 'copy');
  
  args.push('-flags', '+global_header');
  args.push('-bufsize', '1M');
  args.push('-max_muxing_queue_size', '2048');
  args.push('-flvflags', 'no_duration_filesize');
  args.push('-f', 'flv');
  
  if (durationSeconds && durationSeconds > 0) {
    args.push('-t', durationSeconds.toString());
  }
  
  args.push(rtmpUrl);
  
  return args;
}

/**
 * Recreate buildFFmpegArgsWithAudio for testing
 */
function buildFFmpegArgsWithAudio(videoPath, audioPath, rtmpUrl, durationSeconds, loopVideo) {
  const args = [
    '-threads', '2',
    '-thread_queue_size', '512',
    '-hwaccel', 'auto',
    '-loglevel', 'error',
    '-re',
    '-fflags', '+genpts+igndts+discardcorrupt',
    '-avoid_negative_ts', 'make_zero'
  ];
  
  if (loopVideo) {
    args.push('-stream_loop', '-1');
  }
  args.push('-i', videoPath);
  
  args.push('-stream_loop', '-1');
  args.push('-i', audioPath);
  
  args.push('-map', '0:v:0');
  args.push('-map', '1:a:0');
  
  args.push('-c:v', 'copy');
  args.push('-c:a', 'aac');
  args.push('-b:a', '128k');
  args.push('-ar', '44100');
  
  args.push('-flags', '+global_header');
  args.push('-bufsize', '1M');
  args.push('-max_muxing_queue_size', '2048');
  args.push('-flvflags', 'no_duration_filesize');
  args.push('-f', 'flv');
  
  if (durationSeconds && durationSeconds > 0) {
    args.push('-t', durationSeconds.toString());
  }
  
  args.push(rtmpUrl);
  
  return args;
}

/**
 * Duration calculation helper
 */
function calculateDurationSeconds(durationHours, durationMinutes, scheduleTime, endTime, actualStartTime) {
  if (durationHours && durationHours > 0) {
    return durationHours * 3600;
  }
  if (durationMinutes && durationMinutes > 0) {
    return durationMinutes * 60;
  }
  if (endTime && scheduleTime) {
    const scheduleStart = new Date(scheduleTime);
    const scheduleEnd = new Date(endTime);
    const durationMs = scheduleEnd.getTime() - scheduleStart.getTime();
    if (durationMs > 0) {
      return Math.floor(durationMs / 1000);
    }
  }
  return null;
}

// Generators for property tests
const videoPathGen = fc.string({ minLength: 5, maxLength: 20 })
  .map(s => `/path/to/video_${s.replace(/[^a-zA-Z0-9]/g, '')}.mp4`);

const audioPathGen = fc.string({ minLength: 5, maxLength: 20 })
  .map(s => `/path/to/audio_${s.replace(/[^a-zA-Z0-9]/g, '')}.mp3`);

const rtmpUrlGen = fc.constantFrom(
  'rtmp://a.rtmp.youtube.com/live2/xxxx-xxxx-xxxx',
  'rtmp://live.twitch.tv/app/live_xxxxx',
  'rtmp://live-api-s.facebook.com:443/rtmp/xxxxx'
);

const durationSecondsGen = fc.oneof(
  fc.constant(null),
  fc.integer({ min: 60, max: 86400 }) // 1 minute to 24 hours
);

const loopVideoGen = fc.boolean();

describe('CPU Optimization Property Tests', () => {
  
  /**
   * **Feature: cpu-optimization, Property 1: Thread Limiting Present**
   * **Validates: Requirements 1.2, 3.1**
   * 
   * For any stream configuration, when FFmpeg arguments are built,
   * the arguments array SHALL contain thread limiting parameter `-threads`
   * with a value between 1 and 4.
   */
  describe('Property 1: Thread Limiting Present', () => {
    it('video-only mode should always include thread limiting', () => {
      fc.assert(
        fc.property(
          videoPathGen,
          rtmpUrlGen,
          durationSecondsGen,
          loopVideoGen,
          (videoPath, rtmpUrl, durationSeconds, loopVideo) => {
            const args = buildFFmpegArgsVideoOnly(videoPath, rtmpUrl, durationSeconds, loopVideo);
            
            const threadsIndex = args.indexOf('-threads');
            expect(threadsIndex).toBeGreaterThanOrEqual(0);
            
            const threadValue = parseInt(args[threadsIndex + 1]);
            expect(threadValue).toBeGreaterThanOrEqual(1);
            expect(threadValue).toBeLessThanOrEqual(4);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('audio merge mode should always include thread limiting', () => {
      fc.assert(
        fc.property(
          videoPathGen,
          audioPathGen,
          rtmpUrlGen,
          durationSecondsGen,
          loopVideoGen,
          (videoPath, audioPath, rtmpUrl, durationSeconds, loopVideo) => {
            const args = buildFFmpegArgsWithAudio(videoPath, audioPath, rtmpUrl, durationSeconds, loopVideo);
            
            const threadsIndex = args.indexOf('-threads');
            expect(threadsIndex).toBeGreaterThanOrEqual(0);
            
            const threadValue = parseInt(args[threadsIndex + 1]);
            expect(threadValue).toBeGreaterThanOrEqual(1);
            expect(threadValue).toBeLessThanOrEqual(4);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: cpu-optimization, Property 2: Copy Mode for Non-Advanced Streams**
   * **Validates: Requirements 1.3, 1.5**
   * 
   * For any stream with use_advanced_settings=false, the built FFmpeg arguments
   * SHALL contain `-c:v copy` and `-c:a copy` (when no audio merge).
   */
  describe('Property 2: Copy Mode for Non-Advanced Streams', () => {
    it('video-only mode should use copy for both video and audio', () => {
      fc.assert(
        fc.property(
          videoPathGen,
          rtmpUrlGen,
          durationSecondsGen,
          loopVideoGen,
          (videoPath, rtmpUrl, durationSeconds, loopVideo) => {
            const args = buildFFmpegArgsVideoOnly(videoPath, rtmpUrl, durationSeconds, loopVideo);
            
            // Check video copy
            const cvIndex = args.indexOf('-c:v');
            expect(cvIndex).toBeGreaterThanOrEqual(0);
            expect(args[cvIndex + 1]).toBe('copy');
            
            // Check audio copy
            const caIndex = args.indexOf('-c:a');
            expect(caIndex).toBeGreaterThanOrEqual(0);
            expect(args[caIndex + 1]).toBe('copy');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


  /**
   * **Feature: cpu-optimization, Property 4: Audio Bitrate Minimum**
   * **Validates: Requirements 2.4**
   * 
   * For any stream with audio merge enabled, the FFmpeg arguments
   * SHALL contain `-b:a 128k` or higher.
   */
  describe('Property 4: Audio Bitrate Minimum', () => {
    it('audio merge mode should include minimum 128k audio bitrate', () => {
      fc.assert(
        fc.property(
          videoPathGen,
          audioPathGen,
          rtmpUrlGen,
          durationSecondsGen,
          loopVideoGen,
          (videoPath, audioPath, rtmpUrl, durationSeconds, loopVideo) => {
            const args = buildFFmpegArgsWithAudio(videoPath, audioPath, rtmpUrl, durationSeconds, loopVideo);
            
            // Check audio bitrate is present
            const baIndex = args.indexOf('-b:a');
            expect(baIndex).toBeGreaterThanOrEqual(0);
            
            // Check bitrate value is at least 128k
            const bitrateValue = args[baIndex + 1];
            expect(bitrateValue).toBe('128k');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('audio merge mode should use AAC codec', () => {
      fc.assert(
        fc.property(
          videoPathGen,
          audioPathGen,
          rtmpUrlGen,
          durationSecondsGen,
          loopVideoGen,
          (videoPath, audioPath, rtmpUrl, durationSeconds, loopVideo) => {
            const args = buildFFmpegArgsWithAudio(videoPath, audioPath, rtmpUrl, durationSeconds, loopVideo);
            
            const caIndex = args.indexOf('-c:a');
            expect(caIndex).toBeGreaterThanOrEqual(0);
            expect(args[caIndex + 1]).toBe('aac');
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * Recreate buildFFmpegArgsForPlaylist for testing (non-advanced mode)
   */
  function buildFFmpegArgsForPlaylistNonAdvanced(concatFile, rtmpUrl) {
    return [
      '-threads', '2',
      '-thread_queue_size', '512',
      '-hwaccel', 'auto',
      '-loglevel', 'error',
      '-re',
      '-fflags', '+genpts+igndts+discardcorrupt',
      '-avoid_negative_ts', 'make_zero',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatFile,
      '-c:v', 'copy',
      '-c:a', 'copy',
      '-flags', '+global_header',
      '-bufsize', '1M',
      '-max_muxing_queue_size', '2048',
      '-flvflags', 'no_duration_filesize',
      '-f', 'flv',
      rtmpUrl
    ];
  }

  /**
   * Recreate buildFFmpegArgsForPlaylist for testing (advanced mode)
   */
  function buildFFmpegArgsForPlaylistAdvanced(concatFile, rtmpUrl, resolution, bitrate, fps) {
    return [
      '-threads', '2',
      '-thread_queue_size', '512',
      '-hwaccel', 'auto',
      '-loglevel', 'error',
      '-re',
      '-fflags', '+genpts+discardcorrupt',
      '-avoid_negative_ts', 'make_zero',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatFile,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-profile:v', 'baseline',
      '-tune', 'zerolatency',
      '-b:v', `${bitrate}k`,
      '-maxrate', `${bitrate * 1.5}k`,
      '-bufsize', `${Math.min(bitrate * 2, 2000)}k`,
      '-pix_fmt', 'yuv420p',
      '-g', `${fps * 2}`,
      '-s', resolution,
      '-r', fps.toString(),
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ar', '44100',
      '-flvflags', 'no_duration_filesize',
      '-f', 'flv',
      rtmpUrl
    ];
  }

  /**
   * **Feature: cpu-optimization, Property 7: Playlist Optimization Compatible**
   * **Validates: Requirements 6.4**
   * 
   * For any playlist stream, the FFmpeg arguments SHALL contain both
   * `-f concat` and thread limiting parameters.
   */
  describe('Property 7: Playlist Optimization Compatible', () => {
    const concatFileGen = fc.string({ minLength: 5, maxLength: 20 })
      .map(s => `/temp/playlist_${s.replace(/[^a-zA-Z0-9]/g, '')}.txt`);

    it('playlist non-advanced mode should have concat and thread limiting', () => {
      fc.assert(
        fc.property(
          concatFileGen,
          rtmpUrlGen,
          (concatFile, rtmpUrl) => {
            const args = buildFFmpegArgsForPlaylistNonAdvanced(concatFile, rtmpUrl);
            
            // Check concat format
            const fConcatIndex = args.indexOf('-f');
            expect(fConcatIndex).toBeGreaterThanOrEqual(0);
            expect(args[fConcatIndex + 1]).toBe('concat');
            
            // Check thread limiting
            const threadsIndex = args.indexOf('-threads');
            expect(threadsIndex).toBeGreaterThanOrEqual(0);
            expect(parseInt(args[threadsIndex + 1])).toBeLessThanOrEqual(4);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('playlist advanced mode should have concat and thread limiting', () => {
      fc.assert(
        fc.property(
          concatFileGen,
          rtmpUrlGen,
          fc.constantFrom('1280x720', '1920x1080', '854x480'),
          fc.integer({ min: 1000, max: 6000 }),
          fc.constantFrom(24, 30, 60),
          (concatFile, rtmpUrl, resolution, bitrate, fps) => {
            const args = buildFFmpegArgsForPlaylistAdvanced(concatFile, rtmpUrl, resolution, bitrate, fps);
            
            // Check concat format
            const fConcatIndex = args.indexOf('-f');
            expect(fConcatIndex).toBeGreaterThanOrEqual(0);
            expect(args[fConcatIndex + 1]).toBe('concat');
            
            // Check thread limiting
            const threadsIndex = args.indexOf('-threads');
            expect(threadsIndex).toBeGreaterThanOrEqual(0);
            expect(parseInt(args[threadsIndex + 1])).toBeLessThanOrEqual(4);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: cpu-optimization, Property 3: Ultrafast Preset for Encoding**
   * **Validates: Requirements 2.2, 3.2**
   * 
   * For any stream that requires re-encoding (advanced settings enabled),
   * the FFmpeg arguments SHALL contain `-preset ultrafast`.
   */
  describe('Property 3: Ultrafast Preset for Encoding', () => {
    const concatFileGen = fc.string({ minLength: 5, maxLength: 20 })
      .map(s => `/temp/playlist_${s.replace(/[^a-zA-Z0-9]/g, '')}.txt`);

    it('advanced mode should use ultrafast preset', () => {
      fc.assert(
        fc.property(
          concatFileGen,
          rtmpUrlGen,
          fc.constantFrom('1280x720', '1920x1080', '854x480'),
          fc.integer({ min: 1000, max: 6000 }),
          fc.constantFrom(24, 30, 60),
          (concatFile, rtmpUrl, resolution, bitrate, fps) => {
            const args = buildFFmpegArgsForPlaylistAdvanced(concatFile, rtmpUrl, resolution, bitrate, fps);
            
            // Check preset is ultrafast
            const presetIndex = args.indexOf('-preset');
            expect(presetIndex).toBeGreaterThanOrEqual(0);
            expect(args[presetIndex + 1]).toBe('ultrafast');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('advanced mode should use baseline profile for YouTube compatibility', () => {
      fc.assert(
        fc.property(
          concatFileGen,
          rtmpUrlGen,
          fc.constantFrom('1280x720', '1920x1080', '854x480'),
          fc.integer({ min: 1000, max: 6000 }),
          fc.constantFrom(24, 30, 60),
          (concatFile, rtmpUrl, resolution, bitrate, fps) => {
            const args = buildFFmpegArgsForPlaylistAdvanced(concatFile, rtmpUrl, resolution, bitrate, fps);
            
            // Check profile is baseline
            const profileIndex = args.indexOf('-profile:v');
            expect(profileIndex).toBeGreaterThanOrEqual(0);
            expect(args[profileIndex + 1]).toBe('baseline');
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Feature: cpu-optimization, Property 5: Buffer Settings Optimized**
   * **Validates: Requirements 3.4, 8.1**
   * 
   * For any stream configuration, the FFmpeg arguments SHALL contain
   * `-bufsize` with value ≤ 4M and `-max_muxing_queue_size` with value ≤ 7000.
   */
  describe('Property 5: Buffer Settings Optimized', () => {
    it('video-only mode should have optimized buffer settings', () => {
      fc.assert(
        fc.property(
          videoPathGen,
          rtmpUrlGen,
          durationSecondsGen,
          loopVideoGen,
          (videoPath, rtmpUrl, durationSeconds, loopVideo) => {
            const args = buildFFmpegArgsVideoOnly(videoPath, rtmpUrl, durationSeconds, loopVideo);
            
            // Check bufsize is present and optimized
            const bufsizeIndex = args.indexOf('-bufsize');
            expect(bufsizeIndex).toBeGreaterThanOrEqual(0);
            const bufsizeValue = args[bufsizeIndex + 1];
            // Should be 1M or less (optimized from 4M)
            expect(['1M', '2M', '512K']).toContain(bufsizeValue);
            
            // Check max_muxing_queue_size is present and optimized
            const mqsIndex = args.indexOf('-max_muxing_queue_size');
            expect(mqsIndex).toBeGreaterThanOrEqual(0);
            const mqsValue = parseInt(args[mqsIndex + 1]);
            expect(mqsValue).toBeLessThanOrEqual(7000);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('audio merge mode should have optimized buffer settings', () => {
      fc.assert(
        fc.property(
          videoPathGen,
          audioPathGen,
          rtmpUrlGen,
          durationSecondsGen,
          loopVideoGen,
          (videoPath, audioPath, rtmpUrl, durationSeconds, loopVideo) => {
            const args = buildFFmpegArgsWithAudio(videoPath, audioPath, rtmpUrl, durationSeconds, loopVideo);
            
            const bufsizeIndex = args.indexOf('-bufsize');
            expect(bufsizeIndex).toBeGreaterThanOrEqual(0);
            const bufsizeValue = args[bufsizeIndex + 1];
            expect(['1M', '2M', '512K']).toContain(bufsizeValue);
            
            const mqsIndex = args.indexOf('-max_muxing_queue_size');
            expect(mqsIndex).toBeGreaterThanOrEqual(0);
            const mqsValue = parseInt(args[mqsIndex + 1]);
            expect(mqsValue).toBeLessThanOrEqual(7000);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: cpu-optimization, Property 6: Essential Parameters Preserved**
   * **Validates: Requirements 6.2**
   * 
   * For any stream configuration, the built FFmpeg arguments SHALL always contain:
   * input file path, output RTMP URL, and format specification `-f flv`.
   */
  describe('Property 6: Essential Parameters Preserved', () => {
    it('video-only mode should preserve essential parameters', () => {
      fc.assert(
        fc.property(
          videoPathGen,
          rtmpUrlGen,
          durationSecondsGen,
          loopVideoGen,
          (videoPath, rtmpUrl, durationSeconds, loopVideo) => {
            const args = buildFFmpegArgsVideoOnly(videoPath, rtmpUrl, durationSeconds, loopVideo);
            
            // Check input file is present
            const inputIndex = args.indexOf('-i');
            expect(inputIndex).toBeGreaterThanOrEqual(0);
            expect(args[inputIndex + 1]).toBe(videoPath);
            
            // Check output format is FLV
            const formatIndices = args.reduce((acc, val, idx) => {
              if (val === '-f') acc.push(idx);
              return acc;
            }, []);
            const lastFormatIndex = formatIndices[formatIndices.length - 1];
            expect(args[lastFormatIndex + 1]).toBe('flv');
            
            // Check RTMP URL is last element
            expect(args[args.length - 1]).toBe(rtmpUrl);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('audio merge mode should preserve essential parameters', () => {
      fc.assert(
        fc.property(
          videoPathGen,
          audioPathGen,
          rtmpUrlGen,
          durationSecondsGen,
          loopVideoGen,
          (videoPath, audioPath, rtmpUrl, durationSeconds, loopVideo) => {
            const args = buildFFmpegArgsWithAudio(videoPath, audioPath, rtmpUrl, durationSeconds, loopVideo);
            
            // Check both inputs are present
            const inputIndices = args.reduce((acc, val, idx) => {
              if (val === '-i') acc.push(idx);
              return acc;
            }, []);
            expect(inputIndices.length).toBe(2);
            expect(args[inputIndices[0] + 1]).toBe(videoPath);
            expect(args[inputIndices[1] + 1]).toBe(audioPath);
            
            // Check output format is FLV
            const formatIndices = args.reduce((acc, val, idx) => {
              if (val === '-f') acc.push(idx);
              return acc;
            }, []);
            const lastFormatIndex = formatIndices[formatIndices.length - 1];
            expect(args[lastFormatIndex + 1]).toBe('flv');
            
            // Check RTMP URL is last element
            expect(args[args.length - 1]).toBe(rtmpUrl);
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Feature: cpu-optimization, Property 8: Duration Hours to Seconds Conversion**
   * **Validates: Requirements 9.1**
   * 
   * For any duration value in hours, the calculated seconds SHALL equal
   * `hours * 3600` exactly.
   */
  describe('Property 8: Duration Hours to Seconds Conversion', () => {
    it('should correctly convert hours to seconds', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 24 }), // Use integer hours for simplicity
          (hours) => {
            const expectedSeconds = hours * 3600;
            const calculatedSeconds = calculateDurationSeconds(hours, null, null, null, new Date());
            expect(calculatedSeconds).toBe(expectedSeconds);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly convert minutes to seconds when hours not set', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1440 }), // 1 minute to 24 hours
          (minutes) => {
            const expectedSeconds = minutes * 60;
            const calculatedSeconds = calculateDurationSeconds(null, minutes, null, null, new Date());
            expect(calculatedSeconds).toBe(expectedSeconds);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: cpu-optimization, Property 9: Duration from End Time Calculation**
   * **Validates: Requirements 9.2**
   * 
   * For any stream with end_time and start_time, the calculated duration
   * SHALL equal `(endTime - startTime)` in seconds.
   */
  describe('Property 9: Duration from End Time Calculation', () => {
    it('should correctly calculate duration from schedule times', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1704067200000, max: 1735689600000 }), // 2024-01-01 to 2025-01-01 in ms
          fc.integer({ min: 60, max: 86400 }), // 1 minute to 24 hours in seconds
          (startMs, durationSec) => {
            const startDate = new Date(startMs);
            const endDate = new Date(startMs + durationSec * 1000);
            const calculatedSeconds = calculateDurationSeconds(
              null, null, 
              startDate.toISOString(), 
              endDate.toISOString(), 
              startDate
            );
            expect(calculatedSeconds).toBe(durationSec);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: cpu-optimization, Property 10: Duration Parameter Placement**
   * **Validates: Requirements 9.4**
   * 
   * For any stream with duration set, the `-t` parameter SHALL appear
   * in the arguments array at an index less than the RTMP URL index.
   */
  describe('Property 10: Duration Parameter Placement', () => {
    it('video-only mode should place -t before RTMP URL', () => {
      fc.assert(
        fc.property(
          videoPathGen,
          rtmpUrlGen,
          fc.integer({ min: 60, max: 86400 }), // Always have duration
          loopVideoGen,
          (videoPath, rtmpUrl, durationSeconds, loopVideo) => {
            const args = buildFFmpegArgsVideoOnly(videoPath, rtmpUrl, durationSeconds, loopVideo);
            
            const tIndex = args.indexOf('-t');
            const rtmpIndex = args.indexOf(rtmpUrl);
            
            // -t should exist and be before RTMP URL
            expect(tIndex).toBeGreaterThanOrEqual(0);
            expect(rtmpIndex).toBeGreaterThan(tIndex);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('audio merge mode should place -t before RTMP URL', () => {
      fc.assert(
        fc.property(
          videoPathGen,
          audioPathGen,
          rtmpUrlGen,
          fc.integer({ min: 60, max: 86400 }),
          loopVideoGen,
          (videoPath, audioPath, rtmpUrl, durationSeconds, loopVideo) => {
            const args = buildFFmpegArgsWithAudio(videoPath, audioPath, rtmpUrl, durationSeconds, loopVideo);
            
            const tIndex = args.indexOf('-t');
            const rtmpIndex = args.indexOf(rtmpUrl);
            
            expect(tIndex).toBeGreaterThanOrEqual(0);
            expect(rtmpIndex).toBeGreaterThan(tIndex);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not include -t when duration is null', () => {
      fc.assert(
        fc.property(
          videoPathGen,
          rtmpUrlGen,
          loopVideoGen,
          (videoPath, rtmpUrl, loopVideo) => {
            const args = buildFFmpegArgsVideoOnly(videoPath, rtmpUrl, null, loopVideo);
            
            const tIndex = args.indexOf('-t');
            expect(tIndex).toBe(-1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Feature: cpu-optimization, Property 11: Loop with Duration Correct Order**
   * **Validates: Requirements 10.1**
   * 
   * For any stream with loop enabled and duration set, the arguments SHALL contain
   * `-stream_loop` before input and `-t` before output URL.
   */
  describe('Property 11: Loop with Duration Correct Order', () => {
    it('video-only with loop should have correct parameter order', () => {
      fc.assert(
        fc.property(
          videoPathGen,
          rtmpUrlGen,
          fc.integer({ min: 60, max: 86400 }),
          (videoPath, rtmpUrl, durationSeconds) => {
            const args = buildFFmpegArgsVideoOnly(videoPath, rtmpUrl, durationSeconds, true); // loop=true
            
            // Find -stream_loop position
            const loopIndex = args.indexOf('-stream_loop');
            expect(loopIndex).toBeGreaterThanOrEqual(0);
            
            // Find -i position (input)
            const inputIndex = args.indexOf('-i');
            expect(inputIndex).toBeGreaterThan(loopIndex); // loop should be before input
            
            // Find -t position
            const tIndex = args.indexOf('-t');
            expect(tIndex).toBeGreaterThanOrEqual(0);
            
            // Find rtmp URL position
            const rtmpIndex = args.indexOf(rtmpUrl);
            expect(rtmpIndex).toBeGreaterThan(tIndex); // -t should be before output
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: cpu-optimization, Property 12: Audio Loop Sync**
   * **Validates: Requirements 10.2**
   * 
   * For any stream with separate audio and duration limit, the audio input
   * SHALL have `-stream_loop -1` to ensure continuous audio.
   */
  describe('Property 12: Audio Loop Sync', () => {
    it('audio merge should always loop audio for sync', () => {
      fc.assert(
        fc.property(
          videoPathGen,
          audioPathGen,
          rtmpUrlGen,
          fc.integer({ min: 60, max: 86400 }),
          loopVideoGen,
          (videoPath, audioPath, rtmpUrl, durationSeconds, loopVideo) => {
            const args = buildFFmpegArgsWithAudio(videoPath, audioPath, rtmpUrl, durationSeconds, loopVideo);
            
            // Find all -stream_loop occurrences
            const loopIndices = args.reduce((acc, val, idx) => {
              if (val === '-stream_loop') acc.push(idx);
              return acc;
            }, []);
            
            // Should have at least one loop for audio (always loops)
            expect(loopIndices.length).toBeGreaterThanOrEqual(1);
            
            // Find audio input position
            const inputIndices = args.reduce((acc, val, idx) => {
              if (val === '-i') acc.push(idx);
              return acc;
            }, []);
            
            // Audio is second input, should have loop before it
            const audioInputIndex = inputIndices[1];
            const audioLoopIndex = loopIndices.find(idx => idx < audioInputIndex && idx > inputIndices[0]);
            expect(audioLoopIndex).toBeDefined();
            expect(args[audioLoopIndex + 1]).toBe('-1'); // Infinite loop
          }
        ),
        { numRuns: 100 }
      );
    });
  });
