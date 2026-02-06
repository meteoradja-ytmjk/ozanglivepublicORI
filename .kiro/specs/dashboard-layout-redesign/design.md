# Design Document: Dashboard Layout Redesign

## Overview

Redesign layout dashboard StreamFlow untuk mengadopsi desain modern dengan tiga kolom:
1. **Left Sidebar** (~200px) - Navigasi dengan icon + teks, logo di atas, user profile di bawah
2. **Main Content** - Area konten utama dengan stats cards, welcome message, dan streaming table
3. **Right Panel** (~280px) - Analytics summary dengan metrics dan chart (desktop only)

Desain menggunakan tema dark yang konsisten dengan aplikasi StreamFlow saat ini, dengan penambahan circular progress indicators dan accent colors untuk visual yang lebih menarik.

## Architecture

### Layout Structure

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              Desktop Layout                               │
├─────────────┬────────────────────────────────────┬───────────────────────┤
│   Sidebar   │           Main Content             │   Analytics Panel     │
│   (~200px)  │           (flex-1)                 │      (~280px)         │
├─────────────┼────────────────────────────────────┼───────────────────────┤
│  ┌───────┐  │  ┌─────────────────────────────┐   │  ┌─────────────────┐  │
│  │ Logo  │  │  │ Search Bar    [Icons]       │   │  │ Streaming Stats │  │
│  └───────┘  │  └─────────────────────────────┘   │  │ - Total Streams │  │
│             │  ┌─────────────────────────────┐   │  │ - Total Videos  │  │
│  ┌───────┐  │  │ Hello, Username             │   │  │ - Active Users  │  │
│  │Streams│  │  │ Welcome back!               │   │  │ - Storage Used  │  │
│  │Gallery│  │  └─────────────────────────────┘   │  └─────────────────┘  │
│  │Playlist│ │  ┌────┐ ┌────┐ ┌────┐ ┌────┐      │  ┌─────────────────┐  │
│  │History│  │  │Card│ │Card│ │Card│ │Card│      │  │   Statistics    │  │
│  │Users  │  │  └────┘ └────┘ └────┘ └────┘      │  │   Bar Chart     │  │
│  └───────┘  │  ┌────────────┐ ┌────────────┐    │  └─────────────────┘  │
│             │  │ Secondary  │ │ Secondary  │    │                       │
│  ┌───────┐  │  │ Card + Ring│ │ Card + Ring│    │                       │
│  │Profile│  │  └────────────┘ └────────────┘    │                       │
│  │ Badge │  │  ┌─────────────────────────────┐   │                       │
│  └───────┘  │  │    Streaming Status Table   │   │                       │
└─────────────┴────────────────────────────────────┴───────────────────────┘
```

### Mobile Layout

```
┌─────────────────────────────────┐
│  [Logo]              [Icons]    │  <- Top Header
├─────────────────────────────────┤
│  Hello, Username                │
│  Welcome back!                  │
├─────────────────────────────────┤
│  ┌─────┐ ┌─────┐               │
│  │Card │ │Card │               │  <- Stats Cards (2x2 grid)
│  └─────┘ └─────┘               │
│  ┌─────┐ ┌─────┐               │
│  │Card │ │Card │               │
│  └─────┘ └─────┘               │
├─────────────────────────────────┤
│     Streaming Status Table      │
├─────────────────────────────────┤
│ [Streams][Gallery][Playlist]... │  <- Bottom Navigation
└─────────────────────────────────┘
```

## Components and Interfaces

### 1. Left Sidebar Component (layout.ejs)

**Structure:**
```html
<aside class="sidebar">
  <div class="sidebar-logo">
    <img src="/images/logo.svg" alt="StreamFlow">
    <span>StreamFlow</span>
  </div>
  
  <nav class="sidebar-nav">
    <a href="/dashboard" class="nav-item active">
      <i class="ti ti-broadcast"></i>
      <span>Streams</span>
    </a>
    <!-- More nav items -->
  </nav>
  
  <div class="sidebar-profile">
    <img src="avatar" class="avatar">
    <div class="profile-info">
      <span class="username">Username</span>
      <span class="role-badge">Admin</span>
    </div>
  </div>
</aside>
```

**Styling:**
- Width: 200-220px on desktop
- Background: #1a1a2e or dark-800
- Nav items: padding 12px 16px, hover bg-dark-700
- Active item: bg-primary (#0055FF) or left border accent

### 2. Stats Card Component

**Primary Stats Card:**
```html
<div class="stats-card">
  <div class="stats-header">
    <span class="stats-icon"><i class="ti ti-broadcast"></i></span>
    <span class="stats-label">Active Streams</span>
  </div>
  <div class="stats-value">5</div>
</div>
```

**Secondary Stats Card with Circular Progress:**
```html
<div class="stats-card stats-card--highlighted">
  <div class="stats-content">
    <span class="stats-label">CPU Usage</span>
    <span class="stats-value">55%</span>
  </div>
  <div class="circular-progress" data-value="55">
    <svg><!-- SVG circle --></svg>
  </div>
