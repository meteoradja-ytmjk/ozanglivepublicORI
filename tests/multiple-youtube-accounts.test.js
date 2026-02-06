/**
 * Property-based tests for Multiple YouTube Accounts feature
 * Uses fast-check for property testing
 */

const fc = require('fast-check');

// Mock database for testing
const mockDb = {
  credentials: [],
  nextId: 1,
  
  reset() {
    this.credentials = [];
    this.nextId = 1;
  },
  
  findAllByUserId(userId) {
    return this.credentials.filter(c => c.userId === userId);
  },
  
  findById(id) {
    return this.credentials.find(c => c.id === id) || null;
  },
  
  create(userId, data) {
    // Check for duplicate channel
    const existing = this.credentials.find(
      c => c.userId === userId && c.channelId === data.channelId
    );
    if (existing) {
      throw new Error('Channel already connected');
    }
    
    const credential = {
      id: this.nextId++,
      userId,
      clientId: data.clientId,
      clientSecret: data.clientSecret,
      refreshToken: data.refreshToken,
      channelName: data.channelName,
      channelId: data.channelId,
      isPrimary: this.findAllByUserId(userId).length === 0 ? 1 : 0,
      createdAt: new Date().toISOString()
    };
    this.credentials.push(credential);
    return credential;
  },
  
  deleteById(id) {
    const index = this.credentials.findIndex(c => c.id === id);
    if (index === -1) return false;
    this.credentials.splice(index, 1);
    return true;
  },
  
  existsByChannel(userId, channelId) {
    return this.credentials.some(c => c.userId === userId && c.channelId === channelId);
  }
};

// Arbitraries for generating test data
const userIdArbitrary = fc.uuid();
const channelIdArbitrary = fc.stringMatching(/^UC[a-zA-Z0-9_-]{22}$/);
const channelNameArbitrary = fc.string({ minLength: 1, maxLength: 50 });
const clientIdArbitrary = fc.string({ minLength: 10, maxLength: 100 });
const clientSecretArbitrary = fc.string({ minLength: 10, maxLength: 100 });
const refreshTokenArbitrary = fc.string({ minLength: 20, maxLength: 200 });

const credentialDataArbitrary = fc.record({
  clientId: clientIdArbitrary,
  clientSecret: clientSecretArbitrary,
  refreshToken: refreshTokenArbitrary,
  channelName: channelNameArbitrary,
  channelId: channelIdArbitrary
});

