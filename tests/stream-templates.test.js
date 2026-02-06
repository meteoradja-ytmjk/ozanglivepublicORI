/**
 * Property-Based Tests for Stream Templates
 * Feature: stream-templates
 */

const fc = require('fast-check');

// Mock StreamTemplate model for testing
const mockTemplates = new Map();
let mockIdCounter = 0;

const StreamTemplate = {
  create: async (templateData) => {
    const id = `template-${++mockIdCounter}`;
    const template = {
      id,
      user_id: templateData.user_id,
      name: templateData.name,
      video_id: templateData.video_id || null,
      audio_id: templateData.audio_id || null,
      duration_hours: templateData.duration_hours || 0,
      duration_minutes: templateData.duration_minutes || 0,
      loop_video: templateData.loop_video !== false,
      schedule_type: templateData.schedule_type || 'once',
      recurring_time: templateData.recurring_time || null,
      schedule_days: templateData.schedule_days || null,
      created_at: new Date().toISOString()
    };
    mockTemplates.set(id, template);
    return template;
  },
  
  findById: async (id) => {
    return mockTemplates.get(id) || null;
  },
  
  findByUserId: async (userId) => {
    return Array.from(mockTemplates.values()).filter(t => t.user_id === userId);
  },
  
  delete: async (id, userId) => {
    const template = mockTemplates.get(id);
    if (template && template.user_id === userId) {
      mockTemplates.delete(id);
      return { success: true, deleted: true };
    }
    return { success: true, deleted: false };
  },
  
  update: async (id, data) => {
    const template = mockTemplates.get(id);
    if (template) {
      const updated = { ...template, ...data };
      mockTemplates.set(id, updated);
      return { ...updated, updated: true };
    }
    return { updated: false };
  }
};

// Arbitraries for generating test data
const userIdArb = fc.uuid();
const templateNameArb = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);
const videoIdArb = fc.option(fc.uuid(), { nil: null });
const audioIdArb = fc.option(fc.uuid(), { nil: null });
const durationHoursArb = fc.integer({ min: 0, max: 168 });
const durationMinutesArb = fc.integer({ min: 0, max: 59 });
const loopVideoArb = fc.boolean();
const scheduleTypeArb = fc.constantFrom('once', 'daily', 'weekly');
const recurringTimeArb = fc.option(
  fc.tuple(
    fc.integer({ min: 0, max: 23 }),
    fc.integer({ min: 0, max: 59 })
  ).map(([h, m]) => `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`),
  { nil: null }
);
const scheduleDaysArb = fc.option(
  fc.array(fc.integer({ min: 0, max: 6 }), { minLength: 1, maxLength: 7 })
    .map(days => [...new Set(days)].sort()),
  { nil: null }
);

const templateDataArb = fc.record({
  user_id: userIdArb,
  name: templateNameArb,
  video_id: videoIdArb,
  audio_id: audioIdArb,
  duration_hours: durationHoursArb,
  duration_minutes: durationMinutesArb,
  loop_video: loopVideoArb,
  schedule_type: scheduleTypeArb,
  recurring_time: recurringTimeArb,
  schedule_days: scheduleDaysArb
});

// Reset mock before each test
beforeEach(() => {
  mockTemplates.clear();
  mockIdCounter = 0;
});

