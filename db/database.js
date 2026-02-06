const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const dbDir = path.join(__dirname);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const dbPath = path.join(dbDir, 'streamflow.db');

// Track database initialization state
let dbInitialized = false;
let dbInitPromise = null;
let dbInitError = null;

// Required tables that must exist before app can start
const REQUIRED_TABLES = [
  'users', 'videos', 'streams', 'stream_history',
  'playlists', 'playlist_videos', 'playlist_audios', 'audios',
  'system_settings', 'stream_templates', 'youtube_credentials',
  'broadcast_templates', 'recurring_schedules'
];

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
    dbInitError = err;
  } else {
    // Optimize SQLite for better performance and stability
    db.serialize(() => {
      db.run('PRAGMA journal_mode = WAL'); // Write-Ahead Logging for better concurrency
      db.run('PRAGMA synchronous = NORMAL'); // Faster writes, still safe
      db.run('PRAGMA cache_size = 5000'); // REDUCED: Lower cache for 1GB VPS (was 10000)
      db.run('PRAGMA temp_store = MEMORY'); // Store temp tables in memory
      db.run('PRAGMA busy_timeout = 60000'); // INCREASED: Wait 60 seconds if database is locked (was 30)
      db.run('PRAGMA wal_autocheckpoint = 1000'); // Checkpoint every 1000 pages
      db.run('PRAGMA mmap_size = 0'); // DISABLED: Memory mapping can cause issues on low-memory systems
    });

    dbInitPromise = createTables();
  }
});

/**
 * Wait for database to be fully initialized
 * Throws error if initialization failed
 * @returns {Promise<void>}
 */
async function waitForDbInit() {
  if (dbInitError) {
    throw new Error(`Database connection failed: ${dbInitError.message}`);
  }
  if (dbInitialized) return;
  if (dbInitPromise) {
    await dbInitPromise;
  }
  // Double-check initialization succeeded
  if (dbInitError) {
    throw new Error(`Database initialization failed: ${dbInitError.message}`);
  }
}

/**
 * Verify all required tables exist in the database
 * @returns {Promise<{success: boolean, missingTables: string[]}>}
 */
