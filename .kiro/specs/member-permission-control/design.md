# Design Document: Member Permission Control

## Overview

This feature adds granular permission control for video-related actions in the StreamFlow application. Administrators can manage three specific permissions for each member: view videos, download videos, and delete videos. The system supports both individual and bulk permission management.

## Architecture

The feature follows the existing MVC architecture of the StreamFlow application:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (EJS Views)                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  User Management │  │  Gallery View   │  │  Video Actions  │  │
│  │  (Permission UI) │  │  (Filtered)     │  │  (Conditional)  │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
└───────────┼────────────────────┼────────────────────┼───────────┘
            │                    │                    │
            ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Express Routes (app.js)                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Permission API  │  │ Gallery Route   │  │ Video API       │  │
│  │ (Admin only)    │  │ (Check perms)   │  │ (Check perms)   │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
└───────────┼────────────────────┼────────────────────┼───────────┘
            │                    │                    │
            ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                      User Model (models/User.js)                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Permission Fields: can_view_videos, can_download_videos,    ││
│  │                    can_delete_videos                        ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SQLite Database                             │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ users table: + can_view_videos (INTEGER DEFAULT 1)          ││
│  │              + can_download_videos (INTEGER DEFAULT 1)      ││
│  │              + can_delete_videos (INTEGER DEFAULT 1)        ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Database Schema Extension

Add three new columns to the `users` table:

```sql
ALTER TABLE users ADD COLUMN can_view_videos INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN can_download_videos INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN can_delete_videos INTEGER DEFAULT 1;
```

### 2. User Model Extensions

New methods in `models/User.js`:

```javascript
// Update single user permission
static updatePermission(userId, permission, value)

// Update multiple users' permissions (bulk)
static bulkUpdatePermissions(userIds, permissions)

// Get user permissions
static getPermissions(userId)
```

### 3. API Endpoints

| Endpoint | Method | Description | Auth |
|----------|--------|-------------|------|
| `/api/users/permission` | POST | Update single user permission | Admin |
| `/api/users/bulk-permissions` | POST | Update multiple users' permissions | Admin |
| `/api/users/:id/permissions` | GET | Get user permissions | Admin |

### 4. Middleware

New permission check middleware:

```javascript
// Check if user can view videos
const canViewVideos = async (req, res, next) => { ... }

// Check if user can download videos
const canDownloadVideos = async (req, res, next) => { ... }

// Check if user can delete videos
const canDeleteVideos = async (req, res, next) => { ... }
```

### 5. UI Components

Update `views/users.ejs`:
- Add permission toggle switches for each member
- Add checkbox column for bulk selection
- Add bulk action dropdown/buttons
- Add "Select All" checkbox

Update `views/gallery.ejs`:
- Conditionally show/hide videos based on view permission
- Conditionally show/hide download button
- Conditionally show/hide delete button

## Data Models

### User Permission Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| can_view_videos | INTEGER | 1 | 1 = enabled, 0 = disabled |
| can_download_videos | INTEGER | 1 | 1 = enabled, 0 = disabled |
| can_delete_videos | INTEGER | 1 | 1 = enabled, 0 = disabled |

### API Request/Response Models

**Update Permission Request:**
```json
{
  "userId": "uuid-string",
  "permission": "can_view_videos|can_download_videos|can_delete_videos",
  "value": true|false
}
```

**Bulk Update Request:**
```json
{
  "userIds": ["uuid-1", "uuid-2", "uuid-3"],
  "permissions": {
    "can_view_videos": true,
    "can_download_videos": false,
    "can_delete_videos": true
  }
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Permission updated successfully",
  "updatedCount": 3
}
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: View Permission Enforcement

*For any* member with `can_view_videos` set to false, when that member accesses the gallery, the system should return an empty video list or a permission denied message. Conversely, *for any* member with `can_view_videos` set to true, the gallery should return the member's videos.

**Validates: Requirements 1.2, 1.3**

### Property 2: Download Permission Enforcement

*For any* member with `can_download_videos` set to false, when that member attempts to download a video via the API, the system should return an unauthorized error (HTTP 403). Conversely, *for any* member with `can_download_videos` set to true, the download request should succeed.

**Validates: Requirements 2.2, 2.3, 2.4**

### Property 3: Delete Permission Enforcement

*For any* member with `can_delete_videos` set to false, when that member attempts to delete a video via the API, the system should return an unauthorized error (HTTP 403). Conversely, *for any* member with `can_delete_videos` set to true, the delete request should succeed (assuming the video exists and belongs to the member).

**Validates: Requirements 3.2, 3.3, 3.4**

### Property 4: Permission Persistence

*For any* permission update operation (single or bulk), after the API returns success, querying the database should reflect the new permission value immediately.

**Validates: Requirements 4.1, 4.2**

### Property 5: Default Permissions for New Users

*For any* newly created member account, all three permissions (can_view_videos, can_download_videos, can_delete_videos) should be set to enabled (1) by default.

**Validates: Requirements 5.1**

### Property 6: Bulk Permission Update Consistency

*For any* bulk permission update operation with N selected users, after the operation completes, all N users should have the specified permission values.

**Validates: Requirements 6.3**

## Error Handling

### Permission Denied Errors

| Scenario | HTTP Status | Response |
|----------|-------------|----------|
| Member without view permission accesses gallery | 200 | Empty list + message |
| Member without download permission calls download API | 403 | `{ success: false, message: "You don't have permission to download videos" }` |
| Member without delete permission calls delete API | 403 | `{ success: false, message: "You don't have permission to delete videos" }` |

### Admin API Errors

| Scenario | HTTP Status | Response |
|----------|-------------|----------|
| Invalid permission name | 400 | `{ success: false, message: "Invalid permission type" }` |
| User not found | 404 | `{ success: false, message: "User not found" }` |
| Admin tries to modify own permissions | 400 | `{ success: false, message: "Cannot modify your own permissions" }` |
| Empty user selection for bulk action | 400 | `{ success: false, message: "No users selected" }` |

## Testing Strategy

### Unit Tests

Unit tests will cover:
- User model permission methods (updatePermission, bulkUpdatePermissions, getPermissions)
- Permission middleware functions
- API endpoint validation logic

### Property-Based Tests

Property-based tests will use a testing library (e.g., fast-check for JavaScript) to verify:

1. **View Permission Property**: Generate random users with random view permission states, verify gallery behavior matches permission state
2. **Download Permission Property**: Generate random users with random download permission states, verify API response matches permission state
3. **Delete Permission Property**: Generate random users with random delete permission states, verify API response matches permission state
4. **Persistence Property**: Generate random permission updates, verify database state after update
5. **Default Permission Property**: Generate random new user data, verify all permissions default to enabled
6. **Bulk Update Property**: Generate random user selections and permission combinations, verify all selected users are updated

Each property-based test will:
- Run a minimum of 100 iterations
- Be tagged with the corresponding correctness property reference
- Use format: `**Feature: member-permission-control, Property {number}: {property_text}**`

### Integration Tests

Integration tests will verify:
- End-to-end permission flow from admin UI to member experience
- Database migration applies correctly
- Session handling with permission changes
