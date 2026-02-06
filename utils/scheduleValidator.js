/**
 * Schedule Validation Utilities
 * Validates recurring schedule configurations for streams
 */

/**
 * Validate time format (HH:MM in 24-hour format)
 * @param {string} time - Time string to validate
 * @returns {Object} { valid: boolean, error?: string }
 */
function validateTimeFormat(time) {
  if (!time || typeof time !== 'string') {
    return { valid: false, error: 'Time is required' };
  }
  
  const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
  if (!timeRegex.test(time)) {
    return { valid: false, error: 'Invalid time format. Use HH:MM (24-hour format)' };
  }
  
  return { valid: true };
}

/**
 * Validate weekly schedule days array
 * @param {Array} days - Array of day numbers (0-6, where 0=Sunday)
 * @returns {Object} { valid: boolean, error?: string }
 */
function validateWeeklyDays(days) {
  if (!Array.isArray(days)) {
    return { valid: false, error: 'schedule_days must be an array' };
  }
  
  if (days.length === 0) {
    return { valid: false, error: 'schedule_days cannot be empty for weekly schedule' };
  }
  
  for (const day of days) {
    if (typeof day !== 'number' || day < 0 || day > 6 || !Number.isInteger(day)) {
      return { valid: false, error: `Invalid day number: ${day}. Must be integer 0-6` };
    }
  }
  
  // Check for duplicates
  const uniqueDays = new Set(days);
  if (uniqueDays.size !== days.length) {
    return { valid: false, error: 'schedule_days contains duplicate values' };
  }
  
  return { valid: true };
}

/**
 * Validate complete schedule configuration
 * @param {Object} config - Schedule configuration object
 * @returns {Object} { valid: boolean, error?: string }
 */
function validateScheduleConfig(config) {
  if (!config || typeof config !== 'object') {
    return { valid: false, error: 'Config must be an object' };
  }

  const validTypes = ['once', 'daily', 'weekly'];
  const scheduleType = config.schedule_type || 'once';
  
  if (!validTypes.includes(scheduleType)) {
    return { valid: false, error: `Invalid schedule_type: ${scheduleType}. Must be one of: ${validTypes.join(', ')}` };
  }

  // For daily and weekly schedules, recurring_time is required
  if (scheduleType === 'daily' || scheduleType === 'weekly') {
    const timeValidation = validateTimeFormat(config.recurring_time);
    if (!timeValidation.valid) {
      return timeValidation;
    }
  }

  // For weekly schedules, schedule_days is required
  if (scheduleType === 'weekly') {
    const daysValidation = validateWeeklyDays(config.schedule_days);
    if (!daysValidation.valid) {
      return daysValidation;
    }
  }

  // Validate recurring_enabled if provided
  if (config.recurring_enabled !== undefined && typeof config.recurring_enabled !== 'boolean') {
    // Allow 0/1 for database compatibility
    if (config.recurring_enabled !== 0 && config.recurring_enabled !== 1) {
      return { valid: false, error: 'recurring_enabled must be a boolean' };
    }
  }

  return { valid: true };
}

/**
 * Normalize time to HH:MM format with leading zeros
 * @param {string} time - Time string
 * @returns {string} Normalized time string
 */
function normalizeTime(time) {
  if (!time) return null;
  
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return time;
  
  const hours = match[1].padStart(2, '0');
  const minutes = match[2];
  return `${hours}:${minutes}`;
}

/**
 * Parse schedule_days from various formats
 * @param {string|Array} days - Days as JSON string or array
 * @returns {Array} Array of day numbers
 */
function parseScheduleDays(days) {
  if (Array.isArray(days)) {
    return days;
  }
  
  if (typeof days === 'string') {
    try {
      const parsed = JSON.parse(days);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }
  
  return [];
}

/**
 * Get day name from day number
 * @param {number} dayNum - Day number (0-6)
 * @returns {string} Day name
 */
function getDayName(dayNum) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayNum] || 'Unknown';
}

/**
 * Get short day name from day number
 * @param {number} dayNum - Day number (0-6)
 * @returns {string} Short day name
 */
function getShortDayName(dayNum) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[dayNum] || '???';
}

/**
 * Format schedule days for display
 * @param {Array} days - Array of day numbers
 * @returns {string} Formatted string like "Mon, Wed, Fri"
 */
function formatScheduleDays(days) {
  if (!Array.isArray(days) || days.length === 0) {
    return 'No days selected';
  }
  
  const sortedDays = [...days].sort((a, b) => a - b);
  return sortedDays.map(d => getShortDayName(d)).join(', ');
}

module.exports = {
  validateTimeFormat,
  validateWeeklyDays,
  validateScheduleConfig,
  normalizeTime,
  parseScheduleDays,
  getDayName,
  getShortDayName,
  formatScheduleDays
};
