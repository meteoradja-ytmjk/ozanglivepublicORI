/**
 * FileQueueManager - Manages file upload queue with concurrent processing
 * Supports multiple file selection, progress tracking, cancel, and retry
 */
class FileQueueManager {
  /**
   * @param {Object} options
   * @param {string} options.uploadUrl - API endpoint for upload
   * @param {string} options.fileFieldName - Form field name for file (default: 'video' or 'audio')
   * @param {string[]} options.allowedExtensions - Allowed file extensions
   * @param {string[]} options.allowedMimeTypes - Allowed MIME types
   * @param {string} options.csrfToken - CSRF token for requests
   * @param {number} options.concurrentUploads - Number of concurrent uploads (default: 3)
   * @param {Function} options.onProgress - Callback for progress updates
   * @param {Function} options.onFileComplete - Callback when a file completes
   * @param {Function} options.onAllComplete - Callback when all files complete
   * @param {Function} options.onQueueUpdate - Callback when queue changes
   */
  constructor(options = {}) {
    this.uploadUrl = options.uploadUrl || '/api/videos/upload';
    this.fileFieldName = options.fileFieldName || 'video';
    this.allowedExtensions = options.allowedExtensions || ['.mp4', '.avi', '.mov'];
    this.allowedMimeTypes = options.allowedMimeTypes || ['video/mp4', 'video/avi', 'video/quicktime'];
    this.csrfToken = options.csrfToken || '';
    this.extraDataCallback = options.extraDataCallback || null; // Function to get extra form data
    this.concurrentUploads = options.concurrentUploads || 3; // Default 3 concurrent uploads
    
    // Callbacks
    this.onProgress = options.onProgress || (() => {});
    this.onFileComplete = options.onFileComplete || (() => {});
    this.onAllComplete = options.onAllComplete || (() => {});
    this.onQueueUpdate = options.onQueueUpdate || (() => {});
    
    // State
    this.files = [];
    this.currentIndex = -1;
    this.isUploading = false;
    this.isCancelled = false;
    this.activeUploads = 0; // Track number of active uploads
  }

  /**
   * Generate unique ID for file queue item
   */
  generateId() {
    return 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Format file size to human readable string
   * @param {number} bytes
   * @returns {string}
   */
  static formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    else return (bytes / 1073741824).toFixed(1) + ' GB';
  }

  /**
   * Validate if file has allowed format
   * @param {File} file
   * @returns {boolean}
   */
  isValidFile(file) {
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    const isValidExt = this.allowedExtensions.includes(ext);
    const isValidMime = this.allowedMimeTypes.includes(file.type);
    return isValidExt || isValidMime;
  }

  /**
   * Filter files to only include valid formats
   * @param {File[]} files
   * @returns {{valid: File[], invalid: File[]}}
   */
  filterFiles(files) {
    const valid = [];
    const invalid = [];
    
    for (const file of files) {
      if (this.isValidFile(file)) {
        valid.push(file);
      } else {
        invalid.push(file);
      }
    }
    
    return { valid, invalid };
  }

  /**
   * Add files to the queue
   * @param {FileList|File[]} fileList
   * @returns {{added: number, rejected: number, rejectedFiles: string[]}}
   */
  addFiles(fileList) {
    const filesArray = Array.from(fileList);
    const { valid, invalid } = this.filterFiles(filesArray);
    
    for (const file of valid) {
      const item = {
        id: this.generateId(),
        file: file,
        name: file.name,
        size: file.size,
        formattedSize: FileQueueManager.formatFileSize(file.size),
        status: 'pending', // pending, uploading, success, error
        progress: 0,
        error: null,
        xhr: null,
        result: null
      };
      this.files.push(item);
    }
    
    this.onQueueUpdate(this.files);
    
    return {
      added: valid.length,
      rejected: invalid.length,
      rejectedFiles: invalid.map(f => f.name)
    };
  }

  /**
   * Remove file from queue by index
   * @param {number} index
   * @returns {boolean}
   */
  removeFile(index) {
    if (index < 0 || index >= this.files.length) {
      return false;
    }
    
    const item = this.files[index];
    
    // If currently uploading this file, abort it
    if (item.status === 'uploading' && item.xhr) {
      item.xhr.abort();
    }
    
    this.files.splice(index, 1);
    
    // Adjust currentIndex if needed
    if (this.currentIndex >= index && this.currentIndex > 0) {
      this.currentIndex--;
    }
    
    this.onQueueUpdate(this.files);
    return true;
  }

