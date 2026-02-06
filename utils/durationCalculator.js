/**
 * Duration Calculator Utility
 * 
 * Centralized module for calculating stream duration consistently.
 * This ensures all parts of the system use the same priority logic
 * for determining stream duration.
 * 
 * Priority Order:
 * 1. stream_duration_minutes (primary field, in minutes) - ALWAYS takes priority
 * 2. end_time - schedule_time (calculated from schedule) - ONLY if stream_duration_minutes is not set
 * 3. stream_duration_hours (deprecated, in hours)
 * 4. duration (legacy field, in minutes)
 * 
 * IMPORTANT: If stream_duration_minutes is set (even to 0), end_time is NOT used for duration.
 * If both stream_duration_minutes and end_time are empty/null, stream runs UNLIMITED.
 */

/**
 * Calculate stream duration in seconds from stream data
 * 
 * @param {Object} stream - Stream object from database
 * @param {number} [stream.stream_duration_minutes] - Duration in minutes (primary)
 * @param {string} [stream.end_time] - Scheduled end time (ISO format)
 * @param {string} [stream.schedule_time] - Scheduled start time (ISO format)
 * @param {number} [stream.stream_duration_hours] - Duration in hours (deprecated)
 * @param {number} [stream.duration] - Duration in minutes (legacy)
 * @returns {number|null} Duration in seconds or null if not set (unlimited)
 */
function calculateDurationSeconds(stream) {
  if (!stream) {
    console.log('[DurationCalculator] No stream provided');
    return null;
  }

  // Priority 1: stream_duration_minutes (primary field)
  // If user explicitly set duration (hours + minutes), this takes absolute priority
  if (stream.stream_duration_minutes && stream.stream_duration_minutes > 0) {
    const seconds = stream.stream_duration_minutes * 60;
    console.log(`[DurationCalculator] Using stream_duration_minutes: ${stream.stream_duration_minutes} minutes (${seconds} seconds)`);
    return seconds;
  }

  // Priority 2: Calculate from schedule times (end_time - schedule_time)
  // ONLY used if stream_duration_minutes is NOT set
  // For ONCE schedules, end_time can be used to calculate duration
  if (stream.end_time && stream.schedule_time) {
    const scheduleStart = new Date(stream.schedule_time);
    const scheduleEnd = new Date(stream.end_time);
    
    // Validate dates
    if (!isNaN(scheduleStart.getTime()) && !isNaN(scheduleEnd.getTime())) {
      const durationMs = scheduleEnd.getTime() - scheduleStart.getTime();
      if (durationMs > 0) {
        const seconds = Math.floor(durationMs / 1000);
        const minutes = seconds / 60;
        console.log(`[DurationCalculator] Using schedule calculation: ${minutes.toFixed(1)} minutes (${seconds} seconds)`);
        return seconds;
      }
    }
  }

  // Priority 3: stream_duration_hours (deprecated field, convert to seconds)
  if (stream.stream_duration_hours && stream.stream_duration_hours > 0) {
    const seconds = stream.stream_duration_hours * 3600;
    const minutes = stream.stream_duration_hours * 60;
    console.log(`[DurationCalculator] Using stream_duration_hours (deprecated): ${stream.stream_duration_hours} hours = ${minutes} minutes (${seconds} seconds)`);
    return seconds;
  }

  // Priority 4: duration field (legacy, in minutes)
  if (stream.duration && stream.duration > 0) {
    const seconds = stream.duration * 60;
    console.log(`[DurationCalculator] Using duration field (legacy): ${stream.duration} minutes (${seconds} seconds)`);
    return seconds;
  }

  // No duration set - stream will run UNLIMITED
  console.log('[DurationCalculator] No valid duration found - stream will run UNLIMITED');
  return null;
}

/**
 * Calculate remaining duration when stream restarts after error
 * 
 * @param {Date} originalStartTime - Original stream start time
 * @param {number} totalDurationMs - Total intended duration in milliseconds
 * @returns {number} Remaining duration in milliseconds (minimum 0)
 */
function calculateRemainingDuration(originalStartTime, totalDurationMs) {
  if (!originalStartTime || !totalDurationMs || totalDurationMs <= 0) {
    return 0;
  }

  const startTime = originalStartTime instanceof Date 
    ? originalStartTime 
    : new Date(originalStartTime);
  
  if (isNaN(startTime.getTime())) {
    console.log('[DurationCalculator] Invalid originalStartTime provided');
    return 0;
  }

  const elapsed = Date.now() - startTime.getTime();
  const remaining = Math.max(0, totalDurationMs - elapsed);
  
  console.log(`[DurationCalculator] Remaining duration: ${remaining / 60000} minutes (elapsed: ${elapsed / 60000} minutes)`);
  
  return remaining;
}

/**
 * Convert minutes to seconds
 * @param {number} minutes - Duration in minutes
 * @returns {number} Duration in seconds
 */
function minutesToSeconds(minutes) {
  return minutes * 60;
}

/**
 * Convert hours to seconds
 * @param {number} hours - Duration in hours
 * @returns {number} Duration in seconds
 */
function hoursToSeconds(hours) {
  return hours * 3600;
}

/**
 * Convert milliseconds to seconds
 * @param {number} ms - Duration in milliseconds
 * @returns {number} Duration in seconds
 */
function msToSeconds(ms) {
  return Math.floor(ms / 1000);
}

/**
 * Format duration for logging
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted string "X minutes (Y seconds)"
 */
function formatDuration(seconds) {
  if (!seconds || seconds <= 0) {
    return 'not set';
  }
  const minutes = seconds / 60;
  return `${minutes.toFixed(1)} minutes (${seconds} seconds)`;
}

module.exports = {
  calculateDurationSeconds,
  calculateRemainingDuration,
  minutesToSeconds,
  hoursToSeconds,
  msToSeconds,
  formatDuration
};
