/**
 * DriveImportQueueManager - Manages batch Google Drive import with sequential processing
 * Supports multiple links input, progress tracking, cancel, and retry
 */
class DriveImportQueueManager {
  /**
   * @param {Object} options
   * @param {string} options.type - 'video' or 'audio'
   * @param {string} options.csrfToken - CSRF token for requests
   * @param {Function} options.onProgress - Callback for progress updates
   * @param {Function} options.onFileComplete - Callback when a file completes
   * @param {Function} options.onAllComplete - Callback when all files complete
   * @param {Function} options.onQueueUpdate - Callback when queue changes
   * @param {Function} options.onValidationError - Callback for validation errors
   */
  constructor(options = {}) {
    this.type = options.type || 'video';
    this.csrfToken = options.csrfToken || '';
    
    // API endpoints based on type
    this.batchUrl = this.type === 'audio' 
      ? '/api/audios/import-drive-batch'
      : '/api/videos/import-drive-batch';
    this.statusUrl = this.type === 'audio'
      ? '/api/audios/import-batch-status'
      : '/api/videos/import-batch-status';
    this.cancelUrl = this.type === 'audio'
      ? '/api/audios/import-batch-cancel'
      : '/api/videos/import-batch-cancel';
    
    // Callbacks
    this.onProgress = options.onProgress || (() => {});
    this.onFileComplete = options.onFileComplete || (() => {});
    this.onAllComplete = options.onAllComplete || (() => {});
    this.onQueueUpdate = options.onQueueUpdate || (() => {});
    this.onValidationError = options.onValidationError || (() => {});
    
    // State
    this.files = [];
    this.batchId = null;
    this.isProcessing = false;
    this.isCancelled = false;
    this.pollInterval = null;
  }

  /**
   * Parse textarea content into array of links
   * @param {string} text - Textarea content with links separated by newlines
   * @returns {string[]} Array of non-empty trimmed links
   */
  parseLinks(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }
    