  /**
   * Remove file from queue by ID
   * @param {string} id
   * @returns {boolean}
   */
  removeFileById(id) {
    const index = this.files.findIndex(f => f.id === id);
    if (index !== -1) {
      return this.removeFile(index);
    }
    return false;
  }

  /**
   * Get all files in queue
   * @returns {Object[]}
   */
  getFiles() {
    return [...this.files];
  }

  /**
   * Get file count by status
   * @returns {{total: number, pending: number, uploading: number, success: number, error: number}}
   */
  getStatusCounts() {
    const counts = {
      total: this.files.length,
      pending: 0,
      uploading: 0,
      success: 0,
      error: 0
    };
    
    for (const file of this.files) {
      counts[file.status]++;
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
      if (file.status === 'success') {
        totalProgress += 100;
      } else if (file.status === 'uploading') {
        totalProgress += file.progress;
      } else if (file.status === 'error') {
        totalProgress += 100; // Count as processed
      }
    }
    
    return Math.round(totalProgress / this.files.length);
  }

  /**
   * Clear all files from queue
   */
  clearQueue() {
    // Abort any ongoing upload
    for (const file of this.files) {
      if (file.xhr) {
        file.xhr.abort();
      }
    }
    
    this.files = [];
    this.currentIndex = -1;
    this.isUploading = false;
    this.isCancelled = false;
    this.onQueueUpdate(this.files);
  }

  /**
   * Check if queue has files
   * @returns {boolean}
   */
  hasFiles() {
    return this.files.length > 0;
  }

  /**
   * Check if there are pending files
   * @returns {boolean}
   */
  hasPendingFiles() {
    return this.files.some(f => f.status === 'pending');
  }

  /**
   * Check if there are failed files
   * @returns {boolean}
   */
  hasFailedFiles() {
    return this.files.some(f => f.status === 'error');
  }

  /**
   * Start uploading files with concurrent processing
   * @returns {Promise<{success: number, failed: number, results: Object[]}>}
   */
  async startUpload() {
    if (this.isUploading) {
      console.warn('Upload already in progress');
      return null;
    }
    
    if (!this.hasPendingFiles()) {
      console.warn('No pending files to upload');
      return null;
    }
    
    this.isUploading = true;
    this.isCancelled = false;
    this.activeUploads = 0;
    
    const results = [];
    let successCount = 0;
    let failedCount = 0;
    
    // Get all pending files
    const pendingFiles = this.files.filter(f => f.status === 'pending');
    
    // Count already completed files
    for (const file of this.files) {
      if (file.status === 'success') successCount++;
      if (file.status === 'error') failedCount++;
    }
    
    // Process files concurrently with limit
    const uploadPromises = [];
    let fileIndex = 0;
    
    const processNext = async () => {
      while (fileIndex < pendingFiles.length && !this.isCancelled) {
        // Wait if we've reached concurrent limit
        if (this.activeUploads >= this.concurrentUploads) {
          await new Promise(resolve => setTimeout(resolve, 100));
          continue;
        }
        
        const item = pendingFiles[fileIndex];
        fileIndex++;
        
        if (item.status !== 'pending') continue;
        
        this.activeUploads++;
        
        const uploadPromise = (async () => {
          try {
            const result = await this.uploadFile(item);
            item.status = 'success';
            item.result = result;
            item.progress = 100;
            successCount++;
            
            this.onFileComplete(item, true, result);
          } catch (error) {
            item.status = 'error';
            item.error = error.message || 'Upload failed';
            item.progress = 0;
            failedCount++;
            
            this.onFileComplete(item, false, error);
          } finally {
            this.activeUploads--;
          }
          
          this.onQueueUpdate(this.files);
          results.push({ file: item.name, status: item.status, error: item.error });
        })();
        
        uploadPromises.push(uploadPromise);
      }
    };
    
    // Start concurrent uploads
    const workers = [];
    for (let i = 0; i < this.concurrentUploads; i++) {
      workers.push(processNext());
    }
    
    // Wait for all uploads to complete
    await Promise.all(workers);
    await Promise.all(uploadPromises);
    
    this.isUploading = false;
    this.currentIndex = -1;
    this.activeUploads = 0;
    
    const summary = {
      success: successCount,
      failed: failedCount,
      total: this.files.length,
      results
    };
    
    this.onAllComplete(summary);
    return summary;
  }

  /**
   * Upload a single file
   * @param {Object} item - File queue item
   * @returns {Promise<Object>} - Server response
   */
  uploadFile(item) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      item.xhr = xhr;
      item.status = 'uploading';
      item.progress = 0;
      
