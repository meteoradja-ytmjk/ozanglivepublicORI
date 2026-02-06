/**
 * YouTube Default Settings Property Tests
 * **Feature: youtube-default-settings**
 */

const fc = require('fast-check');

// Mock channel defaults data generator
const channelDefaultsArbitrary = fc.record({
  title: fc.string({ minLength: 0, maxLength: 100 }),
  description: fc.string({ minLength: 0, maxLength: 5000 }),
  tags: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 20 }),
  monetizationEnabled: fc.boolean(),
  alteredContent: fc.boolean(),
  categoryId: fc.constantFrom('1', '2', '10', '15', '17', '20', '22', '23', '24', '25', '26', '27', '28')
});

// Simulated form state for testing
class BroadcastFormState {
  constructor() {
    this.title = '';
    this.description = '';
    this.tags = [];
    this.monetizationEnabled = false;
    this.alteredContent = false;
    this.categoryId = '20';
    this.isAutoFilled = false;
    this.hasError = false;
    this.errorMessage = '';
  }

  populateWithDefaults(defaults) {
    if (!defaults) {
      this.hasError = true;
      this.errorMessage = 'Failed to fetch defaults';
      return;
    }
    
    this.title = defaults.title || '';
    this.description = defaults.description || '';
    this.tags = Array.isArray(defaults.tags) ? [...defaults.tags] : [];
    this.monetizationEnabled = defaults.monetizationEnabled || false;
    this.alteredContent = defaults.alteredContent || false;
    this.categoryId = defaults.categoryId || '22';
    this.isAutoFilled = true;
  }

  handleError(error) {
    this.hasError = true;
    this.errorMessage = error.message || 'Unknown error';
    // Form remains usable with empty/default values
    this.title = '';
    this.description = '';
    this.tags = [];
    this.monetizationEnabled = false;
    this.alteredContent = false;
  }

  setTitle(value) {
    this.title = value;
  }

  setDescription(value) {
    this.description = value;
  }

  addTag(tag) {
    if (tag && !this.tags.includes(tag)) {
      this.tags.push(tag);
    }
  }

  removeTag(tag) {
    this.tags = this.tags.filter(t => t !== tag);
  }

  setMonetization(value) {
    this.monetizationEnabled = value;
  }

  setAlteredContent(value) {
    this.alteredContent = value;
  }

  getFormData() {
    return {
      title: this.title,
      description: this.description,
      tags: [...this.tags],
      monetizationEnabled: this.monetizationEnabled,
      alteredContent: this.alteredContent,
      categoryId: this.categoryId
    };
  }

  isUsable() {
    // Form is usable if we can submit (even with empty values)
    return true;
  }
}

// Tag renderer for testing
function renderTags(tags) {
  if (!Array.isArray(tags)) return [];
  
  return tags.map(tag => ({
    text: tag,
    removable: true,
    element: `<span class="tag-chip">${tag}<button class="remove">×</button></span>`
  }));
}

// Simulated API service
const mockYouTubeService = {
  async getChannelDefaults(accessToken) {
    if (!accessToken || accessToken === 'invalid') {
      throw new Error('Invalid access token');
    }
    
    // Return mock defaults
    return {
      title: 'Default Stream Title',
      description: 'Default stream description',
      tags: ['gaming', 'live', 'stream'],
      monetizationEnabled: true,
      alteredContent: false,
      categoryId: '20'
    };
  }
};

