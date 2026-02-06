/**
 * Utility functions for recurring schedule validation and calculation
 */

const VALID_PATTERNS = ['daily', 'weekly'];
const VALID_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_INDEX_MAP = {
  'sunday': 0,
  'monday': 1,
  'tuesday': 2,
  'wednesday': 3,
  'thursday': 4,
  'friday': 5,
  'saturday': 6
};

/**
 * Get current time in Asia/Jakarta timezone (WIB)
 * Uses Intl.DateTimeFormat for accurate timezone conversion
 * @param {Date} date - Date object to convert
 * @returns {Object} Object with hours, minutes, day, year, month, date
 */
function getWIBTime(date = new Date()) {
  try {
    // Use Intl.DateTimeFormat for accurate timezone conversion
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Jakarta',
      hour: 'numeric',
      minute: 'numeric',
      weekday: 'short',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour12: false
    });
    
    const parts = formatter.formatToParts(date);
    let hours = 0, minutes = 0, dayName = '', year = 0, month = 0, dayOfMonth = 0;
    
    for (const part of parts) {
      if (part.type === 'hour') hours = parseInt(part.value, 10);
      if (part.type === 'minute') minutes = parseInt(part.value, 10);
      if (part.type === 'weekday') dayName = part.value;
      if (part.type === 'year') year = parseInt(part.value, 10);
      if (part.type === 'month') month = parseInt(part.value, 10) - 1; // 0-indexed
      if (part.type === 'day') dayOfMonth = parseInt(part.value, 10);
    }
    
    // Convert day name to number (0=Sun, 1=Mon, etc.)
    const dayMap = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
    const day = dayMap[dayName] ?? date.getDay();
    
    return { hours, minutes, day, year, month, dayOfMonth };
  } catch (e) {
    // Fallback to manual calculation if Intl fails
    console.warn('[recurringUtils] Intl.DateTimeFormat failed, using manual WIB calculation');
    const wibOffset = 7 * 60 * 60 * 1000; // 7 hours in ms
    const wibDate = new Date(date.getTime() + wibOffset);
    
    return {
      hours: wibDate.getUTCHours(),
      minutes: wibDate.getUTCMinutes(),
      day: wibDate.getUTCDay(),
      year: wibDate.getUTCFullYear(),
      month: wibDate.getUTCMonth(),
      dayOfMonth: wibDate.getUTCDate()
    };
  }
}

/**
 * Create a Date object for a specific WIB time
 * @param {number} year - Year
 * @param {number} month - Month (0-indexed)
 * @param {number} day - Day of month
 * @param {number} hours - Hours (0-23)
 * @param {number} minutes - Minutes (0-59)
 * @returns {Date} Date object in UTC that represents the given WIB time
 */
function createWIBDate(year, month, day, hours, minutes) {
  // Create date in WIB, then convert to UTC
  // WIB is UTC+7, so subtract 7 hours to get UTC
  const utcHours = hours - 7;
  
  // Handle day rollover
  let adjustedDay = day;
  let adjustedMonth = month;
  let adjustedYear = year;
  let adjustedHours = utcHours;
  
  if (utcHours < 0) {
    adjustedHours = utcHours + 24;
    adjustedDay = day - 1;
    
    // Handle month rollover
    if (adjustedDay < 1) {
      adjustedMonth = month - 1;
      if (adjustedMonth < 0) {
        adjustedMonth = 11;
        adjustedYear = year - 1;
      }
      // Get last day of previous month
      adjustedDay = new Date(adjustedYear, adjustedMonth + 1, 0).getDate();
    }
  }
  
  return new Date(Date.UTC(adjustedYear, adjustedMonth, adjustedDay, adjustedHours, minutes, 0, 0));
}

/**
 * Validate recurring configuration
 * @param {Object} config - Recurring configuration
 * @param {boolean} config.recurring_enabled - Whether recurring is enabled
 * @param {string} config.recurring_pattern - Pattern: 'daily' or 'weekly'
 * @param {string} config.recurring_time - Time in HH:MM format
 * @param {string[]} config.recurring_days - Array of day names for weekly pattern
 * @returns {Object} Validation result { valid: boolean, errors: string[] }
 */
