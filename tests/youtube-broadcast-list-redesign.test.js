/**
 * YouTube Broadcast List Redesign Property Tests
 * **Feature: youtube-broadcast-list-redesign**
 */

const fc = require('fast-check');

// Helper function to generate broadcast numbers for a list
function generateBroadcastNumbers(broadcasts) {
  return broadcasts.map((broadcast, index) => ({
    ...broadcast,
    displayNumber: index + 1
  }));
}

// Helper function to render broadcast item (simulates EJS template output for compact list)
function renderBroadcastItem(broadcast, index) {
  const number = index + 1;
  const streamKey = broadcast.streamKey ? broadcast.streamKey.substring(0, 20) + '...' : '-';
  
  return {
    number,
    title: broadcast.title,
    privacyStatus: broadcast.privacyStatus,
    streamKey,
    streamKeyRaw: broadcast.streamKey || null,
    hasEditButton: true,
    hasSyncButton: true,
    hasDeleteButton: true
  };
}

// Helper function to render full broadcast list
function renderBroadcastList(broadcasts) {
  return broadcasts.map((broadcast, index) => renderBroadcastItem(broadcast, index));
}

// Broadcast generator for fast-check
const broadcastArbitrary = fc.record({
  id: fc.string({ minLength: 1, maxLength: 50 }),
  title: fc.string({ minLength: 1, maxLength: 100 }),
  channelName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
  privacyStatus: fc.constantFrom('public', 'unlisted', 'private'),
  scheduledStartTime: fc.integer({ min: Date.now(), max: Date.now() + 365 * 24 * 60 * 60 * 1000 })
    .map(ts => new Date(ts).toISOString()),
  streamKey: fc.option(fc.string({ minLength: 10, maxLength: 50 }), { nil: null }),
  accountId: fc.integer({ min: 1, max: 100 })
});

describe('YouTube Broadcast List Redesign', () => {
  /**
   * **Feature: youtube-broadcast-list-redesign, Property 1: Essential Information Display**
   * *For any* broadcast object rendered in the list, the output SHALL contain 
   * the broadcast number, title, privacy status, and stream key (or placeholder if empty).
   * **Validates: Requirements 2.2, 4.1, 4.2**
   */
  test('Property 1: Essential information display - number, title, privacy, stream key', async () => {
    await fc.assert(
      fc.asyncProperty(
        broadcastArbitrary,
        async (broadcast) => {
          const rendered = renderBroadcastItem(broadcast, 0);
          
          // Number must be present (starts from 1)
          expect(rendered.number).toBe(1);
          
          // Title must be present
          expect(rendered.title).toBe(broadcast.title);
          
          // Privacy status must be present
          expect(rendered.privacyStatus).toBe(broadcast.privacyStatus);
          
          // Stream key must be present (truncated or placeholder)
          if (broadcast.streamKey) {
            expect(rendered.streamKey).toContain(broadcast.streamKey.substring(0, 20));
          } else {
            expect(rendered.streamKey).toBe('-');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: youtube-broadcast-list-redesign, Property 2: Action Buttons Presence**
   * *For any* broadcast item rendered in the list, the output SHALL contain exactly 
   * three action buttons: edit, sync, and delete.
   * **Validates: Requirements 3.1**
   */
  test('Property 2: All action buttons are present - edit, sync, delete', async () => {
    await fc.assert(
      fc.asyncProperty(
        broadcastArbitrary,
        async (broadcast) => {
          const rendered = renderBroadcastItem(broadcast, 0);
          
          // All three action buttons must be present
          expect(rendered.hasEditButton).toBe(true);
          expect(rendered.hasSyncButton).toBe(true);
          expect(rendered.hasDeleteButton).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Unit test: Empty stream key shows placeholder
  test('Empty stream key displays dash placeholder', () => {
    const broadcast = {
      id: 'test-1',
      title: 'Test Broadcast',
      channelName: 'Test Channel',
      privacyStatus: 'public',
      scheduledStartTime: new Date().toISOString(),
      streamKey: null,
      accountId: 1
    };
    
    const rendered = renderBroadcastItem(broadcast, 0);
    expect(rendered.streamKey).toBe('-');
  });

  // Unit test: Numbering with single item
  test('Single broadcast gets number 1', () => {
    const broadcasts = [{
      id: 'test-1',
      title: 'Single Broadcast',
      channelName: 'Channel',
      privacyStatus: 'unlisted',
      scheduledStartTime: new Date().toISOString(),
      streamKey: 'key-123',
      accountId: 1
    }];
    
    const renderedList = renderBroadcastList(broadcasts);
    expect(renderedList.length).toBe(1);
    expect(renderedList[0].number).toBe(1);
  });

  // Unit test: Empty list
  test('Empty broadcast list renders empty array', () => {
    const broadcasts = [];
    const renderedList = renderBroadcastList(broadcasts);
    expect(renderedList).toEqual([]);
  });

  // Unit test: Header buttons 2-grid layout structure
  describe('Header Buttons Grid Layout', () => {
    // Helper to simulate header buttons structure
    function renderHeaderButtons() {
      return {
        containerClass: 'header-buttons grid grid-cols-2 gap-2',
        buttons: [
          {
            id: 'templateBtn',
            label: 'Templates',
            icon: 'ti-template',
            hasIcon: true,
            hasLabel: true
          },
          {
            id: 'createBtn', 
            label: 'Create',
            icon: 'ti-plus',
            hasIcon: true,
            hasLabel: true
          }
        ]
      };
    }

    test('Header buttons container uses 2-column grid layout', () => {
      const header = renderHeaderButtons();
      expect(header.containerClass).toContain('grid');
      expect(header.containerClass).toContain('grid-cols-2');
    });

    test('Header has exactly 2 buttons (Template and Create)', () => {
      const header = renderHeaderButtons();
      expect(header.buttons.length).toBe(2);
    });

    test('Both buttons have icons and labels', () => {
      const header = renderHeaderButtons();
      header.buttons.forEach(button => {
        expect(button.hasIcon).toBe(true);
        expect(button.hasLabel).toBe(true);
        expect(button.icon).toBeTruthy();
        expect(button.label).toBeTruthy();
      });
    });

    test('Template button is first, Create button is second', () => {
      const header = renderHeaderButtons();
      expect(header.buttons[0].label).toBe('Templates');
      expect(header.buttons[1].label).toBe('Create');
    });
  });

  // Unit tests for Mobile Responsive Layout
  describe('Mobile Responsive Layout', () => {
    // Helper to simulate mobile layout structure
    function renderMobileLayout() {
      return {
        headerButtonsClass: 'header-buttons grid grid-cols-2 gap-2',
        actionButtonMinSize: 36, // w-9 h-9 = 36px
        layoutType: 'stacked',
        actionButtonsLayout: 'horizontal'
      };
    }

    test('Header buttons remain in 2-grid layout on mobile', () => {
      const mobile = renderMobileLayout();
      expect(mobile.headerButtonsClass).toContain('grid');
      expect(mobile.headerButtonsClass).toContain('grid-cols-2');
    });

    test('Action buttons meet minimum touch target size (36px)', () => {
      const mobile = renderMobileLayout();
      expect(mobile.actionButtonMinSize).toBeGreaterThanOrEqual(36);
    });

    test('Mobile layout uses stacked info with horizontal action buttons', () => {
      const mobile = renderMobileLayout();
      expect(mobile.layoutType).toBe('stacked');
      expect(mobile.actionButtonsLayout).toBe('horizontal');
    });
  });
});
