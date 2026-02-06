# Design Document: App Stability Fix

## Overview

Dokumen ini menjelaskan desain teknis untuk memperbaiki masalah stabilitas aplikasi Streamflow. Fokus utama adalah mengatasi race condition pada inisialisasi database, meningkatkan error handling, dan memastikan graceful shutdown yang proper.

## Architecture

### Current Issues

```
┌─────────────────────────────────────────────────────────────┐
│                    CURRENT FLOW (BUGGY)                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  App Start ──► Services Init ──► DB Tables Create (async)   │
│                     │                    │                   │
│                     ▼                    ▼                   │
│              Query Tables ◄──── Tables Not Ready Yet!        │
│                     │                                        │
│                     ▼                                        │
│              CRASH: "no such table"                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Proposed Solution

```
┌─────────────────────────────────────────────────────────────┐
│                    FIXED FLOW                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  App Start ──► Wait for DB Init ──► Verify Tables ──►       │
│                                           │                  │
│                                           ▼                  │
│                                    Services Init ──►         │
│                                           │                  │
│                                           ▼                  │
│                                    Start Server              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Database Initialization Manager

```javascript
// db/database.js - Enhanced initialization
module.exports = {
  db,                    // SQLite database instance
  waitForDbInit,         // Promise that resolves when DB is ready
  isDbInitialized,       // Function to check if DB is ready
  checkIfUsersExist,     // Check if users table has data
  verifyTables           // Verify all required tables exist
};
```

### 2. Application Startup Sequence

```javascript
// app.js - Startup sequence
async function startApplication() {
  // 1. Wait for database initialization
  await waitForDbInit();
  
  // 2. Verify all tables exist
  await verifyTables();
  
  // 3. Initialize services (scheduler, streaming)
  initializeServices();
  
  // 4. Start HTTP server
  startServer();
}
```

### 3. Graceful Shutdown Manager

```javascript
// services/shutdownManager.js
class ShutdownManager {
  register(name, cleanupFn);  // Register cleanup function
  shutdown(signal);           // Execute all cleanup functions
  forceExit(timeout);         // Force exit after timeout
}
```

### 4. Enhanced Health Check

```javascript
// GET /health response
{
  status: 'ok' | 'degraded' | 'error',
  timestamp: ISO8601,
  uptime: seconds,
  memory: { used, total, unit },
  database: { connected: boolean, latency: ms },
  activeStreams: number,
  components: {
    database: 'healthy' | 'unhealthy',
    scheduler: 'healthy' | 'unhealthy',
    streaming: 'healthy' | 'unhealthy'
  }
}
```

## Data Models

### Shutdown State

```javascript
const shutdownState = {
  isShuttingDown: false,
  shutdownStartTime: null,
  cleanupFunctions: Map<string, Function>,
  forceExitTimeout: 30000 // 30 seconds
};
```

### Database Initialization State

```javascript
const dbState = {
  initialized: false,
  initPromise: null,
  requiredTables: [
    'users', 'videos', 'streams', 'stream_history',
    'playlists', 'playlist_videos', 'audios',
    'system_settings', 'stream_templates', 'youtube_credentials'
  ]
};
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Database Initialization Order
*For any* application startup sequence, all database tables SHALL be created and verified before any service attempts to query them.
**Validates: Requirements 1.1, 1.4**

### Property 2: Database Operation Queuing
*For any* database operation attempted before initialization completes, the operation SHALL be queued and executed successfully after initialization.
**Validates: Requirements 1.2**

### Property 3: Session Error Handling
*For any* session middleware error, the application SHALL respond with an error page instead of crashing.
**Validates: Requirements 2.2**

### Property 4: Database Error Independence
*For any* set of database operations where some fail, each error SHALL be handled independently without affecting other operations.
**Validates: Requirements 3.1, 3.2, 3.3**

### Property 5: Graceful Shutdown Cleanup
*For any* shutdown signal, all active streams SHALL be stopped and all intervals/timeouts SHALL be cleared before exit.
**Validates: Requirements 4.2, 4.3**

### Property 6: Health Check Completeness
*For any* health check request, the response SHALL include database connectivity status, memory usage, and uptime.
**Validates: Requirements 5.1, 5.2, 5.3**

### Property 7: Unhandled Rejection Recovery
*For any* unhandled promise rejection, the application SHALL log the error and continue running without crashing.
**Validates: Requirements 6.3**

## Error Handling

### Database Errors

```javascript
// Wrap all database operations with error handling
async function safeDbOperation(operation, context) {
  try {
    return await operation();
  } catch (error) {
    console.error(`[Database Error] ${context}:`, error.message);
    throw new DatabaseError(error.message, context);
  }
}
```

### Session Errors

```javascript
// Session error middleware
app.use((err, req, res, next) => {
  if (err.message && err.message.includes('session')) {
    console.error('[Session Error]:', err.message);
    return res.status(500).render('error', {
      title: 'Session Error',
      message: 'Session error occurred. Please try again.'
    });
  }
  next(err);
});
```

### Unhandled Rejections

```javascript
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Unhandled Rejection]:', reason);
  // Log but don't exit - allow application to continue
});
```

## Testing Strategy

### Unit Testing

Unit tests akan menggunakan Jest untuk menguji:
- Database initialization sequence
- Error handling functions
- Shutdown cleanup functions
- Health check response format

### Property-Based Testing

Property-based tests akan menggunakan **fast-check** library untuk menguji:
- Database operation queuing behavior
- Error handling independence
- Shutdown cleanup completeness

Setiap property-based test akan:
- Dikonfigurasi untuk minimal 100 iterasi
- Ditandai dengan komentar yang mereferensikan correctness property
- Menggunakan format: `**Feature: app-stability-fix, Property {number}: {property_text}**`

### Integration Testing

Integration tests akan menguji:
- Full application startup sequence
- Graceful shutdown with active streams
- Health check under various conditions
