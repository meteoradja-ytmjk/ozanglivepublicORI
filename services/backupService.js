/**
 * Backup Service for Stream Settings
 * Handles export and import of stream configurations
 * Extended for comprehensive backup including all data categories
 */

const Stream = require('../models/Stream');
const YouTubeCredentials = require('../models/YouTubeCredentials');
const BroadcastTemplate = require('../models/BroadcastTemplate');
const RecurringSchedule = require('../models/RecurringSchedule');
const StreamTemplate = require('../models/StreamTemplate');
const Playlist = require('../models/Playlist');
const Video = require('../models/Video');
const Audio = require('../models/Audio');
const TitleFolder = require('../models/TitleFolder');
const TitleSuggestion = require('../models/TitleSuggestion');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

// Fields to include in export (non-sensitive configuration fields)
const EXPORT_FIELDS = [
  'title',
  'rtmp_url',
  'stream_key',
  'platform',
  'platform_icon',
  'bitrate',
  'resolution',
  'fps',
  'orientation',
  'loop_video',
  'schedule_type',
  'schedule_days',
  'schedule_time',           // Added: for one-time schedule
  'recurring_time',
  'recurring_enabled',
  'stream_duration_hours',
  'stream_duration_minutes', // Added: for duration in minutes
  'video_filename',          // Added: for matching video by filename on import
  'audio_filename'           // Added: for matching audio by filename on import
];

// Required fields for import validation
const REQUIRED_FIELDS = ['title', 'rtmp_url', 'stream_key'];

// Fields to exclude (sensitive/system fields)
const EXCLUDED_FIELDS = [
  'id',
  'user_id',
  'video_id',
  'audio_id',
  'status',
  'status_updated_at',
  'start_time',
  'end_time',
  'duration',
  'created_at',
  'updated_at'
];

// YouTube Credentials export fields
const YOUTUBE_CREDENTIALS_FIELDS = [
  'channel_name',
  'channel_id',
  'client_id',
  'client_secret',
  'refresh_token',
  'is_primary'
];

// Broadcast Template export fields
const BROADCAST_TEMPLATE_FIELDS = [
  'name',
  'title',
  'description',
  'privacy_status',
  'tags',
  'category_id',
  'thumbnail_path',
  'thumbnail_folder',
  'thumbnail_index',
  'pinned_thumbnail',
  'stream_key_folder_mapping',
  'title_index',
  'pinned_title_id',
  'title_folder_id',
  'stream_id',
  'account_id',
  'recurring_enabled',
  'recurring_pattern',
  'recurring_time',
  'recurring_days',
  'next_run_at',
  'last_run_at'
];

// Recurring Schedule export fields
const RECURRING_SCHEDULE_FIELDS = [
  'name',
  'pattern',
  'schedule_time',
  'days_of_week',
  'template_id',
  'account_id',
  'title_template',
  'description',
  'privacy_status',
  'tags',
  'category_id',
  'is_active',
  'next_run_at',
  'last_run_at'
];

// Stream Template export fields
const STREAM_TEMPLATE_FIELDS = [
  'name',
  'video_id',
  'audio_id',
  'duration_hours',
  'duration_minutes',
  'loop_video',
  'schedule_type',
  'recurring_time',
  'schedule_days'
];

// Playlist export fields
const PLAYLIST_FIELDS = [
  'name',
  'description',
  'is_shuffle'
];

// Title Folder export fields
const TITLE_FOLDER_FIELDS = [
  'name',
  'color',
  'sort_order'
];

// Title Suggestion export fields
const TITLE_SUGGESTION_FIELDS = [
  'title',
  'use_count',
  'sort_order',
  'is_pinned',
  'folder_name' // For matching folder on import
];

// All available categories for comprehensive export
const ALL_CATEGORIES = [
  'streams',
  'youtube_credentials',
  'broadcast_templates',
  'recurring_schedules',
  'stream_templates',
  'playlists',
  'title_folders',
  'title_suggestions',
  'thumbnail_files'
];

/**
 * Export streams to backup format
 * Includes video_filename and audio_filename for matching on import
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Backup data object
 */
async function exportStreams(userId) {
  const streams = await Stream.findAll(userId);

  // Get all videos and audios for this user to map IDs to filenames
  const videos = await Video.findAll(userId);
  const audios = await Audio.findAll(userId);

  // Create lookup maps for quick access
  const videoMap = new Map(videos.map(v => [v.id, v]));
  const audioMap = new Map(audios.map(a => [a.id, a]));

  const exportedStreams = streams.map(stream => {
    const exportedStream = {};
    EXPORT_FIELDS.forEach(field => {
      if (field === 'video_filename') {
        // Extract video filename from video_id
        if (stream.video_id) {
          const video = videoMap.get(stream.video_id);
          if (video && video.filepath) {
            exportedStream.video_filename = path.basename(video.filepath);
          }
        }
      } else if (field === 'audio_filename') {
        // Extract audio filename from audio_id
        if (stream.audio_id) {
          const audio = audioMap.get(stream.audio_id);
          if (audio && audio.filepath) {
            exportedStream.audio_filename = path.basename(audio.filepath);
          }
        }
      } else if (stream[field] !== undefined) {
        // Parse schedule_days from JSON string to array if it's a string
        if (field === 'schedule_days' && typeof stream[field] === 'string') {
          try {
            exportedStream[field] = JSON.parse(stream[field]);
          } catch (e) {
            exportedStream[field] = stream[field];
          }
        } else {
          exportedStream[field] = stream[field];
        }
      }
    });
    return exportedStream;
  });

  return {
    metadata: {
      exportDate: new Date().toISOString(),
      appVersion: '1.0.0',
      totalStreams: exportedStreams.length
    },
    streams: exportedStreams
  };
}

/**
 * Validate backup file structure
 * @param {Object} data - Parsed JSON data
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateBackupFormat(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    errors.push('Invalid backup format: data must be an object');
    return { valid: false, errors };
  }

  if (!Array.isArray(data.streams)) {
    errors.push('Invalid backup format: missing streams array');
    return { valid: false, errors };
  }

  return { valid: true, errors };
}

/**
 * Determine the appropriate status for an imported stream
 * @param {Object} streamConfig - Stream configuration object
 * @returns {string} Status: 'scheduled' or 'offline'
 */
function determineImportStatus(streamConfig) {
  // Recurring schedules (daily/weekly) should be scheduled
  if (streamConfig.schedule_type === 'daily' || streamConfig.schedule_type === 'weekly') {
    return 'scheduled';
  }

  // One-time schedule with schedule_time should be scheduled
  if (streamConfig.schedule_time) {
    return 'scheduled';
  }

  // Default to offline
  return 'offline';
}

/**
 * Validate single stream configuration
 * @param {Object} streamConfig - Stream configuration object
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateStreamConfig(streamConfig) {
  const errors = [];

  if (!streamConfig || typeof streamConfig !== 'object') {
    errors.push('Stream configuration must be an object');
    return { valid: false, errors };
  }

  REQUIRED_FIELDS.forEach(field => {
    if (!streamConfig[field] || (typeof streamConfig[field] === 'string' && streamConfig[field].trim() === '')) {
      errors.push(`Missing required field: ${field}`);
    }
  });

  return { valid: errors.length === 0, errors };
}

/**
 * Import streams from backup data
 * Supports matching video/audio by filename if video_filename/audio_filename is provided
 * @param {Object} backupData - Parsed backup JSON
 * @param {string} userId - User ID
 * @returns {Promise<{imported: number, skipped: number, matched: {video: number, audio: number}, errors: string[]}>}
 */
