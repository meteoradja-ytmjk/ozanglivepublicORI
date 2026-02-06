/**
 * Migration Helper Service
 * Handles backward compatibility for importing old backup formats
 */

/**
 * Detect if backup data is in old format
 * @param {Object} data - Backup data
 * @returns {boolean} True if old format detected
 */
function isOldFormat(data) {
    if (!data || typeof data !== 'object') return false;

    // Old format characteristics:
    // 1. No metadata object
    // 2. Has streams array directly
    // 3. May have old field names

    const hasMetadata = data.metadata && typeof data.metadata === 'object';
    const hasStreamsArray = Array.isArray(data.streams);

    // If has metadata with exportType, it's new format
    if (hasMetadata && data.metadata.exportType) {
        return false;
    }

    // If has streams array but no metadata, likely old format
    if (hasStreamsArray && !hasMetadata) {
        return true;
    }

    return false;
}

/**
 * Migrate old format to new format
 * @param {Object} oldData - Old format backup data
 * @returns {Object} New format backup data
 */
function migrateToNewFormat(oldData) {
    console.log('[Migration] Converting old format to new format');

    const newData = {
        metadata: {
            exportDate: new Date().toISOString(),
            appVersion: '1.0.0',
            exportType: 'comprehensive',
            migrated: true,
            originalFormat: 'legacy',
            counts: {}
        }
    };

    // Migrate streams
    if (Array.isArray(oldData.streams)) {
        newData.streams = oldData.streams.map(stream => migrateStreamFields(stream));
        newData.metadata.counts.streams = newData.streams.length;
        console.log(`[Migration] Migrated ${newData.streams.length} streams`);
    }

    // Migrate other categories if they exist
    const categories = [
        'youtube_credentials',
        'broadcast_templates',
        'recurring_schedules',
        'stream_templates',
        'playlists',
        'title_folders',
        'title_suggestions'
    ];

    categories.forEach(category => {
        if (Array.isArray(oldData[category])) {
            newData[category] = oldData[category];
            newData.metadata.counts[category] = oldData[category].length;
            console.log(`[Migration] Migrated ${oldData[category].length} ${category}`);
        }
    });

    // Handle thumbnail_files if present
    if (oldData.thumbnail_files) {
        newData.thumbnail_files = oldData.thumbnail_files;
        console.log('[Migration] Migrated thumbnail_files');
    }

    return newData;
}

/**
 * Migrate individual stream fields from old to new format
 * @param {Object} stream - Old format stream
 * @returns {Object} New format stream
 */
function migrateStreamFields(stream) {
    const migrated = { ...stream };

    // Field name migrations (if old app used different names)
    // Add mappings here as we discover them
    const fieldMappings = {
        // Example: 'old_field_name': 'new_field_name'
        // Add actual mappings based on the old export file
    };

    Object.keys(fieldMappings).forEach(oldField => {
        if (stream[oldField] !== undefined) {
            const newField = fieldMappings[oldField];
            migrated[newField] = stream[oldField];
            delete migrated[oldField];
            console.log(`[Migration] Renamed field: ${oldField} -> ${newField}`);
        }
    });

    // Ensure required fields have defaults
    if (!migrated.platform) {
        migrated.platform = 'YouTube';
    }
    if (!migrated.platform_icon) {
        migrated.platform_icon = 'ti-brand-youtube';
    }
    if (!migrated.bitrate) {
        migrated.bitrate = 2500;
    }
    if (!migrated.resolution) {
        migrated.resolution = '1920x1080';
    }
    if (!migrated.fps) {
        migrated.fps = 30;
    }
    if (!migrated.orientation) {
        migrated.orientation = 'horizontal';
    }
    if (migrated.loop_video === undefined) {
        migrated.loop_video = true;
    }
    if (!migrated.schedule_type) {
        migrated.schedule_type = 'once';
    }

    return migrated;
}

/**
 * Attempt to auto-migrate backup data if old format detected
 * @param {Object} data - Backup data
 * @returns {Object} Migrated data or original data
 */
function autoMigrate(data) {
    if (isOldFormat(data)) {
        console.log('[Migration] Old format detected, attempting auto-migration');
        try {
            const migrated = migrateToNewFormat(data);
            console.log('[Migration] Auto-migration successful');
            return migrated;
        } catch (error) {
            console.error('[Migration] Auto-migration failed:', error.message);
            console.error('[Migration] Returning original data');
            return data;
        }
    }

    console.log('[Migration] New format detected, no migration needed');
    return data;
}

module.exports = {
    isOldFormat,
    migrateToNewFormat,
    migrateStreamFields,
    autoMigrate
};