</div>
```

### 3. Circular Progress Component

**SVG-based circular progress:**
```html
<div class="circular-progress">
  <svg viewBox="0 0 36 36">
    <path class="circle-bg" d="M18 2.0845..."/>
    <path class="circle-progress" stroke-dasharray="55, 100" d="M18 2.0845..."/>
  </svg>
  <span class="progress-text">55%</span>
</div>
```

**Colors:**
- CPU: Cyan (#00d4ff)
- Memory: Purple (#a855f7)
- Network: Green (#22c55e)
- Disk: Orange (#f97316)

### 4. Right Analytics Panel

**Structure:**
```html
<aside class="analytics-panel">
  <h3>Streaming Stats</h3>
  
  <div class="analytics-metrics">
    <div class="metric-item">
      <i class="ti ti-broadcast"></i>
      <div class="metric-info">
        <span class="metric-value">230</span>
        <span class="metric-label">Total Streams</span>
      </div>
    </div>
    <!-- More metrics -->
  </div>
  
  <div class="analytics-chart">
    <h4>Statistics</h4>
    <canvas id="statsChart"></canvas>
  </div>
</aside>
```

### 5. Welcome Header Component

```html
<div class="welcome-header">
  <div class="welcome-text">
    <h1>Hello, <%= username %></h1>
    <p>Welcome back!</p>
  </div>
  <button class="filter-btn">
    <span>Filters</span>
    <i class="ti ti-adjustments"></i>
  </button>
</div>
```

## Data Models

Tidak ada perubahan pada data model. Menggunakan data yang sudah ada:

```javascript
// Session data
req.session.userId
req.session.username
req.session.user_role
req.session.avatar_path

// System metrics (from systemMonitor.js)
{
  cpu: { usage: number },
  memory: { used: number, total: number, percentage: number },
  disk: { used: number, total: number, percentage: number },
  network: { upload: number, download: number }
}

// Analytics data (new endpoint needed)
{
  totalStreams: number,
  totalVideos: number,
  activeUsers: number,
  storageUsed: string,
  weeklyStats: [{ day: string, count: number }]
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Active Navigation Highlighting
*For any* page route and corresponding navigation item, the navigation item matching the current route SHALL have the active class applied.
**Validates: Requirements 1.5**

### Property 2: Role Badge Rendering
*For any* authenticated user with a valid role (admin or member), the sidebar profile section SHALL display the corresponding role badge with correct styling.
**Validates: Requirements 2.3**

### Property 3: Stats Card Structure
*For any* stats card rendered on the dashboard, the card SHALL contain an icon element, a label element, and a value element.
**Validates: Requirements 3.3**

### Property 4: Circular Progress Percentage
*For any* secondary stats card with circular progress, the percentage value SHALL be between 0 and 100 inclusive.
**Validates: Requirements 4.2**

### Property 5: Analytics Panel Metrics
*For any* analytics panel render, the panel SHALL contain metric items for Total Streams, Total Videos, and Storage Used.
**Validates: Requirements 5.2**

### Property 6: Welcome Message Username
*For any* authenticated user viewing the dashboard, the welcome message SHALL contain the user's username.
**Validates: Requirements 6.3**

### Property 7: Responsive Sidebar Collapse
*For any* viewport width less than 1024px, the left sidebar SHALL be collapsed or hidden, and the right analytics panel SHALL not be visible.
**Validates: Requirements 5.4, 7.1, 7.2**

### Property 8: Mobile Bottom Navigation
*For any* viewport width less than 1024px, a bottom navigation bar SHALL be visible with navigation items.
**Validates: Requirements 7.3**

## Error Handling

### Layout Errors
- Missing user session: Redirect to login page
- Missing avatar: Display default avatar image
- Missing role: Default to 'member' badge

### Analytics Data Errors
- API failure: Display "Unable to load" message with retry button
- Empty data: Display zero values with appropriate messaging

### Responsive Errors
- CSS not loading: Ensure inline critical styles for basic layout
- JavaScript disabled: Layout should still be functional without interactive features

## Testing Strategy

### Unit Tests
- Test navigation item active state logic
- Test role badge helper function
- Test circular progress percentage calculation
- Test responsive breakpoint detection

### Property-Based Tests
Library: fast-check (JavaScript property-based testing)

**Property Test 1: Navigation Active State**
- Generate random routes and verify correct nav item is active
- **Feature: dashboard-layout-redesign, Property 1: Active Navigation Highlighting**

**Property Test 2: Role Badge Rendering**
- Generate random users with valid roles
- Verify badge HTML contains correct class for each role
- **Feature: dashboard-layout-redesign, Property 2: Role Badge Rendering**

**Property Test 3: Stats Card Structure**
- Generate random stats data
- Verify rendered card contains required elements
- **Feature: dashboard-layout-redesign, Property 3: Stats Card Structure**

**Property Test 4: Circular Progress Bounds**
- Generate random percentage values
- Verify values are clamped to 0-100 range
- **Feature: dashboard-layout-redesign, Property 4: Circular Progress Percentage**

**Property Test 5: Welcome Message**
- Generate random usernames
- Verify welcome message contains the username
- **Feature: dashboard-layout-redesign, Property 6: Welcome Message Username**

### Integration Tests
- Test full page render with mock session data
- Test responsive layout at different viewport sizes
- Test analytics panel data loading