async function importStreams(backupData, userId, options = {}) {
  const result = {
    imported: 0,
    skipped: 0,
    matched: { video: 0, audio: 0 },
    errors: []
  };

  // Validate backup format
  const formatValidation = validateBackupFormat(backupData);
  if (!formatValidation.valid) {
    result.errors = formatValidation.errors;
    return result;
  }

  // Get existing streams to check for duplicates
  const existingStreams = await Stream.findAll(userId);
  const existingByKey = new Map();
  existingStreams.forEach(s => {
    // Create unique key from title + stream_key
    const key = `${s.title}|${s.stream_key}`;
    existingByKey.set(key, s);
  });

  // Get all videos and audios for this user to match by filename
  const videos = await Video.findAll(userId);
  const audios = await Audio.findAll(userId);

  // Create lookup maps by filename (basename of filepath)
  const videoByFilename = new Map();
  videos.forEach(v => {
    if (v.filepath) {
      const filename = path.basename(v.filepath);
      videoByFilename.set(filename, v);
      // Also map by title for fallback matching
      videoByFilename.set(v.title, v);
    }
  });

  const audioByFilename = new Map();
  audios.forEach(a => {
    if (a.filepath) {
      const filename = path.basename(a.filepath);
      audioByFilename.set(filename, a);
      // Also map by title for fallback matching
      audioByFilename.set(a.title, a);
    }
  });

  // Process each stream
  for (let i = 0; i < backupData.streams.length; i++) {
    const streamConfig = backupData.streams[i];
    const validation = validateStreamConfig(streamConfig);

    if (!validation.valid) {
      result.skipped++;
      result.errors.push(`Stream ${i + 1}: ${validation.errors.join(', ')}`);
      continue;
    }

    try {
      // Check for duplicate by title + stream_key
      const duplicateKey = `${streamConfig.title}|${streamConfig.stream_key}`;
      if (existingByKey.has(duplicateKey)) {
        if (options.skipDuplicates !== false) {
          result.skipped++;
          result.errors.push(`Stream ${i + 1}: Stream "${streamConfig.title}" with same stream key already exists (skipped)`);
          continue;
        }
      }

      // Parse schedule_days - ensure it's an array
      let scheduleDays = streamConfig.schedule_days;
      if (typeof scheduleDays === 'string') {
        try {
          scheduleDays = JSON.parse(scheduleDays);
        } catch (e) {
          scheduleDays = null;
        }
      }
      // Ensure it's an array or null
      if (scheduleDays && !Array.isArray(scheduleDays)) {
        scheduleDays = null;
      }

      // Match video by filename if provided
      let video_id = null;
      if (streamConfig.video_filename) {
        const matchedVideo = videoByFilename.get(streamConfig.video_filename);
        if (matchedVideo) {
          video_id = matchedVideo.id;
          result.matched.video++;
        }
      }

      // Match audio by filename if provided
      let audio_id = null;
      if (streamConfig.audio_filename) {
        const matchedAudio = audioByFilename.get(streamConfig.audio_filename);
        if (matchedAudio) {
          audio_id = matchedAudio.id;
          result.matched.audio++;
        }
      }

      // Capture original settings for reset functionality
      const originalSettings = {
        schedule_time: streamConfig.schedule_time || null,
        recurring_time: streamConfig.recurring_time || null,
        stream_duration_minutes: streamConfig.stream_duration_minutes ||
          (streamConfig.stream_duration_hours ? streamConfig.stream_duration_hours * 60 : null),
        schedule_type: streamConfig.schedule_type || 'once',
        schedule_days: scheduleDays,
        recurring_enabled: streamConfig.recurring_enabled !== false
      };

      // Determine status based on schedule configuration
      const status = determineImportStatus(streamConfig);

      // Prepare stream data for creation
      const streamData = {
        title: streamConfig.title,
        video_id: video_id,
        audio_id: audio_id,
        rtmp_url: streamConfig.rtmp_url,
        stream_key: streamConfig.stream_key,
        platform: streamConfig.platform || 'YouTube',
        platform_icon: streamConfig.platform_icon || 'youtube',
        bitrate: streamConfig.bitrate || 2500,
        resolution: streamConfig.resolution || '1920x1080',
        fps: streamConfig.fps || 30,
        orientation: streamConfig.orientation || 'horizontal',
        loop_video: streamConfig.loop_video !== false,
        schedule_type: streamConfig.schedule_type || 'once',
        schedule_days: scheduleDays,  // Use parsed schedule_days
        schedule_time: streamConfig.schedule_time || null,
        recurring_time: streamConfig.recurring_time || null,
        recurring_enabled: streamConfig.recurring_enabled !== false,
        stream_duration_minutes: streamConfig.stream_duration_minutes ||
          (streamConfig.stream_duration_hours ? streamConfig.stream_duration_hours * 60 : null),
        original_settings: originalSettings,
        user_id: userId,
        status: status
      };

      await Stream.create(streamData);
      result.imported++;
    } catch (error) {
      result.skipped++;
      result.errors.push(`Stream ${i + 1}: Failed to create - ${error.message}`);
    }
  }

  return result;
}

/**
 * Export YouTube credentials for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of exported credentials
 */
async function exportYouTubeCredentials(userId) {
  const credentials = await YouTubeCredentials.findAllByUserId(userId);

  return credentials.map(cred => {
    const exported = {};
    YOUTUBE_CREDENTIALS_FIELDS.forEach(field => {
      // Map camelCase to snake_case for some fields
      const sourceField = field === 'channel_name' ? 'channelName' :
        field === 'channel_id' ? 'channelId' :
          field === 'client_id' ? 'clientId' :
            field === 'client_secret' ? 'clientSecret' :
              field === 'refresh_token' ? 'refreshToken' :
                field === 'is_primary' ? 'isPrimary' : field;

      if (cred[sourceField] !== undefined) {
        exported[field] = cred[sourceField];
      }
    });
    return exported;
  });
}

/**
 * Export broadcast templates for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of exported templates
 */
async function exportBroadcastTemplates(userId) {
  const templates = await BroadcastTemplate.findByUserId(userId);

  return templates.map(template => {
    const exported = {};
    BROADCAST_TEMPLATE_FIELDS.forEach(field => {
      if (template[field] !== undefined) {
        exported[field] = template[field];
      }
    });
    return exported;
  });
}

/**
 * Export recurring schedules for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of exported schedules
 */
async function exportRecurringSchedules(userId) {
  const schedules = await RecurringSchedule.findByUserId(userId);

  return schedules.map(schedule => {
    const exported = {};
    RECURRING_SCHEDULE_FIELDS.forEach(field => {
      if (schedule[field] !== undefined) {
        exported[field] = schedule[field];
      }
    });
    return exported;
  });
}

/**
 * Export stream templates for a user
 * Includes video_filename and audio_filename for matching on import
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of exported templates
 */
async function exportStreamTemplates(userId) {
  const templates = await StreamTemplate.findByUserId(userId);

  // Get all videos and audios for this user to map IDs to filenames
  const videos = await Video.findAll(userId);
  const audios = await Audio.findAll(userId);

  // Create lookup maps for quick access
  const videoMap = new Map(videos.map(v => [v.id, v]));
  const audioMap = new Map(audios.map(a => [a.id, a]));

  return templates.map(template => {
    const exported = {};
    STREAM_TEMPLATE_FIELDS.forEach(field => {
      if (field === 'video_id' && template.video_id) {
        exported.video_id = template.video_id;
        // Also add video_filename for matching
        const video = videoMap.get(template.video_id);
        if (video && video.filepath) {
          exported.video_filename = path.basename(video.filepath);
        }
      } else if (field === 'audio_id' && template.audio_id) {
        exported.audio_id = template.audio_id;
        // Also add audio_filename for matching
        const audio = audioMap.get(template.audio_id);
        if (audio && audio.filepath) {
          exported.audio_filename = path.basename(audio.filepath);
        }
      } else if (template[field] !== undefined) {
        exported[field] = template[field];
      }
    });
    return exported;
  });
}

/**
 * Export playlists with video associations for a user
 * Includes video_filename for matching on import
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of exported playlists with videos
 */
