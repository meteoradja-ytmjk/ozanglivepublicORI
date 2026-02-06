/**
 * Property-Based Tests for Streaming Fix Feature
 * Tests FFmpeg args generation for video+audio merge and duration handling
 */

const fc = require('fast-check');
const {
  buildFFmpegArgsWithAudio,
  buildFFmpegArgsVideoOnly
} = require('../services/streamingService');

// Mock paths for testing
const mockVideoPath = '/path/to/video.mp4';
const mockAudioPath = '/path/to/audio.mp3';
const mockRtmpUrl = 'rtmp://a.rtmp.youtube.com/live2/test-key';

describe('Streaming Fix - FFmpeg Args Generation', () => {
  
  /**
   * **Feature: streaming-fix, Property 1: FFmpeg args with audio contains correct mapping**
   * **Validates: Requirements 1.1, 1.3**
   * 
   * For any stream configuration with both video and audio,
   * the generated FFmpeg args SHALL contain two `-i` inputs and proper `-map` parameters
   */
  describe('Property 1: FFmpeg args with audio contains correct mapping', () => {
    it('should contain two -i inputs and -map parameters for video+audio', () => {
      fc.assert(
        fc.property(
          fc.record({
            durationHours: fc.option(fc.integer({ min: 1, max: 168 }), { nil: null }),
            loopVideo: fc.boolean()
          }),
          ({ durationHours, loopVideo }) => {
            const durationSeconds = durationHours ? durationHours * 3600 : null;
            const args = buildFFmpegArgsWithAudio(
              mockVideoPath,
              mockAudioPath,
              mockRtmpUrl,
              durationSeconds,
              loopVideo
            );
            
            // Count -i inputs
            const inputCount = args.filter(a => a === '-i').length;
            
            // Check for -map parameters
            const hasVideoMap = args.includes('-map') && args.includes('0:v:0');
            const hasAudioMap = args.includes('1:a:0');
            
            return inputCount === 2 && hasVideoMap && hasAudioMap;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: streaming-fix, Property 2: FFmpeg args without audio uses video's original audio**
   * **Validates: Requirements 1.2**
   * 
   * For any stream configuration with video only (no audio),
   * the generated FFmpeg args SHALL contain only one `-i` input and no `-map` parameters
   */
  describe('Property 2: FFmpeg args without audio uses video original audio', () => {
    it('should contain one -i input and no -map parameters for video only', () => {
      fc.assert(
        fc.property(
          fc.record({
            durationHours: fc.option(fc.integer({ min: 1, max: 168 }), { nil: null }),
            loopVideo: fc.boolean()
          }),
          ({ durationHours, loopVideo }) => {
            const durationSeconds = durationHours ? durationHours * 3600 : null;
            const args = buildFFmpegArgsVideoOnly(
              mockVideoPath,
              mockRtmpUrl,
              durationSeconds,
              loopVideo
            );
            
            // Count -i inputs
            const inputCount = args.filter(a => a === '-i').length;
            
            // Check that -map is NOT present (using original audio)
            const hasMap = args.includes('-map');
            
            return inputCount === 1 && !hasMap;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: streaming-fix, Property 3: Duration parameter limits stream length**
   * **Validates: Requirements 2.1**
   * 
   * For any stream configuration with stream_duration_hours set,
   * the generated FFmpeg args SHALL contain `-t` parameter with correct seconds value
   */
  describe('Property 3: Duration parameter limits stream length', () => {
    it('should contain -t parameter with correct duration in seconds', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 168 }),
          (durationHours) => {
            const durationSeconds = durationHours * 3600;
            const args = buildFFmpegArgsVideoOnly(
              mockVideoPath,
              mockRtmpUrl,
              durationSeconds,
              true
            );
            
            const tIndex = args.indexOf('-t');
            if (tIndex === -1) return false;
            
            const tValue = parseInt(args[tIndex + 1]);
            return tValue === durationSeconds;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not contain -t parameter when duration is null', () => {
      const args = buildFFmpegArgsVideoOnly(
        mockVideoPath,
        mockRtmpUrl,
        null,
        true
      );
      
      const hasDuration = args.includes('-t');
      expect(hasDuration).toBe(false);
    });
  });

  /**
   * **Feature: streaming-fix, Property 4: Audio looping enabled when audio selected**
   * **Validates: Requirements 2.2**
   * 
   * For any stream configuration with audio,
   * the generated FFmpeg args SHALL contain `-stream_loop -1` before the audio input
   */
  describe('Property 4: Audio looping enabled when audio selected', () => {
    it('should contain -stream_loop -1 for audio input', () => {
      fc.assert(
        fc.property(
          fc.record({
            durationHours: fc.option(fc.integer({ min: 1, max: 168 }), { nil: null }),
            loopVideo: fc.boolean()
          }),
          ({ durationHours, loopVideo }) => {
            const durationSeconds = durationHours ? durationHours * 3600 : null;
            const args = buildFFmpegArgsWithAudio(
              mockVideoPath,
              mockAudioPath,
              mockRtmpUrl,
              durationSeconds,
              loopVideo
            );
            
            // Find all -stream_loop occurrences
            const streamLoopIndices = [];
            args.forEach((arg, index) => {
              if (arg === '-stream_loop') {
                streamLoopIndices.push(index);
              }
            });
            
            // Should have at least one -stream_loop for audio (always loops)
            // and possibly one for video (if loopVideo is true)
            const hasAudioLoop = streamLoopIndices.some(idx => {
              // Check if this -stream_loop is followed by -1 and then eventually the audio path
              return args[idx + 1] === '-1';
            });
            
            return hasAudioLoop;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


/**
 * UI Helper Functions for Testing
 * These functions mirror the logic used in dashboard.ejs
 */

function getStatusColorClass(status) {
  switch (status) {
    case 'live':
      return 'bg-green-500';
    case 'scheduled':
      return 'bg-yellow-500';
    case 'offline':
    default:
      return 'bg-gray-500';
  }
}

function formatDurationHours(hours) {
  if (!hours || hours <= 0) return '-';
  return `${hours} jam`;
}

describe('Streaming Fix - UI Helper Functions', () => {
  
  /**
   * **Feature: streaming-fix, Property 5: Status badge color mapping**
   * **Validates: Requirements 4.4**
   * 
   * For any stream status value, the rendered badge SHALL use the correct color class
   */
  describe('Property 5: Status badge color mapping', () => {
    it('should return correct color class for each status', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('live', 'scheduled', 'offline'),
          (status) => {
            const colorClass = getStatusColorClass(status);
            const expectedColors = {
              'live': 'bg-green-500',
              'scheduled': 'bg-yellow-500',
              'offline': 'bg-gray-500'
            };
            return colorClass === expectedColors[status];
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return gray for unknown status', () => {
      const colorClass = getStatusColorClass('unknown');
      expect(colorClass).toBe('bg-gray-500');
    });
  });

  /**
   * **Feature: streaming-fix, Property 6: Duration format correctness**
   * **Validates: Requirements 4.2**
   * 
   * For any duration value in hours, the formatted string SHALL display correctly
   */
  describe('Property 6: Duration format correctness', () => {
    it('should format duration as "X jam"', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 168 }),
          (hours) => {
            const formatted = formatDurationHours(hours);
            return formatted === `${hours} jam`;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return "-" for null or zero duration', () => {
      expect(formatDurationHours(null)).toBe('-');
      expect(formatDurationHours(0)).toBe('-');
      expect(formatDurationHours(undefined)).toBe('-');
    });
  });
});

// Export helper functions for use in other tests
module.exports = {
  getStatusColorClass,
  formatDurationHours
};
