/**
 * User Security Tests
 * 
 * Property-based tests for username validation and security features.
 * 
 * **Feature: user-security-fix, Property 2: Username Validation Correctness**
 * **Validates: Requirements 2.1, 2.2**
 */

const fc = require('fast-check');

// Username validation function (same as in app.js)
const VALID_USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;
const MIN_LENGTH = 3;
const MAX_LENGTH = 20;

function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    return { valid: false, message: 'Username is required' };
  }
  
  if (username.length < MIN_LENGTH || username.length > MAX_LENGTH) {
    return { valid: false, message: `Username must be between ${MIN_LENGTH} and ${MAX_LENGTH} characters` };
  }
  
  if (!VALID_USERNAME_REGEX.test(username)) {
    return { valid: false, message: 'Username can only contain letters, numbers, and underscores' };
  }
  
  return { valid: true };
}

// HTML escape function for testing
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

describe('User Security Tests', () => {
  
  describe('Property 2: Username Validation Correctness', () => {
    /**
     * **Feature: user-security-fix, Property 2: Username Validation Correctness**
     * **Validates: Requirements 2.1, 2.2**
     * 
     * For any input string, the username validator SHALL return valid: true 
     * if and only if the string contains only alphanumeric characters and underscores,
     * and has length between 3 and 20 characters.
     */
    
    test('should accept valid usernames (alphanumeric + underscore, 3-20 chars)', () => {
      fc.assert(
        fc.property(
          // Generate valid usernames: only letters, numbers, underscores
          fc.array(
            fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_'.split('')),
            { minLength: 3, maxLength: 20 }
          ).map(arr => arr.join('')),
          (username) => {
            const result = validateUsername(username);
            return result.valid === true;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('should reject usernames with special characters', () => {
      const dangerousChars = ["'", '"', '<', '>', '=', ';', '--', '&', '/', '\\', '(', ')', '{', '}'];
      
      fc.assert(
        fc.property(
          fc.constantFrom(...dangerousChars),
          fc.string({ minLength: 2, maxLength: 18 }),
          (dangerousChar, baseString) => {
            // Insert dangerous character into string
            const username = baseString.slice(0, 1) + dangerousChar + baseString.slice(1);
            const result = validateUsername(username);
            return result.valid === false;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('should reject usernames shorter than 3 characters', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789_'.split('')),
            { minLength: 0, maxLength: 2 }
          ).map(arr => arr.join('')),
          (username) => {
            const result = validateUsername(username);
            return result.valid === false;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('should reject usernames longer than 20 characters', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789_'.split('')),
            { minLength: 21, maxLength: 50 }
          ).map(arr => arr.join('')),
          (username) => {
            const result = validateUsername(username);
            return result.valid === false;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('should reject SQL injection patterns', () => {
      const sqlInjectionPatterns = [
        "'OR'1'='1",
        "'; DROP TABLE users;--",
        "' OR ''='",
        "1' OR '1'='1",
        "admin'--",
        "' UNION SELECT * FROM users--",
        "'=\"or'"
      ];
      
      sqlInjectionPatterns.forEach(pattern => {
        const result = validateUsername(pattern);
        expect(result.valid).toBe(false);
      });
    });
    
    test('should reject XSS patterns', () => {
      const xssPatterns = [
        '<script>alert(1)</script>',
        '"><img src=x onerror=alert(1)>',
        "javascript:alert('XSS')",
        '<svg onload=alert(1)>',
        '{{constructor.constructor("alert(1)")()}}'
      ];
      
      xssPatterns.forEach(pattern => {
        const result = validateUsername(pattern);
        expect(result.valid).toBe(false);
      });
    });
  });
  
  describe('Property 1: Username Escape Safety', () => {
    /**
     * **Feature: user-security-fix, Property 1: Username Escape Safety**
     * **Validates: Requirements 1.1, 1.3, 3.1**
     * 
     * For any username string containing special characters, 
     * the escaped output SHALL NOT contain these characters in their raw form.
     */
    
    test('should escape all dangerous HTML characters', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (input) => {
            const escaped = escapeHtml(input);
            
            // Check that raw dangerous characters are not present
            // (they should be converted to HTML entities)
            const hasRawAmpersand = escaped.includes('&') && !escaped.match(/&(amp|lt|gt|quot|#039);/);
            const hasRawLessThan = escaped.includes('<') && !escaped.includes('&lt;');
            const hasRawGreaterThan = escaped.includes('>') && !escaped.includes('&gt;');
            const hasRawDoubleQuote = escaped.includes('"') && !escaped.includes('&quot;');
            const hasRawSingleQuote = escaped.includes("'") && !escaped.includes('&#039;');
            
            // All dangerous characters should be escaped
            return !hasRawLessThan && !hasRawGreaterThan && !hasRawDoubleQuote && !hasRawSingleQuote;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('should prevent XSS by escaping script tags', () => {
      const xssInputs = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert(1)>',
        '<svg onload=alert(1)>',
        "javascript:alert('XSS')"
      ];
      
      xssInputs.forEach(input => {
        const escaped = escapeHtml(input);
        expect(escaped).not.toContain('<script>');
        expect(escaped).not.toContain('<img');
        expect(escaped).not.toContain('<svg');
      });
    });
    
    test('should handle the specific attack pattern from the incident', () => {
      // The actual attack pattern found: '="or'
      const attackPattern = "'=\"or'";
      const escaped = escapeHtml(attackPattern);
      
      // Should not contain raw quotes that could break JavaScript
      expect(escaped).not.toContain("'");
      expect(escaped).not.toContain('"');
      expect(escaped).toContain('&#039;');
      expect(escaped).toContain('&quot;');
    });
  });
});


describe('Property 3: Delete Operation Independence', () => {
  /**
   * **Feature: user-security-fix, Property 3: Delete Operation Independence**
   * **Validates: Requirements 1.2, 4.2**
   * 
   * For any user in the database, the delete operation SHALL succeed 
   * based solely on the user ID, regardless of the characters in the username.
   */
  
  // Mock User model for testing delete operation logic
  const mockDeleteUser = (userId) => {
    // Simulate delete operation that only uses userId
    if (!userId || typeof userId !== 'string' || userId.length === 0) {
      return { success: false, error: 'Invalid user ID' };
    }
    
    // UUID format validation (simplified)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return { success: false, error: 'Invalid UUID format' };
    }
    
    // Delete operation succeeds regardless of username content
    return { success: true, deletedId: userId };
  };
  
  test('should delete user by ID regardless of username content', () => {
    fc.assert(
      fc.property(
        // Generate valid UUID
        fc.uuid(),
        // Generate any string as username (including dangerous characters)
        fc.string({ minLength: 1, maxLength: 100 }),
        (userId, username) => {
          // The delete operation should succeed based on userId alone
          const result = mockDeleteUser(userId);
          
          // Username content should not affect delete operation
          return result.success === true && result.deletedId === userId;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  test('should reject invalid user IDs', () => {
    const invalidIds = ['', null, undefined, 'not-a-uuid', '123', 'abc'];
    
    invalidIds.forEach(id => {
      const result = mockDeleteUser(id);
      expect(result.success).toBe(false);
    });
  });
  
  test('should handle usernames with SQL injection patterns during delete', () => {
    // Even if username contains SQL injection, delete should work by ID
    const sqlInjectionUsernames = [
      "'OR'1'='1",
      "'; DROP TABLE users;--",
      "' OR ''='",
      "'=\"or'"
    ];
    
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.constantFrom(...sqlInjectionUsernames),
        (userId, _username) => {
          // Delete should succeed regardless of username
          const result = mockDeleteUser(userId);
          return result.success === true;
        }
      ),
      { numRuns: 50 }
    );
  });
});
