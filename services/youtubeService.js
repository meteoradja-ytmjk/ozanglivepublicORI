const { google } = require('googleapis');

class YouTubeService {
  /**
   * Get access token from refresh token with retry logic
   * @param {string} clientId - Google Client ID
   * @param {string} clientSecret - Google Client Secret
   * @param {string} refreshToken - Refresh Token
   * @param {number} retryCount - Current retry count (internal use)
   * @returns {Promise<string>} Access token
   */
  async getAccessToken(clientId, clientSecret, refreshToken, retryCount = 0) {
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds
    
    try {
      // Validate inputs
      if (!clientId || !clientSecret || !refreshToken) {
        throw new Error('Missing credentials: clientId, clientSecret, or refreshToken is empty');
      }
      
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
      oauth2Client.setCredentials({ refresh_token: refreshToken });
      
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      if (!credentials || !credentials.access_token) {
        throw new Error('Failed to obtain access token from refresh token');
      }
      
      return credentials.access_token;
    } catch (error) {
      const errorMessage = error.message || 'Unknown error';
      
      // Check if error is retryable
      const isRetryable = 
        errorMessage.includes('ECONNRESET') ||
        errorMessage.includes('ETIMEDOUT') ||
        errorMessage.includes('ENOTFOUND') ||
        errorMessage.includes('socket hang up') ||
        errorMessage.includes('network') ||
        errorMessage.includes('timeout') ||
        (error.code && ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN'].includes(error.code));
      
      if (isRetryable && retryCount < maxRetries) {
        console.warn(`[YouTubeService.getAccessToken] Retryable error (attempt ${retryCount + 1}/${maxRetries}): ${errorMessage}`);
        await new Promise(resolve => setTimeout(resolve, retryDelay * (retryCount + 1)));
        return this.getAccessToken(clientId, clientSecret, refreshToken, retryCount + 1);
      }
      
      // Check for specific OAuth errors
      if (errorMessage.includes('invalid_grant') || errorMessage.includes('Token has been expired or revoked')) {
        console.error('[YouTubeService.getAccessToken] Token expired or revoked - user needs to re-authenticate');
        throw new Error('TOKEN_EXPIRED: YouTube token has expired or been revoked. Please reconnect your YouTube account.');
      }
      
      if (errorMessage.includes('invalid_client')) {
        console.error('[YouTubeService.getAccessToken] Invalid client credentials');
        throw new Error('INVALID_CLIENT: YouTube client credentials are invalid. Please check your API settings.');
      }
      
      console.error(`[YouTubeService.getAccessToken] Failed to get access token: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Get access token with graceful fallback (returns null instead of throwing)
   * Useful for non-critical operations like displaying channel name
   * @param {string} clientId - Google Client ID
   * @param {string} clientSecret - Google Client Secret
   * @param {string} refreshToken - Refresh Token
   * @returns {Promise<string|null>} Access token or null if failed
   */
  async getAccessTokenSafe(clientId, clientSecret, refreshToken) {
    try {
      return await this.getAccessToken(clientId, clientSecret, refreshToken);
    } catch (error) {
      console.warn(`[YouTubeService.getAccessTokenSafe] Failed to get token: ${error.message}`);
      return null;
    }
  }

  /**
   * Validate credentials by testing API connection
   * @param {string} clientId - Google Client ID
   * @param {string} clientSecret - Google Client Secret
   * @param {string} refreshToken - Refresh Token
   * @returns {Promise<{valid: boolean, channelName?: string, channelId?: string, error?: string}>}
   */
  async validateCredentials(clientId, clientSecret, refreshToken) {
    try {
      const accessToken = await this.getAccessToken(clientId, clientSecret, refreshToken);
      const channelInfo = await this.getChannelInfo(accessToken);
      
      return {
        valid: true,
        channelName: channelInfo.title,
        channelId: channelInfo.id,
        channelThumbnail: channelInfo.thumbnail
      };
    } catch (error) {
      const errorMessage = error.message || 'Invalid credentials';
      
      // Provide more specific error messages
      if (errorMessage.includes('TOKEN_EXPIRED')) {
        return {
          valid: false,
          error: 'Token expired - please reconnect your YouTube account',
          errorCode: 'TOKEN_EXPIRED'
        };
      }
      
      if (errorMessage.includes('INVALID_CLIENT')) {
        return {
          valid: false,
          error: 'Invalid client credentials',
          errorCode: 'INVALID_CLIENT'
        };
      }
      
      return {
        valid: false,
        error: errorMessage
      };
    }
  }

  /**
   * Get channel info from access token
   * @param {string} accessToken - Access token
   * @returns {Promise<{id: string, title: string, thumbnail: string}>}
   */
  async getChannelInfo(accessToken) {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    
    const response = await youtube.channels.list({
      part: 'snippet',
      mine: true
    });
    
    if (!response.data.items || response.data.items.length === 0) {
      throw new Error('No channel found for this account');
    }
    
    const channel = response.data.items[0];
    return {
      id: channel.id,
      title: channel.snippet.title,
      thumbnail: channel.snippet.thumbnails?.default?.url || ''
    };
  }


  /**
   * Create a scheduled broadcast on YouTube
   * @param {string} accessToken - Access token
   * @param {Object} data - Broadcast data
   * @param {string} [data.streamId] - Optional existing stream ID to bind
   * @param {string[]} [data.tags] - Optional tags for the broadcast
   * @param {string} [data.categoryId] - Optional category ID
   * @param {boolean} [data.monetizationEnabled] - Optional monetization status
   * @param {string} [data.adFrequency] - Optional ad frequency (high/medium/low)
   * @param {boolean} [data.alteredContent] - Optional altered content declaration
   * @returns {Promise<{broadcastId: string, streamKey: string, rtmpUrl: string}>}
   */
  async createBroadcast(accessToken, { title, description, scheduledStartTime, privacyStatus, streamId, tags, categoryId, enableAutoStart, enableAutoStop, monetizationEnabled, adFrequency, alteredContent }) {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    
    console.log('[YouTubeService.createBroadcast] Received streamId:', streamId);
    console.log('[YouTubeService.createBroadcast] Settings: autoStart=%s, autoStop=%s', enableAutoStart, enableAutoStop);
    console.log('[YouTubeService.createBroadcast] Received categoryId:', categoryId);
    
    // Build snippet - Note: categoryId is NOT supported by liveBroadcasts API
    // Category will be set separately using Videos API after broadcast is created
    // YouTube category IDs: 22 = People & Blogs, 20 = Gaming, 10 = Music, 24 = Entertainment, etc.
    const finalCategoryId = categoryId || '22';
    console.log('[YouTubeService.createBroadcast] Will set categoryId:', finalCategoryId);
    
    const snippet = {
      title: title,
      description: description || '',
      scheduledStartTime: new Date(scheduledStartTime).toISOString()
    };
    
    // Add tags if provided (YouTube API accepts tags in snippet)
    if (tags && Array.isArray(tags) && tags.length > 0) {
      snippet.tags = tags;
    }
    
    // Build contentDetails with auto-start/stop settings
    const contentDetails = {
      enableAutoStart: enableAutoStart === true || enableAutoStart === 'true',
      enableAutoStop: enableAutoStop !== false && enableAutoStop !== 'false', // Default true
      monitorStream: {
        enableMonitorStream: false
      },
      // Record from start - always enabled for replay
      recordFromStart: true
    };
    
    // Build status with privacy settings
    const status = {
      privacyStatus: privacyStatus || 'unlisted',
      selfDeclaredMadeForKids: false
    };
    
    // Create the broadcast
    const broadcastResponse = await youtube.liveBroadcasts.insert({
      part: 'snippet,status,contentDetails',
      requestBody: {
        snippet,
        status,
        contentDetails
      }
    });
    
    const broadcast = broadcastResponse.data;
    
    let stream;
    
    // Use existing stream or create new one
    if (streamId) {
      console.log('[YouTubeService.createBroadcast] Using existing stream:', streamId);
      // Fetch existing stream info
      const streamResponse = await youtube.liveStreams.list({
        part: 'snippet,cdn',
        id: streamId
      });
      
      if (!streamResponse.data.items || streamResponse.data.items.length === 0) {
        console.log('[YouTubeService.createBroadcast] Stream not found, creating new one');
        // Stream not found, create a new one
        const newStreamResponse = await youtube.liveStreams.insert({
          part: 'snippet,cdn',
          requestBody: {
            snippet: {
              title: `Stream for ${title}`
            },
            cdn: {
              frameRate: '30fps',
              ingestionType: 'rtmp',
              resolution: '1080p'
            }
          }
        });
        stream = newStreamResponse.data;
      } else {
        stream = streamResponse.data.items[0];
        console.log('[YouTubeService.createBroadcast] Found existing stream:', stream.snippet.title);
      }
    } else {
      console.log('[YouTubeService.createBroadcast] No streamId provided, creating new stream');
      // Create a new stream
      const streamResponse = await youtube.liveStreams.insert({
        part: 'snippet,cdn',
        requestBody: {
          snippet: {
            title: `Stream for ${title}`
          },
          cdn: {
            frameRate: '30fps',
            ingestionType: 'rtmp',
            resolution: '1080p'
          }
        }
      });
      
      stream = streamResponse.data;
    }
    
    // Bind the stream to the broadcast
    await youtube.liveBroadcasts.bind({
      part: 'id,contentDetails',
      id: broadcast.id,
      streamId: stream.id
    });
    
    console.log('[YouTubeService.createBroadcast] Bound stream:', stream.id, 'with key:', stream.cdn.ingestionInfo.streamName);
    
    // Update video category using Videos API (liveBroadcasts API doesn't support categoryId)
    let actualCategoryId = broadcast.snippet.categoryId || finalCategoryId;
    try {
      console.log('[YouTubeService.createBroadcast] Updating video category to:', finalCategoryId);
      const categoryResult = await this.updateVideoCategory(accessToken, broadcast.id, finalCategoryId);
      actualCategoryId = categoryResult.categoryId;
      console.log('[YouTubeService.createBroadcast] Video category updated successfully to:', actualCategoryId);
    } catch (categoryError) {
      console.error('[YouTubeService.createBroadcast] Failed to update category:', categoryError.message);
      // Continue anyway, category update is not critical
    }
    
    return {
      broadcastId: broadcast.id,
      streamId: stream.id,
      streamKey: stream.cdn.ingestionInfo.streamName,
      rtmpUrl: stream.cdn.ingestionInfo.ingestionAddress,
      title: broadcast.snippet.title,
      description: broadcast.snippet.description,
      scheduledStartTime: broadcast.snippet.scheduledStartTime,
      privacyStatus: broadcast.status.privacyStatus,
      categoryId: actualCategoryId,
      thumbnailUrl: broadcast.snippet.thumbnails?.default?.url || ''
    };
  }

  /**
   * List upcoming broadcasts
   * @param {string} accessToken - Access token
   * @returns {Promise<Array>} List of broadcasts
   */
  async listBroadcasts(accessToken) {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    
    const response = await youtube.liveBroadcasts.list({
      part: 'snippet,status,contentDetails',
      broadcastStatus: 'upcoming',
      maxResults: 50
    });
    
    const broadcasts = response.data.items || [];
    
    // Get stream info for each broadcast
    const result = await Promise.all(broadcasts.map(async (broadcast) => {
      let streamKey = '';
      let streamId = null;
      let rtmpUrl = 'rtmp://a.rtmp.youtube.com/live2';
      
      if (broadcast.contentDetails?.boundStreamId) {
        streamId = broadcast.contentDetails.boundStreamId;
        try {
          const streamResponse = await youtube.liveStreams.list({
            part: 'cdn',
            id: broadcast.contentDetails.boundStreamId
          });
          
          if (streamResponse.data.items && streamResponse.data.items.length > 0) {
            const stream = streamResponse.data.items[0];
            streamKey = stream.cdn.ingestionInfo.streamName;
            rtmpUrl = stream.cdn.ingestionInfo.ingestionAddress;
          }
        } catch (err) {
          console.error('Error fetching stream info:', err.message);
        }
      }
      
      return {
        id: broadcast.id,
        title: broadcast.snippet.title,
        description: broadcast.snippet.description,
        scheduledStartTime: broadcast.snippet.scheduledStartTime,
        privacyStatus: broadcast.status.privacyStatus,
        lifeCycleStatus: broadcast.status.lifeCycleStatus,
        categoryId: broadcast.snippet.categoryId || '22',
        tags: broadcast.snippet.tags || [],
        thumbnailUrl: broadcast.snippet.thumbnails?.medium?.url || broadcast.snippet.thumbnails?.default?.url || '',
        streamId,
        streamKey,
        rtmpUrl
      };
    }));
    
    return result;
  }

  /**
   * List available live streams (stream keys)
   * @param {string} accessToken - Access token
   * @returns {Promise<Array<{id: string, title: string, streamKey: string, rtmpUrl: string, resolution: string, frameRate: string}>>}
   */
  async listStreams(accessToken) {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    
    console.log('[YouTubeService.listStreams] Fetching streams...');
    
    const response = await youtube.liveStreams.list({
      part: 'snippet,cdn',
      mine: true,
      maxResults: 50
    });
    
    const streams = response.data.items || [];
    console.log('[YouTubeService.listStreams] Raw response items:', streams.length);
    
    const result = streams.map(stream => ({
      id: stream.id,
      title: stream.snippet.title,
      streamKey: stream.cdn?.ingestionInfo?.streamName || '',
      rtmpUrl: stream.cdn?.ingestionInfo?.ingestionAddress || 'rtmp://a.rtmp.youtube.com/live2',
      resolution: stream.cdn?.resolution || 'variable',
      frameRate: stream.cdn?.frameRate || 'variable'
    }));
    
    console.log('[YouTubeService.listStreams] Mapped streams:', result.map(s => s.title));
    
    return result;
  }

  /**
   * Delete a broadcast
   * @param {string} accessToken - Access token
   * @param {string} broadcastId - Broadcast ID to delete
   * @returns {Promise<boolean>} True if deleted successfully
   */
  async deleteBroadcast(accessToken, broadcastId) {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    
    await youtube.liveBroadcasts.delete({
      id: broadcastId
    });
    
    return true;
  }

  /**
   * Update a broadcast
   * @param {string} accessToken - Access token
   * @param {string} broadcastId - Broadcast ID to update
   * @param {Object} data - Update data
   * @param {string} [data.title] - New title
   * @param {string} [data.description] - New description
   * @param {string} [data.scheduledStartTime] - New scheduled start time
   * @param {string} [data.privacyStatus] - New privacy status
   * @param {string} [data.categoryId] - Category ID
   * @returns {Promise<Object>} Updated broadcast info
   */
  async updateBroadcast(accessToken, broadcastId, { title, description, scheduledStartTime, privacyStatus, categoryId }) {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    
    console.log('[YouTubeService.updateBroadcast] Updating broadcast:', broadcastId);
    console.log('[YouTubeService.updateBroadcast] Input categoryId:', categoryId);
    
    // First, get the current broadcast to preserve existing values
    const currentResponse = await youtube.liveBroadcasts.list({
      part: 'snippet,status',
      id: broadcastId
    });
    
    if (!currentResponse.data.items || currentResponse.data.items.length === 0) {
      throw new Error('Broadcast not found');
    }
    
    const current = currentResponse.data.items[0];
    console.log('[YouTubeService.updateBroadcast] Current categoryId:', current.snippet.categoryId);
    
    // Determine final categoryId - use provided value or keep existing
    const finalCategoryId = categoryId !== undefined && categoryId !== null && categoryId !== '' 
      ? String(categoryId) 
      : (current.snippet.categoryId || '22');
    
    console.log('[YouTubeService.updateBroadcast] Final categoryId:', finalCategoryId);
    
    // Build update request - preserve all existing values if not provided
    // Note: categoryId is NOT included here because liveBroadcasts API doesn't support it
    // Category will be updated separately using Videos API
    const updateRequest = {
      id: broadcastId,
      snippet: {
        title: title !== undefined && title !== '' ? title : current.snippet.title,
        description: description !== undefined ? description : current.snippet.description,
        scheduledStartTime: scheduledStartTime ? new Date(scheduledStartTime).toISOString() : current.snippet.scheduledStartTime
      },
      status: {
        privacyStatus: privacyStatus !== undefined && privacyStatus !== '' ? privacyStatus : current.status.privacyStatus,
        selfDeclaredMadeForKids: current.status.selfDeclaredMadeForKids || false
      }
    };
    
    // Preserve tags if they exist
    if (current.snippet.tags && current.snippet.tags.length > 0) {
      updateRequest.snippet.tags = current.snippet.tags;
    }
    
    console.log('[YouTubeService.updateBroadcast] Update request:', JSON.stringify(updateRequest, null, 2));
    
    // Update the broadcast (for title, description, scheduledStartTime, privacyStatus)
    const response = await youtube.liveBroadcasts.update({
      part: 'snippet,status',
      requestBody: updateRequest
    });
    
    const broadcast = response.data;
    
    // Update category using Videos API (liveBroadcasts API doesn't support categoryId properly)
    let actualCategoryId = broadcast.snippet.categoryId || '22';
    if (categoryId !== undefined && categoryId !== null && categoryId !== '') {
      try {
        console.log('[YouTubeService.updateBroadcast] Updating video category to:', finalCategoryId);
        const categoryResult = await this.updateVideoCategory(accessToken, broadcastId, finalCategoryId);
        actualCategoryId = categoryResult.categoryId;
        console.log('[YouTubeService.updateBroadcast] Video category updated successfully to:', actualCategoryId);
      } catch (categoryError) {
        console.error('[YouTubeService.updateBroadcast] Failed to update category:', categoryError.message);
        // Continue anyway, category update is not critical
      }
    }
    
    console.log('[YouTubeService.updateBroadcast] Final categoryId:', actualCategoryId);
    
    return {
      id: broadcast.id,
      title: broadcast.snippet.title,
      description: broadcast.snippet.description,
      scheduledStartTime: broadcast.snippet.scheduledStartTime,
      privacyStatus: broadcast.status.privacyStatus,
      categoryId: actualCategoryId,
      thumbnailUrl: broadcast.snippet.thumbnails?.default?.url || ''
    };
  }

  /**
   * Update video category and settings using Videos API
   * This is needed because liveBroadcasts API doesn't support categoryId directly
   * Also attempts to set altered content declaration (synthetic media)
   * @param {string} accessToken - Access token
   * @param {string} videoId - Video/Broadcast ID
   * @param {string} categoryId - Category ID (e.g., '22' for People & Blogs)
   * @returns {Promise<Object>} Updated video info
   */
  async updateVideoCategory(accessToken, videoId, categoryId) {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    
    console.log('[YouTubeService.updateVideoCategory] Updating video:', videoId, 'to category:', categoryId);
    
    // First, get the current video to preserve existing values
    const currentResponse = await youtube.videos.list({
      part: 'snippet,status',
      id: videoId
    });
    
    if (!currentResponse.data.items || currentResponse.data.items.length === 0) {
      throw new Error('Video not found');
    }
    
    const current = currentResponse.data.items[0];
    console.log('[YouTubeService.updateVideoCategory] Current categoryId:', current.snippet.categoryId);
    console.log('[YouTubeService.updateVideoCategory] Current status:', JSON.stringify(current.status));
    
    // Build status object with altered content declaration
    // YouTube uses "containsSyntheticMedia" for the "Altered content" setting
    // We try multiple possible field names as YouTube API may vary
    const statusUpdate = {
      privacyStatus: current.status?.privacyStatus || 'unlisted',
      selfDeclaredMadeForKids: false,
      // Primary field for altered content (synthetic media / AI generated)
      containsSyntheticMedia: true
    };
    
    // Try to update with altered content setting
    let response;
    let alteredContentSet = false;
    
    try {
      response = await youtube.videos.update({
        part: 'snippet,status',
        requestBody: {
          id: videoId,
          snippet: {
            title: current.snippet.title,
            description: current.snippet.description || '',
            categoryId: categoryId,
            tags: current.snippet.tags || []
          },
          status: statusUpdate
        }
      });
      alteredContentSet = true;
      console.log('[YouTubeService.updateVideoCategory] Updated with containsSyntheticMedia: true');
    } catch (err) {
      console.log('[YouTubeService.updateVideoCategory] First attempt failed:', err.message);
      
      // Try without containsSyntheticMedia if not supported
      try {
        response = await youtube.videos.update({
          part: 'snippet,status',
          requestBody: {
            id: videoId,
            snippet: {
              title: current.snippet.title,
              description: current.snippet.description || '',
              categoryId: categoryId,
              tags: current.snippet.tags || []
            },
            status: {
              privacyStatus: current.status?.privacyStatus || 'unlisted',
              selfDeclaredMadeForKids: false
            }
          }
        });
        console.log('[YouTubeService.updateVideoCategory] Updated without altered content field');
      } catch (err2) {
        // Final fallback - just update snippet
        console.log('[YouTubeService.updateVideoCategory] Status update failed, trying snippet only:', err2.message);
        response = await youtube.videos.update({
          part: 'snippet',
          requestBody: {
            id: videoId,
            snippet: {
              title: current.snippet.title,
              description: current.snippet.description || '',
              categoryId: categoryId,
              tags: current.snippet.tags || []
            }
          }
        });
      }
    }
    
    const video = response.data;
    console.log('[YouTubeService.updateVideoCategory] Updated categoryId:', video.snippet.categoryId);
    if (video.status) {
      console.log('[YouTubeService.updateVideoCategory] Updated status:', JSON.stringify(video.status));
    }
    
    return {
      id: video.id,
      title: video.snippet.title,
      categoryId: video.snippet.categoryId,
      containsSyntheticMedia: video.status?.containsSyntheticMedia || alteredContentSet
    };
  }

  /**
   * Get channel default settings for broadcasts
   * Fetches from channel branding settings and last broadcast for better defaults
   * @param {string} accessToken - Access token
   * @returns {Promise<{title: string, description: string, tags: string[], monetizationEnabled: boolean, alteredContent: boolean, categoryId: string}>}
   */
  async getChannelDefaults(accessToken) {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    
    // Fetch channel with brandingSettings and status for monetization info
    const channelResponse = await youtube.channels.list({
      part: 'brandingSettings,status,snippet',
      mine: true
    });
    
    if (!channelResponse.data.items || channelResponse.data.items.length === 0) {
      throw new Error('No channel found for this account');
    }
    
    const channel = channelResponse.data.items[0];
    const brandingSettings = channel.brandingSettings || {};
    const channelSettings = brandingSettings.channel || {};
    
    // Try to get defaults from the most recent broadcast
    let lastBroadcastDefaults = { title: '', description: '', tags: [] };
    try {
      const broadcastsResponse = await youtube.liveBroadcasts.list({
        part: 'snippet',
        broadcastStatus: 'upcoming',
        maxResults: 1
      });
      
      if (broadcastsResponse.data.items && broadcastsResponse.data.items.length > 0) {
        const lastBroadcast = broadcastsResponse.data.items[0];
        lastBroadcastDefaults = {
          title: lastBroadcast.snippet.title || '',
          description: lastBroadcast.snippet.description || '',
          tags: lastBroadcast.snippet.tags || []
        };
      }
    } catch (err) {
      console.log('[YouTubeService] Could not fetch last broadcast for defaults:', err.message);
    }
    
    // Use channel keywords as fallback for tags
    const channelKeywords = channelSettings.keywords 
      ? channelSettings.keywords.split(/[,\s]+/).map(t => t.trim().replace(/^"|"$/g, '')).filter(t => t)
      : [];
    
    // Return combined defaults - prefer last broadcast values, fallback to channel settings
    return {
      title: lastBroadcastDefaults.title || channelSettings.title || '',
      description: lastBroadcastDefaults.description || channelSettings.description || '',
      tags: lastBroadcastDefaults.tags.length > 0 ? lastBroadcastDefaults.tags : channelKeywords,
      monetizationEnabled: channel.status?.isLinked || false,
      alteredContent: false, // YouTube API doesn't expose this default, user must set
      categoryId: channelSettings.defaultCategory || '22' // Default to People & Blogs category
    };
  }

  /**
   * Upload thumbnail for a broadcast
   * @param {string} accessToken - Access token
   * @param {string} broadcastId - Broadcast ID (video ID)
   * @param {Buffer} imageBuffer - Image buffer
   * @param {string} mimeType - Image mime type (image/jpeg or image/png)
   * @returns {Promise<{thumbnailUrl: string}>}
   */
  async uploadThumbnail(accessToken, broadcastId, imageBuffer, mimeType = 'image/jpeg') {
    try {
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: accessToken });
      
      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
      
      console.log(`[YouTubeService.uploadThumbnail] Uploading thumbnail for broadcast ${broadcastId}, size: ${imageBuffer.length} bytes, type: ${mimeType}`);
      
      // Validate buffer
      if (!imageBuffer || imageBuffer.length === 0) {
        throw new Error('Image buffer is empty');
      }
      
      const response = await youtube.thumbnails.set({
        videoId: broadcastId,
        media: {
          mimeType: mimeType,
          body: require('stream').Readable.from(imageBuffer)
        }
      });
      
      console.log('[YouTubeService.uploadThumbnail] Response:', JSON.stringify(response.data, null, 2));
      
      return {
        thumbnailUrl: response.data.items?.[0]?.default?.url || response.data.items?.[0]?.medium?.url || ''
      };
    } catch (error) {
      console.error('[YouTubeService.uploadThumbnail] Error:', error.message);
      if (error.response) {
        console.error('[YouTubeService.uploadThumbnail] Response error:', JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
  }

  /**
   * Get broadcast status by ID
   * Used for status sync to check if broadcast is still active
   * @param {string} accessToken - Access token
   * @param {string} broadcastId - Broadcast ID
   * @returns {Promise<{lifeCycleStatus: string, exists: boolean, error?: string}>}
   */
  async getBroadcastStatus(accessToken, broadcastId) {
    try {
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: accessToken });
      
      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
      
      const response = await youtube.liveBroadcasts.list({
        part: 'status',
        id: broadcastId
      });
      
      if (!response.data.items || response.data.items.length === 0) {
        return { exists: false, lifeCycleStatus: null };
      }
      
      const broadcast = response.data.items[0];
      return {
        exists: true,
        lifeCycleStatus: broadcast.status.lifeCycleStatus
      };
    } catch (error) {
      // Check for quota exceeded error
      if (error.code === 403 && error.message?.includes('quota')) {
        return { exists: true, lifeCycleStatus: null, error: 'quota_exceeded' };
      }
      // For other errors, assume broadcast might still exist
      return { exists: true, lifeCycleStatus: null, error: error.message };
    }
  }

  /**
   * Find broadcast by stream key
   * Searches active broadcasts (live, testing, ready) to find one matching the stream key
   * @param {string} accessToken - Access token
   * @param {string} streamKey - Stream key to search for
   * @returns {Promise<{broadcastId: string, lifeCycleStatus: string} | null>}
   */
  async findBroadcastByStreamKey(accessToken, streamKey) {
    try {
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: accessToken });
      
      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
      
      // Get all active broadcasts (live, testing, ready, upcoming)
      const statuses = ['active', 'upcoming'];
      let allBroadcasts = [];
      
      for (const status of statuses) {
        try {
          const response = await youtube.liveBroadcasts.list({
            part: 'status,contentDetails',
            broadcastStatus: status,
            maxResults: 50
          });
          
          if (response.data.items) {
            allBroadcasts = allBroadcasts.concat(response.data.items);
          }
        } catch (err) {
          console.log(`[YouTubeService] Error fetching ${status} broadcasts:`, err.message);
        }
      }
      
      // For each broadcast, get the bound stream and check stream key
      for (const broadcast of allBroadcasts) {
        if (!broadcast.contentDetails?.boundStreamId) continue;
        
        try {
          const streamResponse = await youtube.liveStreams.list({
            part: 'cdn',
            id: broadcast.contentDetails.boundStreamId
          });
          
          if (streamResponse.data.items && streamResponse.data.items.length > 0) {
            const stream = streamResponse.data.items[0];
            const broadcastStreamKey = stream.cdn?.ingestionInfo?.streamName;
            
            if (broadcastStreamKey === streamKey) {
              return {
                broadcastId: broadcast.id,
                lifeCycleStatus: broadcast.status.lifeCycleStatus
              };
            }
          }
        } catch (err) {
          console.log(`[YouTubeService] Error fetching stream for broadcast ${broadcast.id}:`, err.message);
        }
      }
      
      return null;
    } catch (error) {
      console.error('[YouTubeService] Error finding broadcast by stream key:', error.message);
      return null;
    }
  }

  /**
   * List active broadcasts (live and testing status)
   * Used for status sync to monitor ongoing broadcasts
   * @param {string} accessToken - Access token
   * @returns {Promise<Array<{id: string, streamKey: string, lifeCycleStatus: string}>>}
   */
  async listActiveBroadcasts(accessToken) {
    try {
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: accessToken });
      
      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
      
      // Get active broadcasts (includes live and testing)
      const response = await youtube.liveBroadcasts.list({
        part: 'status,contentDetails',
        broadcastStatus: 'active',
        maxResults: 50
      });
      
      const broadcasts = response.data.items || [];
      const result = [];
      
      // Get stream key for each broadcast
      for (const broadcast of broadcasts) {
        let streamKey = '';
        
        if (broadcast.contentDetails?.boundStreamId) {
          try {
            const streamResponse = await youtube.liveStreams.list({
              part: 'cdn',
              id: broadcast.contentDetails.boundStreamId
            });
            
            if (streamResponse.data.items && streamResponse.data.items.length > 0) {
              streamKey = streamResponse.data.items[0].cdn?.ingestionInfo?.streamName || '';
            }
          } catch (err) {
            console.log(`[YouTubeService] Error fetching stream for broadcast ${broadcast.id}:`, err.message);
          }
        }
        
        result.push({
          id: broadcast.id,
          streamKey,
          lifeCycleStatus: broadcast.status.lifeCycleStatus
        });
      }
      
      return result;
    } catch (error) {
      console.error('[YouTubeService] Error listing active broadcasts:', error.message);
      return [];
    }
  }

  /**
   * Update broadcast/video privacy status to unlisted
   * Used to unlist live replay once stream ends
   * Uses Videos API instead of LiveBroadcasts API for better compatibility
   * @param {string} accessToken - Access token
   * @param {string} videoId - Video/Broadcast ID
   * @param {number} retryCount - Current retry count (for delayed processing)
   * @returns {Promise<{success: boolean, error?: string, needsRetry?: boolean}>}
   */
  async unlistBroadcast(accessToken, videoId, retryCount = 0) {
    const maxRetries = 3;
    
    try {
      // Validate inputs
      if (!accessToken || !videoId) {
        console.error('[YouTubeService.unlistBroadcast] Missing required parameters');
        return { success: false, error: 'Missing accessToken or videoId' };
      }
      
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: accessToken });
      
      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
      
      console.log(`[YouTubeService.unlistBroadcast] Unlisting video ${videoId} (attempt ${retryCount + 1}/${maxRetries + 1})`);
      
      // Use Videos API instead of LiveBroadcasts API
      // This works better for completed broadcasts/replays
      const currentResponse = await youtube.videos.list({
        part: 'snippet,status',
        id: videoId
      });
      
      if (!currentResponse.data.items || currentResponse.data.items.length === 0) {
        console.log(`[YouTubeService.unlistBroadcast] Video ${videoId} not found yet`);
        
        // Video might not be available yet (processing), retry if within limit
        if (retryCount < maxRetries) {
          console.log(`[YouTubeService.unlistBroadcast] Video not ready, will retry`);
          return { success: false, needsRetry: true, error: 'Video not ready yet' };
        }
        
        return { success: false, error: 'Video not found after retries' };
      }
      
      const current = currentResponse.data.items[0];
      
      // Validate video data
      if (!current.status || !current.snippet) {
        console.error(`[YouTubeService.unlistBroadcast] Invalid video data for ${videoId}`);
        return { success: false, error: 'Invalid video data' };
      }
      
      // Check if already unlisted
      if (current.status.privacyStatus === 'unlisted') {
        console.log(`[YouTubeService.unlistBroadcast] Video ${videoId} is already unlisted`);
        return { success: true };
      }
      
      // Check if video is still processing
      if (current.status.uploadStatus === 'processing') {
        console.log(`[YouTubeService.unlistBroadcast] Video ${videoId} is still processing`);
        
        if (retryCount < maxRetries) {
          console.log(`[YouTubeService.unlistBroadcast] Will retry after processing completes`);
          return { success: false, needsRetry: true, error: 'Video still processing' };
        }
      }
      
      // Build update request with safe defaults
      const updateRequest = {
        id: videoId,
        snippet: {
          title: current.snippet.title || 'Untitled',
          description: current.snippet.description || '',
          categoryId: current.snippet.categoryId || '22'
        },
        status: {
          privacyStatus: 'unlisted',
          selfDeclaredMadeForKids: current.status.selfDeclaredMadeForKids || false
        }
      };
      
      // Add tags if they exist
      if (current.snippet.tags && Array.isArray(current.snippet.tags)) {
        updateRequest.snippet.tags = current.snippet.tags;
      }
      
      // Preserve embeddable and publicStatsViewable if they exist
      if (current.status.embeddable !== undefined) {
        updateRequest.status.embeddable = current.status.embeddable;
      }
      if (current.status.publicStatsViewable !== undefined) {
        updateRequest.status.publicStatsViewable = current.status.publicStatsViewable;
      }
      
      // Attempt to update
      await youtube.videos.update({
        part: 'snippet,status',
        requestBody: updateRequest
      });
      
      console.log(`[YouTubeService.unlistBroadcast] Successfully unlisted video ${videoId}`);
      return { success: true };
      
    } catch (error) {
      const errorMessage = error.message || 'Unknown error';
      console.error(`[YouTubeService.unlistBroadcast] Error unlisting video ${videoId}:`, errorMessage);
      
      // Check for specific error types
      if (error.code === 403) {
        // Quota exceeded or permission denied
        if (errorMessage.includes('quota')) {
          return { success: false, error: 'API quota exceeded', needsRetry: false };
        }
        return { success: false, error: 'Permission denied', needsRetry: false };
      }
      
      if (error.code === 401) {
        // Token expired
        return { success: false, error: 'Token expired', needsRetry: false };
      }
      
      // Check if it's a retryable error
      const isRetryable = 
        error.code === 404 ||
        error.code === 503 ||
        errorMessage.includes('not found') ||
        errorMessage.includes('processing') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('ECONNRESET');
      
      if (isRetryable && retryCount < maxRetries) {
        console.log(`[YouTubeService.unlistBroadcast] Retryable error, will retry`);
        return { success: false, needsRetry: true, error: errorMessage };
      }
      
      return { success: false, error: errorMessage, needsRetry: false };
    }
  }

  /**
   * Get live stream statistics (viewers, health, etc.)
   * @param {string} accessToken - Access token
   * @param {string} broadcastId - Broadcast ID
   * @returns {Promise<{concurrentViewers: number, totalChatMessages: number, streamHealth: string, streamHealthStatus: object}>}
   */
  async getLiveStreamStats(accessToken, broadcastId) {
    try {
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: accessToken });
      
      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
      
      // Get broadcast details with liveStreamingDetails
      const broadcastResponse = await youtube.liveBroadcasts.list({
        part: 'snippet,status,statistics,contentDetails',
        id: broadcastId
      });
      
      if (!broadcastResponse.data.items || broadcastResponse.data.items.length === 0) {
        return { error: 'Broadcast not found' };
      }
      
      const broadcast = broadcastResponse.data.items[0];
      const lifeCycleStatus = broadcast.status?.lifeCycleStatus;
      
      // Get video statistics for concurrent viewers
      const videoResponse = await youtube.videos.list({
        part: 'liveStreamingDetails,statistics',
        id: broadcastId
      });
      
      let concurrentViewers = 0;
      let totalChatMessages = 0;
      
      if (videoResponse.data.items && videoResponse.data.items.length > 0) {
        const video = videoResponse.data.items[0];
        concurrentViewers = parseInt(video.liveStreamingDetails?.concurrentViewers || '0');
        // Note: totalChatMessages is not directly available, using activeLiveChatId presence as indicator
      }
      
      // Get stream health if broadcast has bound stream
      let streamHealth = 'unknown';
      let streamHealthStatus = {};
      
      if (broadcast.contentDetails?.boundStreamId) {
        try {
          const streamResponse = await youtube.liveStreams.list({
            part: 'status,cdn,snippet',
            id: broadcast.contentDetails.boundStreamId
          });
          
          if (streamResponse.data.items && streamResponse.data.items.length > 0) {
            const stream = streamResponse.data.items[0];
            streamHealth = stream.status?.streamStatus || 'unknown';
            streamHealthStatus = {
              streamStatus: stream.status?.streamStatus,
              healthStatus: stream.status?.healthStatus?.status,
              configurationIssues: stream.status?.healthStatus?.configurationIssues || [],
              lastUpdateTime: stream.status?.healthStatus?.lastUpdateTimeSeconds
            };
          }
        } catch (err) {
          console.error('[YouTubeService.getLiveStreamStats] Error fetching stream health:', err.message);
        }
      }
      
      return {
        broadcastId,
        lifeCycleStatus,
        concurrentViewers,
        streamHealth,
        streamHealthStatus,
        title: broadcast.snippet?.title,
        thumbnailUrl: broadcast.snippet?.thumbnails?.medium?.url || broadcast.snippet?.thumbnails?.default?.url
      };
    } catch (error) {
      console.error('[YouTubeService.getLiveStreamStats] Error:', error.message);
      
      // Check for quota exceeded
      if (error.code === 403 && error.message?.includes('quota')) {
        return { error: 'quota_exceeded' };
      }
      
      return { error: error.message };
    }
  }

  /**
   * Get all live broadcasts with their stats for a channel
   * @param {string} accessToken - Access token
   * @returns {Promise<Array<{broadcastId: string, title: string, concurrentViewers: number, streamHealth: string}>>}
   */
  async getAllLiveBroadcastsWithStats(accessToken) {
    try {
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: accessToken });
      
      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
      
      // Get active broadcasts (live and testing)
      const broadcastResponse = await youtube.liveBroadcasts.list({
        part: 'snippet,status,contentDetails',
        broadcastStatus: 'active',
        maxResults: 50
      });
      
      const broadcasts = broadcastResponse.data.items || [];
      const results = [];
      
      for (const broadcast of broadcasts) {
        // Get video stats for concurrent viewers
        let concurrentViewers = 0;
        try {
          const videoResponse = await youtube.videos.list({
            part: 'liveStreamingDetails',
            id: broadcast.id
          });
          
          if (videoResponse.data.items && videoResponse.data.items.length > 0) {
            concurrentViewers = parseInt(videoResponse.data.items[0].liveStreamingDetails?.concurrentViewers || '0');
          }
        } catch (err) {
          console.log(`[YouTubeService] Error fetching viewers for ${broadcast.id}:`, err.message);
        }
        
        // Get stream health
        let streamHealth = 'unknown';
        let healthDetails = {};
        
        if (broadcast.contentDetails?.boundStreamId) {
          try {
            const streamResponse = await youtube.liveStreams.list({
              part: 'status',
              id: broadcast.contentDetails.boundStreamId
            });
            
            if (streamResponse.data.items && streamResponse.data.items.length > 0) {
              const stream = streamResponse.data.items[0];
              streamHealth = stream.status?.streamStatus || 'unknown';
              healthDetails = {
                status: stream.status?.healthStatus?.status || 'noData',
                configurationIssues: stream.status?.healthStatus?.configurationIssues || []
              };
            }
          } catch (err) {
            console.log(`[YouTubeService] Error fetching stream health for ${broadcast.id}:`, err.message);
          }
        }
        
        results.push({
          broadcastId: broadcast.id,
          title: broadcast.snippet?.title,
          lifeCycleStatus: broadcast.status?.lifeCycleStatus,
          concurrentViewers,
          streamHealth,
          healthDetails,
          streamKey: '', // Will be populated if needed
          thumbnailUrl: broadcast.snippet?.thumbnails?.default?.url
        });
      }
      
      return results;
    } catch (error) {
      console.error('[YouTubeService.getAllLiveBroadcastsWithStats] Error:', error.message);
      
      if (error.code === 403 && error.message?.includes('quota')) {
        return { error: 'quota_exceeded' };
      }
      
      return [];
    }
  }

  /**
   * Get YouTube API quota usage estimate
   * Note: YouTube API doesn't provide direct quota endpoint, so we estimate based on usage
   * Daily quota is typically 10,000 units
   * @returns {Object} Quota information
   */
  getQuotaInfo() {
    // YouTube API quota costs (approximate):
    // - liveBroadcasts.list: 1 unit
    // - liveBroadcasts.insert: 50 units
    // - liveBroadcasts.update: 50 units
    // - liveBroadcasts.delete: 50 units
    // - liveStreams.list: 1 unit
    // - liveStreams.insert: 50 units
    // - videos.list: 1 unit
    // - videos.update: 50 units
    // - thumbnails.set: 50 units
    // - channels.list: 1 unit
    
    // Since YouTube doesn't expose quota directly, we return static info
    // In production, you'd track usage in a database
    return {
      dailyLimit: 10000,
      estimatedUsed: 0, // Would need to track this
      resetTime: this.getQuotaResetTime(),
      costReference: {
        'list operations': 1,
        'insert/update/delete': 50,
        'thumbnail upload': 50
      }
    };
  }

  /**
   * Get quota reset time (Pacific Time midnight)
   * @returns {string} ISO string of next reset time
   */
  getQuotaResetTime() {
    const now = new Date();
    // YouTube quota resets at midnight Pacific Time
    const pacificOffset = -8; // PST (or -7 for PDT)
    const utcHours = now.getUTCHours();
    const pacificHours = (utcHours + pacificOffset + 24) % 24;
    
    const resetDate = new Date(now);
    if (pacificHours >= 0) {
      // Reset is tomorrow
      resetDate.setUTCDate(resetDate.getUTCDate() + 1);
    }
    resetDate.setUTCHours(-pacificOffset, 0, 0, 0);
    
    return resetDate.toISOString();
  }

  /**
   * Test API connection and get quota status
   * @param {string} accessToken - Access token
   * @returns {Promise<{connected: boolean, quotaOk: boolean, error?: string}>}
   */
  async testConnection(accessToken) {
    try {
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: accessToken });
      
      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
      
      // Simple API call to test connection (1 quota unit)
      const response = await youtube.channels.list({
        part: 'id',
        mine: true
      });
      
      return {
        connected: true,
        quotaOk: true,
        channelId: response.data.items?.[0]?.id
      };
    } catch (error) {
      if (error.code === 403 && error.message?.includes('quota')) {
        return {
          connected: true,
          quotaOk: false,
          error: 'API quota exceeded'
        };
      }
      
      return {
        connected: false,
        quotaOk: false,
        error: error.message
      };
    }
  }
}

module.exports = new YouTubeService();