function validateRecurringConfig(config) {
  const errors = [];
  const { recurring_enabled, recurring_pattern, recurring_time, recurring_days } = config;

  // If not enabled, no validation needed
  if (!recurring_enabled) {
    return { valid: true, errors: [] };
  }

  // Validate pattern
  if (!recurring_pattern) {
    errors.push('Recurring pattern is required');
  } else if (!VALID_PATTERNS.includes(recurring_pattern)) {
    errors.push('Recurring pattern must be daily or weekly');
  }

  // Validate time format
  if (!recurring_time) {
    errors.push('Recurring time is required');
  } else if (!isValidTimeFormat(recurring_time)) {
    errors.push('Recurring time must be in HH:MM format');
  }

  // Validate days for weekly pattern
  if (recurring_pattern === 'weekly') {
    if (!recurring_days || !Array.isArray(recurring_days) || recurring_days.length === 0) {
      errors.push('Weekly schedule requires at least one day selected');
    } else {
      const invalidDays = recurring_days.filter(day => !VALID_DAYS.includes(day.toLowerCase()));
      if (invalidDays.length > 0) {
        errors.push(`Invalid days: ${invalidDays.join(', ')}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate time format (HH:MM)
 * @param {string} time - Time string
 * @returns {boolean} True if valid
 */
function isValidTimeFormat(time) {
  if (!time || typeof time !== 'string') return false;
  
  const regex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
  return regex.test(time);
}

/**
 * Parse time string to hours and minutes
 * @param {string} time - Time in HH:MM format
 * @returns {Object} { hours: number, minutes: number }
 */
function parseTime(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return { hours, minutes };
}

/**
 * Calculate next run time for daily pattern
 * Ensures next_run_at is always in the future
 * Uses WIB timezone for calculation
 * @param {string} time - Time in HH:MM format (WIB)
 * @param {Date} fromDate - Starting date (default: now)
 * @returns {Date} Next run date (always in the future)
 */
function calculateNextDailyRun(time, fromDate = new Date()) {
  const { hours, minutes } = parseTime(time);
  
  // Get current time in WIB
  const wibNow = getWIBTime(fromDate);
  const now = fromDate;
  
  // Calculate scheduled time in minutes from midnight (WIB)
  const scheduleMinutes = hours * 60 + minutes;
  const currentMinutes = wibNow.hours * 60 + wibNow.minutes;
  
  // Determine if we should schedule for today or tomorrow (in WIB)
  let targetDay = wibNow.dayOfMonth;
  let targetMonth = wibNow.month;
  let targetYear = wibNow.year;
  
  // If the time has already passed today (or equals current time), schedule for tomorrow
  if (currentMinutes >= scheduleMinutes) {
    // Add one day
    const tempDate = new Date(Date.UTC(targetYear, targetMonth, targetDay + 1));
    targetYear = tempDate.getUTCFullYear();
    targetMonth = tempDate.getUTCMonth();
    targetDay = tempDate.getUTCDate();
  }
  
  // Create the next run date in WIB
  const next = createWIBDate(targetYear, targetMonth, targetDay, hours, minutes);
  
  return next;
}

/**
 * Calculate next run time for weekly pattern
 * Ensures next_run_at is always in the future
 * Uses WIB timezone for calculation
 * @param {string} time - Time in HH:MM format (WIB)
 * @param {string[]} days - Array of day names
 * @param {Date} fromDate - Starting date (default: now)
 * @returns {Date} Next run date (always in the future)
 */
function calculateNextWeeklyRun(time, days, fromDate = new Date()) {
  const { hours, minutes } = parseTime(time);
  
  // Get current time in WIB
  const wibNow = getWIBTime(fromDate);
  const currentDay = wibNow.day; // 0=Sun, 1=Mon, etc.
  
  // Convert day names to day indices and sort
  const dayIndices = days
    .map(day => DAY_INDEX_MAP[day.toLowerCase()])
    .filter(idx => idx !== undefined)
    .sort((a, b) => a - b);
  
  if (dayIndices.length === 0) {
    throw new Error('No valid days provided');
  }
  
  // Calculate scheduled time in minutes from midnight (WIB)
  const scheduleMinutes = hours * 60 + minutes;
  const currentMinutes = wibNow.hours * 60 + wibNow.minutes;
  
  // Check if we can run today (today is scheduled AND time hasn't passed yet)
  const todayScheduled = dayIndices.includes(currentDay);
  if (todayScheduled && currentMinutes < scheduleMinutes) {
    // Schedule for today
    return createWIBDate(wibNow.year, wibNow.month, wibNow.dayOfMonth, hours, minutes);
  }
  
  // Find next scheduled day
  // First, look for days later this week (after today)
  let daysToAdd = null;
  
  for (const dayIdx of dayIndices) {
    if (dayIdx > currentDay) {
      daysToAdd = dayIdx - currentDay;
      break;
    }
  }
  
  // If no day found later this week, wrap to next week
  // Use the first scheduled day of next week
  if (daysToAdd === null) {
    // Days until end of week + days to first scheduled day
    daysToAdd = (7 - currentDay) + dayIndices[0];
  }
  
  // Calculate target date in WIB
  const tempDate = new Date(Date.UTC(wibNow.year, wibNow.month, wibNow.dayOfMonth + daysToAdd));
  const targetYear = tempDate.getUTCFullYear();
  const targetMonth = tempDate.getUTCMonth();
  const targetDay = tempDate.getUTCDate();
  
  const next = createWIBDate(targetYear, targetMonth, targetDay, hours, minutes);
  
  return next;
}

/**
 * Calculate next run time based on pattern
 * Ensures next_run_at is always in the future
 * @param {Object} config - Recurring configuration
 * @param {string} config.recurring_pattern - Pattern: 'daily' or 'weekly'
 * @param {string} config.recurring_time - Time in HH:MM format
 * @param {string[]} config.recurring_days - Array of day names for weekly pattern
 * @param {Date} fromDate - Starting date (default: now)
 * @returns {Date|null} Next run date (always in the future), or null if invalid config
 */
function calculateNextRun(config, fromDate = new Date()) {
  const { recurring_pattern, recurring_time, recurring_days } = config;
  
  // Validate time format
  if (!recurring_time || !isValidTimeFormat(recurring_time)) {
    return null;
  }
  
  if (recurring_pattern === 'daily') {
    return calculateNextDailyRun(recurring_time, fromDate);
  } else if (recurring_pattern === 'weekly') {
    if (!recurring_days || !Array.isArray(recurring_days) || recurring_days.length === 0) {
      return null;
    }
    return calculateNextWeeklyRun(recurring_time, recurring_days, fromDate);
  }
  
  return null;
}

/**
 * Format next run date to ISO string
 * @param {Date} date - Date to format
 * @returns {string} ISO string
 */
function formatNextRunAt(date) {
  return date.toISOString();
}

/**
 * Replace placeholders in title with actual date/time values
 * Supports: {date}, {time}, {day}, {month}, {year}, {datetime}, {iso}, {DD}, {MM}, {YYYY}, {HH}, {mm}
 * @param {string} titleTemplate - Title with placeholders
 * @param {Date} scheduledDate - Scheduled date
 * @returns {string} Title with replaced placeholders
 */
function replaceTitlePlaceholders(titleTemplate, scheduledDate = new Date()) {
  if (!titleTemplate || typeof titleTemplate !== 'string') {
    return titleTemplate || '';
  }
  
  const date = new Date(scheduledDate);
  
  // Pad number with leading zero
  const pad = (num) => num.toString().padStart(2, '0');
  
  const day = pad(date.getDate());
  const month = pad(date.getMonth() + 1);
  const year = date.getFullYear().toString();
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  
  // Build replacements map with DD/MM/YYYY and HH:mm formats as per requirements
  const replacements = {
    '{date}': day + '/' + month + '/' + year,
    '{time}': hours + ':' + minutes,
    '{day}': date.toLocaleDateString('id-ID', { weekday: 'long' }),
    '{month}': date.toLocaleDateString('id-ID', { month: 'long' }),
    '{year}': year,
    '{datetime}': day + '/' + month + '/' + year + ' ' + hours + ':' + minutes,
    '{iso}': date.toISOString().split('T')[0],
    '{DD}': day,
    '{MM}': month,
    '{YYYY}': year,
    '{HH}': hours,
    '{mm}': minutes
  };
  
  let result = titleTemplate;
  
  // Use simple string replacement (more reliable than regex for this use case)
  for (const [placeholder, value] of Object.entries(replacements)) {
    // Replace all occurrences using split and join
    result = result.split(placeholder).join(value);
  }
  
  return result;
}

/**
 * Check if a schedule was missed (next_run_at is in the past)
 * @param {string} nextRunAt - ISO timestamp of next scheduled run
 * @param {Date} now - Current time (default: now)
 * @returns {boolean} True if schedule was missed
 */
function isScheduleMissed(nextRunAt, now = new Date()) {
  if (!nextRunAt) return false;
  
  const scheduledTime = new Date(nextRunAt);
  return scheduledTime.getTime() < now.getTime();
}

module.exports = {
  validateRecurringConfig,
  isValidTimeFormat,
  parseTime,
  calculateNextDailyRun,
  calculateNextWeeklyRun,
  calculateNextRun,
  formatNextRunAt,
  replaceTitlePlaceholders,
  isScheduleMissed,
  getWIBTime,
  createWIBDate,
  VALID_PATTERNS,
  VALID_DAYS,
  DAY_INDEX_MAP
};