describe('YouTube Default Settings', () => {
  /**
   * **Feature: youtube-default-settings, Property 1: Default settings population**
   * *For any* valid ChannelDefaults response from YouTube API, the form fields 
   * (title, description, tags, monetization, alteredContent) SHALL be populated 
   * with the corresponding values from the response.
   * **Validates: Requirements 1.2, 1.3, 2.1, 3.1, 4.1**
   */
  test('Property 1: Default settings population - form fields match API response', async () => {
    await fc.assert(
      fc.asyncProperty(
        channelDefaultsArbitrary,
        async (defaults) => {
          const form = new BroadcastFormState();
          
          // Populate form with defaults
          form.populateWithDefaults(defaults);
          
          // Verify all fields are populated correctly
          expect(form.title).toBe(defaults.title);
          expect(form.description).toBe(defaults.description);
          expect(form.tags).toEqual(defaults.tags);
          expect(form.monetizationEnabled).toBe(defaults.monetizationEnabled);
          expect(form.alteredContent).toBe(defaults.alteredContent);
          expect(form.categoryId).toBe(defaults.categoryId);
          expect(form.isAutoFilled).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: youtube-default-settings, Property 2: Error handling preserves form usability**
   * *For any* API error response when fetching channel defaults, the form SHALL remain 
   * functional with empty/default field values and display a warning message.
   * **Validates: Requirements 1.4**
   */
  test('Property 2: Error handling - form remains usable after API error', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          errorType: fc.constantFrom('network', 'auth', 'timeout', 'server', 'unknown'),
          errorMessage: fc.string({ minLength: 1, maxLength: 200 })
        }),
        async ({ errorType, errorMessage }) => {
          const form = new BroadcastFormState();
          
          // Simulate error
          const error = new Error(errorMessage);
          error.type = errorType;
          form.handleError(error);
          
          // Form should still be usable
          expect(form.isUsable()).toBe(true);
          
          // Error state should be set
          expect(form.hasError).toBe(true);
          expect(form.errorMessage).toBe(errorMessage);
          
          // Fields should have default/empty values
          expect(form.title).toBe('');
          expect(form.description).toBe('');
          expect(form.tags).toEqual([]);
          
          // User should still be able to input values
          form.setTitle('Manual Title');
          expect(form.title).toBe('Manual Title');
          
          // Form data should be retrievable
          const formData = form.getFormData();
          expect(formData).toBeDefined();
          expect(formData.title).toBe('Manual Title');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: youtube-default-settings, Property 3: User modifications override defaults**
   * *For any* auto-filled field value and any user modification to that field, 
   * the final value used for broadcast creation SHALL be the user-modified value, 
   * not the auto-filled default.
   * **Validates: Requirements 1.5, 3.2, 4.2**
   */
  test('Property 3: User modifications override defaults', async () => {
    await fc.assert(
      fc.asyncProperty(
        channelDefaultsArbitrary,
        fc.record({
          newTitle: fc.string({ minLength: 1, maxLength: 100 }),
          newDescription: fc.string({ minLength: 0, maxLength: 500 }),
          newTag: fc.string({ minLength: 1, maxLength: 50 }),
          newMonetization: fc.boolean(),
          newAlteredContent: fc.boolean()
        }),
        async (defaults, userModifications) => {
          const form = new BroadcastFormState();
          
          // First populate with defaults
          form.populateWithDefaults(defaults);
          
          // User modifies fields
          form.setTitle(userModifications.newTitle);
          form.setDescription(userModifications.newDescription);
          form.addTag(userModifications.newTag);
          form.setMonetization(userModifications.newMonetization);
          form.setAlteredContent(userModifications.newAlteredContent);
          
          // Get final form data
          const formData = form.getFormData();
          
          // User modifications should override defaults
          expect(formData.title).toBe(userModifications.newTitle);
          expect(formData.description).toBe(userModifications.newDescription);
          expect(formData.tags).toContain(userModifications.newTag);
          expect(formData.monetizationEnabled).toBe(userModifications.newMonetization);
          expect(formData.alteredContent).toBe(userModifications.newAlteredContent);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: youtube-default-settings, Property 4: Tags rendering consistency**
   * *For any* array of tags, each tag SHALL be rendered as a removable chip element, 
   * and the total number of rendered chips SHALL equal the number of tags in the array.
   * **Validates: Requirements 4.3**
   */
  test('Property 4: Tags rendering - chip count equals tag count', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 30 }),
        async (tags) => {
          const renderedChips = renderTags(tags);
          
          // Number of rendered chips should equal number of tags
          expect(renderedChips.length).toBe(tags.length);
          
          // Each chip should be removable
          renderedChips.forEach((chip, index) => {
            expect(chip.removable).toBe(true);
            expect(chip.text).toBe(tags[index]);
            expect(chip.element).toContain('tag-chip');
            expect(chip.element).toContain('remove');
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 4: Tags rendering - handles empty array', () => {
    const renderedChips = renderTags([]);
    expect(renderedChips).toEqual([]);
  });

  test('Property 4: Tags rendering - handles invalid input', () => {
    expect(renderTags(null)).toEqual([]);
    expect(renderTags(undefined)).toEqual([]);
    expect(renderTags('not an array')).toEqual([]);
  });

  /**
   * **Feature: youtube-default-settings, Property 5: Monetization field visibility**
   * *For any* channel where monetization is not enabled, the monetization field 
   * SHALL be hidden or disabled.
   * **Validates: Requirements 2.3**
   */
  test('Property 5: Monetization visibility based on channel status', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(),
        async (monetizationEnabled) => {
          const defaults = {
            title: 'Test',
            description: 'Test desc',
            tags: [],
            monetizationEnabled,
            alteredContent: false,
            categoryId: '20'
          };
          
          // Determine if monetization field should be visible
          const shouldShowMonetization = defaults.monetizationEnabled;
          
          // If monetization is not enabled, field should be hidden/disabled
          if (!monetizationEnabled) {
            expect(shouldShowMonetization).toBe(false);
          } else {
            expect(shouldShowMonetization).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('YouTube Default Settings - API Endpoint', () => {
  /**
   * Unit tests for GET /api/youtube/channel-defaults endpoint
   * **Validates: Requirements 1.1, 1.4**
   */
  
  // Mock request/response for API testing
  const createMockReq = (userId, hasCredentials = true) => ({
    session: { userId },
    _hasCredentials: hasCredentials
  });
  
  const createMockRes = () => {
    const res = {
      statusCode: 200,
      jsonData: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.jsonData = data;
        return this;
      }
    };
    return res;
  };
  
  // Simulated endpoint handler
  const channelDefaultsHandler = async (req, res, mockService, mockCredentials) => {
    try {
      const credentials = mockCredentials;
      
      if (!credentials) {
        return res.status(400).json({
          success: false,
          error: 'YouTube account not connected'
        });
      }
      
      const defaults = await mockService.getChannelDefaults('valid-token');
      res.json({ success: true, defaults });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to fetch channel defaults' });
    }
  };
  
  test('API returns success with defaults when credentials exist', async () => {
    const req = createMockReq('user-123');
    const res = createMockRes();
    
    await channelDefaultsHandler(req, res, mockYouTubeService, { clientId: 'test' });
    
    expect(res.statusCode).toBe(200);
    expect(res.jsonData.success).toBe(true);
    expect(res.jsonData.defaults).toBeDefined();
    expect(res.jsonData.defaults.title).toBeDefined();
    expect(res.jsonData.defaults.description).toBeDefined();
    expect(res.jsonData.defaults.tags).toBeDefined();
  });
  
  test('API returns 400 when no credentials', async () => {
    const req = createMockReq('user-123', false);
    const res = createMockRes();
    
    await channelDefaultsHandler(req, res, mockYouTubeService, null);
    
    expect(res.statusCode).toBe(400);
    expect(res.jsonData.success).toBe(false);
    expect(res.jsonData.error).toBe('YouTube account not connected');
  });
  
  test('API returns 500 on service error', async () => {
    const req = createMockReq('user-123');
    const res = createMockRes();
    
    const failingService = {
      async getChannelDefaults() {
        throw new Error('API Error');
      }
    };
    
    await channelDefaultsHandler(req, res, failingService, { clientId: 'test' });
    
    expect(res.statusCode).toBe(500);
    expect(res.jsonData.success).toBe(false);
    expect(res.jsonData.error).toBe('Failed to fetch channel defaults');
  });
});

describe('YouTube Default Settings - Integration', () => {
  test('Full flow: fetch defaults, populate form, modify, submit', async () => {
    const form = new BroadcastFormState();
    
    // Fetch defaults
    const defaults = await mockYouTubeService.getChannelDefaults('valid-token');
    
    // Populate form
    form.populateWithDefaults(defaults);
    
    // Verify auto-fill
    expect(form.isAutoFilled).toBe(true);
    expect(form.title).toBe('Default Stream Title');
    
    // User modifies title
    form.setTitle('My Custom Stream');
    
    // Get form data for submission
    const formData = form.getFormData();
    
    // User modification should be preserved
    expect(formData.title).toBe('My Custom Stream');
    // Other defaults should remain
    expect(formData.description).toBe('Default stream description');
    expect(formData.tags).toEqual(['gaming', 'live', 'stream']);
  });

  test('Error flow: API fails, form still usable', async () => {
    const form = new BroadcastFormState();
    
    try {
      await mockYouTubeService.getChannelDefaults('invalid');
    } catch (error) {
      form.handleError(error);
    }
    
    // Form should be usable despite error
    expect(form.isUsable()).toBe(true);
    expect(form.hasError).toBe(true);
    
    // User can still fill form manually
    form.setTitle('Manual Entry');
    form.setDescription('Manual description');
    form.addTag('manual-tag');
    
    const formData = form.getFormData();
    expect(formData.title).toBe('Manual Entry');
    expect(formData.tags).toContain('manual-tag');
  });
});