async function exportPlaylists(userId) {
  const playlists = await Playlist.findAll(userId);

  const exportedPlaylists = [];
  for (const playlist of playlists) {
    const exported = {};
    PLAYLIST_FIELDS.forEach(field => {
      if (playlist[field] !== undefined) {
        exported[field] = playlist[field];
      }
    });

    // Get videos with positions
    const playlistWithVideos = await Playlist.findByIdWithVideos(playlist.id);
    if (playlistWithVideos && playlistWithVideos.videos) {
      exported.videos = playlistWithVideos.videos.map(v => ({
        video_id: v.id,
        video_filename: v.filepath ? path.basename(v.filepath) : null,
        video_title: v.title,
        position: v.position
      }));
    } else {
      exported.videos = [];
    }

    exportedPlaylists.push(exported);
  }

  return exportedPlaylists;
}

/**
 * Export streams only (for backward compatibility, returns just streams array)
 * Includes video_filename and audio_filename for matching on import
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of exported streams
 */
async function exportStreamsOnly(userId) {
  const streams = await Stream.findAll(userId);

  // Get all videos and audios for this user to map IDs to filenames
  const videos = await Video.findAll(userId);
  const audios = await Audio.findAll(userId);

  // Create lookup maps for quick access
  const videoMap = new Map(videos.map(v => [v.id, v]));
  const audioMap = new Map(audios.map(a => [a.id, a]));

  return streams.map(stream => {
    const exportedStream = {};
    EXPORT_FIELDS.forEach(field => {
      if (field === 'video_filename') {
        // Extract video filename from video_id
        if (stream.video_id) {
          const video = videoMap.get(stream.video_id);
          if (video && video.filepath) {
            exportedStream.video_filename = path.basename(video.filepath);
          }
        }
      } else if (field === 'audio_filename') {
        // Extract audio filename from audio_id
        if (stream.audio_id) {
          const audio = audioMap.get(stream.audio_id);
          if (audio && audio.filepath) {
            exportedStream.audio_filename = path.basename(audio.filepath);
          }
        }
      } else if (stream[field] !== undefined) {
        if (field === 'schedule_days' && typeof stream[field] === 'string') {
          try {
            exportedStream[field] = JSON.parse(stream[field]);
          } catch (e) {
            exportedStream[field] = stream[field];
          }
        } else {
          exportedStream[field] = stream[field];
        }
      }
    });
    return exportedStream;
  });
}

/**
 * Export title folders for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of exported title folders
 */
async function exportTitleFolders(userId) {
  const folders = await TitleFolder.findByUserId(userId);

  return folders.map(folder => {
    const exported = {};
    TITLE_FOLDER_FIELDS.forEach(field => {
      if (folder[field] !== undefined) {
        exported[field] = folder[field];
      }
    });
    return exported;
  });
}

/**
 * Export title suggestions for a user
 * Includes folder_name for matching folder on import
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of exported title suggestions
 */
async function exportTitleSuggestions(userId) {
  const titles = await TitleSuggestion.findByUserId(userId);
  const folders = await TitleFolder.findByUserId(userId);

  // Create folder lookup map
  const folderMap = new Map(folders.map(f => [f.id, f]));

  return titles.map(title => {
    const exported = {
      title: title.title,
      use_count: title.use_count || 0,
      sort_order: title.sort_order || 0,
      is_pinned: title.is_pinned || 0
    };

    // Add folder_name for matching on import
    if (title.folder_id) {
      const folder = folderMap.get(title.folder_id);
      if (folder) {
        exported.folder_name = folder.name;
      }
    }

    return exported;
  });
}

/**
 * Export thumbnail files with folder structure
 * Returns metadata about thumbnails and their folder structure
 * Exports ALL thumbnails in the user's thumbnails directory
 * Also exports template-to-folder mapping for proper restoration
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Thumbnail files metadata
 */
async function exportThumbnailFiles(userId) {
  // User-specific thumbnail directory
  const userThumbnailsDir = path.join(process.cwd(), 'public', 'uploads', 'thumbnails', String(userId));

  const result = {
    folders: [],
    files: [],
    template_folder_mapping: [], // Maps template names to their thumbnail folders
    totalSize: 0,
    skippedFiles: 0
  };

  const MAX_TOTAL_SIZE = 30 * 1024 * 1024; // 30MB limit for thumbnails to leave room for other data

  try {
    // Get broadcast templates to map thumbnail folders to template names
    const templates = await BroadcastTemplate.findByUserId(userId);
    const templateFolderMap = new Map();

    for (const template of templates) {
      if (template.thumbnail_folder !== null && template.thumbnail_folder !== undefined) {
        templateFolderMap.set(template.thumbnail_folder, {
          template_name: template.name,
          thumbnail_index: template.thumbnail_index || 0,
          pinned_thumbnail: template.pinned_thumbnail,
          stream_key_folder_mapping: template.stream_key_folder_mapping
        });

        result.template_folder_mapping.push({
          template_name: template.name,
          folder_id: template.thumbnail_folder,
          thumbnail_index: template.thumbnail_index || 0,
          pinned_thumbnail: template.pinned_thumbnail,
          stream_key_folder_mapping: template.stream_key_folder_mapping
        });
      }
    }

    // Check if user's thumbnails directory exists
    const dirExists = fsSync.existsSync(userThumbnailsDir);
    if (!dirExists) {
      console.log(`User thumbnails directory does not exist: ${userThumbnailsDir}`);
      return result;
    }

    // Read all items in user's thumbnails directory
    const items = await fs.readdir(userThumbnailsDir);
    console.log(`Found ${items.length} items in user thumbnails directory`);

    for (const item of items) {
      const itemPath = path.join(userThumbnailsDir, item);
      const stats = await fs.stat(itemPath);

      if (stats.isDirectory()) {
        // This is a thumbnail folder - export all files in it
        const folderFiles = [];
        const files = await fs.readdir(itemPath);

        for (const file of files) {
          const filePath = path.join(itemPath, file);
          const fileStats = await fs.stat(filePath);

          if (fileStats.isFile() && /\.(jpg|jpeg|png|gif|webp)$/i.test(file)) {
            // Check if adding this file would exceed the limit
            const estimatedBase64Size = Math.ceil(fileStats.size * 1.37); // Base64 is ~37% larger
            if (result.totalSize + estimatedBase64Size > MAX_TOTAL_SIZE) {
              console.warn(`Skipping thumbnail ${item}/${file} - would exceed size limit`);
              result.skippedFiles++;
              continue;
            }

            // Read file as base64 for backup
            const fileContent = await fs.readFile(filePath);
            const base64Data = fileContent.toString('base64');
            folderFiles.push({
              filename: file,
              size: fileStats.size,
              data: base64Data
            });
            result.totalSize += base64Data.length;
            console.log(`Exported thumbnail: ${item}/${file} (${fileStats.size} bytes, base64: ${base64Data.length} bytes)`);
          }
        }

        if (folderFiles.length > 0) {
          // Include template mapping info if this folder is linked to a template
          const templateInfo = templateFolderMap.get(item);
          result.folders.push({
            folder_id: item,
            template_name: templateInfo ? templateInfo.template_name : null,
            files: folderFiles
          });
        }
      } else if (stats.isFile() && /\.(jpg|jpeg|png|gif|webp)$/i.test(item)) {
        // This is a standalone thumbnail file (root level)
        // Check if adding this file would exceed the limit
        const estimatedBase64Size = Math.ceil(stats.size * 1.37);
        if (result.totalSize + estimatedBase64Size > MAX_TOTAL_SIZE) {
          console.warn(`Skipping standalone thumbnail ${item} - would exceed size limit`);
          result.skippedFiles++;
          continue;
        }

        const fileContent = await fs.readFile(itemPath);
        const base64Data = fileContent.toString('base64');
        result.files.push({
          filename: item,
          size: stats.size,
          data: base64Data
        });
        result.totalSize += base64Data.length;
        console.log(`Exported standalone thumbnail: ${item} (${stats.size} bytes, base64: ${base64Data.length} bytes)`);
      }
    }

    const totalSizeMB = result.totalSize / (1024 * 1024);
    console.log(`Total exported for user ${userId}: ${result.folders.length} folders, ${result.files.length} standalone files, ${result.template_folder_mapping.length} template mappings, total size: ${totalSizeMB.toFixed(2)} MB`);

    if (result.skippedFiles > 0) {
      console.warn(`Warning: ${result.skippedFiles} thumbnail files were skipped due to size limit`);
    }
  } catch (err) {
    console.error('Error exporting thumbnail files:', err);
    throw new Error(`Failed to export thumbnail files: ${err.message}`);
  }

  return result;
}

