/**
 * RTMP Health Monitor Service
 * 
 * Monitors RTMP connection health and automatically reconnects
 * if the connection drops while the stream should still be running.
 * 
 * This prevents YouTube Live from dying before the scheduled duration ends.
 */

const Stream = require('../models/Stream');
const { calculateDurationSeconds } = require('../utils/durationCalculator');

// Check interval: 60 minutes (was 30 min) - FFmpeg exit event handles normal cases
const HEALTH_CHECK_INTERVAL_MS = 60 * 60 * 1000;

// Maximum consecutive failures before giving up
const MAX_CONSECUTIVE_FAILURES = 3;

// Reconnect delay: 5 seconds
const RECONNECT_DELAY_MS = 5 * 1000;

// Minimum remaining time to attempt reconnect (2 minutes)
const MIN_REMAINING_TIME_FOR_RECONNECT_MS = 2 * 60 * 1000;

class RTMPHealthMonitor {
  constructor() {
    // Map of streamId -> { intervalId, startTime, durationMs, consecutiveFailures, lastCheck }
    this.monitoredStreams = new Map();
    
    // Reference to streamingService (set via setStreamingService)
    this.streamingService = null;
    
    // Flag to prevent multiple reconnects
    this.reconnectingStreams = new Set();
  }

  /**
   * Set reference to streaming service (to avoid circular dependency)
   * @param {Object} streamingService - StreamingService instance
   */
  setStreamingService(streamingService) {
    this.streamingService = streamingService;
  }

  /**
   * Start monitoring a stream's RTMP connection
   * @param {string} streamId - Stream ID
   * @param {Date} startTime - Stream start time
   * @param {number} durationMs - Expected duration in milliseconds (null for indefinite)
   * @returns {boolean} True if monitoring started
   */
  startMonitoring(streamId, startTime, durationMs) {
    // Don't monitor if already monitoring
    if (this.monitoredStreams.has(streamId)) {
      console.log(`[RTMPHealthMonitor] Already monitoring stream ${streamId}`);
      return true;
    }

    // Start health check interval
    const intervalId = setInterval(async () => {
      await this.checkStreamHealth(streamId);
    }, HEALTH_CHECK_INTERVAL_MS);

    // Store monitoring state
    this.monitoredStreams.set(streamId, {
      intervalId,
      startTime,
      durationMs,
      consecutiveFailures: 0,
      lastCheck: new Date(),
      reconnectAttempts: 0
    });

    const durationInfo = durationMs ? `${(durationMs / 60000).toFixed(1)} minutes` : 'indefinite';
    console.log(`[RTMPHealthMonitor] Started monitoring stream ${streamId} (duration: ${durationInfo})`);
    return true;
  }

  /**
   * Stop monitoring a stream
   * @param {string} streamId - Stream ID
   */
  stopMonitoring(streamId) {
    const monitor = this.monitoredStreams.get(streamId);
    if (!monitor) return;

    // Clear interval
    if (monitor.intervalId) {
      clearInterval(monitor.intervalId);
    }

    // Remove from maps
    this.monitoredStreams.delete(streamId);
    this.reconnectingStreams.delete(streamId);
    
    console.log(`[RTMPHealthMonitor] Stopped monitoring stream ${streamId}`);
  }

  /**
   * Check if stream should still be running based on duration
   * @param {string} streamId - Stream ID
   * @returns {{shouldBeRunning: boolean, remainingMs: number|null}}
   */
  getStreamTimeStatus(streamId) {
    const monitor = this.monitoredStreams.get(streamId);
    if (!monitor) {
      return { shouldBeRunning: false, remainingMs: null };
    }

    // If no duration set, stream should run indefinitely
    if (!monitor.durationMs) {
      return { shouldBeRunning: true, remainingMs: null };
    }

    const now = Date.now();
    const expectedEndTime = monitor.startTime.getTime() + monitor.durationMs;
    const remainingMs = expectedEndTime - now;

    return {
      shouldBeRunning: remainingMs > 0,
      remainingMs: Math.max(0, remainingMs)
    };
  }

  /**
   * Check stream health and reconnect if needed
   * @param {string} streamId - Stream ID
   */
  async checkStreamHealth(streamId) {
    const monitor = this.monitoredStreams.get(streamId);
    if (!monitor) return;

    monitor.lastCheck = new Date();

    try {
      // Check if stream should still be running
      const timeStatus = this.getStreamTimeStatus(streamId);
      
      if (!timeStatus.shouldBeRunning) {
        console.log(`[RTMPHealthMonitor] Stream ${streamId} duration completed, stopping monitor`);
        this.stopMonitoring(streamId);
        return;
      }

      // Check if FFmpeg process is still running
      const isFFmpegRunning = this.streamingService?.isStreamActive(streamId);
      
      if (isFFmpegRunning) {
        // Reset failure counter on success
        monitor.consecutiveFailures = 0;
        
        // Log remaining time periodically
        if (timeStatus.remainingMs !== null) {
          const remainingMin = (timeStatus.remainingMs / 60000).toFixed(1);
          console.log(`[RTMPHealthMonitor] Stream ${streamId}: OK (${remainingMin} min remaining)`);
        }
        return;
      }

      // FFmpeg not running - check if we should reconnect
      monitor.consecutiveFailures++;
      console.log(`[RTMPHealthMonitor] Stream ${streamId}: FFmpeg not running (failure #${monitor.consecutiveFailures})`);

      // Check if enough time remaining to reconnect
      if (timeStatus.remainingMs !== null && timeStatus.remainingMs < MIN_REMAINING_TIME_FOR_RECONNECT_MS) {
        console.log(`[RTMPHealthMonitor] Stream ${streamId}: Not enough time remaining (${(timeStatus.remainingMs / 60000).toFixed(1)} min), skipping reconnect`);
        this.stopMonitoring(streamId);
        return;
      }

      // Check if max failures reached
      if (monitor.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.log(`[RTMPHealthMonitor] Stream ${streamId}: Max failures reached (${MAX_CONSECUTIVE_FAILURES}), stopping monitor`);
        this.stopMonitoring(streamId);
        return;
      }

      // Attempt reconnect
      await this.attemptReconnect(streamId, timeStatus.remainingMs);

    } catch (error) {
      console.error(`[RTMPHealthMonitor] Error checking stream ${streamId}:`, error.message);
    }
  }

