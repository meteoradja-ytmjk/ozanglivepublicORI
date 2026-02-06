/**
 * Unlist Replay Service
 * 
 * Handles automatic unlisting of YouTube live replays after stream ends.
 * Uses delayed retry mechanism to wait for YouTube to finish processing the replay.
 * 
 * Why this service exists:
 * - YouTube API doesn't support "auto unlist on end" setting during broadcast creation
 * - Replays need time to process after stream ends before they can be unlisted
 * - We need retry logic to handle processing delays
 */

const youtubeService = require('./youtubeService');
const YouTubeCredentials = require('../models/YouTubeCredentials');
const YouTubeBroadcastSettings = require('../models/YouTubeBroadcastSettings');

// Retry configuration
const INITIAL_DELAY_MS = 60000; // Wait 1 minute after stream ends
const RETRY_DELAY_MS = 30000; // 30 seconds between retries
const MAX_RETRIES = 5; // Try up to 5 times (total ~3.5 minutes)

class UnlistReplayService {
  constructor() {
    // Map of videoId -> { timeoutId, retryCount, userId }
    this.pendingUnlists = new Map();
  }

  /**
   * Schedule unlist for a broadcast replay
   * @param {string} videoId - YouTube video/broadcast ID
   * @param {string} userId - User ID (for credentials)
   * @param {number} delayMs - Initial delay before first attempt (default: 1 minute)
   */
  scheduleUnlist(videoId, userId, delayMs = INITIAL_DELAY_MS) {
    // Validate inputs
    if (!videoId || !userId) {
      console.error('[UnlistReplayService] Missing videoId or userId');
      return;
    }
    
    // Check if already scheduled
    if (this.pendingUnlists.has(videoId)) {
      console.log(`[UnlistReplayService] Unlist already scheduled for video ${videoId}`);
      return;
    }

    console.log(`[UnlistReplayService] Scheduling unlist for video ${videoId} in ${delayMs / 1000}s`);

    const timeoutId = setTimeout(async () => {
      await this.attemptUnlist(videoId, userId, 0);
    }, delayMs);

    this.pendingUnlists.set(videoId, {
      timeoutId,
      retryCount: 0,
      userId,
      scheduledAt: Date.now()
    });
    
    // Safety: Auto-cleanup after 10 minutes to prevent memory leak
    const cleanupTimeoutId = setTimeout(() => {
      if (this.pendingUnlists.has(videoId)) {
        console.warn(`[UnlistReplayService] Auto-cleanup: Removing stale entry for video ${videoId}`);
        this.cancelUnlist(videoId);
      }
    }, 10 * 60 * 1000); // 10 minutes
    
    const pending = this.pendingUnlists.get(videoId);
    if (pending) {
      pending.cleanupTimeoutId = cleanupTimeoutId;
    }
  }