/**
 * Comprehensive export of all user data
 * @param {string} userId - User ID
 * @param {Array<string>|null} categories - Categories to export (null = all)
 * @returns {Promise<Object>} Comprehensive backup object
 */
async function comprehensiveExport(userId, categories = null) {
  const selectedCategories = categories && categories.length > 0
    ? categories.filter(c => ALL_CATEGORIES.includes(c))
    : ALL_CATEGORIES;

  console.log(`[comprehensiveExport] Exporting for user ${userId}, categories:`, selectedCategories);

  const backup = {
    metadata: {
      exportDate: new Date().toISOString(),
      appVersion: '1.0.0',
      exportType: 'comprehensive',
      counts: {}
    }
  };

  // Export each selected category
  for (const category of selectedCategories) {
    try {
      console.log(`[comprehensiveExport] Exporting category: ${category}`);

      switch (category) {
        case 'streams':
          backup.streams = await exportStreamsOnly(userId);
          backup.metadata.counts.streams = backup.streams.length;
          break;
        case 'youtube_credentials':
          backup.youtube_credentials = await exportYouTubeCredentials(userId);
          backup.metadata.counts.youtube_credentials = backup.youtube_credentials.length;
          break;
        case 'broadcast_templates':
          backup.broadcast_templates = await exportBroadcastTemplates(userId);
          backup.metadata.counts.broadcast_templates = backup.broadcast_templates.length;
          break;
        case 'recurring_schedules':
          backup.recurring_schedules = await exportRecurringSchedules(userId);
          backup.metadata.counts.recurring_schedules = backup.recurring_schedules.length;
          break;
        case 'stream_templates':
          backup.stream_templates = await exportStreamTemplates(userId);
          backup.metadata.counts.stream_templates = backup.stream_templates.length;
          break;
        case 'playlists':
          backup.playlists = await exportPlaylists(userId);
          backup.metadata.counts.playlists = backup.playlists.length;
          break;
        case 'title_folders':
          backup.title_folders = await exportTitleFolders(userId);
          backup.metadata.counts.title_folders = backup.title_folders.length;
          break;
        case 'title_suggestions':
          backup.title_suggestions = await exportTitleSuggestions(userId);
          backup.metadata.counts.title_suggestions = backup.title_suggestions.length;
          break;
        case 'thumbnail_files':
          backup.thumbnail_files = await exportThumbnailFiles(userId);
          backup.metadata.counts.thumbnail_folders = backup.thumbnail_files.folders.length;
          backup.metadata.counts.thumbnail_standalone_files = backup.thumbnail_files.files.length;
          backup.metadata.counts.thumbnail_skipped_files = backup.thumbnail_files.skippedFiles || 0;
          backup.metadata.counts.thumbnail_total_size_mb = (backup.thumbnail_files.totalSize / (1024 * 1024)).toFixed(2);
          break;
      }

      console.log(`[comprehensiveExport] Category ${category} exported successfully`);
    } catch (error) {
      console.error(`[comprehensiveExport] Error exporting category ${category}:`, error);
      throw new Error(`Failed to export ${category}: ${error.message}`);
    }
  }

  console.log('[comprehensiveExport] Export completed, counts:', backup.metadata.counts);
  return backup;
}

/**
 * Format backup as pretty-printed JSON string
 * @param {Object} backup - Backup object
 * @returns {string} Pretty-printed JSON
 */
function formatBackupJson(backup) {
  try {
    const jsonString = JSON.stringify(backup, null, 2);
    const sizeInMB = Buffer.byteLength(jsonString, 'utf8') / (1024 * 1024);
    console.log(`[formatBackupJson] Backup size: ${sizeInMB.toFixed(2)} MB`);

    if (sizeInMB > 45) {
      console.warn(`[formatBackupJson] Warning: Backup size (${sizeInMB.toFixed(2)} MB) is close to the 50MB limit`);
    }

    return jsonString;
  } catch (error) {
    console.error('[formatBackupJson] Error formatting backup:', error);
    throw new Error(`Failed to format backup: ${error.message}`);
  }
}

/**
 * Validate comprehensive backup format
 * @param {Object} data - Parsed JSON data
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateComprehensiveBackup(data) {
  const errors = [];
  const warnings = [];

  if (!data || typeof data !== 'object') {
    errors.push('Invalid backup format: data must be an object');
    return { valid: false, errors, warnings };
  }

  // Check for metadata (optional for backward compatibility)
  if (!data.metadata) {
    warnings.push('Backup file does not contain metadata. This may be an old backup format.');
    console.log('[Import] Warning: Old backup format detected (no metadata)');
  }

  // Check for at least one category (arrays or thumbnail_files object)
  const hasArrayCategory = ALL_CATEGORIES.some(cat =>
    cat !== 'thumbnail_files' && Array.isArray(data[cat])
  );
  const hasThumbnailFiles = data.thumbnail_files && typeof data.thumbnail_files === 'object';

  if (!hasArrayCategory && !hasThumbnailFiles) {
    errors.push('Invalid backup format: no valid data categories found');
    return { valid: false, errors, warnings };
  }

  return { valid: true, errors, warnings };
}

/**
 * Validate YouTube credential for import
 * @param {Object} cred - Credential object
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateYouTubeCredential(cred) {
  const errors = [];

  if (!cred.refresh_token || cred.refresh_token.trim() === '') {
    errors.push('Missing required field: refresh_token');
  }
  if (!cred.channel_id || cred.channel_id.trim() === '') {
    errors.push('Missing required field: channel_id');
  }
  if (!cred.client_id || cred.client_id.trim() === '') {
    errors.push('Missing required field: client_id');
  }
  if (!cred.client_secret || cred.client_secret.trim() === '') {
    errors.push('Missing required field: client_secret');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate broadcast template for import
 * @param {Object} template - Template object
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateBroadcastTemplate(template) {
  const errors = [];

  if (!template.name || template.name.trim() === '') {
    errors.push('Missing required field: name');
  }
  if (!template.title || template.title.trim() === '') {
    errors.push('Missing required field: title');
  }

  // Validate recurring config if enabled
  if (template.recurring_enabled) {
    if (!template.recurring_pattern || !['daily', 'weekly'].includes(template.recurring_pattern)) {
      errors.push('Invalid recurring_pattern: must be daily or weekly');
    }
    if (!template.recurring_time) {
      errors.push('Missing recurring_time when recurring is enabled');
    }
    if (template.recurring_pattern === 'weekly') {
      if (!template.recurring_days || !Array.isArray(template.recurring_days) || template.recurring_days.length === 0) {
        errors.push('Weekly schedule requires at least one day selected');
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Import YouTube credentials from backup
 * @param {Array} credentials - Array of credentials to import
 * @param {string} userId - User ID
 * @param {Object} options - Import options
 * @returns {Promise<{imported: number, skipped: number, errors: string[]}>}
 */
async function importYouTubeCredentialsData(credentials, userId, options = {}) {
  const result = { imported: 0, skipped: 0, errors: [] };

  if (!Array.isArray(credentials)) return result;

  for (let i = 0; i < credentials.length; i++) {
    const cred = credentials[i];
    const validation = validateYouTubeCredential(cred);

    if (!validation.valid) {
      result.skipped++;
      result.errors.push(`youtube_credentials[${i}]: ${validation.errors.join(', ')}`);
      continue;
    }

    try {
      // Check for duplicate
      const exists = await YouTubeCredentials.existsByChannel(userId, cred.channel_id);
      if (exists) {
        if (options.skipDuplicates) {
          result.skipped++;
          continue;
        }
        // TODO: Implement overwrite if needed
      }

      await YouTubeCredentials.create(userId, {
        clientId: cred.client_id,
        clientSecret: cred.client_secret,
        refreshToken: cred.refresh_token,
        channelName: cred.channel_name || 'Unknown Channel',
        channelId: cred.channel_id
      });
      result.imported++;
    } catch (error) {
      result.skipped++;
      result.errors.push(`youtube_credentials[${i}]: ${error.message}`);
    }
  }

  return result;
}