async function verifyTables() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT name FROM sqlite_master WHERE type='table'`,
      [],
      (err, rows) => {
        if (err) {
          console.error('Error verifying tables:', err.message);
          return reject(err);
        }
        const existingTables = rows.map(r => r.name);
        const missingTables = REQUIRED_TABLES.filter(t => !existingTables.includes(t));

        if (missingTables.length > 0) {
          console.warn(`[Database] Missing tables: ${missingTables.join(', ')}`);
        } else {
          console.log('[Database] All required tables verified');
        }

        resolve({
          success: missingTables.length === 0,
          missingTables,
          existingTables
        });
      }
    );
  });
}

/**
 * Run a single table creation query and return a promise
 * @param {string} sql - SQL query to run
 * @param {string} tableName - Name of table for logging
 * @returns {Promise<void>}
 */
function runTableQuery(sql, tableName) {
  return new Promise((resolve, reject) => {
    db.run(sql, (err) => {
      if (err) {
        // Ignore "duplicate column" errors for ALTER TABLE
        if (err.message && err.message.includes('duplicate column name')) {
          resolve();
          return;
        }
        console.error(`Error with ${tableName}:`, err.message);
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

async function createTables() {
  try {
    // Create all tables sequentially to ensure proper order
    await createCoreTablesAsync();

    // Verify all tables were created
    const verification = await verifyTables();
    if (!verification.success) {
      console.error('[Database] Some tables failed to create:', verification.missingTables);
      // Don't throw - some tables might be created by migrations
    }

    // Create default admin if needed
    await createDefaultAdminIfNeeded();

    dbInitialized = true;
    console.log('[Database] Database tables initialized successfully');
  } catch (error) {
    console.error('[Database] Failed to initialize database:', error.message);
    dbInitError = error;
    throw error;
  }
}

/**
 * Create all core tables asynchronously with proper error handling
 */
async function createCoreTablesAsync() {
  // Create tables in order of dependencies
  await runTableQuery(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    avatar_path TEXT,
    gdrive_api_key TEXT,
    user_role TEXT DEFAULT 'admin',
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`, 'users');

  await runTableQuery(`CREATE TABLE IF NOT EXISTS videos (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    filepath TEXT NOT NULL,
    thumbnail_path TEXT,
    file_size INTEGER,
    duration REAL,
    format TEXT,
    resolution TEXT,
    bitrate INTEGER,
    fps TEXT,
    user_id TEXT,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`, 'videos');

  await runTableQuery(`CREATE TABLE IF NOT EXISTS streams (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    video_id TEXT,
    rtmp_url TEXT NOT NULL,
    stream_key TEXT NOT NULL,
    platform TEXT,
    platform_icon TEXT,
    bitrate INTEGER DEFAULT 2500,
    resolution TEXT,
    fps INTEGER DEFAULT 30,
    orientation TEXT DEFAULT 'horizontal',
    loop_video BOOLEAN DEFAULT 1,
    schedule_time TIMESTAMP,
    duration INTEGER,
    status TEXT DEFAULT 'offline',
    status_updated_at TIMESTAMP,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    use_advanced_settings BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (video_id) REFERENCES videos(id)
  )`, 'streams');

  await runTableQuery(`CREATE TABLE IF NOT EXISTS stream_history (
    id TEXT PRIMARY KEY,
    stream_id TEXT,
    title TEXT NOT NULL,
    platform TEXT,
    platform_icon TEXT,
    video_id TEXT,
    video_title TEXT,
    resolution TEXT,
    bitrate INTEGER,
    fps INTEGER,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    duration INTEGER,
    use_advanced_settings BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (stream_id) REFERENCES streams(id),
    FOREIGN KEY (video_id) REFERENCES videos(id)
  )`, 'stream_history');

  // Add schedule_type column to stream_history
  await runTableQuery(`ALTER TABLE stream_history ADD COLUMN schedule_type TEXT DEFAULT 'once'`, 'stream_history.schedule_type');

  await runTableQuery(`CREATE TABLE IF NOT EXISTS playlists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    is_shuffle BOOLEAN DEFAULT 0,
    user_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`, 'playlists');

  await runTableQuery(`CREATE TABLE IF NOT EXISTS playlist_videos (
    id TEXT PRIMARY KEY,
    playlist_id TEXT NOT NULL,
    video_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
  )`, 'playlist_videos');

  await runTableQuery(`CREATE TABLE IF NOT EXISTS playlist_audios (
    id TEXT PRIMARY KEY,
    playlist_id TEXT NOT NULL,
    audio_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY (audio_id) REFERENCES audios(id) ON DELETE CASCADE
  )`, 'playlist_audios');

  await runTableQuery(`CREATE TABLE IF NOT EXISTS audios (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    filepath TEXT NOT NULL,
    file_size INTEGER,
    duration REAL,
    format TEXT,
    user_id TEXT,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`, 'audios');

  // Add columns to users table
  await runTableQuery(`ALTER TABLE users ADD COLUMN user_role TEXT DEFAULT 'admin'`, 'users.user_role');
  await runTableQuery(`ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'`, 'users.status');
  await runTableQuery(`ALTER TABLE users ADD COLUMN live_limit INTEGER DEFAULT NULL`, 'users.live_limit');
  await runTableQuery(`ALTER TABLE users ADD COLUMN can_view_videos INTEGER DEFAULT 1`, 'users.can_view_videos');
  await runTableQuery(`ALTER TABLE users ADD COLUMN can_download_videos INTEGER DEFAULT 1`, 'users.can_download_videos');
  await runTableQuery(`ALTER TABLE users ADD COLUMN can_delete_videos INTEGER DEFAULT 1`, 'users.can_delete_videos');
  await runTableQuery(`ALTER TABLE users ADD COLUMN storage_limit INTEGER DEFAULT NULL`, 'users.storage_limit');

  // Add columns to streams table
  await runTableQuery(`ALTER TABLE streams ADD COLUMN audio_id TEXT`, 'streams.audio_id');
  await runTableQuery(`ALTER TABLE streams ADD COLUMN stream_duration_hours INTEGER`, 'streams.stream_duration_hours');
  await runTableQuery(`ALTER TABLE streams ADD COLUMN stream_duration_minutes INTEGER`, 'streams.stream_duration_minutes');
  await runTableQuery(`ALTER TABLE streams ADD COLUMN schedule_type TEXT DEFAULT 'once'`, 'streams.schedule_type');
  await runTableQuery(`ALTER TABLE streams ADD COLUMN schedule_days TEXT`, 'streams.schedule_days');
  await runTableQuery(`ALTER TABLE streams ADD COLUMN recurring_time TEXT`, 'streams.recurring_time');
  await runTableQuery(`ALTER TABLE streams ADD COLUMN recurring_enabled INTEGER DEFAULT 1`, 'streams.recurring_enabled');
  await runTableQuery(`ALTER TABLE streams ADD COLUMN original_settings TEXT`, 'streams.original_settings');

  // YouTube status sync columns
  await runTableQuery(`ALTER TABLE streams ADD COLUMN youtube_broadcast_id TEXT`, 'streams.youtube_broadcast_id');
  await runTableQuery(`ALTER TABLE streams ADD COLUMN youtube_lifecycle_status TEXT`, 'streams.youtube_lifecycle_status');

  // YouTube broadcast settings columns
  await runTableQuery(`ALTER TABLE streams ADD COLUMN youtube_enable_auto_start INTEGER DEFAULT 1`, 'streams.youtube_enable_auto_start');
  await runTableQuery(`ALTER TABLE streams ADD COLUMN youtube_enable_auto_stop INTEGER DEFAULT 1`, 'streams.youtube_enable_auto_stop');
  await runTableQuery(`ALTER TABLE streams ADD COLUMN youtube_unlist_replay_on_end INTEGER DEFAULT 1`, 'streams.youtube_unlist_replay_on_end');

  // Migrate stream_duration_hours to stream_duration_minutes
  await runTableQuery(`UPDATE streams SET stream_duration_minutes = stream_duration_hours * 60 
          WHERE stream_duration_hours IS NOT NULL AND stream_duration_minutes IS NULL`, 'streams.duration_migration');

  await runTableQuery(`CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`, 'system_settings');

  // Insert default storage limit setting
  await runTableQuery(`INSERT OR IGNORE INTO system_settings (key, value) VALUES ('default_storage_limit', 'null')`, 'system_settings.default_storage_limit');

  // Insert default auto-approve registration setting (enabled by default)
  await runTableQuery(`INSERT OR IGNORE INTO system_settings (key, value) VALUES ('auto_approve_registration', 'enabled')`, 'system_settings.auto_approve_registration');

  // Insert default live limit for new user registrations (2 streams by default)
  await runTableQuery(`INSERT OR IGNORE INTO system_settings (key, value) VALUES ('default_live_limit_registration', '2')`, 'system_settings.default_live_limit_registration');

  await runTableQuery(`CREATE TABLE IF NOT EXISTS stream_templates (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    video_id TEXT,
    audio_id TEXT,
    duration_hours INTEGER DEFAULT 0,
    duration_minutes INTEGER DEFAULT 0,
    loop_video INTEGER DEFAULT 1,
    schedule_type TEXT DEFAULT 'once',
    recurring_time TEXT,
    schedule_days TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`, 'stream_templates');

  await runTableQuery(`CREATE UNIQUE INDEX IF NOT EXISTS idx_stream_templates_user_name 
          ON stream_templates(user_id, name)`, 'stream_templates.index');

  await runTableQuery(`CREATE TABLE IF NOT EXISTS youtube_credentials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    client_secret TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    channel_name TEXT,
    channel_id TEXT,
    is_primary INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, channel_id)
  )`, 'youtube_credentials');

  await runTableQuery(`ALTER TABLE youtube_credentials ADD COLUMN is_primary INTEGER DEFAULT 0`, 'youtube_credentials.is_primary');

  // Set existing single accounts as primary
  await runTableQuery(`UPDATE youtube_credentials SET is_primary = 1 WHERE is_primary = 0 AND id IN (
    SELECT MIN(id) FROM youtube_credentials GROUP BY user_id
  )`, 'youtube_credentials.primary_migration');

  // Run migration for youtube_credentials table if needed
  await migrateYouTubeCredentialsTableAsync();

  // Create broadcast_templates table for YouTube broadcast templates
  await runTableQuery(`CREATE TABLE IF NOT EXISTS broadcast_templates (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    privacy_status TEXT DEFAULT 'unlisted',
    tags TEXT,
    category_id TEXT DEFAULT '20',
    thumbnail_path TEXT,
    stream_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES youtube_credentials(id) ON DELETE CASCADE
  )`, 'broadcast_templates');

  await runTableQuery(`CREATE UNIQUE INDEX IF NOT EXISTS idx_broadcast_templates_user_name 
          ON broadcast_templates(user_id, name)`, 'broadcast_templates.index');

  // Add recurring columns to broadcast_templates table
  await runTableQuery(`ALTER TABLE broadcast_templates ADD COLUMN recurring_enabled INTEGER DEFAULT 0`, 'broadcast_templates.recurring_enabled');
  await runTableQuery(`ALTER TABLE broadcast_templates ADD COLUMN recurring_pattern TEXT`, 'broadcast_templates.recurring_pattern');
  await runTableQuery(`ALTER TABLE broadcast_templates ADD COLUMN recurring_time TEXT`, 'broadcast_templates.recurring_time');
  await runTableQuery(`ALTER TABLE broadcast_templates ADD COLUMN recurring_days TEXT`, 'broadcast_templates.recurring_days');
  await runTableQuery(`ALTER TABLE broadcast_templates ADD COLUMN last_run_at TEXT`, 'broadcast_templates.last_run_at');
  await runTableQuery(`ALTER TABLE broadcast_templates ADD COLUMN next_run_at TEXT`, 'broadcast_templates.next_run_at');

  // Create index for recurring templates lookup
  await runTableQuery(`CREATE INDEX IF NOT EXISTS idx_broadcast_templates_recurring 
          ON broadcast_templates(recurring_enabled)`, 'broadcast_templates.recurring_index');

  // Add thumbnail_folder column for thumbnail selection from folder
  await runTableQuery(`ALTER TABLE broadcast_templates ADD COLUMN thumbnail_folder TEXT`, 'broadcast_templates.thumbnail_folder');

  // Add thumbnail_index column for sequential thumbnail selection
  await runTableQuery(`ALTER TABLE broadcast_templates ADD COLUMN thumbnail_index INTEGER DEFAULT 0`, 'broadcast_templates.thumbnail_index');

  // Add pinned_thumbnail column for pinning specific thumbnail
  await runTableQuery(`ALTER TABLE broadcast_templates ADD COLUMN pinned_thumbnail TEXT`, 'broadcast_templates.pinned_thumbnail');

  // Add stream_key_folder_mapping column to store stream key to folder binding as JSON
  // Format: {"streamKeyId": "folderName", ...}
  await runTableQuery(`ALTER TABLE broadcast_templates ADD COLUMN stream_key_folder_mapping TEXT`, 'broadcast_templates.stream_key_folder_mapping');

  // Add thumbnail_mode column (deprecated - kept for backward compatibility)
  await runTableQuery(`ALTER TABLE broadcast_templates ADD COLUMN thumbnail_mode TEXT DEFAULT 'sequential'`, 'broadcast_templates.thumbnail_mode');

  // Add title_index column for sequential title rotation
  await runTableQuery(`ALTER TABLE broadcast_templates ADD COLUMN title_index INTEGER DEFAULT 0`, 'broadcast_templates.title_index');

  // Add pinned_title_id column for pinning specific title
  await runTableQuery(`ALTER TABLE broadcast_templates ADD COLUMN pinned_title_id TEXT`, 'broadcast_templates.pinned_title_id');

  // Add title_folder_id column for title rotation from specific folder
  await runTableQuery(`ALTER TABLE broadcast_templates ADD COLUMN title_folder_id TEXT`, 'broadcast_templates.title_folder_id');

  // Create recurring_schedules table for scheduled recurring broadcasts
  await runTableQuery(`CREATE TABLE IF NOT EXISTS recurring_schedules (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    pattern TEXT NOT NULL CHECK(pattern IN ('daily', 'weekly')),
    schedule_time TEXT NOT NULL,
    days_of_week TEXT,
    template_id TEXT,
    title_template TEXT,
    description TEXT,
    privacy_status TEXT DEFAULT 'unlisted',
    tags TEXT,
    category_id TEXT DEFAULT '20',
    is_active INTEGER DEFAULT 1,
    last_run_at TEXT,
    next_run_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES youtube_credentials(id) ON DELETE CASCADE,
    FOREIGN KEY (template_id) REFERENCES broadcast_templates(id) ON DELETE SET NULL
  )`, 'recurring_schedules');

  await runTableQuery(`CREATE INDEX IF NOT EXISTS idx_recurring_schedules_user 
          ON recurring_schedules(user_id)`, 'recurring_schedules.user_index');

  await runTableQuery(`CREATE INDEX IF NOT EXISTS idx_recurring_schedules_active 
          ON recurring_schedules(is_active)`, 'recurring_schedules.active_index');

  // Add template_id column to existing recurring_schedules table if not exists
  await runTableQuery(`ALTER TABLE recurring_schedules ADD COLUMN template_id TEXT REFERENCES broadcast_templates(id) ON DELETE SET NULL`, 'recurring_schedules.template_id_column', true);

  // Create title_suggestions table for managing potential broadcast titles
  await runTableQuery(`CREATE TABLE IF NOT EXISTS title_suggestions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    use_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, title)
  )`, 'title_suggestions');

  await runTableQuery(`CREATE INDEX IF NOT EXISTS idx_title_suggestions_user 
          ON title_suggestions(user_id)`, 'title_suggestions.user_index');

  await runTableQuery(`CREATE INDEX IF NOT EXISTS idx_title_suggestions_category 
          ON title_suggestions(user_id, category)`, 'title_suggestions.category_index');

  // Add is_pinned column for pinning specific title
  await runTableQuery(`ALTER TABLE title_suggestions ADD COLUMN is_pinned INTEGER DEFAULT 0`, 'title_suggestions.is_pinned');

  // Add stream_key_id column for binding title to stream key
  await runTableQuery(`ALTER TABLE title_suggestions ADD COLUMN stream_key_id TEXT`, 'title_suggestions.stream_key_id');

  // Add sort_order column for manual ordering
  await runTableQuery(`ALTER TABLE title_suggestions ADD COLUMN sort_order INTEGER DEFAULT 0`, 'title_suggestions.sort_order');

  // Create title_folders table for organizing titles into folders
  await runTableQuery(`CREATE TABLE IF NOT EXISTS title_folders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#8B5CF6',
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`, 'title_folders');

  await runTableQuery(`CREATE INDEX IF NOT EXISTS idx_title_folders_user 
          ON title_folders(user_id)`, 'title_folders.user_index');

  // Add folder_id column to title_suggestions for folder organization
  await runTableQuery(`ALTER TABLE title_suggestions ADD COLUMN folder_id TEXT REFERENCES title_folders(id) ON DELETE SET NULL`, 'title_suggestions.folder_id');

  await runTableQuery(`CREATE INDEX IF NOT EXISTS idx_title_suggestions_folder 
          ON title_suggestions(folder_id)`, 'title_suggestions.folder_index');

  // Create youtube_broadcast_settings table for storing broadcast-specific settings
  await runTableQuery(`CREATE TABLE IF NOT EXISTS youtube_broadcast_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    broadcast_id TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    account_id INTEGER,
    enable_auto_start INTEGER DEFAULT 1,
    enable_auto_stop INTEGER DEFAULT 1,
    unlist_replay_on_end INTEGER DEFAULT 1,
    original_privacy_status TEXT DEFAULT 'public',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES youtube_credentials(id) ON DELETE SET NULL
  )`, 'youtube_broadcast_settings');

  await runTableQuery(`CREATE INDEX IF NOT EXISTS idx_youtube_broadcast_settings_user 
          ON youtube_broadcast_settings(user_id)`, 'youtube_broadcast_settings.user_index');

  await runTableQuery(`CREATE INDEX IF NOT EXISTS idx_youtube_broadcast_settings_broadcast 
          ON youtube_broadcast_settings(broadcast_id)`, 'youtube_broadcast_settings.broadcast_index');

  // Add thumbnail_folder column to youtube_broadcast_settings
  await runTableQuery(`ALTER TABLE youtube_broadcast_settings ADD COLUMN thumbnail_folder TEXT`, 'youtube_broadcast_settings.thumbnail_folder');

  // Add template_id column to youtube_broadcast_settings for tracking source template
  await runTableQuery(`ALTER TABLE youtube_broadcast_settings ADD COLUMN template_id TEXT`, 'youtube_broadcast_settings.template_id');

  // Add thumbnail_index column to youtube_broadcast_settings for storing selected thumbnail index
  await runTableQuery(`ALTER TABLE youtube_broadcast_settings ADD COLUMN thumbnail_index INTEGER DEFAULT 0`, 'youtube_broadcast_settings.thumbnail_index');

  // Add thumbnail_path column to youtube_broadcast_settings for storing selected thumbnail path
  await runTableQuery(`ALTER TABLE youtube_broadcast_settings ADD COLUMN thumbnail_path TEXT`, 'youtube_broadcast_settings.thumbnail_path');

  // Create stream_key_folder_mapping table for storing stream key to thumbnail folder binding
  await runTableQuery(`CREATE TABLE IF NOT EXISTS stream_key_folder_mapping (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    stream_key_id TEXT NOT NULL,
    folder_name TEXT DEFAULT '',
    thumbnail_index INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, stream_key_id)
  )`, 'stream_key_folder_mapping');

  // Add thumbnail_index column to stream_key_folder_mapping if not exists
  await runTableQuery(`ALTER TABLE stream_key_folder_mapping ADD COLUMN thumbnail_index INTEGER DEFAULT 0`, 'stream_key_folder_mapping.thumbnail_index');

  await runTableQuery(`CREATE INDEX IF NOT EXISTS idx_stream_key_folder_mapping_user 
          ON stream_key_folder_mapping(user_id)`, 'stream_key_folder_mapping.user_index');

  // Create user_title_rotation_settings table for storing title rotation settings per user
  await runTableQuery(`CREATE TABLE IF NOT EXISTS user_title_rotation_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL UNIQUE,
    enabled INTEGER DEFAULT 0,
    folder_id TEXT,
    current_index INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`, 'user_title_rotation_settings');

  await runTableQuery(`CREATE INDEX IF NOT EXISTS idx_user_title_rotation_settings_user 
          ON user_title_rotation_settings(user_id)`, 'user_title_rotation_settings.user_index');
}