  /**
   * Attempt to unlist a video with retry logic
   * @param {string} videoId - YouTube video/broadcast ID
   * @param {string} userId - User ID
   * @param {number} retryCount - Current retry count
   */
  async attemptUnlist(videoId, userId, retryCount) {
    let shouldRetry = false;
    
    try {
      console.log(`[UnlistReplayService] Attempting to unlist video ${videoId} (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);

      // Get user credentials
      const credentials = await YouTubeCredentials.findByUserId(userId);
      if (!credentials) {
        console.error(`[UnlistReplayService] No YouTube credentials found for user ${userId}`);
        this.cancelUnlist(videoId);
        return;
      }

      // Get access token - use correct field names (camelCase)
      let accessToken;
      try {
        accessToken = await youtubeService.getAccessToken(
          credentials.clientId,
          credentials.clientSecret,
          credentials.refreshToken
        );
      } catch (tokenError) {
        console.error(`[UnlistReplayService] Failed to get access token: ${tokenError.message}`);
        
        // Don't retry on token errors (likely expired credentials)
        if (tokenError.message?.includes('TOKEN_EXPIRED') || tokenError.message?.includes('invalid_grant')) {
          console.error(`[UnlistReplayService] Token expired for user ${userId}, giving up`);
          this.cancelUnlist(videoId);
          return;
        }
        
        // Retry on network errors
        shouldRetry = retryCount < MAX_RETRIES;
        throw tokenError;
      }

      // Attempt to unlist
      const result = await youtubeService.unlistBroadcast(accessToken, videoId, retryCount);

      if (result.success) {
        console.log(`[UnlistReplayService] Successfully unlisted video ${videoId}`);
        this.cancelUnlist(videoId);
        return;
      }

      // Check if we should retry based on result
      if (result.needsRetry && retryCount < MAX_RETRIES) {
        shouldRetry = true;
        console.log(`[UnlistReplayService] Video ${videoId} not ready, scheduling retry ${retryCount + 1}/${MAX_RETRIES}`);
      } else {
        console.error(`[UnlistReplayService] Failed to unlist video ${videoId} after ${retryCount + 1} attempts: ${result.error}`);
        this.cancelUnlist(videoId);
        return;
      }
      
    } catch (error) {
      console.error(`[UnlistReplayService] Error attempting to unlist video ${videoId}:`, error.message);
      
      // Determine if we should retry based on error type
      if (!shouldRetry) {
        shouldRetry = retryCount < MAX_RETRIES;
      }
    }
    
    // Schedule retry if needed
    if (shouldRetry) {
      console.log(`[UnlistReplayService] Scheduling retry ${retryCount + 1}/${MAX_RETRIES} for video ${videoId}`);
      
      const timeoutId = setTimeout(async () => {
        await this.attemptUnlist(videoId, userId, retryCount + 1);
      }, RETRY_DELAY_MS);

      const pending = this.pendingUnlists.get(videoId);
      if (pending) {
        // Clear old timeout
        if (pending.timeoutId) {
          clearTimeout(pending.timeoutId);
        }
        pending.timeoutId = timeoutId;
        pending.retryCount = retryCount + 1;
      } else {
        // Entry was removed, don't retry
        console.warn(`[UnlistReplayService] Pending entry removed for video ${videoId}, cancelling retry`);
        clearTimeout(timeoutId);
      }
    } else {
      console.error(`[UnlistReplayService] Giving up on video ${videoId} after ${retryCount + 1} attempts`);
      this.cancelUnlist(videoId);
    }
  }

  /**
   * Cancel scheduled unlist for a video
   * @param {string} videoId - YouTube video/broadcast ID
   */
  cancelUnlist(videoId) {
    const pending = this.pendingUnlists.get(videoId);
    if (pending) {
      // Clear main timeout
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId);
      }
      // Clear cleanup timeout
      if (pending.cleanupTimeoutId) {
        clearTimeout(pending.cleanupTimeoutId);
      }
      this.pendingUnlists.delete(videoId);
      console.log(`[UnlistReplayService] Cancelled unlist for video ${videoId}`);
    }
  }

  /**
   * Handle stream end - check if unlist is needed and schedule it
   * @param {Object} stream - Stream object from database
   */
  async handleStreamEnd(stream) {
    // Validate input
    if (!stream) {
      console.warn('[UnlistReplayService] handleStreamEnd called with null/undefined stream');
      return;
    }
    
    if (!stream.youtube_broadcast_id) {
      console.log('[UnlistReplayService] Stream has no YouTube broadcast ID, skipping');
      return;
    }
    
    if (!stream.user_id) {
      console.error('[UnlistReplayService] Stream has no user_id, cannot unlist');
      return;
    }

    try {
      // Check if unlist replay is enabled for this broadcast
      const settings = await YouTubeBroadcastSettings.findByBroadcastId(stream.youtube_broadcast_id);
      
      if (!settings) {
        console.log(`[UnlistReplayService] No settings found for broadcast ${stream.youtube_broadcast_id}`);
        return;
      }
      
      if (!settings.unlistReplayOnEnd) {
        console.log(`[UnlistReplayService] Unlist replay not enabled for broadcast ${stream.youtube_broadcast_id}`);
        return;
      }

      console.log(`[UnlistReplayService] Unlist replay enabled for broadcast ${stream.youtube_broadcast_id}, scheduling...`);
      
      // Schedule the unlist with initial delay
      this.scheduleUnlist(stream.youtube_broadcast_id, stream.user_id);
      
    } catch (error) {
      console.error(`[UnlistReplayService] Error handling stream end for broadcast ${stream.youtube_broadcast_id}:`, error.message);
      // Don't throw - this is a background task
    }
  }

  /**
   * Get status of pending unlists
   * @returns {Array<{videoId: string, retryCount: number, userId: string}>}
   */
  getPendingUnlists() {
    const pending = [];
    for (const [videoId, data] of this.pendingUnlists) {
      pending.push({
        videoId,
        retryCount: data.retryCount,
        userId: data.userId
      });
    }
    return pending;
  }

  /**
   * Cleanup all pending unlists (for shutdown)
   */
  cleanup() {
    for (const [videoId, pending] of this.pendingUnlists) {
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId);
      }
      if (pending.cleanupTimeoutId) {
        clearTimeout(pending.cleanupTimeoutId);
      }
    }
    this.pendingUnlists.clear();
    console.log('[UnlistReplayService] Cleaned up all pending unlists');
  }
}

// Export singleton instance
module.exports = new UnlistReplayService();
