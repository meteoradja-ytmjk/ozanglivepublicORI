/**
 * Simple test runner for member permission control
 * Run with: node tests/run-permission-test.js
 */

const fc = require('fast-check');

// Mock database for testing
const mockDb = {
  users: new Map(),
  videos: new Map()
};

// Mock User model
const MockUser = {
  create: async (userData) => {
    const userId = userData.id || `user-${Date.now()}-${Math.random()}`;
    const user = {
      id: userId,
      username: userData.username,
      password: userData.password,
      user_role: userData.user_role || 'member',
      status: userData.status || 'active',
      can_view_videos: userData.can_view_videos !== undefined ? userData.can_view_videos : 1,
      can_download_videos: userData.can_download_videos !== undefined ? userData.can_download_videos : 1,
      can_delete_videos: userData.can_delete_videos !== undefined ? userData.can_delete_videos : 1
    };
    mockDb.users.set(userId, user);
    return user;
  },

  findById: async (userId) => mockDb.users.get(userId) || null,

  updatePermission: async (userId, permission, value) => {
    const validPermissions = ['can_view_videos', 'can_download_videos', 'can_delete_videos'];
    if (!validPermissions.includes(permission)) throw new Error('Invalid permission type');
    
    const user = mockDb.users.get(userId);
    if (!user) throw new Error('User not found');
    
    const permValue = value ? 1 : 0;
    user[permission] = permValue;
    mockDb.users.set(userId, user);
    return { id: userId, [permission]: permValue, changes: 1 };
  },

  bulkUpdatePermissions: async (userIds, permissions) => {
    if (!userIds || userIds.length === 0) throw new Error('No users selected');
    const validPermissions = ['can_view_videos', 'can_download_videos', 'can_delete_videos'];
    let updatedCount = 0;

    for (const userId of userIds) {
      const user = mockDb.users.get(userId);
      if (user) {
        for (const [key, value] of Object.entries(permissions)) {
          if (validPermissions.includes(key)) user[key] = value ? 1 : 0;
        }
        mockDb.users.set(userId, user);
        updatedCount++;
      }
    }
    return { updatedCount, userIds };
  },

  getPermissions: async (userId) => {
    const user = mockDb.users.get(userId);
    if (!user) return null;
    return {
      can_view_videos: user.can_view_videos === 1,
      can_download_videos: user.can_download_videos === 1,
      can_delete_videos: user.can_delete_videos === 1
    };
  }
};

// Permission middleware
const createPermissionMiddleware = (permissionField) => async (userId) => {
  const user = mockDb.users.get(userId);
  if (!user) return { allowed: false, error: 'User not found' };
  if (user.user_role === 'admin') return { allowed: true };
  const hasPermission = user[permissionField] === 1;
  return { allowed: hasPermission, error: hasPermission ? null : `You don't have permission` };
};

const canViewVideos = createPermissionMiddleware('can_view_videos');
const canDownloadVideos = createPermissionMiddleware('can_download_videos');
const canDeleteVideos = createPermissionMiddleware('can_delete_videos');

// Test runner
let passed = 0;
let failed = 0;