    return text
      .split(/[\r\n]+/)
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }

  /**
   * Validate a single Google Drive URL
   * @param {string} link - Google Drive URL to validate
   * @returns {{valid: boolean, link: string, fileId: string|null, error: string|null}}
   */
  validateLink(link) {
    if (!link || typeof link !== 'string') {
      return { valid: false, link: link || '', fileId: null, error: 'Empty link' };
    }
    
    const trimmedLink = link.trim();
    
    // Check if it's a Google Drive URL
    if (!trimmedLink.includes('drive.google.com') && !trimmedLink.includes('docs.google.com')) {
      return { valid: false, link: trimmedLink, fileId: null, error: 'Not a Google Drive URL' };
    }
    
    // Try to extract file ID
    let fileId = null;
    
    // Pattern: /file/d/{fileId}/
    let match = trimmedLink.match(/\/file\/d\/([^\/]+)/);
    if (match) {
      fileId = match[1];
    }
    
    // Pattern: ?id={fileId}
    if (!fileId) {
      match = trimmedLink.match(/[?&]id=([^&]+)/);
      if (match) {
        fileId = match[1];
      }
    }
    
    // Pattern: /d/{fileId}/
    if (!fileId) {
      match = trimmedLink.match(/\/d\/([^\/]+)/);
      if (match) {
        fileId = match[1];
      }
    }
    
    if (!fileId) {
      return { valid: false, link: trimmedLink, fileId: null, error: 'Could not extract file ID' };
    }
    
    // Validate file ID format (alphanumeric with - and _)
    if (!/^[a-zA-Z0-9_-]{10,}$/.test(fileId)) {
      return { valid: false, link: trimmedLink, fileId: null, error: 'Invalid file ID format' };
    }
    
    return { valid: true, link: trimmedLink, fileId: fileId, error: null };
  }

  /**
   * Validate all links and return results
   * @param {string[]} links - Array of links to validate
   * @returns {{valid: Object[], invalid: Object[], allValid: boolean}}
   */
  validateAllLinks(links) {
    const valid = [];
    const invalid = [];
    
    for (const link of links) {
      const result = this.validateLink(link);
      if (result.valid) {
        valid.push(result);
      } else {
        invalid.push(result);
      }
    }
    
    return {
      valid,
      invalid,
      allValid: invalid.length === 0
    };
  }

  /**
   * Get status counts from current files
   * @returns {{total: number, pending: number, downloading: number, processing: number, completed: number, failed: number}}
   */
  getStatusCounts() {
    const counts = {
      total: this.files.length,
      pending: 0,
      downloading: 0,
      processing: 0,
      completed: 0,
      failed: 0
    };
    
    for (const file of this.files) {
      const status = file.status || 'pending';
      if (counts.hasOwnProperty(status)) {
        counts[status]++;
      }
    }
    
    return counts;
  }

  /**
   * Calculate overall progress percentage
   * @returns {number} 0-100
   */
  getOverallProgress() {
    if (this.files.length === 0) return 0;
    
    let totalProgress = 0;
    for (const file of this.files) {
      if (file.status === 'completed') {
        totalProgress += 100;
      } else if (file.status === 'downloading' || file.status === 'processing') {
        totalProgress += file.progress || 0;
      } else if (file.status === 'failed') {
        totalProgress += 100; // Count as processed
      }
    }
    
    return Math.round(totalProgress / this.files.length);
  }

  /**
   * Start batch import
   * @param {string[]} links - Array of Google Drive links
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async startImport(links) {
    if (this.isProcessing) {
      return { success: false, error: 'Import already in progress' };
    }
    
    if (!links || links.length === 0) {
      return { success: false, error: 'No links provided' };
    }
    
    // Validate all links first
    const validation = this.validateAllLinks(links);
    if (!validation.allValid) {
      this.onValidationError(validation.invalid);
      return { success: false, error: 'Some links are invalid', invalid: validation.invalid };
    }
    
    this.isProcessing = true;
    this.isCancelled = false;
    
    // Initialize files array
    this.files = validation.valid.map((v, index) => ({
      index,
      link: v.link,
      fileId: v.fileId,
      status: 'pending',
      progress: 0,
      message: 'Waiting...',
      error: null,
      resultId: null
    }));
    
    this.onQueueUpdate(this.files);
    
    try {
      const response = await fetch(this.batchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': this.csrfToken
        },
        body: JSON.stringify({
          driveUrls: validation.valid.map(v => v.link)
        })
      });
      
      const data = await response.json();
      
      if (data.success && data.batchId) {
        this.batchId = data.batchId;
        this.startPolling();
        return { success: true, batchId: data.batchId };
      } else {
        this.isProcessing = false;
        return { success: false, error: data.error || 'Failed to start import' };
      }
    } catch (error) {
      this.isProcessing = false;
      return { success: false, error: error.message || 'Network error' };
    }
  }

  /**
   * Start polling for batch status
   */
  startPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    
    this.pollInterval = setInterval(() => this.pollStatus(), 2000);
    // Also poll immediately
    this.pollStatus();
  }

  /**
   * Stop polling
   */
  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Poll for batch status
   */
  async pollStatus() {
    if (!this.batchId) return;
    
    try {
      const response = await fetch(`${this.statusUrl}/${this.batchId}`);
      const data = await response.json();
      
      if (data.success && data.status) {
        const status = data.status;
        
        // Update files from server status
        if (status.files) {
          for (const serverFile of status.files) {
            const localFile = this.files[serverFile.index];
            if (localFile) {
              const prevStatus = localFile.status;
              localFile.status = serverFile.status;
              localFile.progress = serverFile.progress;
              localFile.message = serverFile.message;
              localFile.error = serverFile.error;
              localFile.resultId = serverFile.resultId;
              
              // Trigger file complete callback on status change to completed/failed
              if (prevStatus !== serverFile.status) {
                if (serverFile.status === 'completed' || serverFile.status === 'failed') {
                  this.onFileComplete(localFile, serverFile.status === 'completed');
                }
              }
            }
          }
        }
        
        this.onQueueUpdate(this.files);
        this.onProgress(this.getOverallProgress(), this.getStatusCounts());
        
        // Check if complete
        if (status.isComplete || status.isCancelled) {
          this.stopPolling();
          this.isProcessing = false;
          this.isCancelled = status.isCancelled || false;
          
          this.onAllComplete({
            success: this.getStatusCounts().completed,
            failed: this.getStatusCounts().failed,
            total: this.files.length,
            cancelled: this.isCancelled
          });
        }
      }
    } catch (error) {
      console.error('Error polling status:', error);
    }
  }

  /**
   * Cancel all imports
   * @returns {Promise<{success: boolean}>}
   */
  async cancelAll() {
    if (!this.batchId) {
      return { success: false, error: 'No batch to cancel' };
    }
    
    this.isCancelled = true;
    
    try {
      const response = await fetch(`${this.cancelUrl}/${this.batchId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': this.csrfToken
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.stopPolling();
        this.isProcessing = false;
        this.onQueueUpdate(this.files);
        return { success: true };
      }
      
      return { success: false, error: data.error };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Retry failed imports
   * @returns {Promise<{success: boolean}>}
   */
  async retryFailed() {
    const failedLinks = this.files
      .filter(f => f.status === 'failed')
      .map(f => f.link);
    
    if (failedLinks.length === 0) {
      return { success: false, error: 'No failed imports to retry' };
    }
    
    // Reset state
    this.batchId = null;
    this.isProcessing = false;
    this.isCancelled = false;
    
    // Start new import with failed links
    return this.startImport(failedLinks);
  }

  /**
   * Reset manager state
   */
  reset() {
    this.stopPolling();
    this.files = [];
    this.batchId = null;
    this.isProcessing = false;
    this.isCancelled = false;
    this.onQueueUpdate(this.files);
  }

  /**
   * Check if there are failed files
   * @returns {boolean}
   */
  hasFailedFiles() {
    return this.files.some(f => f.status === 'failed');
  }

  /**
   * Check if import is complete
   * @returns {boolean}
   */
  isComplete() {
    if (this.files.length === 0) return false;
    return this.files.every(f => f.status === 'completed' || f.status === 'failed');
  }
}

// Export for both browser and Node.js (for testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DriveImportQueueManager;
}