/**
 * Import broadcast templates from backup
 * @param {Array} templates - Array of templates to import
 * @param {string} userId - User ID
 * @param {Object} options - Import options
 * @param {Map} thumbnailFolderMap - Map of template names to thumbnail folder info
 * @returns {Promise<{imported: number, skipped: number, errors: string[]}>}
 */
async function importBroadcastTemplatesData(templates, userId, options = {}, thumbnailFolderMap = new Map()) {
  const result = { imported: 0, skipped: 0, errors: [] };

  if (!Array.isArray(templates)) return result;

  for (let i = 0; i < templates.length; i++) {
    const template = templates[i];
    const validation = validateBroadcastTemplate(template);

    if (!validation.valid) {
      result.skipped++;
      result.errors.push(`broadcast_templates[${i}]: ${validation.errors.join(', ')}`);
      continue;
    }

    try {
      // Check for duplicate by name
      const exists = await BroadcastTemplate.findByName(userId, template.name);
      if (exists) {
        if (options.skipDuplicates) {
          result.skipped++;
          result.errors.push(`broadcast_templates[${i}]: Template "${template.name}" already exists (skipped)`);
          continue;
        }
      }

      // Get thumbnail folder info from mapping if available
      let thumbnailFolder = template.thumbnail_folder;
      let thumbnailIndex = template.thumbnail_index || 0;
      let pinnedThumbnail = template.pinned_thumbnail;
      let streamKeyFolderMapping = template.stream_key_folder_mapping;

      // Check if we have mapping info for this template
      if (thumbnailFolderMap.has(template.name)) {
        const folderInfo = thumbnailFolderMap.get(template.name);
        thumbnailFolder = folderInfo.folder_id;
        thumbnailIndex = folderInfo.thumbnail_index || thumbnailIndex;
        pinnedThumbnail = folderInfo.pinned_thumbnail || pinnedThumbnail;
        streamKeyFolderMapping = folderInfo.stream_key_folder_mapping || streamKeyFolderMapping;
        console.log(`Restored thumbnail folder mapping for template "${template.name}": ${thumbnailFolder}`);
      }

      await BroadcastTemplate.create({
        user_id: userId,
        account_id: template.account_id,
        name: template.name,
        title: template.title,
        description: template.description,
        privacy_status: template.privacy_status || 'unlisted',
        tags: template.tags,
        category_id: template.category_id || '20',
        thumbnail_path: template.thumbnail_path,
        thumbnail_folder: thumbnailFolder,
        thumbnail_index: thumbnailIndex,
        pinned_thumbnail: pinnedThumbnail,
        stream_key_folder_mapping: streamKeyFolderMapping,
        title_index: template.title_index || 0,
        pinned_title_id: template.pinned_title_id,
        title_folder_id: template.title_folder_id,
        stream_id: template.stream_id,
        recurring_enabled: template.recurring_enabled || false,
        recurring_pattern: template.recurring_pattern,
        recurring_time: template.recurring_time,
        recurring_days: template.recurring_days,
        next_run_at: template.next_run_at
      });
      result.imported++;
    } catch (error) {
      result.skipped++;
      result.errors.push(`broadcast_templates[${i}]: ${error.message}`);
    }
  }

  return result;
}

/**
 * Import recurring schedules from backup
 * @param {Array} schedules - Array of schedules to import
 * @param {string} userId - User ID
 * @param {Object} options - Import options
 * @returns {Promise<{imported: number, skipped: number, errors: string[]}>}
 */
async function importRecurringSchedulesData(schedules, userId, options = {}) {
  const result = { imported: 0, skipped: 0, errors: [] };

  if (!Array.isArray(schedules)) return result;

  for (let i = 0; i < schedules.length; i++) {
    const schedule = schedules[i];

    try {
      await RecurringSchedule.create({
        user_id: userId,
        account_id: schedule.account_id,
        name: schedule.name,
        pattern: schedule.pattern,
        schedule_time: schedule.schedule_time,
        days_of_week: schedule.days_of_week,
        template_id: schedule.template_id,
        title_template: schedule.title_template,
        description: schedule.description,
        privacy_status: schedule.privacy_status || 'unlisted',
        tags: schedule.tags,
        category_id: schedule.category_id || '20',
        is_active: schedule.is_active !== false,
        next_run_at: schedule.next_run_at
      });
      result.imported++;
    } catch (error) {
      result.skipped++;
      result.errors.push(`recurring_schedules[${i}]: ${error.message}`);
    }
  }

  return result;
}

/**
 * Import stream templates from backup
 * Supports matching video/audio by filename if video_filename/audio_filename is provided
 * @param {Array} templates - Array of templates to import
 * @param {string} userId - User ID
 * @param {Object} options - Import options
 * @returns {Promise<{imported: number, skipped: number, matched: {video: number, audio: number}, errors: string[]}>}
 */
async function importStreamTemplatesData(templates, userId, options = {}) {
  const result = { imported: 0, skipped: 0, matched: { video: 0, audio: 0 }, errors: [] };

  if (!Array.isArray(templates)) return result;

  // Get all videos and audios for this user to match by filename
  const videos = await Video.findAll(userId);
  const audios = await Audio.findAll(userId);

  // Create lookup maps by filename
  const videoByFilename = new Map();
  videos.forEach(v => {
    if (v.filepath) {
      const filename = path.basename(v.filepath);
      videoByFilename.set(filename, v);
    }
    if (v.title) {
      videoByFilename.set(v.title, v);
    }
  });

  const audioByFilename = new Map();
  audios.forEach(a => {
    if (a.filepath) {
      const filename = path.basename(a.filepath);
      audioByFilename.set(filename, a);
    }
    if (a.title) {
      audioByFilename.set(a.title, a);
    }
  });

  for (let i = 0; i < templates.length; i++) {
    const template = templates[i];

    try {
      // Check for duplicate by name
      const exists = await StreamTemplate.findByName(userId, template.name);
      if (exists) {
        if (options.skipDuplicates) {
          result.skipped++;
          continue;
        }
      }

      // Match video by filename if provided
      let video_id = template.video_id;
      if (template.video_filename) {
        const matchedVideo = videoByFilename.get(template.video_filename);
        if (matchedVideo) {
          video_id = matchedVideo.id;
          result.matched.video++;
        }
      }

      // Match audio by filename if provided
      let audio_id = template.audio_id;
      if (template.audio_filename) {
        const matchedAudio = audioByFilename.get(template.audio_filename);
        if (matchedAudio) {
          audio_id = matchedAudio.id;
          result.matched.audio++;
        }
      }

      await StreamTemplate.create({
        user_id: userId,
        name: template.name,
        video_id: video_id,
        audio_id: audio_id,
        duration_hours: template.duration_hours || 0,
        duration_minutes: template.duration_minutes || 0,
        loop_video: template.loop_video !== false,
        schedule_type: template.schedule_type || 'once',
        recurring_time: template.recurring_time,
        schedule_days: template.schedule_days
      });
      result.imported++;
    } catch (error) {
      result.skipped++;
      result.errors.push(`stream_templates[${i}]: ${error.message}`);
    }
  }

  return result;
}

/**
 * Import playlists from backup
 * Supports matching videos by filename if video_filename is provided
 * @param {Array} playlists - Array of playlists to import
 * @param {string} userId - User ID
 * @param {Object} options - Import options
 * @returns {Promise<{imported: number, skipped: number, matchedVideos: number, errors: string[]}>}
 */