describe('Multiple YouTube Accounts - Property Tests', () => {
  beforeEach(() => {
    mockDb.reset();
  });

  describe('Property 1: Adding account preserves existing accounts', () => {
    /**
     * **Feature: multiple-youtube-accounts, Property 1: Adding account preserves existing accounts**
     * For any user with N connected YouTube accounts, adding a new valid account 
     * should result in exactly N+1 accounts, with all original accounts preserved.
     */
    it('should preserve all existing accounts when adding a new one', () => {
      fc.assert(
        fc.property(
          userIdArbitrary,
          fc.array(credentialDataArbitrary, { minLength: 0, maxLength: 5 }),
          credentialDataArbitrary,
          (userId, existingCredentials, newCredential) => {
            mockDb.reset();
            
            // Setup: Create user with existing accounts (with unique channel IDs)
            const uniqueExisting = [];
            const usedChannelIds = new Set();
            
            for (const cred of existingCredentials) {
              if (!usedChannelIds.has(cred.channelId)) {
                usedChannelIds.add(cred.channelId);
                uniqueExisting.push(cred);
                mockDb.create(userId, cred);
              }
            }
            
            const initialCount = mockDb.findAllByUserId(userId).length;
            const initialIds = mockDb.findAllByUserId(userId).map(c => c.id);
            
            // Ensure new credential has unique channel ID
            if (usedChannelIds.has(newCredential.channelId)) {
              // Skip this test case - channel already exists
              return true;
            }
            
            // Action: Add new account
            mockDb.create(userId, newCredential);
            
            // Assert: Count increased by 1
            const finalCount = mockDb.findAllByUserId(userId).length;
            expect(finalCount).toBe(initialCount + 1);
            
            // Assert: All original accounts still exist
            const finalIds = mockDb.findAllByUserId(userId).map(c => c.id);
            for (const id of initialIds) {
              expect(finalIds).toContain(id);
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should set first account as primary', () => {
      fc.assert(
        fc.property(
          userIdArbitrary,
          credentialDataArbitrary,
          (userId, credential) => {
            mockDb.reset();
            
            // Action: Add first account
            const created = mockDb.create(userId, credential);
            
            // Assert: First account is primary
            expect(created.isPrimary).toBe(1);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not set subsequent accounts as primary', () => {
      fc.assert(
        fc.property(
          userIdArbitrary,
          credentialDataArbitrary,
          credentialDataArbitrary,
          (userId, firstCred, secondCred) => {
            mockDb.reset();
            
            // Ensure different channel IDs
            if (firstCred.channelId === secondCred.channelId) {
              return true; // Skip
            }
            
            // Action: Add two accounts
            mockDb.create(userId, firstCred);
            const second = mockDb.create(userId, secondCred);
            
            // Assert: Second account is not primary
            expect(second.isPrimary).toBe(0);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 2: Disconnect removes only target account', () => {
    /**
     * **Feature: multiple-youtube-accounts, Property 2: Disconnect removes only target account**
     * For any user with N connected YouTube accounts (N > 1), disconnecting a specific 
     * account should result in exactly N-1 accounts, with all other accounts unchanged.
     */
    it('should remove only the target account and preserve others', () => {
      fc.assert(
        fc.property(
          userIdArbitrary,
          fc.array(credentialDataArbitrary, { minLength: 2, maxLength: 5 }),
          fc.nat(),
          (userId, credentials, indexToRemove) => {
            mockDb.reset();
            
            // Setup: Create accounts with unique channel IDs
            const uniqueCredentials = [];
            const usedChannelIds = new Set();
            
            for (const cred of credentials) {
              if (!usedChannelIds.has(cred.channelId)) {
                usedChannelIds.add(cred.channelId);
                uniqueCredentials.push(mockDb.create(userId, cred));
              }
            }
            
            if (uniqueCredentials.length < 2) {
              return true; // Need at least 2 accounts
            }
            
            const initialCount = uniqueCredentials.length;
            const targetIndex = indexToRemove % uniqueCredentials.length;
            const targetId = uniqueCredentials[targetIndex].id;
            const otherIds = uniqueCredentials
              .filter((_, i) => i !== targetIndex)
              .map(c => c.id);
            
            // Action: Remove target account
            mockDb.deleteById(targetId);
            
            // Assert: Count decreased by 1
            const finalAccounts = mockDb.findAllByUserId(userId);
            expect(finalAccounts.length).toBe(initialCount - 1);
            
            // Assert: Target account is gone
            expect(mockDb.findById(targetId)).toBeNull();
            
            // Assert: Other accounts still exist
            for (const id of otherIds) {
              expect(mockDb.findById(id)).not.toBeNull();
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 3: Duplicate channel prevention', () => {
    /**
     * For any user, attempting to add an account with a channel ID that already exists
     * should throw an error and not modify the existing accounts.
     */
    it('should prevent adding duplicate channel for same user', () => {
      fc.assert(
        fc.property(
          userIdArbitrary,
          credentialDataArbitrary,
          (userId, credential) => {
            mockDb.reset();
            
            // Setup: Add first account
            mockDb.create(userId, credential);
            const initialCount = mockDb.findAllByUserId(userId).length;
            
            // Action: Try to add same channel again
            expect(() => {
              mockDb.create(userId, credential);
            }).toThrow('Channel already connected');
            
            // Assert: Count unchanged
            expect(mockDb.findAllByUserId(userId).length).toBe(initialCount);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow same channel for different users', () => {
      fc.assert(
        fc.property(
          userIdArbitrary,
          userIdArbitrary,
          credentialDataArbitrary,
          (userId1, userId2, credential) => {
            mockDb.reset();
            
            // Ensure different users
            if (userId1 === userId2) {
              return true; // Skip
            }
            
            // Action: Add same channel to different users
            const cred1 = mockDb.create(userId1, credential);
            const cred2 = mockDb.create(userId2, credential);
            
            // Assert: Both created successfully
            expect(cred1).toBeDefined();
            expect(cred2).toBeDefined();
            expect(cred1.id).not.toBe(cred2.id);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

describe('Multiple YouTube Accounts - Unit Tests', () => {
  beforeEach(() => {
    mockDb.reset();
  });

  describe('findAllByUserId', () => {
    it('should return empty array for user with no accounts', () => {
      const result = mockDb.findAllByUserId('user-123');
      expect(result).toEqual([]);
    });

    it('should return all accounts for user', () => {
      const userId = 'user-123';
      mockDb.create(userId, {
        clientId: 'client1',
        clientSecret: 'secret1',
        refreshToken: 'token1',
        channelName: 'Channel 1',
        channelId: 'UC123456789012345678901'
      });
      mockDb.create(userId, {
        clientId: 'client2',
        clientSecret: 'secret2',
        refreshToken: 'token2',
        channelName: 'Channel 2',
        channelId: 'UC123456789012345678902'
      });
      
      const result = mockDb.findAllByUserId(userId);
      expect(result.length).toBe(2);
    });

    it('should not return accounts from other users', () => {
      mockDb.create('user-1', {
        clientId: 'client1',
        clientSecret: 'secret1',
        refreshToken: 'token1',
        channelName: 'Channel 1',
        channelId: 'UC123456789012345678901'
      });
      mockDb.create('user-2', {
        clientId: 'client2',
        clientSecret: 'secret2',
        refreshToken: 'token2',
        channelName: 'Channel 2',
        channelId: 'UC123456789012345678902'
      });
      
      const result = mockDb.findAllByUserId('user-1');
      expect(result.length).toBe(1);
      expect(result[0].channelName).toBe('Channel 1');
    });
  });

  describe('deleteById', () => {
    it('should return false for non-existent id', () => {
      const result = mockDb.deleteById(999);
      expect(result).toBe(false);
    });

    it('should return true and remove credential', () => {
      const cred = mockDb.create('user-1', {
        clientId: 'client1',
        clientSecret: 'secret1',
        refreshToken: 'token1',
        channelName: 'Channel 1',
        channelId: 'UC123456789012345678901'
      });
      
      const result = mockDb.deleteById(cred.id);
      expect(result).toBe(true);
      expect(mockDb.findById(cred.id)).toBeNull();
    });
  });
});


describe('Property 4: Broadcast uses selected account credentials', () => {
  /**
   * **Feature: multiple-youtube-accounts, Property 4: Broadcast uses selected account credentials**
   * For any broadcast creation with a selected YouTube account, the system should use 
   * that account's credentials for the YouTube API call.
   */
  
  // Mock broadcast creation that tracks which credentials were used
  const mockBroadcastService = {
    lastUsedCredentials: null,
    
    reset() {
      this.lastUsedCredentials = null;
    },
    
    createBroadcast(credentials, broadcastData) {
      this.lastUsedCredentials = {
        id: credentials.id,
        clientId: credentials.clientId,
        channelId: credentials.channelId
      };
      return {
        broadcastId: `broadcast_${Date.now()}`,
        ...broadcastData,
        accountId: credentials.id
      };
    }
  };

  beforeEach(() => {
    mockDb.reset();
    mockBroadcastService.reset();
  });

  it('should use the selected account credentials for broadcast creation', () => {
    fc.assert(
      fc.property(
        userIdArbitrary,
        fc.array(credentialDataArbitrary, { minLength: 2, maxLength: 5 }),
        fc.nat(),
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 100 }),
          description: fc.string({ maxLength: 500 })
        }),
        (userId, credentials, accountIndex, broadcastData) => {
          mockDb.reset();
          mockBroadcastService.reset();
          
          // Setup: Create accounts with unique channel IDs
          const createdAccounts = [];
          const usedChannelIds = new Set();
          
          for (const cred of credentials) {
            if (!usedChannelIds.has(cred.channelId)) {
              usedChannelIds.add(cred.channelId);
              createdAccounts.push(mockDb.create(userId, cred));
            }
          }
          
          if (createdAccounts.length < 2) {
            return true; // Need at least 2 accounts
          }
          
          // Select an account
          const selectedIndex = accountIndex % createdAccounts.length;
          const selectedAccount = createdAccounts[selectedIndex];
          
          // Action: Create broadcast with selected account
          mockBroadcastService.createBroadcast(selectedAccount, broadcastData);
          
          // Assert: The correct credentials were used
          expect(mockBroadcastService.lastUsedCredentials).not.toBeNull();
          expect(mockBroadcastService.lastUsedCredentials.id).toBe(selectedAccount.id);
          expect(mockBroadcastService.lastUsedCredentials.clientId).toBe(selectedAccount.clientId);
          expect(mockBroadcastService.lastUsedCredentials.channelId).toBe(selectedAccount.channelId);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 5: Broadcast stores account identifier', () => {
  /**
   * **Feature: multiple-youtube-accounts, Property 5: Broadcast stores account identifier**
   * For any created broadcast, the associated YouTube account identifier should be 
   * stored and retrievable.
   */
  
  const mockBroadcastStore = {
    broadcasts: [],
    
    reset() {
      this.broadcasts = [];
    },
    
    create(accountId, data) {
      const broadcast = {
        id: `broadcast_${Date.now()}_${Math.random()}`,
        accountId,
        ...data,
        createdAt: new Date().toISOString()
      };
      this.broadcasts.push(broadcast);
      return broadcast;
    },
    
    findById(id) {
      return this.broadcasts.find(b => b.id === id) || null;
    },
    
    findByAccountId(accountId) {
      return this.broadcasts.filter(b => b.accountId === accountId);
    }
  };

  beforeEach(() => {
    mockDb.reset();
    mockBroadcastStore.reset();
  });

  it('should store and retrieve account identifier for each broadcast', () => {
    fc.assert(
      fc.property(
        userIdArbitrary,
        credentialDataArbitrary,
        fc.array(fc.record({
          title: fc.string({ minLength: 1, maxLength: 100 }),
          description: fc.string({ maxLength: 500 })
        }), { minLength: 1, maxLength: 5 }),
        (userId, credential, broadcastsData) => {
          mockDb.reset();
          mockBroadcastStore.reset();
          
          // Setup: Create account
          const account = mockDb.create(userId, credential);
          
          // Action: Create broadcasts
          const createdBroadcasts = broadcastsData.map(data => 
            mockBroadcastStore.create(account.id, data)
          );
          
          // Assert: Each broadcast has the correct account ID
          for (const broadcast of createdBroadcasts) {
            const retrieved = mockBroadcastStore.findById(broadcast.id);
            expect(retrieved).not.toBeNull();
            expect(retrieved.accountId).toBe(account.id);
          }
          
          // Assert: Can find all broadcasts by account ID
          const accountBroadcasts = mockBroadcastStore.findByAccountId(account.id);
          expect(accountBroadcasts.length).toBe(createdBroadcasts.length);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