  /**
   * Attempt to reconnect a stream
   * @param {string} streamId - Stream ID
   * @param {number|null} remainingMs - Remaining duration in milliseconds
   */
  async attemptReconnect(streamId, remainingMs) {
    // Prevent multiple simultaneous reconnects
    if (this.reconnectingStreams.has(streamId)) {
      console.log(`[RTMPHealthMonitor] Stream ${streamId}: Reconnect already in progress`);
      return;
    }

    this.reconnectingStreams.add(streamId);
    const monitor = this.monitoredStreams.get(streamId);
    
    if (monitor) {
      monitor.reconnectAttempts++;
    }

    try {
      console.log(`[RTMPHealthMonitor] Stream ${streamId}: Attempting reconnect (attempt #${monitor?.reconnectAttempts || 1})`);

      // Wait before reconnecting
      await new Promise(resolve => setTimeout(resolve, RECONNECT_DELAY_MS));

      // Get stream data
      const stream = await Stream.findById(streamId);
      if (!stream) {
        console.log(`[RTMPHealthMonitor] Stream ${streamId}: Not found in database, stopping monitor`);
        this.stopMonitoring(streamId);
        return;
      }

      // Check if stream should still be running (status check)
      if (stream.status !== 'live') {
        console.log(`[RTMPHealthMonitor] Stream ${streamId}: Status is '${stream.status}', not reconnecting`);
        this.stopMonitoring(streamId);
        return;
      }

      // Attempt to restart the stream
      if (this.streamingService) {
        // Update the stream's duration to remaining time if applicable
        if (remainingMs !== null && remainingMs > 0) {
          const remainingMinutes = Math.ceil(remainingMs / 60000);
          console.log(`[RTMPHealthMonitor] Stream ${streamId}: Reconnecting with ${remainingMinutes} minutes remaining`);
          
          // Update stream_duration_minutes to remaining time
          await Stream.update(streamId, {
            stream_duration_minutes: remainingMinutes
          });
        }

        const result = await this.streamingService.startStream(streamId);
        
        if (result.success) {
          console.log(`[RTMPHealthMonitor] Stream ${streamId}: Reconnect successful`);
          if (monitor) {
            monitor.consecutiveFailures = 0;
          }
        } else {
          console.error(`[RTMPHealthMonitor] Stream ${streamId}: Reconnect failed - ${result.error}`);
        }
      }

    } catch (error) {
      console.error(`[RTMPHealthMonitor] Stream ${streamId}: Reconnect error - ${error.message}`);
    } finally {
      this.reconnectingStreams.delete(streamId);
    }
  }

  /**
   * Update duration for a monitored stream
   * @param {string} streamId - Stream ID
   * @param {number} newDurationMs - New duration in milliseconds
   */
  updateDuration(streamId, newDurationMs) {
    const monitor = this.monitoredStreams.get(streamId);
    if (monitor) {
      monitor.durationMs = newDurationMs;
      console.log(`[RTMPHealthMonitor] Updated duration for stream ${streamId}: ${(newDurationMs / 60000).toFixed(1)} minutes`);
    }
  }

  /**
   * Check if a stream is being monitored
   * @param {string} streamId - Stream ID
   * @returns {boolean}
   */
  isMonitoring(streamId) {
    return this.monitoredStreams.has(streamId);
  }

  /**
   * Get monitoring status for a stream
   * @param {string} streamId - Stream ID
   * @returns {Object|null}
   */
  getMonitorStatus(streamId) {
    const monitor = this.monitoredStreams.get(streamId);
    if (!monitor) return null;

    const timeStatus = this.getStreamTimeStatus(streamId);
    
    return {
      startTime: monitor.startTime,
      durationMs: monitor.durationMs,
      remainingMs: timeStatus.remainingMs,
      consecutiveFailures: monitor.consecutiveFailures,
      reconnectAttempts: monitor.reconnectAttempts,
      lastCheck: monitor.lastCheck,
      isReconnecting: this.reconnectingStreams.has(streamId)
    };
  }

  /**
   * Get all monitored streams
   * @returns {string[]} Array of stream IDs
   */
  getMonitoredStreams() {
    return Array.from(this.monitoredStreams.keys());
  }

  /**
   * Cleanup all monitoring (for shutdown)
   */
  cleanup() {
    for (const [streamId, monitor] of this.monitoredStreams) {
      if (monitor.intervalId) {
        clearInterval(monitor.intervalId);
      }
    }
    this.monitoredStreams.clear();
    this.reconnectingStreams.clear();
    console.log('[RTMPHealthMonitor] Cleaned up all monitoring');
  }
}

// Export singleton instance
module.exports = new RTMPHealthMonitor();
