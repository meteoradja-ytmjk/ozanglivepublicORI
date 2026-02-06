# Auto-Admin Setup

## Overview

This StreamFlow instance is configured to automatically create a default admin account during installation. This eliminates the need for manual account setup when first launching the application.

## Default Credentials

When the application is installed for the first time (no active admin exists), it will automatically create:

- **Username**: `ozang88`
- **Password**: `Moejokerto#88`
- **Role**: Admin (full system access)
- **Status**: Active

## First Login

1. Start the application
2. Navigate to the login page (`http://localhost:7575/login`)
3. Enter the default credentials above
4. You will be logged in automatically without seeing the "Complete Your Account" setup page

## Security Recommendations

> **⚠️ IMPORTANT SECURITY NOTICE**
> 
> The default admin credentials are hardcoded in the application. Anyone with access to the source code can see these credentials.

**We strongly recommend:**

1. **Change the password immediately after first login**
   - Go to your profile settings
   - Update to a strong, unique password
   
2. **Consider changing the username** (if desired)
   - You can create a new admin account with your preferred username
   - Then delete or deactivate the default `ozang88` account

3. **Do not use default credentials in production** unless absolutely necessary

## How It Works

The auto-admin creation is handled by the `createDefaultAdminIfNeeded()` function in `db/database.js`:

1. After database tables are created, the system checks if any active admin exists
2. If no admin is found, it automatically creates the default admin account
3. The password is properly hashed using bcrypt before storage
4. If the username already exists but is not an active admin, it will be updated to active admin status

## Disabling Auto-Admin Creation

If you want to disable this feature and return to manual admin setup:

1. Open `db/database.js`
2. Find the `createTables()` function (around line 119)
3. Comment out or remove this line:
   ```javascript
   await createDefaultAdminIfNeeded();
   ```
4. Restart the application

## Logs

When the default admin is created, you will see these messages in the console:

```
[Database] No admin found. Creating default admin account...
[Database] Default admin created successfully
[Database] Login credentials - Username: ozang88, Password: Moejokerto#88
[Database] IMPORTANT: Please change the default password after first login for security!
```

If an active admin already exists:

```
[Database] Active admin already exists, skipping default admin creation
```

## Troubleshooting

### I can't login with the default credentials

1. Check if an admin already exists:
   ```bash
   node check-admin.js
   ```

2. If you see "NO ACTIVE ADMIN FOUND", the auto-creation might have failed. Check the console logs for errors.

3. You can manually create or reset the admin using:
   ```bash
   node fix-admin-complete.js
   ```

### The setup page still appears

If you're still seeing the "Complete Your Account" page:

1. Ensure the application has been restarted after the code changes
2. Check that an active admin exists in the database
3. Clear your browser cache and cookies
4. Try accessing `/login` directly instead of going to the root URL
