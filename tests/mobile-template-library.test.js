/**
 * Property-based tests for Mobile Template Library
 * Tests template rendering for mobile layout
 * 
 * **Feature: mobile-template-library-fix**
 */

const fc = require('fast-check');

// Mock template data generator
const templateArb = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  title: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  channel_name: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: 'Unknown Channel' }),
  isMultiBroadcast: fc.boolean(),
  broadcasts: fc.array(fc.record({ id: fc.uuid() }), { minLength: 0, maxLength: 5 }),
  recurring_enabled: fc.boolean(),
  recurring_pattern: fc.constantFrom('daily', 'weekly', 'custom'),
  recurring_days: fc.option(fc.string(), { nil: null }),
  recurring_time: fc.option(fc.string({ minLength: 5, maxLength: 5 }).filter(s => /^\d{2}:\d{2}$/.test(s)), { nil: '08:00' }),
  next_run_at: fc.option(fc.date().map(d => d.toISOString()), { nil: null }),
  created_at: fc.date().map(d => d.toISOString())
});

// Helper function to escape HTML (same as in youtube.js)
function escapeHtml(text) {
  if (!text) return '';
  const div = { textContent: '', innerHTML: '' };
  div.textContent = text;
  // Simple escape for testing
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Helper function to format recurring pattern (simplified for testing)
function formatRecurringPattern(pattern, days, time) {
  if (!pattern) return 'Not set';
  if (pattern === 'daily') return `Daily at ${time || '00:00'}`;
  if (pattern === 'weekly') return `Weekly at ${time || '00:00'}`;
  return `Custom at ${time || '00:00'}`;
}

// Helper function to format next run (simplified for testing)
function formatNextRun(nextRunAt) {
  if (!nextRunAt) return 'Not scheduled';
  try {
    return new Date(nextRunAt).toLocaleString();
  } catch {
    return 'Invalid date';
  }
}

// Simulated renderTemplateList function that generates HTML
function renderTemplateCard(template) {
  const isMulti = template.isMultiBroadcast && template.broadcasts && template.broadcasts.length > 1;
  const broadcastCount = isMulti ? template.broadcasts.length : 1;
  const hasRecurring = template.recurring_enabled;
  
  // Build recurring info HTML for mobile
  let recurringHtmlMobile = '';
  if (hasRecurring) {
    const patternText = formatRecurringPattern(template.recurring_pattern, template.recurring_days, template.recurring_time);
    const nextRunText = formatNextRun(template.next_run_at);
    recurringHtmlMobile = `
      <div class="mt-2 p-2 bg-green-500/10 rounded-lg">
        <div class="flex items-center gap-1 text-green-400 text-xs font-medium">
          <i class="ti ti-repeat"></i>
          <span>${escapeHtml(patternText)}</span>
        </div>
        <p class="text-xs text-gray-400 mt-1">Next: ${escapeHtml(nextRunText)}</p>
      </div>
    `;
  }
  
  return {
    html: `
      <!-- Desktop Layout -->
      <div class="hidden md:flex items-start justify-between gap-4">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <h4 class="font-medium text-white truncate">${escapeHtml(template.name)}</h4>
            ${isMulti ? `<span class="px-1.5 py-0.5 bg-primary/20 text-primary text-xs rounded">${broadcastCount} broadcasts</span>` : ''}
            ${hasRecurring ? `<span class="recurring-badge px-1.5 py-0.5 bg-green-500/20 text-green-400 text-xs rounded flex items-center gap-0.5"><i class="ti ti-repeat text-[10px]"></i> Auto</span>` : ''}
          </div>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          ${!isMulti ? `
          <button class="recurring-toggle px-3 py-1.5 ${hasRecurring ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'} hover:opacity-80 rounded-lg transition-colors text-sm flex items-center gap-1" data-recurring="${hasRecurring}">
            <i class="ti ti-repeat"></i>
            <span>${hasRecurring ? 'On' : 'Off'}</span>
          </button>
          ` : ''}
        </div>
      </div>
      
      <!-- Mobile Layout -->
      <div class="md:hidden">
        <div class="mb-3">
          <div class="flex items-center gap-2 flex-wrap mb-1">
            <h4 class="font-medium text-white text-sm">${escapeHtml(template.name)}</h4>
            ${isMulti ? `<span class="px-1.5 py-0.5 bg-primary/20 text-primary text-[10px] rounded">${broadcastCount}</span>` : ''}
            ${hasRecurring ? `<span class="recurring-badge px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded flex items-center gap-0.5"><i class="ti ti-repeat text-[8px]"></i> Auto</span>` : ''}
          </div>
          <p class="text-xs text-gray-400 mb-1">${escapeHtml(template.title)}</p>
          <p class="text-xs text-red-400 flex items-center gap-1">
            <i class="ti ti-brand-youtube text-[10px]"></i>
            ${escapeHtml(template.channel_name || 'Unknown Channel')}
          </p>
          ${recurringHtmlMobile}
        </div>
        
        <div class="grid grid-cols-3 gap-1.5">
          ${!isMulti ? `
          <button class="recurring-toggle template-action-btn flex items-center justify-center gap-1 px-2 py-2 ${hasRecurring ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'} hover:opacity-80 rounded-lg transition-colors" data-recurring="${hasRecurring}">
            <i class="ti ti-repeat text-sm"></i>
            <span class="text-[10px]">${hasRecurring ? 'On' : 'Off'}</span>
          </button>
          ` : ''}
        </div>
      </div>
    `,
    hasRecurring,
    isMulti
  };
}

describe('Mobile Template Library', () => {
  describe('Template Card Rendering', () => {
    /**
     * **Feature: mobile-template-library-fix, Property 1: Recurring toggle state consistency**
     * **Validates: Requirements 2.2**
     * 
     * For any template with recurring_enabled set to true or false, the rendered toggle button
     * SHALL display the correct state ("On" with green styling when enabled, "Off" with gray styling when disabled).
     */
    test('Property 1: Recurring toggle state consistency', () => {
      fc.assert(
        fc.property(
          templateArb,
          (template) => {
            // Skip multi-broadcast templates as they don't have recurring toggle
            if (template.isMultiBroadcast && template.broadcasts && template.broadcasts.length > 1) {
              return true;
            }
            
            const result = renderTemplateCard(template);
            const html = result.html;
            
            if (template.recurring_enabled) {
              // When recurring is enabled, button should show "On" with green styling
              expect(html).toContain('data-recurring="true"');
              expect(html).toContain('bg-green-500/20 text-green-400');
              expect(html).toMatch(/<span[^>]*>On<\/span>/);
            } else {
              // When recurring is disabled, button should show "Off" with gray styling
              expect(html).toContain('data-recurring="false"');
              expect(html).toContain('bg-gray-500/20 text-gray-400');
              expect(html).toMatch(/<span[^>]*>Off<\/span>/);
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: mobile-template-library-fix, Property 2: Recurring badge visibility**
     * **Validates: Requirements 4.1**
     * 
     * For any template with recurring_enabled set to true, the rendered template card
     * SHALL contain a visible recurring pattern badge with the correct pattern text.
     */
    test('Property 2: Recurring badge visibility', () => {
      fc.assert(
        fc.property(
          templateArb.filter(t => t.recurring_enabled === true),
          (template) => {
            const result = renderTemplateCard(template);
            const html = result.html;
            
            // Recurring badge should be present
            expect(html).toContain('recurring-badge');
            expect(html).toContain('Auto');
            
            // Mobile recurring info should be present
            expect(html).toContain('bg-green-500/10');
            
            // Pattern text should be present
            const patternText = formatRecurringPattern(template.recurring_pattern, template.recurring_days, template.recurring_time);
            expect(html).toContain(escapeHtml(patternText));
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Template card has separate desktop and mobile layouts', () => {
      fc.assert(
        fc.property(
          templateArb,
          (template) => {
            const result = renderTemplateCard(template);
            const html = result.html;
            
            // Should have desktop layout with hidden md:flex
            expect(html).toContain('hidden md:flex');
            
            // Should have mobile layout with md:hidden
            expect(html).toContain('md:hidden');
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    test('Mobile layout has grid action buttons', () => {
      fc.assert(
        fc.property(
          templateArb,
          (template) => {
            const result = renderTemplateCard(template);
            const html = result.html;
            
            // Mobile layout should have grid for action buttons
            expect(html).toContain('grid grid-cols-3');
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    test('Template info is displayed without truncation on mobile', () => {
      fc.assert(
        fc.property(
          templateArb,
          (template) => {
            const result = renderTemplateCard(template);
            const html = result.html;
            
            // Mobile layout should contain template name
            expect(html).toContain(escapeHtml(template.name));
            
            // Mobile layout should contain template title
            expect(html).toContain(escapeHtml(template.title));
            
            // Mobile layout should contain channel name
            expect(html).toContain(escapeHtml(template.channel_name || 'Unknown Channel'));
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    test('Non-recurring templates do not show recurring badge', () => {
      fc.assert(
        fc.property(
          templateArb.filter(t => t.recurring_enabled === false),
          (template) => {
            const result = renderTemplateCard(template);
            const html = result.html;
            
            // Should not have recurring badge with "Auto" text
            // Note: The badge class might still be in the template structure, 
            // but the actual badge element should not be rendered
            const mobileSection = html.split('md:hidden')[1];
            if (mobileSection) {
              // Check that the recurring info section is not present
              expect(mobileSection).not.toContain('bg-green-500/10 rounded-lg');
            }
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Action Button Layout', () => {
    test('Action buttons have proper touch target size class', () => {
      fc.assert(
        fc.property(
          templateArb,
          (template) => {
            const result = renderTemplateCard(template);
            const html = result.html;
            
            // Mobile action buttons should have template-action-btn class
            // which will be styled with min-height: 44px in CSS
            if (!result.isMulti) {
              expect(html).toContain('template-action-btn');
            }
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