async function importPlaylistsData(playlists, userId, options = {}) {
  const result = { imported: 0, skipped: 0, matchedVideos: 0, errors: [] };

  if (!Array.isArray(playlists)) return result;

  // Get all videos for this user to match by filename
  const videos = await Video.findAll(userId);

  // Create lookup maps by filename (basename of filepath) and title
  const videoByFilename = new Map();
  videos.forEach(v => {
    if (v.filepath) {
      const filename = path.basename(v.filepath);
      videoByFilename.set(filename, v);
    }
    // Also map by title for fallback matching
    if (v.title) {
      videoByFilename.set(v.title, v);
    }
  });

  for (let i = 0; i < playlists.length; i++) {
    const playlist = playlists[i];

    try {
      const created = await Playlist.create({
        user_id: userId,
        name: playlist.name,
        description: playlist.description,
        is_shuffle: playlist.is_shuffle ? 1 : 0
      });

      // Add videos if present
      if (playlist.videos && Array.isArray(playlist.videos)) {
        for (const video of playlist.videos) {
          try {
            let videoId = video.video_id;

            // Try to match by filename first if provided
            if (video.video_filename) {
              const matchedVideo = videoByFilename.get(video.video_filename);
              if (matchedVideo) {
                videoId = matchedVideo.id;
                result.matchedVideos++;
              }
            }
            // Fallback to title matching if filename not found
            else if (video.video_title) {
              const matchedVideo = videoByFilename.get(video.video_title);
              if (matchedVideo) {
                videoId = matchedVideo.id;
                result.matchedVideos++;
              }
            }

            if (videoId) {
              await Playlist.addVideo(created.id, videoId, video.position);
            } else {
              result.errors.push(`playlists[${i}]: Warning - could not find video ${video.video_filename || video.video_title || video.video_id}`);
            }
          } catch (videoErr) {
            // Log warning but continue
            result.errors.push(`playlists[${i}]: Warning - could not add video ${video.video_filename || video.video_id}`);
          }
        }
      }

      result.imported++;
    } catch (error) {
      result.skipped++;
      result.errors.push(`playlists[${i}]: ${error.message}`);
    }
  }

  return result;
}

/**
 * Import title folders from backup
 * @param {Array} folders - Array of folders to import
 * @param {string} userId - User ID
 * @param {Object} options - Import options
 * @returns {Promise<{imported: number, skipped: number, errors: string[], folderMap: Map}>}
 */
async function importTitleFoldersData(folders, userId, options = {}) {
  const result = { imported: 0, skipped: 0, errors: [], folderMap: new Map() };

  if (!Array.isArray(folders)) return result;

  // Get existing folders to check for duplicates
  const existingFolders = await TitleFolder.findByUserId(userId);
  const existingByName = new Map(existingFolders.map(f => [f.name, f]));

  for (let i = 0; i < folders.length; i++) {
    const folder = folders[i];

    if (!folder.name || folder.name.trim() === '') {
      result.skipped++;
      result.errors.push(`title_folders[${i}]: Missing required field: name`);
      continue;
    }

    try {
      // Check for duplicate by name
      const existing = existingByName.get(folder.name);
      if (existing) {
        if (options.skipDuplicates) {
          result.skipped++;
          result.errors.push(`title_folders[${i}]: Folder "${folder.name}" already exists (skipped)`);
          // Map the existing folder for title matching
          result.folderMap.set(folder.name, existing.id);
          continue;
        }
      }

      const created = await TitleFolder.create({
        user_id: userId,
        name: folder.name,
        color: folder.color || '#8B5CF6'
      });

      result.folderMap.set(folder.name, created.id);
      result.imported++;
    } catch (error) {
      if (error.message.includes('already exists')) {
        result.skipped++;
        result.errors.push(`title_folders[${i}]: Folder "${folder.name}" already exists`);
        // Try to get existing folder ID for mapping
        const existing = existingByName.get(folder.name);
        if (existing) {
          result.folderMap.set(folder.name, existing.id);
        }
      } else {
        result.skipped++;
        result.errors.push(`title_folders[${i}]: ${error.message}`);
      }
    }
  }

  return result;
}

/**
 * Import title suggestions from backup
 * @param {Array} titles - Array of titles to import
 * @param {string} userId - User ID
 * @param {Map} folderMap - Map of folder names to IDs
 * @param {Object} options - Import options
 * @returns {Promise<{imported: number, skipped: number, errors: string[]}>}
 */
async function importTitleSuggestionsData(titles, userId, folderMap, options = {}) {
  const result = { imported: 0, skipped: 0, errors: [] };

  if (!Array.isArray(titles)) return result;

  // Get existing titles to check for duplicates
  const existingTitles = await TitleSuggestion.findByUserId(userId);
  const existingByTitle = new Set(existingTitles.map(t => t.title.toLowerCase()));

  for (let i = 0; i < titles.length; i++) {
    const title = titles[i];

    if (!title.title || title.title.trim() === '') {
      result.skipped++;
      result.errors.push(`title_suggestions[${i}]: Missing required field: title`);
      continue;
    }

    try {
      // Check for duplicate by title text (case-insensitive)
      if (existingByTitle.has(title.title.toLowerCase())) {
        if (options.skipDuplicates) {
          result.skipped++;
          result.errors.push(`title_suggestions[${i}]: Title "${title.title}" already exists (skipped)`);
          continue;
        }
      }

      // Match folder by name if provided
      let folderId = null;
      if (title.folder_name && folderMap) {
        folderId = folderMap.get(title.folder_name) || null;
      }

      await TitleSuggestion.create({
        user_id: userId,
        title: title.title,
        folder_id: folderId
      });

      // Add to existing set to prevent duplicates within same import
      existingByTitle.add(title.title.toLowerCase());
      result.imported++;
    } catch (error) {
      if (error.message.includes('already exists')) {
        result.skipped++;
        result.errors.push(`title_suggestions[${i}]: Title "${title.title}" already exists`);
      } else {
        result.skipped++;
        result.errors.push(`title_suggestions[${i}]: ${error.message}`);
      }
    }
  }

  return result;
}

/**
 * Import thumbnail files from backup
 * Restores thumbnail folders and files to user's thumbnail directory
 * For thumbnail files, we always overwrite existing files since backup is the source of truth
 * Returns folder mapping for updating broadcast templates
 * @param {Object} thumbnailData - Thumbnail files data
 * @param {string} userId - User ID for user-specific thumbnail directory
 * @param {Object} options - Import options (skipDuplicates only affects count reporting)
 * @returns {Promise<{imported: number, skipped: number, overwritten: number, errors: string[], folderMap: Map}>}
 */