// Old createCoreTables function removed - replaced with createCoreTablesAsync above

/**
 * Migrate youtube_credentials table to support multiple accounts per user (async version)
 * This removes the UNIQUE constraint on user_id and adds UNIQUE on (user_id, channel_id)
 * @returns {Promise<void>}
 */
async function migrateYouTubeCredentialsTableAsync() {
  return new Promise((resolve) => {
    db.get(`SELECT sql FROM sqlite_master WHERE type='table' AND name='youtube_credentials'`, (err, row) => {
      if (err || !row) {
        resolve();
        return;
      }

      const sql = row.sql;
      if (sql.includes('user_id TEXT NOT NULL UNIQUE') && !sql.includes('UNIQUE(user_id, channel_id)')) {
        console.log('[Database] Migrating youtube_credentials table for multiple accounts support...');

        db.serialize(() => {
          db.run(`CREATE TABLE IF NOT EXISTS youtube_credentials_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            client_id TEXT NOT NULL,
            client_secret TEXT NOT NULL,
            refresh_token TEXT NOT NULL,
            channel_name TEXT,
            channel_id TEXT,
            is_primary INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, channel_id)
          )`);

          db.run(`INSERT OR IGNORE INTO youtube_credentials_new 
            (id, user_id, client_id, client_secret, refresh_token, channel_name, channel_id, is_primary, created_at)
            SELECT id, user_id, client_id, client_secret, refresh_token, channel_name, channel_id, 1, created_at
            FROM youtube_credentials`);

          db.run(`DROP TABLE IF EXISTS youtube_credentials`);

          db.run(`ALTER TABLE youtube_credentials_new RENAME TO youtube_credentials`, (err) => {
            if (err) {
              console.error('[Database] Error renaming youtube_credentials table:', err.message);
            } else {
              console.log('[Database] Successfully migrated youtube_credentials table');
            }
            resolve();
          });
        });
      } else {
        resolve();
      }
    });
  });
}

