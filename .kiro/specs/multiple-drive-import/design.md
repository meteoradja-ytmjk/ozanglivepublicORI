# Design Document: Multiple Google Drive Import

## Overview

This feature enhances the existing Google Drive import functionality to support importing multiple files at once. Users can enter multiple Google Drive links (one per line) in a textarea, and the system will process them sequentially with individual progress tracking. The design reuses the existing `googleDriveService.js` for downloading and extends the backend to handle batch imports with a queue-based approach.

## Architecture

```mermaid
flowchart TB
    subgraph Frontend
        UI[Import Modal with Textarea]
        QM[DriveImportQueueManager]
        Progress[Progress Display]
    end
    
    subgraph Backend
        API[/api/videos/import-drive-batch]
        StatusAPI[/api/videos/import-batch-status/:batchId]
        Processor[Batch Import Processor]
        GDS[googleDriveService.js]
    end
    
    subgraph Storage
        Jobs[(Import Jobs Store)]
        DB[(Database)]
        Files[(File Storage)]
    end
    
    UI --> QM
    QM --> API
    QM --> StatusAPI
    API --> Processor
    Processor --> GDS
    GDS --> Files
    Processor --> DB
    Processor --> Jobs
    StatusAPI --> Jobs
    Progress --> StatusAPI
```

## Components and Interfaces

### 1. DriveImportQueueManager (Frontend)

A JavaScript class that manages the batch import process on the frontend.

```javascript
class DriveImportQueueManager {
  constructor(options) {
    this.type = options.type; // 'video' or 'audio'
    this.csrfToken = options.csrfToken;
    this.onProgress = options.onProgress;
    this.onFileComplete = options.onFileComplete;
    this.onAllComplete = options.onAllComplete;
    this.onQueueUpdate = options.onQueueUpdate;
    
    this.links = [];
    this.batchId = null;
    this.isProcessing = false;
    this.isCancelled = false;
  }
  
  // Parse textarea content into array of links
  parseLinks(text) { }
  
  // Validate Google Drive URL format
  validateLink(link) { }
  
  // Start batch import
  async startImport(links) { }
  
  // Poll for batch status
  async pollStatus() { }
  
  // Cancel all imports
  cancelAll() { }
  
  // Retry failed imports
  async retryFailed() { }
  
  // Get status counts
  getStatusCounts() { }
}
```

### 2. Backend API Endpoints

#### POST /api/videos/import-drive-batch
Accepts an array of Google Drive URLs and starts batch processing.

Request:
```json
{
  "driveUrls": [
    "https://drive.google.com/file/d/xxx/view",
    "https://drive.google.com/file/d/yyy/view"
  ]
}
```

Response:
```json
{
  "success": true,
  "batchId": "batch_uuid",
  "totalFiles": 2
}
```

#### GET /api/videos/import-batch-status/:batchId
Returns the current status of all files in the batch.

Response:
```json
{
  "success": true,
  "status": {
    "batchId": "batch_uuid",
    "isComplete": false,
    "isCancelled": false,
    "files": [
      {
        "index": 0,
        "link": "https://...",
        "status": "completed",
        "progress": 100,
        "message": "Video imported successfully",
        "videoId": 123
      },
      {
        "index": 1,
        "link": "https://...",
        "status": "downloading",
        "progress": 45,
        "message": "Downloading..."
      }
    ],
    "summary": {
      "total": 2,
      "completed": 1,
      "failed": 0,
      "pending": 0,
      "processing": 1
    }
  }
}
```

#### POST /api/videos/import-batch-cancel/:batchId
Cancels the batch import.

#### POST /api/audios/import-drive-batch
Same as video but for audio files.

#### GET /api/audios/import-batch-status/:batchId
Same as video but for audio files.

### 3. Batch Import Processor (Backend)

