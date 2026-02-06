# Design Document: YouTube Auto-fill Broadcast

## Overview

Fitur ini menyederhanakan proses pembuatan broadcast YouTube dengan mengisi otomatis field title, description, tags, dan stream key dari data YouTube Dashboard. Field category dihilangkan untuk menyederhanakan form. Tampilan form disamakan antara mode desktop dan mobile untuk konsistensi pengalaman pengguna.

## Architecture

```mermaid
flowchart TD
    subgraph Frontend
        A[Create Broadcast Modal] --> B[Account Selector]
        B --> C{Account Changed?}
        C -->|Yes| D[Fetch Channel Defaults]
        C -->|Yes| E[Fetch Stream Keys]
        D --> F[Populate Form Fields]
        E --> G[Populate Stream Key Dropdown]
        F --> H[Show Auto-fill Indicators]
    end
    
    subgraph Backend
        I[/api/youtube/channel-defaults] --> J[YouTubeService.getChannelDefaults]
        K[/api/youtube/streams] --> L[YouTubeService.listStreams]
    end
    
    D --> I
    E --> K
```

## Components and Interfaces

### Frontend Components

#### 1. Create Broadcast Modal (views/youtube.ejs)
- Menghilangkan field Category dari form
- Menambahkan auto-fill indicator untuk title, description, dan tags
- Memastikan semua field memiliki touch target minimum 44px untuk mobile
- Modal scrollable untuk mobile view

#### 2. YouTube Client JavaScript (public/js/youtube.js)
- `fetchChannelDefaults(accountId)`: Fetch default settings dari YouTube API
- `populateFormWithDefaults(defaults)`: Populate form fields dengan data defaults
- `onAccountChange(accountId)`: Handler untuk perubahan account selection
- `renderTags()`: Render tags sebagai chips dengan auto-fill indicator

### Backend Components

#### 1. YouTube Service (services/youtubeService.js)
- `getChannelDefaults(accessToken)`: Mengambil channel branding settings dari YouTube API
  - Returns: `{ title, description, tags[], categoryId }`

#### 2. API Endpoints (app.js)
- `GET /api/youtube/channel-defaults?accountId=`: Endpoint untuk fetch channel defaults
- `GET /api/youtube/streams?accountId=`: Endpoint untuk fetch available stream keys

## Data Models

### Channel Defaults Response
```javascript
{
  success: boolean,
  defaults: {
    title: string,           // Default title dari channel settings
    description: string,     // Default description dari channel settings
    tags: string[],          // Default tags dari channel keywords
    categoryId: string       // Default category (used internally, not shown in UI)
  }
}
```

### Stream Keys Response
```javascript
{
  success: boolean,
  streams: [
    {
      id: string,            // Stream ID
      title: string,         // Stream title
      streamKey: string,     // Stream key value
      rtmpUrl: string,       // RTMP URL
      resolution: string,    // e.g., "1080p"
      frameRate: string      // e.g., "30fps"
    }
  ]
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Form population from channel defaults
*For any* valid channel defaults response containing title, description, or tags, the corresponding form fields SHALL be populated with those values when the response is processed.
**Validates: Requirements 1.2, 1.3, 1.4**

### Property 2: Loading indicator visibility during data fetch
*For any* data fetch operation (channel defaults or stream keys), loading indicators SHALL be visible on affected fields while the request is in progress.
**Validates: Requirements 1.5, 2.2, 5.3**

### Property 3: Auto-fill indicator display
*For any* successfully auto-filled field, an "Auto-filled" indicator SHALL be displayed next to that field, and this behavior SHALL be consistent across desktop and mobile views.
**Validates: Requirements 1.6, 4.2**

### Property 4: Form remains functional on API failure
*For any* API failure (channel defaults or stream keys fetch), the form SHALL remain fully functional allowing manual input, and the stream key dropdown SHALL display "Create new stream key" as the default option.
**Validates: Requirements 1.7, 2.6**

### Property 5: Stream key dropdown population
*For any* valid stream keys response, the dropdown SHALL contain all stream keys with their title, resolution, and frame rate displayed in the option text.
**Validates: Requirements 2.3, 2.4**

### Property 6: Category field removal
*For any* broadcast form (create or edit), the category field SHALL NOT be present in the DOM, and broadcast creation SHALL use a default category value internally.
**Validates: Requirements 3.1, 3.2, 3.3**

### Property 7: Mobile-desktop UI consistency
*For any* form field displayed in the create broadcast modal, the field order and available options SHALL be identical between desktop and mobile views.
**Validates: Requirements 4.1, 4.3**

### Property 8: Touch-friendly input sizes
*For any* interactive element in the mobile broadcast form, the touch target size SHALL be at least 44px in both width and height.
**Validates: Requirements 4.4**

### Property 9: Account change triggers data refresh
*For any* account selection change, both channel defaults and stream keys SHALL be fetched for the newly selected account, and all auto-filled fields SHALL be updated with the new account's data.
**Validates: Requirements 5.1, 5.2, 5.4**

## Error Handling

### API Failure Scenarios

1. **Channel Defaults Fetch Failure**
   - Display toast notification: "Could not load YouTube defaults"
   - Allow manual input for all fields
   - Hide auto-fill indicators

2. **Stream Keys Fetch Failure**
   - Display "Create new stream key" as only option
   - Allow form submission
   - Log error for debugging

3. **Network Timeout**
   - Set timeout to 10 seconds
   - On timeout, treat as API failure
   - Show appropriate error message

### Validation

1. **Empty Defaults**
   - If title is empty, leave field empty for manual input
   - If description is empty, leave field empty
   - If tags array is empty, show empty tags container

## Testing Strategy

### Property-Based Testing Library
- **Library**: Jest with `fast-check` for property-based testing
- **Minimum iterations**: 100 per property test

### Unit Tests
- Test `populateFormWithDefaults()` with various input combinations
- Test `renderTags()` with different tag arrays
- Test loading indicator toggle functions
- Test account change handler

### Property-Based Tests
Each correctness property will be implemented as a property-based test:

1. **Property 1 Test**: Generate random channel defaults objects, verify form population
2. **Property 2 Test**: Generate random loading states, verify indicator visibility
3. **Property 3 Test**: Generate random auto-fill scenarios, verify indicator display
4. **Property 4 Test**: Generate random API error scenarios, verify form functionality
5. **Property 5 Test**: Generate random stream key arrays, verify dropdown content
6. **Property 6 Test**: Verify category field absence in DOM
7. **Property 7 Test**: Compare field order between viewport sizes
8. **Property 8 Test**: Measure touch target sizes for all interactive elements
9. **Property 9 Test**: Generate random account changes, verify data refresh

### Test Annotations
All property-based tests will be annotated with:
```javascript
// **Feature: youtube-autofill-broadcast, Property {number}: {property_text}**
// **Validates: Requirements X.Y**
```
