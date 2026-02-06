/**
 * Username Validator Utility
 * 
 * Provides validation functions to prevent SQL injection and XSS attacks
 * through malicious usernames.
 */

// Valid username pattern - only letters, numbers, and underscores
const VALID_USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;

// Minimum and maximum username length
const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 20;

// Blacklisted patterns - SQL injection and XSS attack patterns
const BLACKLISTED_PATTERNS = [
  /['"]/,                           // Single or double quotes
  /[<>]/,                           // HTML tags
  /[;]/,                            // SQL statement separator
  /--/,                             // SQL comment
  /\/\*/,                           // SQL block comment start
  /\*\//,                           // SQL block comment end
  /\bor\b/i,                        // SQL OR keyword
  /\band\b/i,                       // SQL AND keyword
  /\bunion\b/i,                     // SQL UNION keyword
  /\bselect\b/i,                    // SQL SELECT keyword
  /\binsert\b/i,                    // SQL INSERT keyword
  /\bupdate\b/i,                    // SQL UPDATE keyword
  /\bdelete\b/i,                    // SQL DELETE keyword
  /\bdrop\b/i,                      // SQL DROP keyword
  /\bexec\b/i,                      // SQL EXEC keyword
  /\bscript\b/i,                    // XSS script tag
  /\balert\b/i,                     // XSS alert
  /\bonerror\b/i,                   // XSS event handler
  /\bonload\b/i,                    // XSS event handler
  /javascript:/i,                   // JavaScript protocol
  /data:/i,                         // Data protocol
  /vbscript:/i,                     // VBScript protocol
  /=\s*['"]?\s*or/i,                // Common SQL injection pattern '=' or
  /1\s*=\s*1/,                      // SQL injection 1=1
  /0\s*=\s*0/,                      // SQL injection 0=0
];

/**
 * Validate username format and check for malicious patterns
 * @param {string} username - Username to validate
 * @returns {Object} - { isValid: boolean, error: string|null }
 */
function validateUsername(username) {
  // Check if username is provided
  if (!username || typeof username !== 'string') {
    return { isValid: false, error: 'Username is required' };
  }

  // Trim whitespace
  const trimmedUsername = username.trim();

  // Check length
  if (trimmedUsername.length < MIN_USERNAME_LENGTH) {
    return { isValid: false, error: `Username must be at least ${MIN_USERNAME_LENGTH} characters` };
  }

  if (trimmedUsername.length > MAX_USERNAME_LENGTH) {
    return { isValid: false, error: `Username must be no more than ${MAX_USERNAME_LENGTH} characters` };
  }

  // Check valid pattern (only letters, numbers, underscores)
  if (!VALID_USERNAME_REGEX.test(trimmedUsername)) {
    return { isValid: false, error: 'Username can only contain letters, numbers, and underscores' };
  }

  // Check against blacklisted patterns
  for (const pattern of BLACKLISTED_PATTERNS) {
    if (pattern.test(trimmedUsername)) {
      return { isValid: false, error: 'Username contains invalid characters or patterns' };
    }
  }

  return { isValid: true, error: null };
}

/**
 * Check if username is potentially malicious (for cleanup scripts)
 * @param {string} username - Username to check
 * @returns {Object} - { isMalicious: boolean, reason: string|null }
 */
function isMaliciousUsername(username) {
  if (!username || typeof username !== 'string') {
    return { isMalicious: true, reason: 'Empty or invalid username' };
  }

  // Check valid pattern first
  if (!VALID_USERNAME_REGEX.test(username)) {
    return { isMalicious: true, reason: 'Contains invalid characters (only letters, numbers, underscores allowed)' };
  }

  // Check against blacklisted patterns
  for (const pattern of BLACKLISTED_PATTERNS) {
    if (pattern.test(username)) {
      return { isMalicious: true, reason: `Matches blacklisted pattern: ${pattern}` };
    }
  }

  return { isMalicious: false, reason: null };
}

/**
 * Sanitize username by removing invalid characters
 * Note: This should only be used for display purposes, not for storage
 * @param {string} username - Username to sanitize
 * @returns {string} - Sanitized username
 */
function sanitizeUsername(username) {
  if (!username || typeof username !== 'string') {
    return '';
  }
  
  // Remove all characters except letters, numbers, and underscores
  return username.replace(/[^a-zA-Z0-9_]/g, '');
}

module.exports = {
  validateUsername,
  isMaliciousUsername,
  sanitizeUsername,
  VALID_USERNAME_REGEX,
  MIN_USERNAME_LENGTH,
  MAX_USERNAME_LENGTH,
  BLACKLISTED_PATTERNS
};