      this.onQueueUpdate(this.files);
      
      // Progress handler
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          item.progress = Math.round((e.loaded / e.total) * 100);
          this.onProgress(item, item.progress, this.getOverallProgress());
          this.onQueueUpdate(this.files);
        }
      });
      
      // Load handler (success)
      xhr.addEventListener('load', () => {
        item.xhr = null;
        
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            if (response.success) {
              resolve(response);
            } else {
              reject(new Error(response.error || 'Upload failed'));
            }
          } catch (e) {
            reject(new Error('Invalid server response'));
          }
        } else if (xhr.status === 401) {
          // Unauthorized - session expired or not logged in
          reject(new Error('Unauthorized - please login again'));
        } else if (xhr.status === 413) {
          // Storage limit exceeded
          try {
            const response = JSON.parse(xhr.responseText);
            const errorMsg = response.message || 'Storage limit exceeded';
            const details = response.formatted ? 
              `\nCurrent: ${response.formatted.usage}\nLimit: ${response.formatted.limit}` : '';
            reject(new Error(errorMsg + details));
          } catch (e) {
            reject(new Error('Storage limit exceeded'));
          }
        } else if (xhr.status === 408) {
          // Request timeout
          reject(new Error('Upload timeout - file may be too large'));
        } else {
          try {
            const response = JSON.parse(xhr.responseText);
            reject(new Error(response.error || `HTTP ${xhr.status}`));
          } catch (e) {
            reject(new Error(`HTTP ${xhr.status}`));
          }
        }
      });
      
      // Error handler
      xhr.addEventListener('error', () => {
        item.xhr = null;
        reject(new Error('Network error'));
      });
      
      // Abort handler
      xhr.addEventListener('abort', () => {
        item.xhr = null;
        reject(new Error('Upload cancelled'));
      });
      
      // Timeout handler
      xhr.addEventListener('timeout', () => {
        item.xhr = null;
        reject(new Error('Upload timeout'));
      });
      
      // Prepare form data
      const formData = new FormData();
      formData.append(this.fileFieldName, item.file);
      if (this.csrfToken) {
        formData.append('_csrf', this.csrfToken);
      }
      
      // Add extra data if callback provided
      if (this.extraDataCallback && typeof this.extraDataCallback === 'function') {
        const extraData = this.extraDataCallback();
        if (extraData && typeof extraData === 'object') {
          for (const [key, value] of Object.entries(extraData)) {
            formData.append(key, value);
          }
        }
      }
      
      // Send request
      xhr.open('POST', this.uploadUrl, true);
      xhr.setRequestHeader('X-CSRF-Token', this.csrfToken);
      xhr.timeout = 0; // No timeout for large files
      xhr.send(formData);
    });
  }

  /**
   * Cancel current upload
   */
  cancelCurrent() {
    if (this.currentIndex >= 0 && this.currentIndex < this.files.length) {
      const item = this.files[this.currentIndex];
      if (item.xhr) {
        item.xhr.abort();
        item.status = 'pending'; // Reset to pending so it can be retried
        item.progress = 0;
        item.error = null;
        this.onQueueUpdate(this.files);
      }
    }
  }

  /**
   * Cancel all uploads and clear queue
   */
  cancelAll() {
    this.isCancelled = true;
    
    // Abort all active uploads
    for (const file of this.files) {
      if (file.status === 'uploading' && file.xhr) {
        file.xhr.abort();
        file.status = 'pending';
        file.progress = 0;
        file.error = null;
        file.xhr = null;
      }
    }
    
    this.isUploading = false;
    this.currentIndex = -1;
    this.activeUploads = 0;
    this.onQueueUpdate(this.files);
  }

  /**
   * Retry only failed uploads
   * @returns {Promise<{success: number, failed: number, results: Object[]}>}
   */
  async retryFailed() {
    // Reset failed files to pending
    for (const file of this.files) {
      if (file.status === 'error') {
        file.status = 'pending';
        file.progress = 0;
        file.error = null;
      }
    }
    
    this.onQueueUpdate(this.files);
    
    // Start upload again
    return this.startUpload();
  }

  /**
   * Get count of files currently uploading
   * @returns {number}
   */
  getUploadingCount() {
    return this.files.filter(f => f.status === 'uploading').length;
  }
  
  /**
   * Set number of concurrent uploads
   * @param {number} count
   */
  setConcurrentUploads(count) {
    this.concurrentUploads = Math.max(1, Math.min(count, 5)); // Limit between 1-5
  }
}

// Export for both browser and Node.js (for testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FileQueueManager;
}