async function runTest(name, testFn) {
  mockDb.users.clear();
  mockDb.videos.clear();
  try {
    await testFn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (error) {
    console.log(`✕ ${name}`);
    console.log(`  Error: ${error.message}`);
    failed++;
  }
}

async function runAllTests() {
  console.log('\n=== Member Permission Control Tests ===\n');

  // Property 5: Default Permissions
  await runTest('Property 5: New users have all permissions enabled', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (userId) => {
        const user = await MockUser.create({ id: userId, username: `user_${userId.slice(0,8)}`, password: 'test' });
        if (user.can_view_videos !== 1) throw new Error('can_view_videos not 1');
        if (user.can_download_videos !== 1) throw new Error('can_download_videos not 1');
        if (user.can_delete_videos !== 1) throw new Error('can_delete_videos not 1');
      }),
      { numRuns: 50 }
    );
  });

  // Property 4: Permission Persistence
  await runTest('Property 4: Permission changes persist immediately', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.constantFrom('can_view_videos', 'can_download_videos', 'can_delete_videos'),
        fc.boolean(),
        async (userId, permission, value) => {
          await MockUser.create({ id: userId, username: `user_${userId.slice(0,8)}`, password: 'test' });
          await MockUser.updatePermission(userId, permission, value);
          const perms = await MockUser.getPermissions(userId);
          if (perms[permission] !== value) throw new Error(`Expected ${value}, got ${perms[permission]}`);
        }
      ),
      { numRuns: 50 }
    );
  });

  // Property 1: View Permission
  await runTest('Property 1: View permission enforcement', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), fc.boolean(), async (userId, hasPermission) => {
        await MockUser.create({ id: userId, username: `user_${userId.slice(0,8)}`, password: 'test', can_view_videos: hasPermission ? 1 : 0 });
        const result = await canViewVideos(userId);
        if (result.allowed !== hasPermission) throw new Error(`Expected allowed=${hasPermission}`);
      }),
      { numRuns: 50 }
    );
  });

  // Property 2: Download Permission
  await runTest('Property 2: Download permission enforcement', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), fc.boolean(), async (userId, hasPermission) => {
        await MockUser.create({ id: userId, username: `user_${userId.slice(0,8)}`, password: 'test', can_download_videos: hasPermission ? 1 : 0 });
        const result = await canDownloadVideos(userId);
        if (result.allowed !== hasPermission) throw new Error(`Expected allowed=${hasPermission}`);
      }),
      { numRuns: 50 }
    );
  });

  // Property 3: Delete Permission
  await runTest('Property 3: Delete permission enforcement', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), fc.boolean(), async (userId, hasPermission) => {
        await MockUser.create({ id: userId, username: `user_${userId.slice(0,8)}`, password: 'test', can_delete_videos: hasPermission ? 1 : 0 });
        const result = await canDeleteVideos(userId);
        if (result.allowed !== hasPermission) throw new Error(`Expected allowed=${hasPermission}`);
      }),
      { numRuns: 50 }
    );
  });

  // Property 6: Bulk Update
  await runTest('Property 6: Bulk permission update consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
        fc.record({ can_view_videos: fc.boolean(), can_download_videos: fc.boolean(), can_delete_videos: fc.boolean() }),
        async (userIds, permissions) => {
          for (const userId of userIds) {
            await MockUser.create({ id: userId, username: `user_${userId.slice(0,8)}`, password: 'test' });
          }
          const result = await MockUser.bulkUpdatePermissions(userIds, permissions);
          if (result.updatedCount !== userIds.length) throw new Error('Not all users updated');
          for (const userId of userIds) {
            const perms = await MockUser.getPermissions(userId);
            if (perms.can_view_videos !== permissions.can_view_videos) throw new Error('can_view_videos mismatch');
            if (perms.can_download_videos !== permissions.can_download_videos) throw new Error('can_download_videos mismatch');
            if (perms.can_delete_videos !== permissions.can_delete_videos) throw new Error('can_delete_videos mismatch');
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  // Admin override test
  await runTest('Admin users always have all permissions', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), fc.boolean(), fc.boolean(), fc.boolean(), async (userId, v, d, del) => {
        await MockUser.create({ id: userId, username: `admin_${userId.slice(0,8)}`, password: 'test', user_role: 'admin', can_view_videos: v?1:0, can_download_videos: d?1:0, can_delete_videos: del?1:0 });
        const viewRes = await canViewVideos(userId);
        const downloadRes = await canDownloadVideos(userId);
        const deleteRes = await canDeleteVideos(userId);
        if (!viewRes.allowed || !downloadRes.allowed || !deleteRes.allowed) throw new Error('Admin should have all permissions');
      }),
      { numRuns: 50 }
    );
  });

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runAllTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
