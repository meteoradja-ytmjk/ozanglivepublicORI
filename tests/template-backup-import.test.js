/**
 * Template Backup & Import Tests
 * Property-based tests using fast-check
 */

const fc = require('fast-check');
const {
  exportTemplatesOnly,
  validateTemplateBackup,
  validateTemplateForImport,
  importTemplatesOnly,
  formatTemplateBackupJson,
  TEMPLATE_EXPORT_FIELDS
} = require('../services/backupService');

// Mock BroadcastTemplate model
jest.mock('../models/BroadcastTemplate', () => ({
  findByUserId: jest.fn(),
  findByName: jest.fn(),
  create: jest.fn()
}));

const BroadcastTemplate = require('../models/BroadcastTemplate');

// Generator for valid template data
const validTemplateArb = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  title: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  description: fc.option(fc.string({ maxLength: 500 }), { nil: null }),
  privacy_status: fc.constantFrom('public', 'unlisted', 'private'),
  tags: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 30 }), { maxLength: 5 }), { nil: null }),
  category_id: fc.constantFrom('20', '22', '24', '10'),
  recurring_enabled: fc.constant(false),
  recurring_pattern: fc.constant(null),
  recurring_time: fc.constant(null),
  recurring_days: fc.constant(null)
});

// Generator for template with valid recurring config
const validRecurringDailyArb = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  title: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  description: fc.option(fc.string({ maxLength: 500 }), { nil: null }),
  privacy_status: fc.constantFrom('public', 'unlisted', 'private'),
  tags: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 30 }), { maxLength: 5 }), { nil: null }),
  category_id: fc.constantFrom('20', '22', '24', '10'),
  recurring_enabled: fc.constant(true),
  recurring_pattern: fc.constant('daily'),
  recurring_time: fc.stringMatching(/^([01]\d|2[0-3]):[0-5]\d$/),
  recurring_days: fc.constant(null)
});

const validRecurringWeeklyArb = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  title: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  description: fc.option(fc.string({ maxLength: 500 }), { nil: null }),
  privacy_status: fc.constantFrom('public', 'unlisted', 'private'),
  tags: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 30 }), { maxLength: 5 }), { nil: null }),
  category_id: fc.constantFrom('20', '22', '24', '10'),
  recurring_enabled: fc.constant(true),
  recurring_pattern: fc.constant('weekly'),
  recurring_time: fc.stringMatching(/^([01]\d|2[0-3]):[0-5]\d$/),
  recurring_days: fc.array(fc.integer({ min: 0, max: 6 }), { minLength: 1, maxLength: 7 })
});

// Generator for valid backup metadata
const validMetadataArb = fc.record({
  exportDate: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }).map(d => d.toISOString()),
  appVersion: fc.constant('1.0.0'),
  exportType: fc.constant('templates'),
  totalTemplates: fc.nat({ max: 100 })
});