/**
 * Close database connection gracefully
 * @returns {Promise<void>}
 */
function closeDatabase() {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        console.error('[Database] Error closing database:', err.message);
        reject(err);
      } else {
        console.log('[Database] Database connection closed');
        resolve();
      }
    });
  });
}

/**
 * Check database connectivity
 * @returns {Promise<{connected: boolean, latency: number}>}
 */
async function checkConnectivity() {
  const startTime = Date.now();
  return new Promise((resolve) => {
    // Add timeout to prevent hanging - INCREASED to 10 seconds
    const timeout = setTimeout(() => {
      // On timeout, assume connected to avoid false failures
      resolve({ connected: true, latency: 10000, warning: 'Database query slow but assuming connected' });
    }, 10000);

    db.get('SELECT 1 as test', [], (err) => {
      clearTimeout(timeout);
      const latency = Date.now() - startTime;
      if (err) {
        resolve({ connected: false, latency, error: err.message });
      } else {
        resolve({ connected: true, latency });
      }
    });
  });
}

/**
 * Safe database query wrapper with timeout and error handling
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @param {number} timeoutMs - Timeout in milliseconds (default 30s)
 * @returns {Promise<any>}
 */
function safeDbQuery(sql, params = [], timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Database query timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    db.all(sql, params, (err, rows) => {
      clearTimeout(timeout);
      if (err) {
        console.error('[Database] Query error:', err.message);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

/**
 * Safe database run wrapper with timeout and error handling
 * @param {string} sql - SQL statement
 * @param {Array} params - Query parameters
 * @param {number} timeoutMs - Timeout in milliseconds (default 30s)
 * @returns {Promise<{lastID: number, changes: number}>}
 */
function safeDbRun(sql, params = [], timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Database run timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    db.run(sql, params, function (err) {
      clearTimeout(timeout);
      if (err) {
        console.error('[Database] Run error:', err.message);
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}
function checkIfUsersExist() {
  return new Promise((resolve, reject) => {
    // First check if users table exists
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", [], (err, tableExists) => {
      if (err) {
        console.error('[Database] Error checking users table:', err.message);
        // On error, assume no users exist
        resolve(false);
        return;
      }

      if (!tableExists) {
        // Table doesn't exist yet, no users
        resolve(false);
        return;
      }

      // Table exists, check for users
      db.get('SELECT COUNT(*) as count FROM users', [], (err, result) => {
        if (err) {
          console.error('[Database] Error checking users:', err.message);
          // On error, assume no users exist
          resolve(false);
          return;
        }
        resolve(result.count > 0);
      });
    });
  });
}

/**
 * Create default admin account if no admin exists
 * Called during database initialization to ensure there's always an admin account
 * @returns {Promise<void>}
 */
async function createDefaultAdminIfNeeded() {
  try {
    const adminExists = await checkIfAdminExists();

    if (!adminExists) {
      const bcrypt = require('bcrypt');
      const { v4: uuidv4 } = require('uuid');

      const DEFAULT_ADMIN_USERNAME = 'ozang88';
      const DEFAULT_ADMIN_PASSWORD = 'Moejokerto#88';

      console.log('[Database] No admin found. Creating default admin account...');

      const userId = uuidv4();
      const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);

      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO users (id, username, password, user_role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [userId, DEFAULT_ADMIN_USERNAME, hashedPassword, 'admin', 'active', new Date().toISOString(), new Date().toISOString()],
          function (err) {
            if (err) {
              // If username already exists but not active, update it
              if (err.message && err.message.includes('UNIQUE constraint')) {
                db.run(
                  'UPDATE users SET password = ?, user_role = ?, status = ?, updated_at = ? WHERE username = ?',
                  [hashedPassword, 'admin', 'active', new Date().toISOString(), DEFAULT_ADMIN_USERNAME],
                  function (err2) {
                    if (err2) {
                      console.error('[Database] Error updating existing user to admin:', err2.message);
                      reject(err2);
                    } else {
                      console.log(`[Database] Updated existing user '${DEFAULT_ADMIN_USERNAME}' to active admin`);
                      resolve();
                    }
                  }
                );
              } else {
                console.error('[Database] Error creating default admin:', err.message);
                reject(err);
              }
            } else {
              console.log(`[Database] Default admin created successfully`);
              console.log(`[Database] Login credentials - Username: ${DEFAULT_ADMIN_USERNAME}, Password: ${DEFAULT_ADMIN_PASSWORD}`);
              console.log('[Database] IMPORTANT: Please change the default password after first login for security!');
              resolve();
            }
          }
        );
      });
    } else {
      console.log('[Database] Active admin already exists, skipping default admin creation');
    }
  } catch (error) {
    console.error('[Database] Error in createDefaultAdminIfNeeded:', error.message);
    // Don't throw - this is not critical enough to stop app startup
  }
}

/**
 * Check if any admin user exists in the database
 * Used for first-time setup to determine if admin account needs to be created
 * @returns {Promise<boolean>}
 */
function checkIfAdminExists() {
  return new Promise((resolve, reject) => {
    // First check if users table exists
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", [], (err, tableExists) => {
      if (err) {
        console.error('[Database] Error checking users table:', err.message);
        // On error, assume no admin exists to allow setup
        resolve(false);
        return;
      }

      if (!tableExists) {
        // Table doesn't exist yet, no admin
        resolve(false);
        return;
      }

      // Table exists, check for active admin
      db.get("SELECT COUNT(*) as count FROM users WHERE user_role = 'admin' AND status = 'active'", [], (err, result) => {
        if (err) {
          console.error('[Database] Error checking admin users:', err.message);
          // On error, assume no admin exists to allow setup
          resolve(false);
          return;
        }
        resolve(result.count > 0);
      });
    });
  });
}

/**
 * Get database instance
 * @returns {sqlite3.Database} Database instance
 */
function getDb() {
  return db;
}

module.exports = {
  db,
  getDb,
  checkIfUsersExist,
  checkIfAdminExists,
  waitForDbInit,
  verifyTables,
  checkConnectivity,
  closeDatabase,
  safeDbQuery,
  safeDbRun,
  isDbInitialized: () => dbInitialized,
  getInitError: () => dbInitError,
  REQUIRED_TABLES
};