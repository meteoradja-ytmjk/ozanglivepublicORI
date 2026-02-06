/**
 * Comprehensive Backup Service Test v2
 * Tests for title folders, title suggestions, and thumbnail files backup
 */

const backupService = require('../services/backupService');

describe('Backup Service - Extended Categories', () => {
  describe('ALL_CATEGORIES', () => {
    it('should include all required categories', () => {
      expect(backupService.ALL_CATEGORIES).toContain('streams');
      expect(backupService.ALL_CATEGORIES).toContain('youtube_credentials');
      expect(backupService.ALL_CATEGORIES).toContain('broadcast_templates');
      expect(backupService.ALL_CATEGORIES).toContain('recurring_schedules');
      expect(backupService.ALL_CATEGORIES).toContain('stream_templates');
      expect(backupService.ALL_CATEGORIES).toContain('playlists');
      expect(backupService.ALL_CATEGORIES).toContain('title_folders');
      expect(backupService.ALL_CATEGORIES).toContain('title_suggestions');
      expect(backupService.ALL_CATEGORIES).toContain('thumbnail_files');
    });

    it('should have 9 categories total', () => {
      expect(backupService.ALL_CATEGORIES.length).toBe(9);
    });
  });

  describe('TITLE_FOLDER_FIELDS', () => {
    it('should include required fields', () => {
      expect(backupService.TITLE_FOLDER_FIELDS).toContain('name');
      expect(backupService.TITLE_FOLDER_FIELDS).toContain('color');
      expect(backupService.TITLE_FOLDER_FIELDS).toContain('sort_order');
    });
  });

  describe('TITLE_SUGGESTION_FIELDS', () => {
    it('should include required fields', () => {
      expect(backupService.TITLE_SUGGESTION_FIELDS).toContain('title');
      expect(backupService.TITLE_SUGGESTION_FIELDS).toContain('use_count');
      expect(backupService.TITLE_SUGGESTION_FIELDS).toContain('sort_order');
      expect(backupService.TITLE_SUGGESTION_FIELDS).toContain('is_pinned');
      expect(backupService.TITLE_SUGGESTION_FIELDS).toContain('folder_name');
    });
  });

  describe('BROADCAST_TEMPLATE_FIELDS', () => {
    it('should include thumbnail folder fields', () => {
      expect(backupService.BROADCAST_TEMPLATE_FIELDS).toContain('thumbnail_folder');
      expect(backupService.BROADCAST_TEMPLATE_FIELDS).toContain('thumbnail_index');
      expect(backupService.BROADCAST_TEMPLATE_FIELDS).toContain('pinned_thumbnail');
      expect(backupService.BROADCAST_TEMPLATE_FIELDS).toContain('stream_key_folder_mapping');
    });

    it('should include title rotation fields', () => {
      expect(backupService.BROADCAST_TEMPLATE_FIELDS).toContain('title_index');
      expect(backupService.BROADCAST_TEMPLATE_FIELDS).toContain('pinned_title_id');
      expect(backupService.BROADCAST_TEMPLATE_FIELDS).toContain('title_folder_id');
    });
  });

  describe('validateComprehensiveBackup', () => {
    it('should validate backup with thumbnail_files object', () => {
      const backup = {
        metadata: {
          exportDate: new Date().toISOString(),
          appVersion: '1.0.0'
        },
        thumbnail_files: {
          folders: [],
          files: []
        }
      };
      
      const result = backupService.validateComprehensiveBackup(backup);
      expect(result.valid).toBe(true);
    });

    it('should validate backup with title_folders array', () => {
      const backup = {
        metadata: {
          exportDate: new Date().toISOString(),
          appVersion: '1.0.0'
        },
        title_folders: [
          { name: 'Test Folder', color: '#8B5CF6' }
        ]
      };
      
      const result = backupService.validateComprehensiveBackup(backup);
      expect(result.valid).toBe(true);
    });

    it('should validate backup with title_suggestions array', () => {
      const backup = {
        metadata: {
          exportDate: new Date().toISOString(),
          appVersion: '1.0.0'
        },
        title_suggestions: [
          { title: 'Test Title', folder_name: 'Test Folder' }
        ]
      };
      
      const result = backupService.validateComprehensiveBackup(backup);
      expect(result.valid).toBe(true);
    });

    it('should reject backup without metadata', () => {
      const backup = {
        title_folders: []
      };
      
      const result = backupService.validateComprehensiveBackup(backup);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid backup format: missing metadata');
    });

    it('should reject backup without any valid category', () => {
      const backup = {
        metadata: {
          exportDate: new Date().toISOString()
        }
      };
      
      const result = backupService.validateComprehensiveBackup(backup);
      expect(result.valid).toBe(false);
    });
  });

  describe('Export Functions', () => {
    it('should export exportTitleFolders function', () => {
      expect(typeof backupService.exportTitleFolders).toBe('function');
    });

    it('should export exportTitleSuggestions function', () => {
      expect(typeof backupService.exportTitleSuggestions).toBe('function');
    });

    it('should export exportThumbnailFiles function', () => {
      expect(typeof backupService.exportThumbnailFiles).toBe('function');
    });
  });

  describe('Import Functions', () => {
    it('should export importTitleFoldersData function', () => {
      expect(typeof backupService.importTitleFoldersData).toBe('function');
    });

    it('should export importTitleSuggestionsData function', () => {
      expect(typeof backupService.importTitleSuggestionsData).toBe('function');
    });

    it('should export importThumbnailFilesData function', () => {
      expect(typeof backupService.importThumbnailFilesData).toBe('function');
    });
  });
});