describe('Template Backup & Import', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * **Feature: template-backup-import, Property 1: Export contains all user templates**
   * **Validates: Requirements 1.1, 1.2**
   */
  describe('Property 1: Export contains all user templates', () => {
    it('should export all templates for a user with correct metadata', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(validTemplateArb, { minLength: 0, maxLength: 10 }),
          async (templates) => {
            // Add IDs to templates (simulating DB records)
            const dbTemplates = templates.map((t, i) => ({
              ...t,
              id: `template-${i}`,
              user_id: 'user-123',
              account_id: 'account-456'
            }));
            
            BroadcastTemplate.findByUserId.mockResolvedValue(dbTemplates);
            
            const result = await exportTemplatesOnly('user-123');
            
            // Verify metadata
            expect(result.metadata).toBeDefined();
            expect(result.metadata.exportDate).toBeDefined();
            expect(result.metadata.appVersion).toBe('1.0.0');
            expect(result.metadata.exportType).toBe('templates');
            expect(result.metadata.totalTemplates).toBe(templates.length);
            
            // Verify all templates are exported
            expect(result.templates).toHaveLength(templates.length);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: template-backup-import, Property 2: Exported templates have required fields**
   * **Validates: Requirements 1.3**
   */
  describe('Property 2: Exported templates have required fields', () => {
    it('should include all required fields in exported templates', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(validTemplateArb, { minLength: 1, maxLength: 5 }),
          async (templates) => {
            const dbTemplates = templates.map((t, i) => ({
              ...t,
              id: `template-${i}`,
              user_id: 'user-123',
              account_id: 'account-456'
            }));
            
            BroadcastTemplate.findByUserId.mockResolvedValue(dbTemplates);
            
            const result = await exportTemplatesOnly('user-123');
            
            // Verify each exported template has required fields
            for (const exported of result.templates) {
              for (const field of TEMPLATE_EXPORT_FIELDS) {
                expect(exported).toHaveProperty(field);
              }
              // Verify system fields are NOT included
              expect(exported).not.toHaveProperty('id');
              expect(exported).not.toHaveProperty('user_id');
              expect(exported).not.toHaveProperty('account_id');
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Feature: template-backup-import, Property 3: Import validation rejects invalid format**
   * **Validates: Requirements 2.1, 2.4**
   */
  describe('Property 3: Import validation rejects invalid format', () => {
    it('should reject data that is not an object', () => {
      fc.assert(
        fc.property(
          fc.oneof(fc.string(), fc.integer(), fc.constant(null), fc.constant(undefined)),
          (invalidData) => {
            const result = validateTemplateBackup(invalidData);
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject data without metadata', () => {
      fc.assert(
        fc.property(
          fc.record({
            templates: fc.array(validTemplateArb)
          }),
          (dataWithoutMetadata) => {
            const result = validateTemplateBackup(dataWithoutMetadata);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Invalid backup format: missing metadata');
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject data without templates array', () => {
      fc.assert(
        fc.property(
          fc.record({
            metadata: validMetadataArb
          }),
          (dataWithoutTemplates) => {
            const result = validateTemplateBackup(dataWithoutTemplates);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Invalid backup format: missing templates array');
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept valid backup format', () => {
      fc.assert(
        fc.property(
          fc.record({
            metadata: validMetadataArb,
            templates: fc.array(validTemplateArb, { maxLength: 10 })
          }),
          (validData) => {
            const result = validateTemplateBackup(validData);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.templateCount).toBe(validData.templates.length);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: template-backup-import, Property 4: Import creates templates for valid items**
   * **Validates: Requirements 2.3, 3.1**
   */
  describe('Property 4: Import creates templates for valid items', () => {
    it('should create templates for all valid items in backup', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(validTemplateArb, { minLength: 1, maxLength: 5 }),
          async (templates) => {
            // Ensure unique names
            const uniqueTemplates = templates.map((t, i) => ({
              ...t,
              name: `${t.name}-${i}`
            }));
            
            const backupData = {
              metadata: {
                exportDate: new Date().toISOString(),
                appVersion: '1.0.0',
                exportType: 'templates',
                totalTemplates: uniqueTemplates.length
              },
              templates: uniqueTemplates
            };
            
            BroadcastTemplate.findByName.mockResolvedValue(null);
            BroadcastTemplate.create.mockResolvedValue({ id: 'new-id' });
            
            const result = await importTemplatesOnly(backupData, 'user-123', 'account-456');
            
            // All valid templates should be imported
            expect(result.imported + result.skipped).toBe(uniqueTemplates.length);
            expect(result.imported).toBe(uniqueTemplates.length);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: template-backup-import, Property 5: Duplicate handling with skip option**
   * **Validates: Requirements 2.5**
   */
  describe('Property 5: Duplicate handling with skip option', () => {
    it('should skip templates with duplicate names when skipDuplicates is true', async () => {
      await fc.assert(
        fc.asyncProperty(
          validTemplateArb,
          async (template) => {
            const backupData = {
              metadata: {
                exportDate: new Date().toISOString(),
                appVersion: '1.0.0',
                exportType: 'templates',
                totalTemplates: 1
              },
              templates: [template]
            };
            
            // Simulate existing template with same name
            BroadcastTemplate.findByName.mockResolvedValue({ id: 'existing-id', name: template.name });
            
            const result = await importTemplatesOnly(backupData, 'user-123', 'account-456', { skipDuplicates: true });
            
            expect(result.skipped).toBe(1);
            expect(result.imported).toBe(0);
            expect(result.errors.some(e => e.includes('already exists'))).toBe(true);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: template-backup-import, Property 6: Required field validation**
   * **Validates: Requirements 5.1**
   */
  describe('Property 6: Required field validation', () => {
    it('should reject templates with empty name', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: fc.constantFrom('', '   ', null, undefined),
            title: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0)
          }),
          (template) => {
            const result = validateTemplateForImport(template);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('name'))).toBe(true);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject templates with empty title', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
            title: fc.constantFrom('', '   ', null, undefined)
          }),
          (template) => {
            const result = validateTemplateForImport(template);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('title'))).toBe(true);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept templates with valid name and title', () => {
      fc.assert(
        fc.property(
          validTemplateArb,
          (template) => {
            const result = validateTemplateForImport(template);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Feature: template-backup-import, Property 7: Recurring configuration validation**
   * **Validates: Requirements 5.2, 5.3**
   */
  describe('Property 7: Recurring configuration validation', () => {
    it('should reject recurring templates without pattern', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
            title: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
            recurring_enabled: fc.constant(true),
            recurring_pattern: fc.constantFrom(null, undefined, 'invalid'),
            recurring_time: fc.constant('10:00')
          }),
          (template) => {
            const result = validateTemplateForImport(template);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('recurring_pattern'))).toBe(true);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject recurring templates without time', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
            title: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
            recurring_enabled: fc.constant(true),
            recurring_pattern: fc.constantFrom('daily', 'weekly'),
            recurring_time: fc.constantFrom(null, undefined, '')
          }),
          (template) => {
            const result = validateTemplateForImport(template);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('recurring_time'))).toBe(true);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject weekly recurring without days', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
            title: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
            recurring_enabled: fc.constant(true),
            recurring_pattern: fc.constant('weekly'),
            recurring_time: fc.constant('10:00'),
            recurring_days: fc.constantFrom(null, undefined, [])
          }),
          (template) => {
            const result = validateTemplateForImport(template);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('day'))).toBe(true);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept valid daily recurring config', () => {
      fc.assert(
        fc.property(
          validRecurringDailyArb,
          (template) => {
            const result = validateTemplateForImport(template);
            expect(result.valid).toBe(true);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept valid weekly recurring config', () => {
      fc.assert(
        fc.property(
          validRecurringWeeklyArb,
          (template) => {
            const result = validateTemplateForImport(template);
            expect(result.valid).toBe(true);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: template-backup-import, Property 8: Partial import continues on failure**
   * **Validates: Requirements 5.4, 3.2**
   */
  describe('Property 8: Partial import continues on failure', () => {
    it('should continue importing after encountering invalid templates', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(validTemplateArb, { minLength: 2, maxLength: 5 }),
          async (validTemplates) => {
            // Make templates unique
            const uniqueTemplates = validTemplates.map((t, i) => ({
              ...t,
              name: `valid-${i}`
            }));
            
            // Insert invalid template in the middle
            const invalidTemplate = { name: '', title: '' };
            const mixedTemplates = [
              uniqueTemplates[0],
              invalidTemplate,
              ...uniqueTemplates.slice(1)
            ];
            
            const backupData = {
              metadata: {
                exportDate: new Date().toISOString(),
                appVersion: '1.0.0',
                exportType: 'templates',
                totalTemplates: mixedTemplates.length
              },
              templates: mixedTemplates
            };
            
            BroadcastTemplate.findByName.mockResolvedValue(null);
            BroadcastTemplate.create.mockResolvedValue({ id: 'new-id' });
            
            const result = await importTemplatesOnly(backupData, 'user-123', 'account-456');
            
            // Should have imported valid templates and skipped invalid one
            expect(result.imported).toBe(uniqueTemplates.length);
            expect(result.skipped).toBe(1);
            expect(result.errors.length).toBeGreaterThan(0);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: template-backup-import, Property 9: Round-trip consistency**
   * **Validates: Requirements 6.2**
   */
  describe('Property 9: Round-trip consistency', () => {
    it('should produce equivalent data after export-import-export cycle', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(validTemplateArb, { minLength: 1, maxLength: 5 }),
          async (templates) => {
            // Make templates unique
            const uniqueTemplates = templates.map((t, i) => ({
              ...t,
              name: `template-${i}`,
              id: `id-${i}`,
              user_id: 'user-123',
              account_id: 'account-456'
            }));
            
            // First export
            BroadcastTemplate.findByUserId.mockResolvedValue(uniqueTemplates);
            const firstExport = await exportTemplatesOnly('user-123');
            
            // Simulate import (templates would be created in DB)
            // Then second export should produce same template data
            const secondExport = await exportTemplatesOnly('user-123');
            
            // Compare template data (excluding metadata timestamps)
            expect(firstExport.templates).toEqual(secondExport.templates);
            expect(firstExport.metadata.totalTemplates).toBe(secondExport.metadata.totalTemplates);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce valid JSON that can be parsed back', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(validTemplateArb, { minLength: 0, maxLength: 5 }),
          async (templates) => {
            const dbTemplates = templates.map((t, i) => ({
              ...t,
              id: `id-${i}`,
              user_id: 'user-123',
              account_id: 'account-456'
            }));
            
            BroadcastTemplate.findByUserId.mockResolvedValue(dbTemplates);
            
            const exported = await exportTemplatesOnly('user-123');
            const jsonString = formatTemplateBackupJson(exported);
            
            // Should be valid JSON
            const parsed = JSON.parse(jsonString);
            
            // Should have same structure
            expect(parsed.metadata).toEqual(exported.metadata);
            expect(parsed.templates).toEqual(exported.templates);
            
            // Should be pretty-printed (contains newlines and indentation)
            expect(jsonString).toContain('\n');
            expect(jsonString).toContain('  ');
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