```javascript
const batchImportJobs = {};

async function processBatchImport(batchId, fileIds, userId, type = 'video') {
  batchImportJobs[batchId] = {
    isComplete: false,
    isCancelled: false,
    files: fileIds.map((id, index) => ({
      index,
      fileId: id.fileId,
      link: id.link,
      status: 'pending',
      progress: 0,
      message: 'Waiting...',
      error: null,
      resultId: null
    }))
  };
  
  for (let i = 0; i < fileIds.length; i++) {
    if (batchImportJobs[batchId].isCancelled) break;
    
    const file = batchImportJobs[batchId].files[i];
    file.status = 'downloading';
    
    try {
      // Download and process file
      // Update progress via callback
      // Create database record
      file.status = 'completed';
    } catch (error) {
      file.status = 'failed';
      file.error = error.message;
    }
  }
  
  batchImportJobs[batchId].isComplete = true;
}
```

## Data Models

### BatchImportJob (In-Memory)

```javascript
{
  batchId: string,
  isComplete: boolean,
  isCancelled: boolean,
  files: [
    {
      index: number,
      fileId: string,
      link: string,
      status: 'pending' | 'downloading' | 'processing' | 'completed' | 'failed',
      progress: number, // 0-100
      message: string,
      error: string | null,
      resultId: number | null // Video or Audio ID after successful import
    }
  ]
}
```

### Link Validation Result

```javascript
{
  valid: boolean,
  link: string,
  fileId: string | null,
  error: string | null
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Link Parsing Correctness
*For any* multi-line text input, parsing SHALL produce an array where each non-empty line becomes a separate link entry, and the count of entries SHALL equal the count of non-empty lines.
**Validates: Requirements 1.2**

### Property 2: Link Validation Correctness
*For any* list of links containing both valid and invalid Google Drive URLs, validation SHALL correctly identify valid links (containing drive.google.com or docs.google.com with a file ID) and invalid links.
**Validates: Requirements 1.3, 1.4**

### Property 3: Status Tracking Completeness
*For any* batch import job, each file SHALL have a status field that is one of: 'pending', 'downloading', 'processing', 'completed', or 'failed'.
**Validates: Requirements 2.1, 2.3, 2.4**

### Property 4: Progress Bounds
*For any* file in the import queue, the progress value SHALL be between 0 and 100 inclusive.
**Validates: Requirements 2.2**

### Property 5: Error Resilience
*For any* batch import where file at index N fails, files at indices greater than N SHALL still be processed (unless cancelled).
**Validates: Requirements 3.1**

### Property 6: Summary Accuracy
*For any* completed batch import, the sum of completed + failed + pending + processing counts SHALL equal the total file count.
**Validates: Requirements 3.2**

### Property 7: Sequential Processing
*For any* batch import, at most one file SHALL have status 'downloading' or 'processing' at any given time.
**Validates: Requirements 6.1**

### Property 8: Cancel State Preservation
*For any* cancelled batch import, files that were already 'completed' SHALL remain 'completed', and remaining files SHALL not be processed.
**Validates: Requirements 4.2, 4.3**

## Error Handling

1. **Invalid Link Format**: Display error message next to the invalid link, allow user to correct
2. **Network Errors**: Mark file as failed with error message, continue with next file
3. **File Access Errors**: Mark file as failed with "File is private or not accessible" message
4. **Server Errors**: Mark file as failed, allow retry
5. **Timeout**: Mark file as failed with timeout message, allow retry

## Testing Strategy

### Unit Tests
- Link parsing with various input formats (empty lines, whitespace, mixed content)
- Link validation for valid and invalid URLs
- Status count calculations
- Progress calculations

### Property-Based Tests
Using fast-check library:

1. **Property 1**: Generate random multi-line strings, verify parsing produces correct count
2. **Property 2**: Generate mix of valid/invalid URLs, verify validation accuracy
3. **Property 3**: Generate batch jobs with various states, verify all have valid status
4. **Property 4**: Generate progress values, verify bounds
5. **Property 5**: Simulate failures at various indices, verify subsequent files processed
6. **Property 6**: Generate completed batches, verify summary counts
7. **Property 7**: Generate batch states, verify at most one downloading
8. **Property 8**: Generate cancelled batches, verify completed files preserved

### Integration Tests
- End-to-end batch import with mock Google Drive responses
- Cancel during import
- Retry failed imports
