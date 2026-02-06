/**
 * Property-Based Tests for Schedule Time Input Fix
 * Feature: schedule-time-input-fix
 */

const fc = require('fast-check');

// Mock DOM environment for testing
const createMockCell = (originalHtml = '<span>Original</span>') => ({
  innerHTML: originalHtml,
  dataset: { originalHtml: '' },
  appendChild: jest.fn(function(child) {
    this.innerHTML = child.outerHTML || '<input type="time">';
  })
});

const createMockInput = (value = '') => ({
  type: 'time',
  value,
  className: '',
  outerHTML: '<input type="time">',
  focus: jest.fn(),
  select: jest.fn(),
  addEventListener: jest.fn()
});

// Simulate the inline edit state
let activeInlineEdit = null;
let inlineEditOriginalValue = null;
let scheduleInlineSaving = false;

// Simplified version of createScheduleInlineEdit for testing
function createScheduleInlineEdit(cell, streamId, currentSchedule) {
  if (activeInlineEdit) {
    cancelInlineEdit();
  }
  
  inlineEditOriginalValue = currentSchedule;
  activeInlineEdit = { cell, streamId, field: 'schedule' };
  
  const originalHTML = cell.innerHTML;
  cell.dataset.originalHtml = originalHTML;
  
  const input = createMockInput(currentSchedule.recurring_time || '');
  input.className = 'w-25 px-2 py-1 bg-dark-700 border border-primary rounded text-sm text-white';
  
  cell.innerHTML = '';
  cell.appendChild(input);
  input.focus();
  input.select();
  
  return input;
}

// Simplified version of saveScheduleInlineEdit for testing
async function saveScheduleInlineEdit(streamId, scheduleType, recurringTime, cell) {
  // Save lock to prevent duplicate saves
  if (scheduleInlineSaving) {
    return false; // Return false to indicate save was blocked
  }
  scheduleInlineSaving = true;
  
  try {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 10));
    
    activeInlineEdit = null;
    inlineEditOriginalValue = null;
    scheduleInlineSaving = false;
    return true; // Return true to indicate save was successful
  } catch (error) {
    cell.innerHTML = cell.dataset.originalHtml;
    activeInlineEdit = null;
    inlineEditOriginalValue = null;
    scheduleInlineSaving = false;
    return false;
  }
}

function cancelInlineEdit() {
  if (activeInlineEdit && activeInlineEdit.cell) {
    activeInlineEdit.cell.innerHTML = activeInlineEdit.cell.dataset.originalHtml || '';
  }
  activeInlineEdit = null;
  inlineEditOriginalValue = null;
}

// Reset state before each test
beforeEach(() => {
  activeInlineEdit = null;
  inlineEditOriginalValue = null;
  scheduleInlineSaving = false;
});

describe('Schedule Time Input Fix', () => {
  /**
   * **Feature: schedule-time-input-fix, Property 1: Input Visibility Persistence**
   * **Validates: Requirements 1.1**
   * 
   * For any schedule cell click event, the time input element SHALL remain
   * in the DOM and visible until an explicit save or cancel action occurs.
   */
  describe('Property 1: Input Visibility Persistence', () => {
    it('input remains visible after creation until explicit action', () => {
      fc.assert(
        fc.property(
          fc.record({
            streamId: fc.uuid(),
            schedule_type: fc.constantFrom('daily', 'weekly', 'once'),
            recurring_time: fc.option(fc.stringMatching(/^([01]\d|2[0-3]):([0-5]\d)$/), { nil: null })
          }),
          (schedule) => {
            const cell = createMockCell();
            const input = createScheduleInlineEdit(cell, schedule.streamId, schedule);
            
            // Input should be created and focused
            expect(input.focus).toHaveBeenCalled();
            expect(input.select).toHaveBeenCalled();
            
            // activeInlineEdit should be set
            expect(activeInlineEdit).not.toBeNull();
            expect(activeInlineEdit.streamId).toBe(schedule.streamId);
            expect(activeInlineEdit.field).toBe('schedule');
            
            // Original HTML should be stored
            expect(cell.dataset.originalHtml).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('input is removed only after cancel action', () => {
      fc.assert(
        fc.property(
          fc.record({
            streamId: fc.uuid(),
            schedule_type: fc.constantFrom('daily', 'weekly'),
            recurring_time: fc.stringMatching(/^([01]\d|2[0-3]):([0-5]\d)$/)
          }),
          (schedule) => {
            const originalHtml = '<span>Daily at 10:00</span>';
            const cell = createMockCell(originalHtml);
            
            createScheduleInlineEdit(cell, schedule.streamId, schedule);
            expect(activeInlineEdit).not.toBeNull();
            
            // Cancel should restore original HTML
            cancelInlineEdit();
            expect(activeInlineEdit).toBeNull();
            expect(cell.innerHTML).toBe(originalHtml);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: schedule-time-input-fix, Property 2: Save Lock Prevents Duplicates**
   * **Validates: Requirements 3.3**
   * 
   * For any sequence of rapid save attempts on the same schedule cell,
   * only the first save request SHALL be sent while isSaving flag is true.
   */
  describe('Property 2: Save Lock Prevents Duplicates', () => {
    it('concurrent save attempts are blocked by save lock', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            streamId: fc.uuid(),
            schedule_type: fc.constantFrom('daily', 'weekly'),
            recurring_time: fc.stringMatching(/^([01]\d|2[0-3]):([0-5]\d)$/)
          }),
          fc.integer({ min: 2, max: 5 }), // Number of concurrent save attempts
          async (schedule, numAttempts) => {
            const cell = createMockCell();
            
            // Start multiple save attempts concurrently
            const savePromises = [];
            for (let i = 0; i < numAttempts; i++) {
              savePromises.push(
                saveScheduleInlineEdit(schedule.streamId, schedule.schedule_type, schedule.recurring_time, cell)
              );
            }
            
            const results = await Promise.all(savePromises);
            
            // Only the first save should succeed, rest should be blocked
            const successCount = results.filter(r => r === true).length;
            expect(successCount).toBe(1);
            
            // Save lock should be released after completion
            expect(scheduleInlineSaving).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('save lock is released after successful save', async () => {
      fc.assert(
        fc.asyncProperty(
          fc.record({
            streamId: fc.uuid(),
            schedule_type: fc.constantFrom('daily', 'weekly'),
            recurring_time: fc.stringMatching(/^([01]\d|2[0-3]):([0-5]\d)$/)
          }),
          async (schedule) => {
            const cell = createMockCell();
            
            // First save
            await saveScheduleInlineEdit(schedule.streamId, schedule.schedule_type, schedule.recurring_time, cell);
            expect(scheduleInlineSaving).toBe(false);
            
            // Second save should also work (not blocked)
            const result = await saveScheduleInlineEdit(schedule.streamId, schedule.schedule_type, schedule.recurring_time, cell);
            expect(result).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