async function importThumbnailFilesData(thumbnailData, userId, options = {}) {
  const result = {
    imported: 0,
    skipped: 0,
    overwritten: 0, // Track overwritten files
    errors: [],
    folderMap: new Map(), // Maps template_name to folder_id for updating templates
    templateFolderMapping: [] // Original mapping from backup
  };

  if (!thumbnailData) return result;

  // User-specific thumbnail directory
  const userThumbnailsDir = path.join(process.cwd(), 'public', 'uploads', 'thumbnails', String(userId));

  // Ensure user's thumbnails directory exists
  try {
    await fs.mkdir(userThumbnailsDir, { recursive: true });
    console.log(`Created/verified user thumbnail directory: ${userThumbnailsDir}`);
  } catch (err) {
    // Directory may already exist
  }

  // Store template folder mapping for later use
  if (thumbnailData.template_folder_mapping && Array.isArray(thumbnailData.template_folder_mapping)) {
    result.templateFolderMapping = thumbnailData.template_folder_mapping;

    // Build folder map from template mapping
    for (const mapping of thumbnailData.template_folder_mapping) {
      if (mapping.template_name && mapping.folder_id !== undefined) {
        result.folderMap.set(mapping.template_name, {
          folder_id: mapping.folder_id,
          thumbnail_index: mapping.thumbnail_index || 0,
          pinned_thumbnail: mapping.pinned_thumbnail,
          stream_key_folder_mapping: mapping.stream_key_folder_mapping
        });
      }
    }
  }

  // Import folder-based thumbnails
  if (thumbnailData.folders && Array.isArray(thumbnailData.folders)) {
    for (const folder of thumbnailData.folders) {
      const folderPath = path.join(userThumbnailsDir, folder.folder_id);

      try {
        // Create folder if it doesn't exist
        await fs.mkdir(folderPath, { recursive: true });

        // Add to folderMap if template_name is provided and not already in map from template_folder_mapping
        if (folder.template_name && !result.folderMap.has(folder.template_name)) {
          result.folderMap.set(folder.template_name, {
            folder_id: folder.folder_id,
            thumbnail_index: 0,
            pinned_thumbnail: null,
            stream_key_folder_mapping: null
          });
        }

        if (folder.files && Array.isArray(folder.files)) {
          for (const file of folder.files) {
            const filePath = path.join(folderPath, file.filename);

            try {
              // Check if file already exists
              const exists = fsSync.existsSync(filePath);

              // Always write the file (overwrite if exists)
              // Thumbnail files should always be restored from backup
              const buffer = Buffer.from(file.data, 'base64');
              await fs.writeFile(filePath, buffer);

              if (exists) {
                result.overwritten++;
                console.log(`Overwritten thumbnail: ${folder.folder_id}/${file.filename}`);
              } else {
                result.imported++;
                console.log(`Imported thumbnail: ${folder.folder_id}/${file.filename}`);
              }
            } catch (fileErr) {
              result.errors.push(`thumbnail ${folder.folder_id}/${file.filename}: ${fileErr.message}`);
              result.skipped++;
            }
          }
        }
      } catch (folderErr) {
        result.errors.push(`thumbnail folder ${folder.folder_id}: ${folderErr.message}`);
      }
    }
  }

  // Import standalone thumbnail files (root level)
  if (thumbnailData.files && Array.isArray(thumbnailData.files)) {
    for (const file of thumbnailData.files) {
      const filePath = path.join(userThumbnailsDir, file.filename);

      try {
        // Check if file already exists
        const exists = fsSync.existsSync(filePath);

        // Always write the file (overwrite if exists)
        const buffer = Buffer.from(file.data, 'base64');
        await fs.writeFile(filePath, buffer);

        if (exists) {
          result.overwritten++;
          console.log(`Overwritten standalone thumbnail: ${file.filename}`);
        } else {
          result.imported++;
          console.log(`Imported standalone thumbnail: ${file.filename}`);
        }
      } catch (fileErr) {
        result.errors.push(`thumbnail ${file.filename}: ${fileErr.message}`);
        result.skipped++;
      }
    }
  }

  console.log(`Thumbnail import complete for user ${userId}: ${result.imported} new, ${result.overwritten} overwritten, ${result.skipped} failed, ${result.folderMap.size} template mappings`);

  return result;
}

/**
 * Comprehensive import of all user data
 * @param {Object} backupData - Backup data object
 * @param {string} userId - User ID
 * @param {Object} options - Import options (skipDuplicates, overwrite)
 * @returns {Promise<Object>} Import results
 */
async function comprehensiveImport(backupData, userId, options = {}) {
  const results = {
    success: true,
    results: {},
    warnings: []
  };

  // Auto-migrate old format if detected
  const migrationHelper = require('./migration-helper');
  const originalData = backupData;
  backupData = migrationHelper.autoMigrate(backupData);

  // Add migration warning if data was migrated
  if (backupData !== originalData && backupData.metadata && backupData.metadata.migrated) {
    results.warnings.push('Backup file was in old format and has been automatically converted to new format.');
    console.log('[Import] Old format detected and migrated');
  }

  // Validate backup format
  const validation = validateComprehensiveBackup(backupData);
  if (!validation.valid) {
    console.error('[Import] Validation failed:', validation.errors);
    return {
      success: false,
      error: 'Validation failed',
      details: validation.errors
    };
  }

  // Add validation warnings to results
  if (validation.warnings && validation.warnings.length > 0) {
    results.warnings.push(...validation.warnings);
  }

  // Import thumbnail files FIRST to get folder mapping
  // This ensures thumbnail folders exist before importing templates that reference them
  let thumbnailFolderMap = new Map();
  if (backupData.thumbnail_files) {
    try {
      console.log('[Import] Starting thumbnail_files import...');
      const thumbnailResult = await importThumbnailFilesData(
        backupData.thumbnail_files, userId, options
      );
      results.results.thumbnail_files = {
        imported: thumbnailResult.imported,
        overwritten: thumbnailResult.overwritten,
        skipped: thumbnailResult.skipped,
        errors: thumbnailResult.errors
      };
      thumbnailFolderMap = thumbnailResult.folderMap;
      console.log(`[Import] Thumbnail folder map has ${thumbnailFolderMap.size} entries`);
    } catch (error) {
      console.error('[Import] Error importing thumbnail_files:', error.message);
      results.results.thumbnail_files = {
        imported: 0,
        errors: [`Failed to import thumbnails: ${error.message}`]
      };
      results.warnings.push(`Thumbnail import failed: ${error.message}`);
    }
  }

  // Import in correct order for referential integrity
  // 1. YouTube credentials first (referenced by templates)
  if (backupData.youtube_credentials) {
    try {
      console.log('[Import] Starting youtube_credentials import...');
      results.results.youtube_credentials = await importYouTubeCredentialsData(
        backupData.youtube_credentials, userId, options
      );
    } catch (error) {
      console.error('[Import] Error importing youtube_credentials:', error.message);
      results.results.youtube_credentials = {
        imported: 0,
        errors: [`Failed: ${error.message}`]
      };
      results.warnings.push(`YouTube credentials import failed: ${error.message}`);
    }
  }

  // 2. Streams (independent)
  if (backupData.streams) {
    try {
      console.log('[Import] Starting streams import...');
      results.results.streams = await importStreams({ streams: backupData.streams }, userId, options);
    } catch (error) {
      console.error('[Import] Error importing streams:', error.message);
      console.error('[Import] Error stack:', error.stack);
      results.results.streams = {
        imported: 0,
        errors: [`Failed: ${error.message}`]
      };
      results.warnings.push(`Streams import failed: ${error.message}`);
    }
  }

  // 3. Broadcast templates (may reference credentials and thumbnail folders)
  if (backupData.broadcast_templates) {
    try {
      console.log('[Import] Starting broadcast_templates import...');
      results.results.broadcast_templates = await importBroadcastTemplatesData(
        backupData.broadcast_templates, userId, options, thumbnailFolderMap
      );
    } catch (error) {
      console.error('[Import] Error importing broadcast_templates:', error.message);
      results.results.broadcast_templates = {
        imported: 0,
        errors: [`Failed: ${error.message}`]
      };
      results.warnings.push(`Broadcast templates import failed: ${error.message}`);
    }
  }

  // 4. Stream templates (independent)
  if (backupData.stream_templates) {
    try {
      console.log('[Import] Starting stream_templates import...');
      results.results.stream_templates = await importStreamTemplatesData(
        backupData.stream_templates, userId, options
      );
    } catch (error) {
      console.error('[Import] Error importing stream_templates:', error.message);
      results.results.stream_templates = {
        imported: 0,
        errors: [`Failed: ${error.message}`]
      };
      results.warnings.push(`Stream templates import failed: ${error.message}`);
    }
  }

  // 5. Recurring schedules (may reference templates and credentials)
  if (backupData.recurring_schedules) {
    try {
      console.log('[Import] Starting recurring_schedules import...');
      results.results.recurring_schedules = await importRecurringSchedulesData(
        backupData.recurring_schedules, userId, options
      );
    } catch (error) {
      console.error('[Import] Error importing recurring_schedules:', error.message);
      results.results.recurring_schedules = {
        imported: 0,
        errors: [`Failed: ${error.message}`]
      };
      results.warnings.push(`Recurring schedules import failed: ${error.message}`);
    }
  }

  // 6. Playlists (may reference videos)
  if (backupData.playlists) {
    try {
      console.log('[Import] Starting playlists import...');
      results.results.playlists = await importPlaylistsData(
        backupData.playlists, userId, options
      );
    } catch (error) {
      console.error('[Import] Error importing playlists:', error.message);
      results.results.playlists = {
        imported: 0,
        errors: [`Failed: ${error.message}`]
      };
      results.warnings.push(`Playlists import failed: ${error.message}`);
    }
  }

  // 7. Title folders (must be imported before title suggestions)
  let folderMap = new Map();
  if (backupData.title_folders) {
    try {
      console.log('[Import] Starting title_folders import...');
      const folderResult = await importTitleFoldersData(
        backupData.title_folders, userId, options
      );
      results.results.title_folders = {
        imported: folderResult.imported,
        skipped: folderResult.skipped,
        errors: folderResult.errors
      };
      folderMap = folderResult.folderMap;
    } catch (error) {
      console.error('[Import] Error importing title_folders:', error.message);
      results.results.title_folders = {
        imported: 0,
        errors: [`Failed: ${error.message}`]
      };
      results.warnings.push(`Title folders import failed: ${error.message}`);
    }
  }

  // 8. Title suggestions (references title folders)
  if (backupData.title_suggestions) {
    try {
      console.log('[Import] Starting title_suggestions import...');
      results.results.title_suggestions = await importTitleSuggestionsData(
        backupData.title_suggestions, userId, folderMap, options
      );
    } catch (error) {
      console.error('[Import] Error importing title_suggestions:', error.message);
      results.results.title_suggestions = {
        imported: 0,
        errors: [`Failed: ${error.message}`]
      };
      results.warnings.push(`Title suggestions import failed: ${error.message}`);
    }
  }

  console.log('[Import] Comprehensive import completed');
  return results;
}