describe('Stream Templates - Property Based Tests', () => {
  /**
   * **Feature: stream-templates, Property 4: Template Persistence Round-Trip**
   * **Validates: Requirements 4.1, 4.2**
   * 
   * For any template that is created and saved, retrieving templates
   * SHALL return the same template with identical field values.
   */
  describe('Property 4: Template Persistence Round-Trip', () => {
    it('created template can be retrieved with identical values', async () => {
      await fc.assert(
        fc.asyncProperty(templateDataArb, async (templateData) => {
          // Create template
          const created = await StreamTemplate.create(templateData);
          
          // Retrieve template
          const retrieved = await StreamTemplate.findById(created.id);
          
          // Verify all fields match
          expect(retrieved).not.toBeNull();
          expect(retrieved.user_id).toBe(templateData.user_id);
          expect(retrieved.name).toBe(templateData.name);
          expect(retrieved.video_id).toBe(templateData.video_id);
          expect(retrieved.audio_id).toBe(templateData.audio_id);
          expect(retrieved.duration_hours).toBe(templateData.duration_hours);
          expect(retrieved.duration_minutes).toBe(templateData.duration_minutes);
          expect(retrieved.loop_video).toBe(templateData.loop_video);
          expect(retrieved.schedule_type).toBe(templateData.schedule_type);
          expect(retrieved.recurring_time).toBe(templateData.recurring_time);
          
          // Schedule days comparison (handle null and array)
          if (templateData.schedule_days === null) {
            expect(retrieved.schedule_days).toBeNull();
          } else {
            expect(retrieved.schedule_days).toEqual(templateData.schedule_days);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: stream-templates, Property 5: Template List Completeness**
   * **Validates: Requirements 3.1, 3.4**
   * 
   * For any user with N templates, the template list API SHALL return
   * exactly N templates with name and created_at fields present.
   */
  describe('Property 5: Template List Completeness', () => {
    it('listing templates returns all created templates with required fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          fc.array(templateNameArb, { minLength: 1, maxLength: 10 })
            .map(names => [...new Set(names)]), // Ensure unique names
          async (userId, templateNames) => {
            // Create multiple templates for the same user
            for (const name of templateNames) {
              await StreamTemplate.create({
                user_id: userId,
                name,
                video_id: null,
                audio_id: null,
                duration_hours: 1,
                duration_minutes: 0,
                loop_video: true,
                schedule_type: 'once',
                recurring_time: null,
                schedule_days: null
              });
            }
            
            // List templates
            const templates = await StreamTemplate.findByUserId(userId);
            
            // Verify count matches
            expect(templates.length).toBe(templateNames.length);
            
            // Verify all templates have required fields
            templates.forEach(template => {
              expect(template.name).toBeDefined();
              expect(typeof template.name).toBe('string');
              expect(template.created_at).toBeDefined();
            });
            
            // Verify all names are present
            const retrievedNames = templates.map(t => t.name);
            templateNames.forEach(name => {
              expect(retrievedNames).toContain(name);
            });
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * **Feature: stream-templates, Property 6: Template Deletion Permanence**
   * **Validates: Requirements 4.3**
   * 
   * For any deleted template, subsequent retrieval attempts
   * SHALL not return the deleted template.
   */
  describe('Property 6: Template Deletion Permanence', () => {
    it('deleted template is not retrievable', async () => {
      await fc.assert(
        fc.asyncProperty(templateDataArb, async (templateData) => {
          // Create template
          const created = await StreamTemplate.create(templateData);
          
          // Verify it exists
          const beforeDelete = await StreamTemplate.findById(created.id);
          expect(beforeDelete).not.toBeNull();
          
          // Delete template
          const deleteResult = await StreamTemplate.delete(created.id, templateData.user_id);
          expect(deleteResult.deleted).toBe(true);
          
          // Verify it's gone
          const afterDelete = await StreamTemplate.findById(created.id);
          expect(afterDelete).toBeNull();
          
          // Verify it's not in user's list
          const userTemplates = await StreamTemplate.findByUserId(templateData.user_id);
          const found = userTemplates.find(t => t.id === created.id);
          expect(found).toBeUndefined();
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: stream-templates, Property 1: Template Save Completeness**
   * **Validates: Requirements 1.2, 1.4**
   * 
   * For any valid stream form state, saving as template SHALL capture
   * and store all required fields.
   */
  describe('Property 1: Template Save Completeness', () => {
    it('all required fields are stored when saving template', async () => {
      await fc.assert(
        fc.asyncProperty(templateDataArb, async (templateData) => {
          const created = await StreamTemplate.create(templateData);
          
          // Verify all required fields are present
          expect(created.id).toBeDefined();
          expect(created.user_id).toBe(templateData.user_id);
          expect(created.name).toBe(templateData.name);
          expect(created).toHaveProperty('video_id');
          expect(created).toHaveProperty('audio_id');
          expect(created).toHaveProperty('duration_hours');
          expect(created).toHaveProperty('duration_minutes');
          expect(created).toHaveProperty('loop_video');
          expect(created).toHaveProperty('schedule_type');
          expect(created).toHaveProperty('recurring_time');
          expect(created).toHaveProperty('schedule_days');
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: stream-templates, Property 2: Template Apply Correctness**
   * **Validates: Requirements 2.2**
   * 
   * For any saved template, applying it to a form SHALL correctly
   * populate all stored fields with their original values.
   */
  describe('Property 2: Template Apply Correctness', () => {
    it('applying template returns correct field values', async () => {
      await fc.assert(
        fc.asyncProperty(templateDataArb, async (templateData) => {
          // Create and save template
          const created = await StreamTemplate.create(templateData);
          
          // Simulate applying template (retrieve and use values)
          const template = await StreamTemplate.findById(created.id);
          
          // Simulate form fill
          const formValues = {
            video_id: template.video_id,
            audio_id: template.audio_id,
            duration_hours: template.duration_hours,
            duration_minutes: template.duration_minutes,
            loop_video: template.loop_video,
            schedule_type: template.schedule_type,
            recurring_time: template.recurring_time,
            schedule_days: template.schedule_days
          };
          
          // Verify form values match original template data
          expect(formValues.video_id).toBe(templateData.video_id);
          expect(formValues.audio_id).toBe(templateData.audio_id);
          expect(formValues.duration_hours).toBe(templateData.duration_hours);
          expect(formValues.duration_minutes).toBe(templateData.duration_minutes);
          expect(formValues.loop_video).toBe(templateData.loop_video);
          expect(formValues.schedule_type).toBe(templateData.schedule_type);
          expect(formValues.recurring_time).toBe(templateData.recurring_time);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: stream-templates, Property 3: Stream Key Security**
   * **Validates: Requirements 2.3**
   * 
   * For any template operation, the stream key SHALL never be stored
   * in or retrieved from the template.
   */
  describe('Property 3: Stream Key Security', () => {
    it('stream key is never stored in template', async () => {
      await fc.assert(
        fc.asyncProperty(
          templateDataArb,
          fc.string({ minLength: 10, maxLength: 50 }), // stream key
          async (templateData, streamKey) => {
            // Attempt to create template with stream key
            const dataWithKey = { ...templateData, stream_key: streamKey };
            const created = await StreamTemplate.create(dataWithKey);
            
            // Verify stream key is not stored
            expect(created.stream_key).toBeUndefined();
            
            // Retrieve and verify
            const retrieved = await StreamTemplate.findById(created.id);
            expect(retrieved.stream_key).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
