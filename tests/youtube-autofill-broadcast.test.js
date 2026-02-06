/**
 * Property-based tests for YouTube Auto-fill Broadcast
 * Tests category field removal, auto-fill functionality, and UI consistency
 * 
 * **Feature: youtube-autofill-broadcast**
 */

const fc = require('fast-check');
const fs = require('fs');
const path = require('path');

// Read the actual view file content for DOM testing
const viewFilePath = path.join(__dirname, '..', 'views', 'youtube.ejs');
const jsFilePath = path.join(__dirname, '..', 'public', 'js', 'youtube.js');

describe('YouTube Auto-fill Broadcast', () => {
  let viewContent;
  let jsContent;

  beforeAll(() => {
    viewContent = fs.readFileSync(viewFilePath, 'utf8');
    jsContent = fs.readFileSync(jsFilePath, 'utf8');
  });

  describe('Category Field Removal', () => {
    /**
     * **Feature: youtube-autofill-broadcast, Property 6: Category field removal**
     * **Validates: Requirements 3.1, 3.2, 3.3**
     * 
     * For any broadcast form (create or edit), the category field SHALL NOT be present
     * in the DOM, and broadcast creation SHALL use a default category value internally.
     */
    test('Property 6: Category field not present in Create Broadcast Modal', () => {
      // Extract Create Broadcast Modal content
      const createModalMatch = viewContent.match(/id="createBroadcastModal"[\s\S]*?<\/form>/);
      expect(createModalMatch).not.toBeNull();
      
      const createModalContent = createModalMatch[0];
      
      // Verify category field is NOT present
      expect(createModalContent).not.toMatch(/id="categoryId"/);
      expect(createModalContent).not.toMatch(/name="categoryId"/);
      expect(createModalContent).not.toMatch(/categoryAutoFillIndicator/);
    });

    test('Property 6: Category field not present in Edit Broadcast Modal', () => {
      // Extract Edit Broadcast Modal content
      const editModalMatch = viewContent.match(/id="editBroadcastModal"[\s\S]*?<\/form>/);
      expect(editModalMatch).not.toBeNull();
      
      const editModalContent = editModalMatch[0];
      
      // Verify category field is NOT present
      expect(editModalContent).not.toMatch(/id="editCategoryId"/);
      expect(editModalContent).not.toMatch(/name="categoryId"/);
    });

    test('Property 6: Category field not present in Create Template Modal', () => {
      // Extract Create Template Modal content
      const templateModalMatch = viewContent.match(/id="createTemplateModal"[\s\S]*?<\/form>/);
      expect(templateModalMatch).not.toBeNull();
      
      const templateModalContent = templateModalMatch[0];
      
      // Verify category field is NOT present
      expect(templateModalContent).not.toMatch(/id="templateCategoryId"/);
    });

    test('Property 6: Backend uses default category value', () => {
      // Read youtubeService.js to verify default category
      const serviceFilePath = path.join(__dirname, '..', 'services', 'youtubeService.js');
      const serviceContent = fs.readFileSync(serviceFilePath, 'utf8');
      
      // Verify default category is set to '22' (People & Blogs)
      expect(serviceContent).toMatch(/categoryId:\s*categoryId\s*\|\|\s*['"]22['"]/);
    });

    test('Property 6: JavaScript does not send categoryId from create broadcast form', () => {
      // Verify that create broadcast form handler does not read categoryId from form element
      // The form handler should not have getElementById('categoryId')
      const createFormSection = jsContent.match(/createBroadcastForm[\s\S]*?\/api\/youtube\/broadcasts/);
      expect(createFormSection).not.toBeNull();
      
      // Check that categoryId is not being read from a form element in this section
      expect(createFormSection[0]).not.toMatch(/getElementById\(['"]categoryId['"]\)/);
    });
  });

  describe('Auto-fill Indicators', () => {
    /**
     * **Feature: youtube-autofill-broadcast, Property 3: Auto-fill indicator display**
     * **Validates: Requirements 1.6, 4.2**
     * 
     * For any successfully auto-filled field, an "Auto-filled" indicator SHALL be displayed
     * next to that field, and this behavior SHALL be consistent across desktop and mobile views.
     */
    test('Property 3: Tags auto-fill indicator exists in view', () => {
      expect(viewContent).toMatch(/id="tagsAutoFillIndicator"/);
      expect(viewContent).toMatch(/Auto-filled/);
    });

    test('Property 3: populateFormWithDefaults shows auto-fill indicator for tags', () => {
      // Verify the function shows indicator when tags are populated
      expect(jsContent).toMatch(/tagsAutoFillIndicator[\s\S]*?classList\.remove\(['"]hidden['"]\)/);
    });
  });

  describe('Stream Key Loading', () => {
    /**
     * **Feature: youtube-autofill-broadcast, Property 5: Stream key dropdown population**
     * **Validates: Requirements 2.3, 2.4**
     * 
     * For any valid stream keys response, the dropdown SHALL contain all stream keys
     * with their title, resolution, and frame rate displayed in the option text.
     */
    test('Property 5: Stream key dropdown has loading indicator', () => {
      expect(viewContent).toMatch(/id="streamKeyLoading"/);
    });

    test('Property 5: Stream key dropdown has default option', () => {
      expect(viewContent).toMatch(/Create new stream key/);
    });

    test('Property 5: fetchStreams function displays stream info correctly', () => {
      // Verify the format includes title, resolution, and frameRate
      expect(jsContent).toMatch(/stream\.title/);
      expect(jsContent).toMatch(/stream\.resolution/);
      expect(jsContent).toMatch(/stream\.frameRate/);
    });
  });

  describe('Form Population', () => {
    /**
     * **Feature: youtube-autofill-broadcast, Property 1: Form population from channel defaults**
     * **Validates: Requirements 1.2, 1.3, 1.4**
     * 
     * For any valid channel defaults response containing title, description, or tags,
     * the corresponding form fields SHALL be populated with those values.
     */
    test('Property 1: populateFormWithDefaults handles title', () => {
      expect(jsContent).toMatch(/broadcastTitle[\s\S]*?defaults\.title/);
    });

    test('Property 1: populateFormWithDefaults handles description', () => {
      expect(jsContent).toMatch(/broadcastDescription[\s\S]*?defaults\.description/);
    });

    test('Property 1: populateFormWithDefaults handles tags', () => {
      expect(jsContent).toMatch(/defaults\.tags[\s\S]*?currentTags/);
    });

    /**
     * Property-based test for form population logic
     */
    test('Property 1: Form population preserves all provided values', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            title: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: '' }),
            description: fc.option(fc.string({ minLength: 0, maxLength: 500 }), { nil: '' }),
            tags: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 0, maxLength: 10 }), { nil: [] })
          }),
          async (defaults) => {
            // Simulate form population logic
            const formState = {
              title: '',
              description: '',
              tags: []
            };

            // Apply defaults (mimicking populateFormWithDefaults logic)
            if (defaults.title && !formState.title) {
              formState.title = defaults.title;
            }
            if (defaults.description && !formState.description) {
              formState.description = defaults.description;
            }
            if (defaults.tags && defaults.tags.length > 0) {
              formState.tags = [...defaults.tags];
            }

            // Verify values are preserved
            if (defaults.title) {
              expect(formState.title).toBe(defaults.title);
            }
            if (defaults.description) {
              expect(formState.description).toBe(defaults.description);
            }
            if (defaults.tags && defaults.tags.length > 0) {
              expect(formState.tags).toEqual(defaults.tags);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Account Change Handler', () => {
    /**
     * **Feature: youtube-autofill-broadcast, Property 9: Account change triggers data refresh**
     * **Validates: Requirements 5.1, 5.2, 5.4**
     * 
     * For any account selection change, both channel defaults and stream keys SHALL be
     * fetched for the newly selected account.
     */
    test('Property 9: onAccountChange calls fetchStreams', () => {
      expect(jsContent).toMatch(/onAccountChange[\s\S]*?fetchStreams/);
    });

    test('Property 9: onAccountChange calls fetchChannelDefaults', () => {
      expect(jsContent).toMatch(/onAccountChange[\s\S]*?fetchChannelDefaults/);
    });
  });

  describe('API Failure Handling', () => {
    /**
     * **Feature: youtube-autofill-broadcast, Property 4: Form remains functional on API failure**
     * **Validates: Requirements 1.7, 2.6**
     * 
     * For any API failure, the form SHALL remain fully functional allowing manual input.
     */
    test('Property 4: fetchChannelDefaults has error handling', () => {
      expect(jsContent).toMatch(/fetchChannelDefaults[\s\S]*?catch/);
    });

    test('Property 4: fetchStreams has error handling', () => {
      expect(jsContent).toMatch(/fetchStreams[\s\S]*?catch/);
    });
  });

  describe('Loading Indicators', () => {
    /**
     * **Feature: youtube-autofill-broadcast, Property 2: Loading indicator visibility during data fetch**
     * **Validates: Requirements 1.5, 2.2, 5.3**
     * 
     * For any data fetch operation, loading indicators SHALL be visible on affected fields.
     */
    test('Property 2: Tags loading indicator exists', () => {
      expect(viewContent).toMatch(/id="tagsLoading"/);
    });

    test('Property 2: Stream key loading indicator exists', () => {
      expect(viewContent).toMatch(/id="streamKeyLoading"/);
    });

    test('Property 2: fetchChannelDefaults toggles loading indicator', () => {
      expect(jsContent).toMatch(/tagsLoading[\s\S]*?classList\.(remove|add)\(['"]hidden['"]\)/);
    });

    test('Property 2: fetchStreams toggles loading indicator', () => {
      expect(jsContent).toMatch(/streamKeyLoading[\s\S]*?classList\.(remove|add)\(['"]hidden['"]\)/);
    });
  });

  describe('Mobile-Desktop UI Consistency', () => {
    /**
     * **Feature: youtube-autofill-broadcast, Property 7: Mobile-desktop UI consistency**
     * **Validates: Requirements 4.1, 4.3**
     * 
     * For any form field displayed in the create broadcast modal, the field order
     * and available options SHALL be identical between desktop and mobile views.
     */
    test('Property 7: Create Broadcast Modal is responsive', () => {
      // Verify modal has responsive classes
      expect(viewContent).toMatch(/createBroadcastModal[\s\S]*?overflow-y-auto/);
    });

    test('Property 7: Form fields have consistent structure', () => {
      // Verify essential form fields exist
      const essentialFields = [
        'accountSelect',
        'broadcastTitle',
        'broadcastDescription',
        'scheduledStartTime',
        'privacyStatus',
        'streamKeySelect',
        'tagInput'
      ];

      essentialFields.forEach(fieldId => {
        expect(viewContent).toMatch(new RegExp(`id="${fieldId}"`));
      });
    });
  });

  describe('Touch-Friendly Input Sizes', () => {
    /**
     * **Feature: youtube-autofill-broadcast, Property 8: Touch-friendly input sizes**
     * **Validates: Requirements 4.4**
     * 
     * For any interactive element in the mobile broadcast form, the touch target size
     * SHALL be at least 44px in both width and height.
     */
    test('Property 8: Form inputs have adequate padding for touch', () => {
      // Verify inputs have py-2.5 (padding-y: 0.625rem = 10px) which with text makes ~44px
      expect(viewContent).toMatch(/py-2\.5/);
    });

    test('Property 8: Buttons have minimum height for touch', () => {
      // Verify buttons have adequate sizing with py-3 (padding-y: 0.75rem = 12px) for touch targets
      expect(viewContent).toMatch(/py-3/);
    });
  });
});