// Template-only export fields (excludes account-specific and system fields)
const TEMPLATE_EXPORT_FIELDS = [
  'name',
  'title',
  'description',
  'privacy_status',
  'tags',
  'category_id',
  'thumbnail_path',
  'recurring_enabled',
  'recurring_pattern',
  'recurring_time',
  'recurring_days'
];

/**
 * Export templates only (standalone template backup)
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Template backup object with metadata
 */
async function exportTemplatesOnly(userId) {
  const templates = await BroadcastTemplate.findByUserId(userId);

  const exportedTemplates = templates.map(template => {
    const exported = {};
    TEMPLATE_EXPORT_FIELDS.forEach(field => {
      if (template[field] !== undefined) {
        exported[field] = template[field];
      }
    });
    return exported;
  });

  return {
    metadata: {
      exportDate: new Date().toISOString(),
      appVersion: '1.0.0',
      exportType: 'templates',
      totalTemplates: exportedTemplates.length
    },
    templates: exportedTemplates
  };
}

/**
 * Validate template backup file format
 * @param {Object} data - Parsed JSON data
 * @returns {{valid: boolean, errors: string[], templateCount: number}}
 */
function validateTemplateBackup(data) {
  const errors = [];
  let templateCount = 0;

  if (!data || typeof data !== 'object') {
    errors.push('Invalid backup format: data must be an object');
    return { valid: false, errors, templateCount: 0 };
  }

  // Check for metadata
  if (!data.metadata) {
    errors.push('Invalid backup format: missing metadata');
    return { valid: false, errors, templateCount: 0 };
  }

  // Check for templates array
  if (!Array.isArray(data.templates)) {
    errors.push('Invalid backup format: missing templates array');
    return { valid: false, errors, templateCount: 0 };
  }

  templateCount = data.templates.length;

  return { valid: true, errors, templateCount };
}

/**
 * Validate single template for import
 * @param {Object} template - Template object
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateTemplateForImport(template) {
  const errors = [];

  // Check required fields
  if (!template.name || (typeof template.name === 'string' && template.name.trim() === '')) {
    errors.push('Missing required field: name');
  }
  if (!template.title || (typeof template.title === 'string' && template.title.trim() === '')) {
    errors.push('Missing required field: title');
  }

  // Validate recurring config if enabled
  if (template.recurring_enabled) {
    if (!template.recurring_pattern || !['daily', 'weekly'].includes(template.recurring_pattern)) {
      errors.push('Invalid recurring_pattern: must be daily or weekly');
    }
    if (!template.recurring_time) {
      errors.push('Missing recurring_time when recurring is enabled');
    }
    if (template.recurring_pattern === 'weekly') {
      if (!template.recurring_days || !Array.isArray(template.recurring_days) || template.recurring_days.length === 0) {
        errors.push('Weekly schedule requires at least one day selected');
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Import templates only (standalone template import)
 * @param {Object} backupData - Parsed backup JSON
 * @param {string} userId - User ID
 * @param {string} accountId - Default account ID for imported templates
 * @param {Object} options - Import options (skipDuplicates)
 * @returns {Promise<{imported: number, skipped: number, errors: string[]}>}
 */
async function importTemplatesOnly(backupData, userId, accountId, options = {}) {
  const result = { imported: 0, skipped: 0, errors: [] };

  // Validate backup format first
  const formatValidation = validateTemplateBackup(backupData);
  if (!formatValidation.valid) {
    result.errors = formatValidation.errors;
    return result;
  }

  if (!Array.isArray(backupData.templates)) {
    return result;
  }

  for (let i = 0; i < backupData.templates.length; i++) {
    const template = backupData.templates[i];
    const validation = validateTemplateForImport(template);

    if (!validation.valid) {
      result.skipped++;
      result.errors.push(`templates[${i}]: ${validation.errors.join(', ')}`);
      continue;
    }

    try {
      // Check for duplicate by name
      const exists = await BroadcastTemplate.findByName(userId, template.name);
      if (exists) {
        if (options.skipDuplicates) {
          result.skipped++;
          result.errors.push(`templates[${i}]: Template "${template.name}" already exists (skipped)`);
          continue;
        }
        // If not skipping, still skip but with different message
        result.skipped++;
        result.errors.push(`templates[${i}]: Template "${template.name}" already exists`);
        continue;
      }

      await BroadcastTemplate.create({
        user_id: userId,
        account_id: accountId,
        name: template.name,
        title: template.title,
        description: template.description || null,
        privacy_status: template.privacy_status || 'unlisted',
        tags: template.tags || null,
        category_id: template.category_id || '20',
        thumbnail_path: template.thumbnail_path || null,
        recurring_enabled: template.recurring_enabled || false,
        recurring_pattern: template.recurring_pattern || null,
        recurring_time: template.recurring_time || null,
        recurring_days: template.recurring_days || null
      });
      result.imported++;
    } catch (error) {
      result.skipped++;
      result.errors.push(`templates[${i}]: ${error.message}`);
    }
  }

  return result;
}

/**
 * Format template backup as pretty-printed JSON string
 * @param {Object} backup - Backup object
 * @returns {string} Pretty-printed JSON
 */
function formatTemplateBackupJson(backup) {
  return JSON.stringify(backup, null, 2);
}

module.exports = {
  exportStreams,
  importStreams,
  validateBackupFormat,
  validateStreamConfig,
  determineImportStatus,
  exportYouTubeCredentials,
  exportBroadcastTemplates,
  exportRecurringSchedules,
  exportStreamTemplates,
  exportPlaylists,
  // Title Manager functions
  exportTitleFolders,
  exportTitleSuggestions,
  importTitleFoldersData,
  importTitleSuggestionsData,
  // Thumbnail files functions
  exportThumbnailFiles,
  importThumbnailFilesData,
  // Comprehensive backup functions
  comprehensiveExport,
  comprehensiveImport,
  validateComprehensiveBackup,
  formatBackupJson,
  // Template-specific functions
  exportTemplatesOnly,
  validateTemplateBackup,
  validateTemplateForImport,
  importTemplatesOnly,
  formatTemplateBackupJson,
  TEMPLATE_EXPORT_FIELDS,
  // Constants
  EXPORT_FIELDS,
  REQUIRED_FIELDS,
  EXCLUDED_FIELDS,
  YOUTUBE_CREDENTIALS_FIELDS,
  BROADCAST_TEMPLATE_FIELDS,
  RECURRING_SCHEDULE_FIELDS,
  STREAM_TEMPLATE_FIELDS,
  PLAYLIST_FIELDS,
  TITLE_FOLDER_FIELDS,
  TITLE_SUGGESTION_FIELDS,
  ALL_CATEGORIES
};
