# Design Document: Auto-Approve Registration

## Overview

Fitur ini menambahkan pengaturan sistem untuk auto-approve registrasi user baru dan konfigurasi default live limit. Admin dapat mengaktifkan/menonaktifkan auto-approve melalui toggle di halaman Settings. Ketika diaktifkan, user baru akan langsung mendapat status "active" tanpa perlu approval manual. Admin juga dapat mengatur default live limit dimana nilai 0 berarti unlimited.

## Architecture

Fitur ini menggunakan arsitektur yang sudah ada:
- **SystemSettings Model**: Menyimpan konfigurasi `auto_approve_registration` dan `default_live_limit`
- **Settings Page (UI)**: Menampilkan toggle auto-approve dan input default live limit di tab System
- **Signup Endpoint**: Membaca setting untuk menentukan status user baru dan live limit

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Settings UI    │────▶│  API Endpoints   │────▶│ SystemSettings  │
│  (Toggle/Input) │     │  /api/settings/* │     │    Model        │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                          │
                                                          ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Signup Form    │────▶│  POST /signup    │────▶│   User.create   │
│                 │     │  (reads setting) │     │   (with status) │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## Components and Interfaces

### 1. SystemSettings Model Extensions

Menambahkan method baru di `models/SystemSettings.js`:

```javascript
// Get auto-approve setting
static async getAutoApproveRegistration() {
  const value = await this.get('auto_approve_registration');
  return value === 'enabled';
}

// Set auto-approve setting
static async setAutoApproveRegistration(enabled) {
  return this.set('auto_approve_registration', enabled ? 'enabled' : 'disabled');
}

// Get default live limit (0 = unlimited)
static async getDefaultLiveLimitForRegistration() {
  const value = await this.get('default_live_limit_registration');
  if (value === null) return 0; // Default unlimited
  const parsed = parseInt(value, 10);
  return isNaN(parsed) || parsed < 0 ? 0 : parsed;
}

// Set default live limit for registration
static async setDefaultLiveLimitForRegistration(limit) {
  const validLimit = Math.max(0, parseInt(limit, 10) || 0);
  return this.set('default_live_limit_registration', validLimit.toString());
}
```

### 2. API Endpoints

#### GET /api/settings/auto-approve
Returns current auto-approve setting.

Response:
```json
{
  "success": true,
  "enabled": false
}
```

#### POST /api/settings/auto-approve
Updates auto-approve setting.

Request:
```json
{
  "enabled": true
}
```

Response:
```json
{
  "success": true,
  "message": "Auto-approve setting updated"
}
```

#### GET /api/settings/default-live-limit-registration
Returns default live limit for new registrations.

Response:
```json
{
  "success": true,
  "limit": 0,
  "isUnlimited": true
}
```

#### POST /api/settings/default-live-limit-registration
Updates default live limit for new registrations.

Request:
```json
{
  "limit": 5
}
```

### 3. UI Components (Settings Page)

Menambahkan section baru di tab System pada `views/settings.ejs`:

```html
<!-- User Registration Settings -->
<div class="bg-dark-700 rounded-lg p-4 mt-6">
  <h4 class="text-md font-medium mb-4 flex items-center">
    <i class="ti ti-user-plus mr-2 text-green-400"></i>
    User Registration Settings
  </h4>
  
  <!-- Auto-Approve Toggle -->
  <div class="flex items-center justify-between mb-4">
    <div>
      <label class="text-sm font-medium text-gray-300">Auto-Approve New Users</label>
      <p class="text-xs text-gray-500">New users will be automatically activated</p>
    </div>
    <label class="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" id="auto-approve-toggle" class="sr-only peer">
      <div class="toggle-switch"></div>
    </label>
  </div>
  
  <!-- Default Live Limit -->
  <div class="space-y-2">
    <label class="text-sm font-medium text-gray-300">Default Live Limit</label>
    <div class="flex items-center gap-3">
      <input type="number" id="default-live-limit-reg" min="0" value="0">
      <button id="save-live-limit-reg">Save</button>
    </div>
    <p class="text-xs text-gray-500">Set to 0 for unlimited</p>
  </div>
</div>
```

### 4. Signup Endpoint Modification

Modifikasi `POST /signup` di `app.js`:

```javascript
app.post('/signup', upload.single('avatar'), async (req, res) => {
  // ... existing validation ...
  
  // Get auto-approve setting
  const autoApprove = await SystemSettings.getAutoApproveRegistration();
  const defaultLiveLimit = await SystemSettings.getDefaultLiveLimitForRegistration();
  
  const newUser = await User.create({
    username,
    password,
    avatar_path: avatarPath,
    user_role: 'member',
    status: autoApprove ? 'active' : 'inactive',
    live_limit: defaultLiveLimit === 0 ? null : defaultLiveLimit
  });
  
  // Show appropriate message
  const successMessage = autoApprove 
    ? 'Account created successfully! You can now login.'
    : 'Account created successfully! Please wait for admin approval.';
  
  return res.render('signup', { success: successMessage });
});
```

## Data Models

### System Settings Keys

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `auto_approve_registration` | string | "disabled" | "enabled" or "disabled" |
| `default_live_limit_registration` | string | "0" | Number as string, 0 = unlimited |

### User Model (existing)

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | "active" or "inactive" |
| `live_limit` | integer/null | null = unlimited, number = limit |

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Auto-approve setting persistence
*For any* boolean value (true/false), when admin sets auto-approve setting, reading the setting back should return the same value.
**Validates: Requirements 1.2, 1.3**

### Property 2: User status matches auto-approve setting
*For any* user registration, the created user's status should be "active" if auto-approve is enabled, and "inactive" if disabled.
**Validates: Requirements 2.1, 2.2**

### Property 3: Default live limit application
*For any* user registration, the created user's live_limit should be NULL when default is 0, or the configured number otherwise.
**Validates: Requirements 2.5, 2.6**

### Property 4: Default values on fresh system
*For any* fresh system without settings configured, auto-approve should return false and default live limit should return 0.
**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Error Handling

| Scenario | Handling |
|----------|----------|
| Database error reading settings | Return default values (disabled, 0) |
| Invalid live limit input | Coerce to 0 (unlimited) |
| Non-admin accessing settings API | Return 403 Forbidden |
| Missing CSRF token | Return 403 Forbidden |

## Testing Strategy

### Unit Tests
- Test SystemSettings.getAutoApproveRegistration() returns correct boolean
- Test SystemSettings.setAutoApproveRegistration() persists value
- Test SystemSettings.getDefaultLiveLimitForRegistration() returns correct number
- Test default values when settings don't exist

### Property-Based Tests (using fast-check)
- Property 1: Round-trip test for auto-approve setting
- Property 2: User creation status matches setting
- Property 3: Live limit application correctness
- Property 4: Default value consistency

### Integration Tests
- Full signup flow with auto-approve enabled
- Full signup flow with auto-approve disabled
- Settings UI interaction
