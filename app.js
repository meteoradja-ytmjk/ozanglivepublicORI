require('dotenv').config();
require('./services/logger.js');
const express = require('express');
const path = require('path');
const engine = require('ejs-mate');
const os = require('os');
const multer = require('multer');
const fs = require('fs');
const csrf = require('csrf');
const { v4: uuidv4 } = require('uuid');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const User = require('./models/User');
const { db, checkIfUsersExist, checkIfAdminExists, waitForDbInit, verifyTables, checkConnectivity, closeDatabase } = require('./db/database');
const systemMonitor = require('./services/systemMonitor');
const { uploadVideo, upload, uploadAudio, uploadBackup, checkStorageLimit } = require('./middleware/uploadMiddleware');
const { ensureDirectories } = require('./utils/storage');
const { getVideoInfo, generateThumbnail } = require('./utils/videoProcessor');
const Video = require('./models/Video');
const Audio = require('./models/Audio');
const Playlist = require('./models/Playlist');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const streamingService = require('./services/streamingService');
const schedulerService = require('./services/schedulerService');
const LiveLimitService = require('./services/liveLimitService');
const YouTubeCredentials = require('./models/YouTubeCredentials');
const youtubeService = require('./services/youtubeService');
const BroadcastTemplate = require('./models/BroadcastTemplate');
const TitleSuggestion = require('./models/TitleSuggestion');
const TitleFolder = require('./models/TitleFolder');
const SystemSettings = require('./models/SystemSettings');
const YouTubeBroadcastSettings = require('./models/YouTubeBroadcastSettings');
const scheduleService = require('./services/scheduleService');
const backupService = require('./services/backupService');
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
// Track if we're shutting down to prevent multiple shutdown attempts
let isShuttingDown = false;
let httpServer = null;
const activeIntervals = [];
const activeTimeouts = [];

// Store interval/timeout references for cleanup
const originalSetInterval = global.setInterval;
const originalSetTimeout = global.setTimeout;
const originalClearInterval = global.clearInterval;
const originalClearTimeout = global.clearTimeout;

global.setInterval = function (...args) {
  const id = originalSetInterval.apply(this, args);
  activeIntervals.push(id);
  return id;
};

global.setTimeout = function (...args) {
  const id = originalSetTimeout.apply(this, args);
  activeTimeouts.push(id);
  return id;
};

global.clearInterval = function (id) {
  const index = activeIntervals.indexOf(id);
  if (index > -1) activeIntervals.splice(index, 1);
  return originalClearInterval.call(this, id);
};

global.clearTimeout = function (id) {
  const index = activeTimeouts.indexOf(id);
  if (index > -1) activeTimeouts.splice(index, 1);
  return originalClearTimeout.call(this, id);
};

/**
 * Perform graceful shutdown of the application
 * @param {string} signal - Signal that triggered shutdown
 * @param {number} exitCode - Exit code to use
 */
async function gracefulShutdown(signal, exitCode = 0) {
  if (isShuttingDown) {
    console.log('[Shutdown] Already shutting down, ignoring signal');
    return;
  }

  isShuttingDown = true;
  console.log(`[Shutdown] Received ${signal}, starting graceful shutdown...`);

  // Force exit after 30 seconds
  const forceExitTimeout = setTimeout(() => {
    console.error('[Shutdown] Force exit after 30 second timeout');
    process.exit(exitCode || 1);
  }, 30000);
  forceExitTimeout.unref();

  try {
    // 1. Stop accepting new connections
    if (httpServer) {
      console.log('[Shutdown] Closing HTTP server...');
      await new Promise((resolve) => {
        httpServer.close(() => {
          console.log('[Shutdown] HTTP server closed');
          resolve();
        });
      });
    }

    // 2. Stop all active streams
    try {
      const activeStreams = streamingService.getActiveStreams();
      if (activeStreams.length > 0) {
        console.log(`[Shutdown] Stopping ${activeStreams.length} active streams...`);
        await Promise.all(activeStreams.map(id =>
          streamingService.stopStream(id).catch(err => {
            console.error(`[Shutdown] Error stopping stream ${id}:`, err.message);
          })
        ));
        console.log('[Shutdown] All streams stopped');
      }
    } catch (e) {
      console.error('[Shutdown] Error stopping streams:', e.message);
    }

    // 3. Clear all intervals and timeouts
    console.log(`[Shutdown] Clearing ${activeIntervals.length} intervals and ${activeTimeouts.length} timeouts...`);
    activeIntervals.forEach(id => originalClearInterval(id));
    activeTimeouts.forEach(id => originalClearTimeout(id));
    activeIntervals.length = 0;
    activeTimeouts.length = 0;

    // 4. Close database connection
    try {
      console.log('[Shutdown] Closing database connection...');
      await closeDatabase();
    } catch (e) {
      console.error('[Shutdown] Error closing database:', e.message);
    }

    console.log('[Shutdown] Graceful shutdown complete');
    clearTimeout(forceExitTimeout);
    process.exit(exitCode);

  } catch (error) {
    console.error('[Shutdown] Error during graceful shutdown:', error);
    clearTimeout(forceExitTimeout);
    process.exit(exitCode || 1);
  }
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('-----------------------------------');
  console.error('[ERROR] UNHANDLED REJECTION');
  console.error('Promise:', promise);
  console.error('Reason:', reason);
  console.error('Stack:', reason?.stack || 'No stack trace');
  console.error('-----------------------------------');
  // Don't exit - just log and continue
  // This prevents the app from crashing on unhandled promise rejections
});

// SIMPLIFIED: Removed aggressive memory monitoring and self-healing
// These were causing more problems than they solved
// PM2 will handle restarts if needed via max_memory_restart

// Simple memory logging every 4 hours (just for info, no action)
setInterval(() => {
  try {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const rssMB = Math.round(memUsage.rss / 1024 / 1024);
    console.log(`[Memory] Heap: ${heapUsedMB}MB, RSS: ${rssMB}MB`);
  } catch (e) {
    // Ignore errors
  }
}, 4 * 60 * 60 * 1000); // Every 4 hours (was 2 hours)

process.on('uncaughtException', (error) => {
  console.error('-----------------------------------');
  console.error('[ERROR] UNCAUGHT EXCEPTION');
  console.error('Error:', error);
  console.error('Stack:', error?.stack || 'No stack trace');
  console.error('-----------------------------------');

  // Check if this is a recoverable error
  // EXPANDED: Added more recoverable error codes
  const recoverableErrors = [
    'ECONNRESET',
    'EPIPE',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'ENOTFOUND',
    'EAI_AGAIN',
    'ECONNABORTED',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'ENOENT',
    'EBUSY',
    'SQLITE_BUSY',
    'SQLITE_LOCKED',
    'ERR_STREAM_DESTROYED',
    'ERR_STREAM_WRITE_AFTER_END',
    'ERR_HTTP_HEADERS_SENT'
  ];

  // Also check for common recoverable error messages
  const recoverableMessages = [
    'socket hang up',
    'read ECONNRESET',
    'write EPIPE',
    'connect ETIMEDOUT',
    'getaddrinfo',
    'SQLITE_BUSY',
    'database is locked',
    'Cannot read properties of null',
    'Cannot read properties of undefined'
  ];

  const isRecoverable = recoverableErrors.some(code =>
    error.code === code || (error.message && error.message.includes(code))
  ) || recoverableMessages.some(msg =>
    error.message && error.message.includes(msg)
  );

  if (isRecoverable) {
    console.error('[ERROR] Recoverable error detected, continuing...');
    return;
  }

  // For critical errors, attempt graceful shutdown
  gracefulShutdown('uncaughtException', 1);
});

// Handle SIGTERM and SIGINT for graceful shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM', 0));
process.on('SIGINT', () => gracefulShutdown('SIGINT', 0));
const app = express();
app.set("trust proxy", 1);
const port = process.env.PORT || 7575;
const tokens = new csrf();
ensureDirectories();
ensureDirectories();

app.locals.helpers = {
  getUsername: function (req) {
    if (req.session && req.session.username) {
      return req.session.username;
    }
    return 'User';
  },
  getRoleBadge: function (req) {
    if (req.session && req.session.user_role) {
      const role = req.session.user_role;
      if (role === 'admin') {
        return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30" title="Administrator - Full system access">
          <i class="ti ti-shield-check text-xs"></i>
          <span>Admin</span>
        </span>`;
      } else {
        return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 text-gray-400 border border-gray-500/30" title="Member - Standard access">
          <i class="ti ti-user text-xs"></i>
          <span>Member</span>
        </span>`;
      }
    }
    return '';
  },
  getAvatar: function (req) {
    if (req.session && req.session.userId) {
      const avatarPath = req.session.avatar_path;
      if (avatarPath) {
        return `<img src="${avatarPath}" alt="${req.session.username || 'User'}'s Profile" class="w-full h-full object-cover" onerror="this.onerror=null; this.src='/images/default-avatar.jpg';">`;
      }
    }
    return '<img src="/images/default-avatar.jpg" alt="Default Profile" class="w-full h-full object-cover">';
  },
  getPlatformIcon: function (platform) {
    switch (platform) {
      case 'YouTube': return 'youtube';
      case 'Facebook': return 'facebook';
      case 'Twitch': return 'twitch';
      case 'TikTok': return 'tiktok';
      case 'Instagram': return 'instagram';
      case 'Shopee Live': return 'shopping-bag';
      case 'Restream.io': return 'live-photo';
      default: return 'broadcast';
    }
  },
  getPlatformColor: function (platform) {
    switch (platform) {
      case 'YouTube': return 'red-500';
      case 'Facebook': return 'blue-500';
      case 'Twitch': return 'purple-500';
      case 'TikTok': return 'gray-100';
      case 'Instagram': return 'pink-500';
      case 'Shopee Live': return 'orange-500';
      case 'Restream.io': return 'teal-500';
      default: return 'gray-400';
    }
  },
  formatDateTime: function (isoString) {
    if (!isoString) return '--';

    const utcDate = new Date(isoString);

    return utcDate.toLocaleString('en-US', {
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  },
  formatDuration: function (seconds) {
    if (!seconds) return '--';
    const hours = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}:${secs}`;
  },
  formatTime: function (isoString) {
    if (!isoString) return '--';
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }
};
// Validate SESSION_SECRET exists and generate secure fallback if not
let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  console.warn('[Session] WARNING: SESSION_SECRET is not set in .env file!');
  console.warn('[Session] Generating a temporary secret - DO NOT USE IN PRODUCTION!');
  console.warn('[Session] Generate a permanent secret using: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  sessionSecret = require('crypto').randomBytes(32).toString('hex');
}

// Validate secret is not empty or too short
if (!sessionSecret || sessionSecret.length < 16) {
  console.error('[Session] CRITICAL: SESSION_SECRET is too short or invalid!');
  sessionSecret = require('crypto').randomBytes(32).toString('hex');
}

// Create session store with cleanup
const sessionStore = new SQLiteStore({
  db: 'sessions.db',
  dir: './db/',
  table: 'sessions',
  // CRITICAL: Enable session cleanup to prevent database bloat
  cleanupInterval: 900000 // Clean expired sessions every 15 minutes (900000ms)
});

app.use(session({
  store: sessionStore,
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Session error handling middleware
app.use((err, req, res, next) => {
  if (err && err.message && err.message.includes('session')) {
    console.error('[Session] Session error:', err.message);
    return res.status(500).render('error', {
      title: 'Session Error',
      message: 'A session error occurred. Please try refreshing the page.',
      error: process.env.NODE_ENV === 'development' ? err : {}
    });
  }
  next(err);
});
app.use(async (req, res, next) => {
  if (req.session && req.session.userId) {
    try {
      const user = await User.findById(req.session.userId);
      if (user) {
        req.session.username = user.username;
        req.session.avatar_path = user.avatar_path;
        if (user.email) req.session.email = user.email;
        res.locals.user = {
          id: user.id,
          username: user.username,
          avatar_path: user.avatar_path,
          email: user.email
        };
      }
    } catch (error) {
      console.error('Error loading user:', error);
    }
  }
  res.locals.req = req;
  next();
});
app.use(function (req, res, next) {
  if (!req.session.csrfSecret) {
    req.session.csrfSecret = uuidv4();
  }
  res.locals.csrfToken = tokens.create(req.session.csrfSecret);
  next();
});
app.engine('ejs', engine);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Service-Worker-Allowed', '/');
  res.sendFile(path.join(__dirname, 'public', 'sw.js'));
});

app.use('/uploads', function (req, res, next) {
  res.header('Cache-Control', 'no-cache');
  res.header('Pragma', 'no-cache');
  res.header('Expires', '0');
  next();
});
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));

// Request timeout middleware - prevent hanging requests
app.use((req, res, next) => {
  // Skip timeout for upload endpoints - they need more time for large files
  const isUploadEndpoint = req.path.includes('/api/videos/upload') ||
    req.path.includes('/api/audios/upload') ||
    req.path.includes('/api/drive/import');

  if (isUploadEndpoint) {
    // No timeout for upload endpoints
    req.setTimeout(0);
    res.setTimeout(0);
    return next();
  }

  // Set timeout for all other requests (60 seconds)
  req.setTimeout(60000, () => {
    console.error(`[Timeout] Request timeout: ${req.method} ${req.url}`);
    if (!res.headersSent) {
      res.status(408).json({ error: 'Request timeout' });
    }
  });

  res.setTimeout(60000, () => {
    console.error(`[Timeout] Response timeout: ${req.method} ${req.url}`);
  });

  next();
});

const csrfProtection = function (req, res, next) {
  if ((req.path === '/login' && req.method === 'POST') ||
    (req.path === '/setup-account' && req.method === 'POST')) {
    return next();
  }
  const token = req.body._csrf || req.query._csrf || req.headers['x-csrf-token'];
  if (!token || !tokens.verify(req.session.csrfSecret, token)) {
    // Return JSON for API calls, HTML for regular requests
    if (req.path.startsWith('/api/') || req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(403).json({
        success: false,
        error: 'CSRF validation failed. Please refresh the page and try again.'
      });
    }
    return res.status(403).render('error', {
      title: 'Error',
      error: 'CSRF validation failed. Please try again.'
    });
  }
  next();
};
const isAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    return next();
  }
  // Return JSON for API calls, redirect for regular requests
  if (req.path.startsWith('/api/') || req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(401).json({
      success: false,
      error: 'Session expired. Please login again.',
      redirect: '/login'
    });
  }
  res.redirect('/login');
};

const isAdmin = async (req, res, next) => {
  try {
    if (!req.session.userId) {
      return res.redirect('/login');
    }

    const user = await User.findById(req.session.userId);
    if (!user || user.user_role !== 'admin') {
      return res.redirect('/dashboard');
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    res.redirect('/dashboard');
  }
};

// Permission middleware for member video access control
const canViewVideos = async (req, res, next) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.redirect('/login');
    }
    // Admins always have permission
    if (user.user_role === 'admin') {
      req.user = user;
      return next();
    }
    // Check member permission
    if (user.can_view_videos !== 1) {
      req.viewPermissionDenied = true;
    }
    req.user = user;
    next();
  } catch (error) {
    console.error('View permission middleware error:', error);
    next();
  }
};

const canDownloadVideos = async (req, res, next) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    // Admins always have permission
    if (user.user_role === 'admin') {
      req.user = user;
      return next();
    }
    // Check member permission
    if (user.can_download_videos !== 1) {
      return res.status(403).json({ success: false, message: "You don't have permission to download videos" });
    }
    req.user = user;
    next();
  } catch (error) {
    console.error('Download permission middleware error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const canDeleteVideos = async (req, res, next) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    // Admins always have permission
    if (user.user_role === 'admin') {
      req.user = user;
      return next();
    }
    // Check member permission
    if (user.can_delete_videos !== 1) {
      return res.status(403).json({ success: false, message: "You don't have permission to delete videos" });
    }
    req.user = user;
    next();
  } catch (error) {
    console.error('Delete permission middleware error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

app.use('/uploads', function (req, res, next) {
  res.header('Cache-Control', 'no-cache');
  res.header('Pragma', 'no-cache');
  res.header('Expires', '0');
  next();
});
app.use('/uploads/avatars', (req, res, next) => {
  const file = path.join(__dirname, 'public', 'uploads', 'avatars', path.basename(req.path));
  if (fs.existsSync(file)) {
    const ext = path.extname(file).toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.gif') contentType = 'image/gif';
    res.header('Content-Type', contentType);
    res.header('Cache-Control', 'max-age=60, must-revalidate');
    fs.createReadStream(file).pipe(res);
  } else {
    next();
  }
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).render('login', {
      title: 'Login',
      error: 'Too many login attempts. Please try again in 15 minutes.'
    });
  },
  requestWasSuccessful: (request, response) => {
    return response.statusCode < 400;
  }
});
const loginDelayMiddleware = async (req, res, next) => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  next();
};
app.get('/login', async (req, res) => {
  // Prevent caching of login page
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  try {
    // Check if any active admin exists, not just any user
    const adminExists = await checkIfAdminExists();
    if (!adminExists) {
      return res.redirect('/setup-account');
    }
    res.render('login', {
      title: 'Login',
      error: null
    });
  } catch (error) {
    console.error('Error checking for users:', error);
    // If database error occurs (e.g., fresh install), redirect to setup
    return res.redirect('/setup-account');
  }
});
app.post('/login', loginDelayMiddleware, loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  console.log('[Login] Attempt for username:', username);
  try {
    const user = await User.findByUsername(username);
    if (!user) {
      console.log('[Login] User not found:', username);
      return res.render('login', {
        title: 'Login',
        error: 'Invalid username or password'
      });
    }
    console.log('[Login] User found:', user.username, 'role:', user.user_role, 'status:', user.status);
    const passwordMatch = await User.verifyPassword(password, user.password);
    if (!passwordMatch) {
      console.log('[Login] Password mismatch for:', username);
      return res.render('login', {
        title: 'Login',
        error: 'Invalid username or password'
      });
    }

    if (user.status !== 'active') {
      console.log('[Login] User not active:', username);
      return res.render('login', {
        title: 'Login',
        error: 'Your account is not active. Please contact administrator for activation.'
      });
    }

    console.log('[Login] Success for:', username, '- redirecting to dashboard');
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.avatar_path = user.avatar_path;
    req.session.user_role = user.user_role;

    // Force session save before redirect
    req.session.save((err) => {
      if (err) {
        console.error('[Login] Session save error:', err);
        return res.render('login', {
          title: 'Login',
          error: 'Session error. Please try again.'
        });
      }
      console.log('[Login] Session saved, redirecting...');
      res.redirect('/dashboard');
    });
  } catch (error) {
    console.error('[Login] Error:', error);
    res.render('login', {
      title: 'Login',
      error: 'An error occurred during login. Please try again.'
    });
  }
});
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

app.get('/signup', async (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  try {
    // Check if any active admin exists, not just any user
    const adminExists = await checkIfAdminExists();
    if (!adminExists) {
      return res.redirect('/setup-account');
    }
    res.render('signup', {
      title: 'Sign Up',
      error: null,
      success: null
    });
  } catch (error) {
    console.error('Error loading signup page:', error);
    // If database error occurs (e.g., fresh install), redirect to setup
    return res.redirect('/setup-account');
  }
});

app.post('/signup', upload.single('avatar'), async (req, res) => {
  const { username, password, user_role, status } = req.body;

  // Username validation regex - only allow letters, numbers, and underscores
  const VALID_USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;

  try {
    if (!username || !password) {
      return res.render('signup', {
        title: 'Sign Up',
        error: 'Username and password are required',
        success: null
      });
    }

    // Validate username format to prevent SQL injection and XSS
    if (!VALID_USERNAME_REGEX.test(username)) {
      return res.render('signup', {
        title: 'Sign Up',
        error: 'Username can only contain letters, numbers, and underscores',
        success: null
      });
    }

    // Validate username length
    if (username.length < 3 || username.length > 20) {
      return res.render('signup', {
        title: 'Sign Up',
        error: 'Username must be between 3 and 20 characters',
        success: null
      });
    }

    if (password.length < 6) {
      return res.render('signup', {
        title: 'Sign Up',
        error: 'Password must be at least 6 characters long',
        success: null
      });
    }

    const existingUser = await User.findByUsername(username);
    if (existingUser) {
      return res.render('signup', {
        title: 'Sign Up',
        error: 'Username already exists',
        success: null
      });
    }

    let avatarPath = null;
    if (req.file) {
      avatarPath = `/uploads/avatars/${req.file.filename}`;
    }

    // Get auto-approve and default live limit settings
    const autoApprove = await SystemSettings.getAutoApproveRegistration();
    const defaultLiveLimit = await SystemSettings.getDefaultLiveLimitForRegistration();

    const newUser = await User.create({
      username,
      password,
      avatar_path: avatarPath,
      user_role: user_role || 'member',
      status: autoApprove ? 'active' : 'inactive',
      live_limit: defaultLiveLimit === 0 ? null : defaultLiveLimit
    });

    if (newUser) {
      const successMessage = autoApprove
        ? 'Account created successfully! You can now login.'
        : 'Account created successfully! Please wait for admin approval to activate your account.';

      return res.render('signup', {
        title: 'Sign Up',
        error: null,
        success: successMessage
      });
    } else {
      return res.render('signup', {
        title: 'Sign Up',
        error: 'Failed to create account. Please try again.',
        success: null
      });
    }
  } catch (error) {
    console.error('Signup error:', error);
    return res.render('signup', {
      title: 'Sign Up',
      error: 'An error occurred during registration. Please try again.',
      success: null
    });
  }
});

app.get('/setup-account', async (req, res) => {
  try {
    // Check if any active admin exists
    const adminExists = await checkIfAdminExists();
    if (adminExists && !req.session.userId) {
      return res.redirect('/login');
    }
    if (req.session.userId) {
      const user = await User.findById(req.session.userId);
      if (user && user.username) {
        return res.redirect('/dashboard');
      }
    }
    res.render('setup-account', {
      title: 'Complete Your Account',
      user: req.session.userId ? await User.findById(req.session.userId) : {},
      error: null
    });
  } catch (error) {
    console.error('Setup account error:', error);
    // On error (e.g., fresh install with no tables yet), show setup page anyway
    res.render('setup-account', {
      title: 'Complete Your Account',
      user: {},
      error: null
    });
  }
});
app.post('/setup-account', upload.single('avatar'), [
  body('username')
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Username must be between 3 and 20 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.render('setup-account', {
        title: 'Complete Your Account',
        user: { username: req.body.username || '' },
        error: errors.array()[0].msg
      });
    }
    const existingUsername = await User.findByUsername(req.body.username);
    if (existingUsername) {
      return res.render('setup-account', {
        title: 'Complete Your Account',
        user: { email: req.body.email || '' },
        error: 'Username is already taken'
      });
    }
    const avatarPath = req.file ? `/uploads/avatars/${req.file.filename}` : null;
    // Check if any active admin exists (not just any user)
    const adminExists = await checkIfAdminExists();
    if (!adminExists) {
      try {
        const user = await User.create({
          username: req.body.username,
          password: req.body.password,
          avatar_path: avatarPath,
          user_role: 'admin',
          status: 'active'
        });
        req.session.userId = user.id;
        req.session.username = req.body.username;
        req.session.user_role = user.user_role;
        if (avatarPath) {
          req.session.avatar_path = avatarPath;
        }
        console.log('Setup account - Using user ID from database:', user.id);
        console.log('Setup account - Session userId set to:', req.session.userId);
        return res.redirect('/dashboard');
      } catch (error) {
        console.error('User creation error:', error);
        return res.render('setup-account', {
          title: 'Complete Your Account',
          user: {},
          error: 'Failed to create user. Please try again.'
        });
      }
    } else {
      await User.update(req.session.userId, {
        username: req.body.username,
        password: req.body.password,
        avatar_path: avatarPath,
      });
      req.session.username = req.body.username;
      if (avatarPath) {
        req.session.avatar_path = avatarPath;
      }
      res.redirect('/dashboard');
    }
  } catch (error) {
    console.error('Account setup error:', error);
    res.render('setup-account', {
      title: 'Complete Your Account',
      user: { email: req.body.email || '' },
      error: 'An error occurred. Please try again.'
    });
  }
});
app.get('/', (req, res) => {
  res.redirect('/dashboard');
});

// Health check endpoint - no authentication required
// Used for monitoring if the application is running
app.get('/health', async (req, res) => {
  try {
    const activeStreams = streamingService.getActiveStreams();

    // Check database connectivity
    let dbStatus = { connected: false, latency: 0 };
    try {
      dbStatus = await checkConnectivity();
    } catch (dbErr) {
      dbStatus = { connected: false, latency: 0, error: dbErr.message };
    }

    // Determine overall status
    const components = {
      database: dbStatus.connected ? 'healthy' : 'unhealthy',
      streaming: 'healthy',
      scheduler: 'healthy'
    };

    const isHealthy = Object.values(components).every(s => s === 'healthy');
    const status = isHealthy ? 'ok' : 'degraded';
    const statusCode = isHealthy ? 200 : 503;

    res.status(statusCode).json({
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB'
      },
      database: {
        connected: dbStatus.connected,
        latency: dbStatus.latency
      },
      activeStreams: activeStreams.length,
      components
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString(),
      components: {
        database: 'unknown',
        streaming: 'unknown',
        scheduler: 'unknown'
      }
    });
  }
});
app.get('/dashboard', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    res.render('dashboard', {
      title: 'Dashboard',
      active: 'dashboard',
      user: user
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.redirect('/login');
  }
});
app.get('/gallery', isAuthenticated, canViewVideos, async (req, res) => {
  try {
    const tab = req.query.tab || 'video';
    const user = await User.findById(req.session.userId);

    // Check view permission for members
    let videos = [];
    let viewPermissionDenied = false;

    if (user.user_role === 'admin' || user.can_view_videos === 1) {
      videos = await Video.findAll(req.session.userId);
    } else {
      viewPermissionDenied = true;
    }

    const audios = await Audio.findAll(req.session.userId);

    // Get user permissions for UI
    const permissions = {
      can_view_videos: user.user_role === 'admin' || user.can_view_videos === 1,
      can_download_videos: user.user_role === 'admin' || user.can_download_videos === 1,
      can_delete_videos: user.user_role === 'admin' || user.can_delete_videos === 1
    };

    res.render('gallery', {
      title: 'Media Gallery',
      active: 'gallery',
      user: user,
      videos: videos,
      audios: audios,
      activeTab: tab,
      permissions: permissions,
      viewPermissionDenied: viewPermissionDenied
    });
  } catch (error) {
    console.error('Gallery error:', error);
    res.redirect('/dashboard');
  }
});
app.get('/settings', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      req.session.destroy();
      return res.redirect('/login');
    }
    res.render('settings', {
      title: 'Settings',
      active: 'settings',
      user: user
    });
  } catch (error) {
    console.error('Settings error:', error);
    res.redirect('/login');
  }
});
// Schedule page - shows all scheduled streams
app.get('/schedule', isAuthenticated, async (req, res) => {
  try {
    const streams = await Stream.findAllScheduled(req.session.userId);

    // Compute next run time for recurring streams
    streams.forEach(stream => {
      if (stream.schedule_type === 'daily' || stream.schedule_type === 'weekly') {
        stream.nextRunTime = Stream.getNextScheduledTime(stream);
      }
    });

    // Group streams by schedule type
    const grouped = Stream.groupByScheduleType(streams);

    // Filter today's schedules
    const todaySchedules = Stream.filterTodaySchedules(streams);

    res.render('schedule', {
      active: 'schedule',
      title: 'Schedule',
      streams: streams,
      grouped: grouped,
      todaySchedules: todaySchedules,
      helpers: app.locals.helpers
    });
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load schedules',
      error: error
    });
  }
});

app.get('/history', isAuthenticated, async (req, res) => {
  try {
    const db = require('./db/database').db;
    const history = await new Promise((resolve, reject) => {
      db.all(
        `SELECT h.*, v.thumbnail_path 
         FROM stream_history h 
         LEFT JOIN videos v ON h.video_id = v.id 
         WHERE h.user_id = ? 
         ORDER BY h.start_time DESC`,
        [req.session.userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
    res.render('history', {
      active: 'history',
      title: 'Stream History',
      history: history,
      helpers: app.locals.helpers
    });
  } catch (error) {
    console.error('Error fetching stream history:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load stream history',
      error: error
    });
  }
});
app.delete('/api/history/:id', isAuthenticated, async (req, res) => {
  try {
    const db = require('./db/database').db;
    const historyId = req.params.id;
    const history = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM stream_history WHERE id = ? AND user_id = ?',
        [historyId, req.session.userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    if (!history) {
      return res.status(404).json({
        success: false,
        error: 'History entry not found or not authorized'
      });
    }
    await new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM stream_history WHERE id = ?',
        [historyId],
        function (err) {
          if (err) reject(err);
          else resolve(this);
        }
      );
    });
    res.json({ success: true, message: 'History entry deleted' });
  } catch (error) {
    console.error('Error deleting history entry:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete history entry'
    });
  }
});

app.get('/users', isAdmin, async (req, res) => {
  try {
    const users = await User.findAll();
    const SystemSettingsModel = require('./models/SystemSettings');
    const defaultLiveLimit = await SystemSettingsModel.getDefaultLiveLimit();

    const usersWithStats = await Promise.all(users.map(async (user) => {
      const videoStats = await new Promise((resolve, reject) => {
        db.get(
          `SELECT COUNT(*) as count, COALESCE(SUM(file_size), 0) as totalSize 
           FROM videos WHERE user_id = ?`,
          [user.id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      const streamStats = await new Promise((resolve, reject) => {
        db.get(
          `SELECT COUNT(*) as count FROM streams WHERE user_id = ?`,
          [user.id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      const activeStreamStats = await new Promise((resolve, reject) => {
        db.get(
          `SELECT COUNT(*) as count FROM streams WHERE user_id = ? AND status = 'live'`,
          [user.id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
      };

      return {
        ...user,
        videoCount: videoStats.count,
        totalVideoSize: videoStats.totalSize > 0 ? formatFileSize(videoStats.totalSize) : null,
        streamCount: streamStats.count,
        activeStreamCount: activeStreamStats.count,
        defaultLiveLimit: defaultLiveLimit
      };
    }));

    res.render('users', {
      title: 'User Management',
      active: 'users',
      users: usersWithStats,
      user: req.user
    });
  } catch (error) {
    console.error('Users page error:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load users page',
      user: req.user
    });
  }
});

app.post('/api/users/status', isAdmin, async (req, res) => {
  try {
    const { userId, status } = req.body;

    if (!userId || !status || !['active', 'inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID or status'
      });
    }

    if (userId == req.session.userId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot change your own status'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await User.updateStatus(userId, status);

    res.json({
      success: true,
      message: `User ${status === 'active' ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user status'
    });
  }
});

app.post('/api/users/role', isAdmin, async (req, res) => {
  try {
    const { userId, role } = req.body;

    if (!userId || !role || !['admin', 'member'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID or role'
      });
    }

    if (userId == req.session.userId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot change your own role'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await User.updateRole(userId, role);

    res.json({
      success: true,
      message: `User role updated to ${role} successfully`
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user role'
    });
  }
});

app.post('/api/users/delete', isAdmin, async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    if (userId == req.session.userId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await User.delete(userId);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user'
    });
  }
});

app.post('/api/users/update', isAdmin, upload.single('avatar'), async (req, res) => {
  try {
    const { userId, username, role, status, password, live_limit, storage_limit } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    let avatarPath = user.avatar_path;
    if (req.file) {
      avatarPath = `/uploads/avatars/${req.file.filename}`;
    }

    const updateData = {
      username: username || user.username,
      user_role: role || user.user_role,
      status: status || user.status,
      avatar_path: avatarPath
    };

    // Handle live_limit - convert to null if empty/0, otherwise parse as integer
    if (live_limit !== undefined) {
      const parsedLimit = parseInt(live_limit, 10);
      updateData.live_limit = (isNaN(parsedLimit) || parsedLimit <= 0) ? null : parsedLimit;
    }

    // Handle storage_limit - convert to null if empty/0, otherwise parse as integer
    if (storage_limit !== undefined) {
      const parsedStorageLimit = parseInt(storage_limit, 10);
      updateData.storage_limit = (isNaN(parsedStorageLimit) || parsedStorageLimit <= 0) ? null : parsedStorageLimit;
    }

    if (password && password.trim() !== '') {
      const bcrypt = require('bcrypt');
      updateData.password = await bcrypt.hash(password, 10);
    }

    await User.updateProfile(userId, updateData);

    res.json({
      success: true,
      message: 'User updated successfully'
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user'
    });
  }
});

app.post('/api/users/create', isAdmin, upload.single('avatar'), async (req, res) => {
  try {
    const { username, role, status, password } = req.body;

    // Username validation regex - only allow letters, numbers, and underscores
    const VALID_USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    // Validate username format to prevent SQL injection and XSS
    if (!VALID_USERNAME_REGEX.test(username)) {
      return res.status(400).json({
        success: false,
        message: 'Username can only contain letters, numbers, and underscores'
      });
    }

    // Validate username length
    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({
        success: false,
        message: 'Username must be between 3 and 20 characters'
      });
    }

    const existingUser = await User.findByUsername(username);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Username already exists'
      });
    }

    let avatarPath = null;
    if (req.file) {
      avatarPath = `/uploads/avatars/${req.file.filename}`;
    }

    const userData = {
      username: username,
      password: password,
      user_role: role || 'member',
      status: status || 'active',
      avatar_path: avatarPath
    };

    const result = await User.create(userData);

    res.json({
      success: true,
      message: 'User created successfully',
      userId: result.id
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user'
    });
  }
});

app.get('/api/users/:id/videos', isAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const videos = await Video.findAll(userId);
    res.json({ success: true, videos });
  } catch (error) {
    console.error('Get user videos error:', error);
    res.status(500).json({ success: false, message: 'Failed to get user videos' });
  }
});

app.get('/api/users/:id/streams', isAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const streams = await Stream.findAll(userId);
    res.json({ success: true, streams });
  } catch (error) {
    console.error('Get user streams error:', error);
    res.status(500).json({ success: false, message: 'Failed to get user streams' });
  }
});

// Permission Control API
app.post('/api/users/permission', isAdmin, async (req, res) => {
  try {
    const { userId, permission, value } = req.body;

    const validPermissions = ['can_view_videos', 'can_download_videos', 'can_delete_videos'];
    if (!userId || !permission || !validPermissions.includes(permission)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID or permission type'
      });
    }

    if (userId === req.session.userId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify your own permissions'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await User.updatePermission(userId, permission, value);

    res.json({
      success: true,
      message: 'Permission updated successfully'
    });
  } catch (error) {
    console.error('Error updating permission:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update permission'
    });
  }
});

app.post('/api/users/bulk-permissions', isAdmin, async (req, res) => {
  try {
    const { userIds, permissions } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No users selected'
      });
    }

    // Filter out admin's own ID
    const filteredUserIds = userIds.filter(id => id !== req.session.userId);
    if (filteredUserIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify your own permissions'
      });
    }

    const validPermissions = ['can_view_videos', 'can_download_videos', 'can_delete_videos'];
    const validatedPermissions = {};
    for (const [key, value] of Object.entries(permissions || {})) {
      if (validPermissions.includes(key)) {
        validatedPermissions[key] = value;
      }
    }

    if (Object.keys(validatedPermissions).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid permissions to update'
      });
    }

    const result = await User.bulkUpdatePermissions(filteredUserIds, validatedPermissions);

    res.json({
      success: true,
      message: `Permissions updated for ${result.updatedCount} users`,
      updatedCount: result.updatedCount
    });
  } catch (error) {
    console.error('Error bulk updating permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update permissions'
    });
  }
});

app.get('/api/users/:id/permissions', isAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const permissions = await User.getPermissions(userId);

    if (!permissions) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({ success: true, permissions });
  } catch (error) {
    console.error('Get user permissions error:', error);
    res.status(500).json({ success: false, message: 'Failed to get user permissions' });
  }
});

// Storage Limit API
const StorageService = require('./services/storageService');

app.get('/api/users/:id/storage', isAuthenticated, async (req, res) => {
  try {
    const userId = req.params.id;
    const currentUser = req.session.user;

    // Allow users to view their own storage, admins can view any user
    if (currentUser.id !== userId && currentUser.user_role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const storageInfo = await StorageService.getStorageInfo(userId);
    res.json({ success: true, storage: storageInfo });
  } catch (error) {
    console.error('Get user storage error:', error);
    res.status(500).json({ success: false, message: 'Failed to get storage info' });
  }
});

app.put('/api/users/:id/storage-limit', isAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const { limit } = req.body;

    const result = await User.updateStorageLimit(userId, limit);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Update storage limit error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

app.get('/api/settings/default-storage-limit', isAdmin, async (req, res) => {
  try {
    const defaultLimit = await StorageService.getDefaultStorageLimit();
    res.json({
      success: true,
      defaultLimit,
      formatted: StorageService.formatBytes(defaultLimit)
    });
  } catch (error) {
    console.error('Get default storage limit error:', error);
    res.status(500).json({ success: false, message: 'Failed to get default storage limit' });
  }
});

app.put('/api/settings/default-storage-limit', isAdmin, async (req, res) => {
  try {
    const { limit } = req.body;
    await StorageService.setDefaultStorageLimit(limit);
    res.json({ success: true, message: 'Default storage limit updated' });
  } catch (error) {
    console.error('Update default storage limit error:', error);
    res.status(500).json({ success: false, message: 'Failed to update default storage limit' });
  }
});


// Live Limit Settings API

app.get('/api/settings/live-limit', isAdmin, async (req, res) => {
  try {
    const defaultLimit = await SystemSettings.getDefaultLiveLimit();
    res.json({ success: true, defaultLimit });
  } catch (error) {
    console.error('Get live limit error:', error);
    res.status(500).json({ success: false, message: 'Failed to get live limit' });
  }
});

app.post('/api/settings/live-limit', isAdmin, async (req, res) => {
  try {
    const { limit } = req.body;
    const parsedLimit = parseInt(limit, 10);

    if (isNaN(parsedLimit) || parsedLimit < 1) {
      return res.status(400).json({
        success: false,
        message: 'Live limit must be at least 1'
      });
    }

    await SystemSettings.setDefaultLiveLimit(parsedLimit);
    res.json({ success: true, message: 'Live limit updated successfully', limit: parsedLimit });
  } catch (error) {
    console.error('Set live limit error:', error);
    res.status(500).json({ success: false, message: 'Failed to update live limit' });
  }
});

// Auto-approve registration settings
app.get('/api/settings/auto-approve', isAdmin, async (req, res) => {
  try {
    const enabled = await SystemSettings.getAutoApproveRegistration();
    res.json({ success: true, enabled });
  } catch (error) {
    console.error('Get auto-approve error:', error);
    res.status(500).json({ success: false, message: 'Failed to get auto-approve setting' });
  }
});

app.post('/api/settings/auto-approve', isAdmin, async (req, res) => {
  try {
    const { enabled } = req.body;
    await SystemSettings.setAutoApproveRegistration(!!enabled);
    res.json({ success: true, message: 'Auto-approve setting updated successfully', enabled: !!enabled });
  } catch (error) {
    console.error('Set auto-approve error:', error);
    res.status(500).json({ success: false, message: 'Failed to update auto-approve setting' });
  }
});

// Default live limit for new registrations
app.get('/api/settings/default-live-limit-registration', isAdmin, async (req, res) => {
  try {
    const limit = await SystemSettings.getDefaultLiveLimitForRegistration();
    res.json({ success: true, limit, isUnlimited: limit === 0 });
  } catch (error) {
    console.error('Get default live limit registration error:', error);
    res.status(500).json({ success: false, message: 'Failed to get default live limit' });
  }
});

app.post('/api/settings/default-live-limit-registration', isAdmin, async (req, res) => {
  try {
    const { limit } = req.body;
    const parsedLimit = parseInt(limit, 10) || 0;

    if (parsedLimit < 0) {
      return res.status(400).json({
        success: false,
        message: 'Live limit cannot be negative'
      });
    }

    await SystemSettings.setDefaultLiveLimitForRegistration(parsedLimit);
    res.json({
      success: true,
      message: parsedLimit === 0 ? 'Default live limit set to unlimited' : `Default live limit set to ${parsedLimit}`,
      limit: parsedLimit,
      isUnlimited: parsedLimit === 0
    });
  } catch (error) {
    console.error('Set default live limit registration error:', error);
    res.status(500).json({ success: false, message: 'Failed to update default live limit' });
  }
});

app.get('/api/streams/limit-info', isAuthenticated, async (req, res) => {
  try {
    const limitInfo = await LiveLimitService.validateAndGetInfo(req.session.userId);
    res.json({ success: true, ...limitInfo });
  } catch (error) {
    console.error('Get limit info error:', error);
    res.status(500).json({ success: false, message: 'Failed to get limit info' });
  }
});

app.get('/api/system-stats', isAuthenticated, async (req, res) => {
  try {
    const stats = await systemMonitor.getSystemStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  Object.keys(interfaces).forEach((ifname) => {
    interfaces[ifname].forEach((iface) => {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    });
  });
  return addresses.length > 0 ? addresses : ['localhost'];
}
app.post('/settings/profile', isAuthenticated, upload.single('avatar'), [
  body('username')
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Username must be between 3 and 20 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('settings', {
        title: 'Settings',
        active: 'settings',
        user: await User.findById(req.session.userId),
        error: errors.array()[0].msg,
        activeTab: 'profile'
      });
    }
    const currentUser = await User.findById(req.session.userId);
    if (req.body.username !== currentUser.username) {
      const existingUser = await User.findByUsername(req.body.username);
      if (existingUser) {
        return res.render('settings', {
          title: 'Settings',
          active: 'settings',
          user: currentUser,
          error: 'Username is already taken',
          activeTab: 'profile'
        });
      }
    }
    const updateData = {
      username: req.body.username
    };
    if (req.file) {
      updateData.avatar_path = `/uploads/avatars/${req.file.filename}`;
    }
    await User.update(req.session.userId, updateData);
    req.session.username = updateData.username;
    if (updateData.avatar_path) {
      req.session.avatar_path = updateData.avatar_path;
    }
    return res.render('settings', {
      title: 'Settings',
      active: 'settings',
      user: await User.findById(req.session.userId),
      success: 'Profile updated successfully!',
      activeTab: 'profile'
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.render('settings', {
      title: 'Settings',
      active: 'settings',
      user: await User.findById(req.session.userId),
      error: 'An error occurred while updating your profile',
      activeTab: 'profile'
    });
  }
});
app.post('/settings/password', isAuthenticated, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),
  body('confirmPassword')
    .custom((value, { req }) => value === req.body.newPassword)
    .withMessage('Passwords do not match'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('settings', {
        title: 'Settings',
        active: 'settings',
        user: await User.findById(req.session.userId),
        error: errors.array()[0].msg,
        activeTab: 'security'
      });
    }
    const user = await User.findById(req.session.userId);
    const passwordMatch = await User.verifyPassword(req.body.currentPassword, user.password);
    if (!passwordMatch) {
      return res.render('settings', {
        title: 'Settings',
        active: 'settings',
        user: user,
        error: 'Current password is incorrect',
        activeTab: 'security'
      });
    }
    const hashedPassword = await bcrypt.hash(req.body.newPassword, 10);
    await User.update(req.session.userId, { password: hashedPassword });
    return res.render('settings', {
      title: 'Settings',
      active: 'settings',
      user: await User.findById(req.session.userId),
      success: 'Password changed successfully',
      activeTab: 'security'
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.render('settings', {
      title: 'Settings',
      active: 'settings',
      user: await User.findById(req.session.userId),
      error: 'An error occurred while changing your password',
      activeTab: 'security'
    });
  }
});
app.get('/settings', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      req.session.destroy();
      return res.redirect('/login');
    }
    res.render('settings', {
      title: 'Settings',
      active: 'settings',
      user: user
    });
  } catch (error) {
    console.error('Settings error:', error);
    res.redirect('/dashboard');
  }
});
app.post('/settings/integrations/gdrive', isAuthenticated, [
  body('apiKey').notEmpty().withMessage('API Key is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('settings', {
        title: 'Settings',
        active: 'settings',
        user: await User.findById(req.session.userId),
        error: errors.array()[0].msg,
        activeTab: 'integrations'
      });
    }
    await User.update(req.session.userId, {
      gdrive_api_key: req.body.apiKey
    });
    return res.render('settings', {
      title: 'Settings',
      active: 'settings',
      user: await User.findById(req.session.userId),
      success: 'Google Drive API key saved successfully!',
      activeTab: 'integrations'
    });
  } catch (error) {
    console.error('Error saving Google Drive API key:', error);
    res.render('settings', {
      title: 'Settings',
      active: 'settings',
      user: await User.findById(req.session.userId),
      error: 'An error occurred while saving your Google Drive API key',
      activeTab: 'integrations'
    });
  }
});
app.post('/upload/video', isAuthenticated, uploadVideo.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const { filename, originalname, path: videoPath, mimetype, size } = req.file;
    const thumbnailName = path.basename(filename, path.extname(filename)) + '.jpg';
    const videoInfo = await getVideoInfo(videoPath);
    const thumbnailRelativePath = await generateThumbnail(videoPath, thumbnailName)
      .then(() => `/uploads/thumbnails/${thumbnailName}`)
      .catch(() => null);

    let format = 'unknown';
    if (mimetype === 'video/mp4') format = 'mp4';
    else if (mimetype === 'video/avi') format = 'avi';
    else if (mimetype === 'video/quicktime') format = 'mov';

    const videoData = {
      title: path.basename(originalname, path.extname(originalname)),
      original_filename: originalname,
      filepath: `/uploads/videos/${filename}`,
      thumbnail_path: thumbnailRelativePath,
      file_size: size,
      duration: videoInfo.duration,
      format: format,
      user_id: req.session.userId
    };

    const video = await Video.create(videoData);
    res.json({
      success: true,
      video: {
        id: video.id,
        title: video.title,
        filepath: video.filepath,
        thumbnail_path: video.thumbnail_path,
        duration: video.duration,
        file_size: video.file_size,
        format: video.format
      }
    });
  } catch (error) {
    console.error('Upload error details:', error);
    res.status(500).json({
      error: 'Failed to upload video',
      details: error.message
    });
  }
});

app.post('/api/videos/upload', isAuthenticated, (req, res, next) => {
  uploadVideo.single('video')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          success: false,
          error: 'File too large. Maximum size is 10GB.'
        });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          success: false,
          error: 'Unexpected file field.'
        });
      }
      return res.status(400).json({
        success: false,
        error: err.message
      });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No video file provided'
      });
    }

    const title = path.parse(req.file.originalname).name;
    const filePath = `/uploads/videos/${req.file.filename}`;
    const fullFilePath = path.join(__dirname, 'public', filePath);
    const fileSize = req.file.size;

    // Generate thumbnail filename early
    const thumbnailFilename = `thumb-${path.parse(req.file.filename).name}.jpg`;
    const thumbnailPath = `/uploads/thumbnails/${thumbnailFilename}`;

    // Run ffprobe and thumbnail generation in parallel for faster processing
    const [metadata] = await Promise.all([
      // Get video metadata
      new Promise((resolve, reject) => {
        ffmpeg.ffprobe(fullFilePath, (err, metadata) => {
          if (err) return reject(err);
          resolve(metadata);
        });
      }),
      // Generate thumbnail in parallel (don't wait for it to complete response)
      new Promise((resolve) => {
        ffmpeg(fullFilePath)
          .screenshots({
            timestamps: ['10%'],
            filename: thumbnailFilename,
            folder: path.join(__dirname, 'public', 'uploads', 'thumbnails'),
            size: '854x480'
          })
          .on('end', resolve)
          .on('error', (err) => {
            console.error('Thumbnail generation error:', err.message);
            resolve(); // Don't fail upload if thumbnail fails
          });
      })
    ]);

    const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
    const duration = metadata.format.duration || 0;
    const format = metadata.format.format_name || path.extname(req.file.filename).replace('.', '');
    const resolution = videoStream ? `${videoStream.width}x${videoStream.height}` : '';
    const bitrate = metadata.format.bit_rate ? Math.round(parseInt(metadata.format.bit_rate) / 1000) : null;

    let fps = null;
    if (videoStream && videoStream.avg_frame_rate) {
      const fpsRatio = videoStream.avg_frame_rate.split('/');
      if (fpsRatio.length === 2 && parseInt(fpsRatio[1]) !== 0) {
        fps = Math.round((parseInt(fpsRatio[0]) / parseInt(fpsRatio[1]) * 100)) / 100;
      } else {
        fps = parseInt(fpsRatio[0]) || null;
      }
    }

    const videoData = {
      title,
      filepath: filePath,
      thumbnail_path: thumbnailPath,
      file_size: fileSize,
      duration,
      format,
      resolution,
      bitrate,
      fps,
      user_id: req.session.userId
    };

    const video = await Video.create(videoData);

    res.json({
      success: true,
      message: 'Video uploaded successfully',
      video
    });

  } catch (error) {
    console.error('Upload error details:', error);
    res.status(500).json({
      error: 'Failed to upload video',
      details: error.message
    });
  }
});
app.get('/api/videos', isAuthenticated, async (req, res) => {
  try {
    const videos = await Video.findAll(req.session.userId);
    res.json({ success: true, videos });
  } catch (error) {
    console.error('Error fetching videos:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch videos' });
  }
});
app.delete('/api/videos/:id', isAuthenticated, canDeleteVideos, async (req, res) => {
  try {
    const videoId = req.params.id;
    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({ success: false, error: 'Video not found' });
    }
    if (video.user_id !== req.session.userId) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    const videoPath = path.join(__dirname, 'public', video.filepath);
    if (fs.existsSync(videoPath)) {
      fs.unlinkSync(videoPath);
    }
    if (video.thumbnail_path) {
      const thumbnailPath = path.join(__dirname, 'public', video.thumbnail_path);
      if (fs.existsSync(thumbnailPath)) {
        fs.unlinkSync(thumbnailPath);
      }
    }
    await Video.delete(videoId, req.session.userId);
    res.json({ success: true, message: 'Video deleted successfully' });
  } catch (error) {
    console.error('Error deleting video:', error);
    res.status(500).json({ success: false, error: 'Failed to delete video' });
  }
});
// Video download endpoint with permission check
app.get('/api/videos/:id/download', isAuthenticated, canDownloadVideos, async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ success: false, error: 'Video not found' });
    }
    // Admin can download any video, members can only download their own
    if (req.user.user_role !== 'admin' && video.user_id !== req.session.userId) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    const videoPath = path.join(__dirname, 'public', video.filepath);
    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({ success: false, error: 'Video file not found' });
    }
    res.download(videoPath, video.title + path.extname(video.filepath));
  } catch (error) {
    console.error('Error downloading video:', error);
    res.status(500).json({ success: false, error: 'Failed to download video' });
  }
});

app.post('/api/videos/:id/rename', isAuthenticated, [
  body('title').trim().isLength({ min: 1 }).withMessage('Title cannot be empty')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    if (video.user_id !== req.session.userId) {
      return res.status(403).json({ error: 'You don\'t have permission to rename this video' });
    }
    await Video.update(req.params.id, { title: req.body.title });
    res.json({ success: true, message: 'Video renamed successfully' });
  } catch (error) {
    console.error('Error renaming video:', error);
    res.status(500).json({ error: 'Failed to rename video' });
  }
});
app.get('/stream/:videoId', isAuthenticated, async (req, res) => {
  try {
    const videoId = req.params.videoId;
    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).send('Video not found');
    }
    // Allow admin to access all videos, members can only access their own
    const user = await User.findById(req.session.userId);
    if (user.user_role !== 'admin' && video.user_id !== req.session.userId) {
      return res.status(403).send('You do not have permission to access this video');
    }
    const videoPath = path.join(__dirname, 'public', video.filepath);
    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = (end - start) + 1;
      const file = fs.createReadStream(videoPath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': 'video/mp4',
      });
      file.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      });
      fs.createReadStream(videoPath).pipe(res);
    }
  } catch (error) {
    console.error('Streaming error:', error);
    res.status(500).send('Error streaming video');
  }
});
app.get('/api/settings/gdrive-status', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    res.json({
      hasApiKey: !!user.gdrive_api_key,
      message: user.gdrive_api_key ? 'Google Drive API key is configured' : 'No Google Drive API key found'
    });
  } catch (error) {
    console.error('Error checking Google Drive API status:', error);
    res.status(500).json({ error: 'Failed to check API key status' });
  }
});
app.post('/api/settings/gdrive-api-key', isAuthenticated, [
  body('apiKey').notEmpty().withMessage('API Key is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array()[0].msg
      });
    }
    await User.update(req.session.userId, {
      gdrive_api_key: req.body.apiKey
    });
    return res.json({
      success: true,
      message: 'Google Drive API key saved successfully!'
    });
  } catch (error) {
    console.error('Error saving Google Drive API key:', error);
    res.status(500).json({
      success: false,
      error: 'An error occurred while saving your Google Drive API key'
    });
  }
});
app.post('/api/videos/import-drive', isAuthenticated, [
  body('driveUrl').notEmpty().withMessage('Google Drive URL is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }
    const { driveUrl } = req.body;
    const { extractFileId, downloadFile } = require('./utils/googleDriveService');
    try {
      const fileId = extractFileId(driveUrl);
      const jobId = uuidv4();
      processGoogleDriveImport(jobId, fileId, req.session.userId)
        .catch(err => console.error('Drive import failed:', err));
      return res.json({
        success: true,
        message: 'Video import started',
        jobId: jobId
      });
    } catch (error) {
      console.error('Google Drive URL parsing error:', error);
      return res.status(400).json({
        success: false,
        error: 'Invalid Google Drive URL format'
      });
    }
  } catch (error) {
    console.error('Error importing from Google Drive:', error);
    res.status(500).json({ success: false, error: 'Failed to import video' });
  }
});
app.get('/api/videos/import-status/:jobId', isAuthenticated, async (req, res) => {
  const jobId = req.params.jobId;
  if (!importJobs[jobId]) {
    return res.status(404).json({ success: false, error: 'Import job not found' });
  }
  return res.json({
    success: true,
    status: importJobs[jobId]
  });
});
const importJobs = {};
async function processGoogleDriveImport(jobId, fileId, userId) {
  const { downloadFile } = require('./utils/googleDriveService');
  const { getVideoInfo, generateThumbnail } = require('./utils/videoProcessor');
  const ffmpeg = require('fluent-ffmpeg');

  importJobs[jobId] = {
    status: 'downloading',
    progress: 0,
    message: 'Starting download...'
  };

  try {
    const result = await downloadFile(fileId, (progress) => {
      let progressPercent = progress.progress;
      let message = '';

      if (progressPercent === -1 || progressPercent < 0) {
        // Unknown file size - show downloaded bytes
        const downloadedMB = (progress.downloaded / 1024 / 1024).toFixed(2);
        message = `Downloading: ${downloadedMB} MB downloaded...`;
        progressPercent = 0; // Keep progress bar at 0 for unknown size
      } else {
        message = `Downloading: ${progressPercent}%`;
      }

      importJobs[jobId] = {
        status: 'downloading',
        progress: progressPercent,
        message: message
      };
    });

    importJobs[jobId] = {
      status: 'processing',
      progress: 100,
      message: 'Processing video...'
    };

    const videoInfo = await getVideoInfo(result.localFilePath);

    const metadata = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(result.localFilePath, (err, metadata) => {
        if (err) return reject(err);
        resolve(metadata);
      });
    });

    let resolution = '';
    let bitrate = null;

    const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
    if (videoStream) {
      resolution = `${videoStream.width}x${videoStream.height}`;
    }

    if (metadata.format && metadata.format.bit_rate) {
      bitrate = Math.round(parseInt(metadata.format.bit_rate) / 1000);
    }

    const thumbnailName = path.basename(result.filename, path.extname(result.filename)) + '.jpg';
    const thumbnailRelativePath = await generateThumbnail(result.localFilePath, thumbnailName)
      .then(() => `/uploads/thumbnails/${thumbnailName}`)
      .catch(() => null);

    let format = path.extname(result.filename).toLowerCase().replace('.', '');
    if (!format) format = 'mp4';

    const videoData = {
      title: path.basename(result.originalFilename, path.extname(result.originalFilename)),
      filepath: `/uploads/videos/${result.filename}`,
      thumbnail_path: thumbnailRelativePath,
      file_size: result.fileSize,
      duration: videoInfo.duration,
      format: format,
      resolution: resolution,
      bitrate: bitrate,
      user_id: userId
    };

    const video = await Video.create(videoData);

    importJobs[jobId] = {
      status: 'complete',
      progress: 100,
      message: 'Video imported successfully',
      videoId: video.id
    };
    setTimeout(() => {
      delete importJobs[jobId];
    }, 5 * 60 * 1000);
  } catch (error) {
    console.error('Error processing Google Drive import:', error);
    importJobs[jobId] = {
      status: 'failed',
      progress: 0,
      message: error.message || 'Failed to import video'
    };
    setTimeout(() => {
      delete importJobs[jobId];
    }, 5 * 60 * 1000);
  }
}

// Batch Google Drive Import for Videos
const batchImportJobs = {};

app.post('/api/videos/import-drive-batch', isAuthenticated, [
  body('driveUrls').isArray({ min: 1 }).withMessage('At least one Google Drive URL is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { driveUrls } = req.body;
    const { extractFileId } = require('./utils/googleDriveService');

    // Validate and extract file IDs
    const files = [];
    for (let i = 0; i < driveUrls.length; i++) {
      try {
        const fileId = extractFileId(driveUrls[i]);
        files.push({ index: i, link: driveUrls[i], fileId });
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: `Invalid Google Drive URL at position ${i + 1}: ${error.message}`
        });
      }
    }

    const batchId = uuidv4();

    // Start batch processing
    processBatchVideoImport(batchId, files, req.session.userId)
      .catch(err => console.error('Batch video import failed:', err));

    return res.json({
      success: true,
      message: 'Batch import started',
      batchId: batchId,
      totalFiles: files.length
    });
  } catch (error) {
    console.error('Error starting batch import:', error);
    res.status(500).json({ success: false, error: 'Failed to start batch import' });
  }
});

app.get('/api/videos/import-batch-status/:batchId', isAuthenticated, async (req, res) => {
  const batchId = req.params.batchId;
  if (!batchImportJobs[batchId]) {
    return res.status(404).json({ success: false, error: 'Batch import job not found' });
  }

  const job = batchImportJobs[batchId];
  const summary = {
    total: job.files.length,
    completed: job.files.filter(f => f.status === 'completed').length,
    failed: job.files.filter(f => f.status === 'failed').length,
    pending: job.files.filter(f => f.status === 'pending').length,
    processing: job.files.filter(f => f.status === 'downloading' || f.status === 'processing').length
  };

  return res.json({
    success: true,
    status: {
      batchId,
      isComplete: job.isComplete,
      isCancelled: job.isCancelled,
      files: job.files,
      summary
    }
  });
});

app.post('/api/videos/import-batch-cancel/:batchId', isAuthenticated, async (req, res) => {
  const batchId = req.params.batchId;
  if (!batchImportJobs[batchId]) {
    return res.status(404).json({ success: false, error: 'Batch import job not found' });
  }

  batchImportJobs[batchId].isCancelled = true;

  return res.json({
    success: true,
    message: 'Batch import cancelled'
  });
});

async function processBatchVideoImport(batchId, files, userId) {
  const { downloadFile } = require('./utils/googleDriveService');
  const { getVideoInfo, generateThumbnail } = require('./utils/videoProcessor');
  const ffmpeg = require('fluent-ffmpeg');

  // Initialize batch job
  batchImportJobs[batchId] = {
    isComplete: false,
    isCancelled: false,
    files: files.map(f => ({
      index: f.index,
      link: f.link,
      fileId: f.fileId,
      status: 'pending',
      progress: 0,
      message: 'Waiting...',
      error: null,
      resultId: null
    }))
  };

  // Process files sequentially
  for (let i = 0; i < files.length; i++) {
    // Check if cancelled
    if (batchImportJobs[batchId].isCancelled) {
      break;
    }

    const file = batchImportJobs[batchId].files[i];
    file.status = 'downloading';
    file.message = 'Starting download...';

    try {
      // Download file
      const result = await downloadFile(file.fileId, (progress) => {
        let progressPercent = progress.progress;
        if (progressPercent === -1 || progressPercent < 0) {
          const downloadedMB = (progress.downloaded / 1024 / 1024).toFixed(2);
          file.progress = 0;
          file.message = `Downloading: ${downloadedMB} MB downloaded...`;
        } else {
          file.progress = progressPercent;
          file.message = `Downloading: ${progressPercent}%`;
        }
      });

      file.status = 'processing';
      file.progress = 100;
      file.message = 'Processing video...';

      // Get video info
      const videoInfo = await getVideoInfo(result.localFilePath);

      // Get metadata
      const metadata = await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(result.localFilePath, (err, metadata) => {
          if (err) return reject(err);
          resolve(metadata);
        });
      });

      let resolution = '';
      let bitrate = null;

      const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
      if (videoStream) {
        resolution = `${videoStream.width}x${videoStream.height}`;
      }

      if (metadata.format && metadata.format.bit_rate) {
        bitrate = Math.round(parseInt(metadata.format.bit_rate) / 1000);
      }

      // Generate thumbnail
      const thumbnailName = path.basename(result.filename, path.extname(result.filename)) + '.jpg';
      const thumbnailRelativePath = await generateThumbnail(result.localFilePath, thumbnailName)
        .then(() => `/uploads/thumbnails/${thumbnailName}`)
        .catch(() => null);

      let format = path.extname(result.filename).toLowerCase().replace('.', '');
      if (!format) format = 'mp4';

      // Create video record
      const videoData = {
        title: path.basename(result.originalFilename, path.extname(result.originalFilename)),
        filepath: `/uploads/videos/${result.filename}`,
        thumbnail_path: thumbnailRelativePath,
        file_size: result.fileSize,
        duration: videoInfo.duration,
        format: format,
        resolution: resolution,
        bitrate: bitrate,
        user_id: userId
      };

      const video = await Video.create(videoData);

      file.status = 'completed';
      file.progress = 100;
      file.message = 'Video imported successfully';
      file.resultId = video.id;

    } catch (error) {
      console.error(`Error importing file ${i}:`, error);
      file.status = 'failed';
      file.progress = 0;
      file.message = error.message || 'Import failed';
      file.error = error.message || 'Import failed';
    }
  }

  batchImportJobs[batchId].isComplete = true;

  // Clean up after 10 minutes
  setTimeout(() => {
    delete batchImportJobs[batchId];
  }, 10 * 60 * 1000);
}

app.get('/api/stream/videos', isAuthenticated, async (req, res) => {
  try {
    const videos = await Video.findAll(req.session.userId);
    const formattedVideos = videos.map(video => {
      const duration = video.duration ? Math.floor(video.duration) : 0;
      const minutes = Math.floor(duration / 60);
      const seconds = Math.floor(duration % 60);
      const formattedDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      return {
        id: video.id,
        name: video.title,
        thumbnail: video.thumbnail_path,
        resolution: video.resolution || '1280x720',
        duration: formattedDuration,
        url: `/stream/${video.id}`,
        type: 'video'
      };
    });
    res.json(formattedVideos);
  } catch (error) {
    console.error('Error fetching videos for stream:', error);
    res.status(500).json({ error: 'Failed to load videos' });
  }
});

app.get('/api/stream/content', isAuthenticated, async (req, res) => {
  try {
    const videos = await Video.findAll(req.session.userId);
    const formattedVideos = videos.map(video => {
      const duration = video.duration ? Math.floor(video.duration) : 0;
      const minutes = Math.floor(duration / 60);
      const seconds = Math.floor(duration % 60);
      const formattedDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      return {
        id: video.id,
        name: video.title,
        thumbnail: video.thumbnail_path,
        resolution: video.resolution || '1280x720',
        duration: formattedDuration,
        url: `/stream/${video.id}`,
        type: 'video'
      };
    });

    const playlists = await Playlist.findAll(req.session.userId);
    const formattedPlaylists = playlists.map(playlist => {
      return {
        id: playlist.id,
        name: playlist.name,
        thumbnail: '/images/playlist-thumbnail.svg',
        resolution: 'Playlist',
        duration: `${playlist.video_count || 0} videos`,
        url: `/playlist/${playlist.id}`,
        type: 'playlist',
        description: playlist.description,
        is_shuffle: playlist.is_shuffle
      };
    });

    const allContent = [...formattedPlaylists, ...formattedVideos];

    res.json(allContent);
  } catch (error) {
    console.error('Error fetching content for stream:', error);
    res.status(500).json({ error: 'Failed to load content' });
  }
});

// API endpoint for fetching audio list for stream modal
app.get('/api/stream/audios', isAuthenticated, async (req, res) => {
  try {
    const audios = await Audio.findAll(req.session.userId);
    const formattedAudios = audios.map(audio => {
      let formattedDuration = 'Unknown';
      if (audio.duration) {
        const duration = Math.floor(audio.duration);
        const minutes = Math.floor(duration / 60);
        const seconds = Math.floor(duration % 60);
        formattedDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      }
      return {
        id: audio.id,
        title: audio.title,
        name: audio.title,
        duration: formattedDuration,
        format: audio.format || 'audio',
        filepath: audio.filepath
      };
    });
    res.json(formattedAudios);
  } catch (error) {
    console.error('Error fetching audios for stream:', error);
    res.status(500).json({ error: 'Failed to load audios' });
  }
});

const Stream = require('./models/Stream');
const { title } = require('process');

// API endpoint for schedules (used by dashboard modal)
app.get('/api/schedules', isAuthenticated, async (req, res) => {
  try {
    const type = req.query.type || 'once';
    const allSchedules = await Stream.findAllScheduled(req.session.userId);

    // Filter by type
    const schedules = allSchedules.filter(s => s.schedule_type === type);

    // Add nextRunTime for recurring schedules
    schedules.forEach(stream => {
      if (stream.schedule_type === 'daily' || stream.schedule_type === 'weekly') {
        stream.nextRunTime = Stream.getNextScheduledTime(stream);
      }
    });

    res.json({ success: true, schedules });
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch schedules' });
  }
});

app.get('/api/streams', isAuthenticated, async (req, res) => {
  try {
    const filter = req.query.filter;
    const streams = await Stream.findAll(req.session.userId, filter);
    res.json({ success: true, streams });
  } catch (error) {
    console.error('Error fetching streams:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch streams' });
  }
});

// Get YouTube status for a stream
app.get('/api/streams/:id/youtube-status', isAuthenticated, async (req, res) => {
  try {
    const streamId = req.params.id;
    const stream = await Stream.findById(streamId);

    if (!stream) {
      return res.status(404).json({ success: false, error: 'Stream not found' });
    }

    // Check if stream belongs to user
    if (stream.user_id !== req.session.userId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Get YouTube status from streaming service
    const youtubeStatus = streamingService.getYouTubeStatus(streamId);
    const isMonitored = streamingService.isYouTubeMonitored(streamId);

    res.json({
      success: true,
      streamId,
      platform: stream.platform,
      isYouTube: stream.platform === 'YouTube',
      isMonitored,
      youtubeStatus: youtubeStatus || null
    });
  } catch (error) {
    console.error('Error fetching YouTube status:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch YouTube status' });
  }
});
app.post('/api/streams', isAuthenticated, [
  body('streamTitle').trim().isLength({ min: 1 }).withMessage('Title is required'),
  body('rtmpUrl').trim().isLength({ min: 1 }).withMessage('RTMP URL is required'),
  body('streamKey').trim().isLength({ min: 1 }).withMessage('Stream key is required')
], async (req, res) => {
  try {
    console.log('Session userId for stream creation:', req.session.userId);
    console.log('[API] Received stream data:', JSON.stringify({
      scheduleType: req.body.scheduleType,
      recurringTime: req.body.recurringTime,
      recurringEnabled: req.body.recurringEnabled,
      scheduleDays: req.body.scheduleDays
    }));
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    // Check stream limit before creating
    const limitInfo = await LiveLimitService.validateAndGetInfo(req.session.userId);
    if (!limitInfo.canStart) {
      return res.status(403).json({
        success: false,
        error: limitInfo.message || 'Stream limit reached',
        limitInfo: {
          activeStreams: limitInfo.activeStreams,
          effectiveLimit: limitInfo.effectiveLimit
        }
      });
    }

    let platform = 'Custom';
    let platform_icon = 'ti-broadcast';
    if (req.body.rtmpUrl.includes('youtube.com')) {
      platform = 'YouTube';
      platform_icon = 'ti-brand-youtube';
    } else if (req.body.rtmpUrl.includes('facebook.com')) {
      platform = 'Facebook';
      platform_icon = 'ti-brand-facebook';
    } else if (req.body.rtmpUrl.includes('twitch.tv')) {
      platform = 'Twitch';
      platform_icon = 'ti-brand-twitch';
    } else if (req.body.rtmpUrl.includes('tiktok.com')) {
      platform = 'TikTok';
      platform_icon = 'ti-brand-tiktok';
    } else if (req.body.rtmpUrl.includes('instagram.com')) {
      platform = 'Instagram';
      platform_icon = 'ti-brand-instagram';
    } else if (req.body.rtmpUrl.includes('shopee.io')) {
      platform = 'Shopee Live';
      platform_icon = 'ti-brand-shopee';
    } else if (req.body.rtmpUrl.includes('restream.io')) {
      platform = 'Restream.io';
      platform_icon = 'ti-live-photo';
    }
    // Parse schedule days if provided
    let scheduleDays = null;
    if (req.body.scheduleDays) {
      try {
        scheduleDays = typeof req.body.scheduleDays === 'string'
          ? JSON.parse(req.body.scheduleDays)
          : req.body.scheduleDays;
      } catch (e) {
        scheduleDays = null;
      }
    }

    const streamData = {
      title: req.body.streamTitle,
      video_id: req.body.videoId || null,
      audio_id: req.body.audioId || null,
      rtmp_url: req.body.rtmpUrl,
      stream_key: req.body.streamKey,
      platform,
      platform_icon,
      bitrate: parseInt(req.body.bitrate) || 2500,
      resolution: req.body.resolution || '1280x720',
      fps: parseInt(req.body.fps) || 30,
      orientation: req.body.orientation || 'horizontal',
      loop_video: req.body.loopVideo === 'true' || req.body.loopVideo === true,
      // Duration in minutes (stored as stream_duration_minutes in DB)
      // Priority: If user sets duration (hours + minutes), use that and ignore end_time for duration
      stream_duration_minutes: (() => {
        const hours = parseInt(req.body.streamDurationHours) || 0;
        const minutes = parseInt(req.body.streamDurationMinutes) || 0;
        const totalMinutes = (hours * 60) + minutes;
        console.log(`[API] Duration calculation: ${hours}h + ${minutes}m = ${totalMinutes} total minutes`);
        return totalMinutes > 0 ? totalMinutes : null;
      })(),
      // Recurring schedule fields
      schedule_type: req.body.scheduleType || 'once',
      schedule_days: scheduleDays,
      recurring_time: req.body.recurringTime || null,
      // FIXED: Handle all possible truthy values for recurring_enabled
      recurring_enabled: req.body.recurringEnabled === 'true' || req.body.recurringEnabled === true || req.body.recurringEnabled === 'on' || req.body.recurringEnabled === 1,
      user_id: req.session.userId
    };

    // Calculate if user has set explicit duration
    const hasExplicitDuration = streamData.stream_duration_minutes && streamData.stream_duration_minutes > 0;

    const serverTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    function parseLocalDateTime(dateTimeString) {
      const [datePart, timePart] = dateTimeString.split('T');
      const [year, month, day] = datePart.split('-').map(Number);
      const [hours, minutes] = timePart.split(':').map(Number);

      return new Date(year, month - 1, day, hours, minutes);
    }

    if (req.body.scheduleStartTime) {
      const scheduleStartDate = parseLocalDateTime(req.body.scheduleStartTime);
      streamData.schedule_time = scheduleStartDate.toISOString();
      streamData.status = 'scheduled';

      // Only use end_time for duration calculation if user hasn't set explicit duration
      if (req.body.scheduleEndTime && !hasExplicitDuration) {
        const scheduleEndDate = parseLocalDateTime(req.body.scheduleEndTime);

        if (scheduleEndDate <= scheduleStartDate) {
          return res.status(400).json({
            success: false,
            error: 'End time must be after start time'
          });
        }

        streamData.end_time = scheduleEndDate.toISOString();
        const durationMs = scheduleEndDate - scheduleStartDate;
        const durationMinutes = Math.round(durationMs / (1000 * 60));
        // Set stream_duration_minutes from end_time calculation
        streamData.stream_duration_minutes = durationMinutes > 0 ? durationMinutes : null;
        streamData.duration = durationMinutes > 0 ? durationMinutes : null;
        console.log(`[API] Duration from end_time: ${durationMinutes} minutes`);
      } else if (req.body.scheduleEndTime && hasExplicitDuration) {
        // User set both duration and end_time - use duration, but still store end_time for reference
        const scheduleEndDate = parseLocalDateTime(req.body.scheduleEndTime);
        streamData.end_time = scheduleEndDate.toISOString();
        console.log(`[API] Using explicit duration (${streamData.stream_duration_minutes} min), end_time stored for reference only`);
      }
      // If no end_time and no duration, stream will be unlimited
    } else if (req.body.scheduleEndTime) {
      const scheduleEndDate = parseLocalDateTime(req.body.scheduleEndTime);
      streamData.end_time = scheduleEndDate.toISOString();
    }

    // Set status based on schedule type
    if (!streamData.status) {
      if (streamData.schedule_type === 'daily' || streamData.schedule_type === 'weekly') {
        // Recurring schedules should be 'scheduled' status
        streamData.status = 'scheduled';
      } else {
        streamData.status = 'offline';
      }
    }

    console.log(`[API] Creating stream with schedule_type=${streamData.schedule_type}, recurring_time=${streamData.recurring_time}, recurring_enabled=${streamData.recurring_enabled}, status=${streamData.status}, duration=${streamData.stream_duration_minutes} min`);

    const stream = await Stream.create(streamData);
    res.json({ success: true, stream });
  } catch (error) {
    console.error('Error creating stream:', error);
    res.status(500).json({ success: false, error: 'Failed to create stream' });
  }
});

// Stream Settings Backup - Export endpoint (MUST be before :id routes)
const backupService = require('./services/backupService');

app.get('/api/streams/export', isAuthenticated, async (req, res) => {
  try {
    const backupData = await backupService.exportStreams(req.session.userId);
    const filename = `ozanglive-backup-${new Date().toISOString().split('T')[0]}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(backupData, null, 2));
  } catch (error) {
    console.error('Error exporting streams:', error);
    res.status(500).json({ success: false, error: 'Failed to export stream settings' });
  }
});

// Stream Settings Backup - Import endpoint
app.post('/api/streams/import', isAuthenticated, uploadBackup.single('backupFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    // Read and parse the uploaded file
    const fileContent = req.file.buffer.toString('utf8');
    let backupData;

    try {
      backupData = JSON.parse(fileContent);
    } catch (parseError) {
      return res.status(400).json({ success: false, error: 'Invalid JSON format' });
    }

    // Import streams
    const result = await backupService.importStreams(backupData, req.session.userId);

    res.json({
      success: true,
      imported: result.imported,
      skipped: result.skipped,
      matched: result.matched || { video: 0, audio: 0 },
      errors: result.errors,
      message: `Successfully imported ${result.imported} stream(s). ${result.skipped} skipped.` +
        (result.matched && (result.matched.video > 0 || result.matched.audio > 0)
          ? ` Matched: ${result.matched.video} video(s), ${result.matched.audio} audio(s).`
          : '')
    });
  } catch (error) {
    console.error('Error importing streams:', error);
    res.status(500).json({ success: false, error: 'Failed to import stream settings' });
  }
});

// Comprehensive Backup - Export all data endpoint
app.post('/api/backup/export-all', isAuthenticated, async (req, res) => {
  try {
    const { categories } = req.body || {};
    console.log('[Export] Starting export for user:', req.session.userId, 'categories:', categories);

    const backupData = await backupService.comprehensiveExport(req.session.userId, categories);
    console.log('[Export] Export completed successfully');

    const filename = `ozanglive-full-backup-${new Date().toISOString().split('T')[0]}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(backupService.formatBackupJson(backupData));
  } catch (error) {
    console.error('[Export] Error exporting all data:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to export data' });
  }
});

// Comprehensive Backup - Import all data endpoint
app.post('/api/backup/import-all', isAuthenticated, uploadBackup.single('backupFile'), async (req, res) => {
  try {
    console.log('[Import] Starting import process for user:', req.session.userId);

    let backupData;
    let fileContent = '';

    // Handle file upload or JSON body
    if (req.file) {
      console.log('[Import] File received:', req.file.originalname, 'Size:', req.file.size, 'bytes');
      fileContent = req.file.buffer.toString('utf8');
      try {
        backupData = JSON.parse(fileContent);
        console.log('[Import] JSON parsed successfully');

        // Log backup data structure for debugging
        console.log('[Import] Backup data structure:');
        console.log('[Import]   - Type:', typeof backupData);
        console.log('[Import]   - Is Array:', Array.isArray(backupData));
        console.log('[Import]   - Top-level keys:', Object.keys(backupData || {}).join(', '));

        // Detect format type
        const hasMetadata = backupData && backupData.metadata;
        const hasStreamsArray = backupData && Array.isArray(backupData.streams);
        const isOldFormat = !hasMetadata && hasStreamsArray;

        console.log('[Import] Format detection:');
        console.log('[Import]   - Has metadata:', hasMetadata);
        console.log('[Import]   - Has streams array:', hasStreamsArray);
        console.log('[Import]   - Detected as old format:', isOldFormat);

        if (hasMetadata) {
          console.log('[Import] Metadata:', JSON.stringify(backupData.metadata, null, 2));
        }

        // Log data counts for each category
        const categories = ['streams', 'youtube_credentials', 'broadcast_templates',
          'recurring_schedules', 'stream_templates', 'playlists',
          'title_folders', 'title_suggestions', 'thumbnail_files'];

        console.log('[Import] Data counts by category:');
        categories.forEach(cat => {
          if (backupData[cat]) {
            if (Array.isArray(backupData[cat])) {
              console.log(`[Import]   - ${cat}: ${backupData[cat].length} items`);
            } else if (typeof backupData[cat] === 'object') {
              console.log(`[Import]   - ${cat}: object with keys [${Object.keys(backupData[cat]).join(', ')}]`);
            }
          }
        });

      } catch (parseError) {
        console.error('[Import] JSON parse error:', parseError.message);
        console.error('[Import] File content preview (first 500 chars):', fileContent.substring(0, 500));
        return res.status(400).json({
          success: false,
          error: 'Invalid JSON format',
          details: [
            'The uploaded file is not valid JSON. Please check the file format.',
            `Parse error: ${parseError.message}`
          ]
        });
      }
    } else if (req.body && req.body.backup) {
      console.log('[Import] Using backup data from request body');
      backupData = req.body.backup;
    } else {
      console.error('[Import] No backup data provided');
      return res.status(400).json({
        success: false,
        error: 'No backup data provided',
        details: ['Please select a backup file to import.']
      });
    }

    // Get import options
    const options = {
      skipDuplicates: req.body.skipDuplicates !== false,
      overwrite: req.body.overwrite === true
    };

    console.log('[Import] Import options:', options);

    // Import all data
    console.log('[Import] Calling comprehensiveImport...');
    const result = await backupService.comprehensiveImport(backupData, req.session.userId, options);
    console.log('[Import] Import completed:', result.success ? 'SUCCESS' : 'FAILED');

    if (!result.success) {
      console.error('[Import] Import failed:', result.error);
      console.error('[Import] Validation details:', result.details);
      return res.status(400).json(result);
    }

    console.log('[Import] Sending success response');
    res.json({
      success: true,
      results: result.results,
      warnings: result.warnings,
      message: 'Import completed successfully'
    });
  } catch (error) {
    console.error('[Import] CRITICAL ERROR during import:', error);
    console.error('[Import] Error stack:', error.stack);
    console.error('[Import] Error name:', error.name);
    console.error('[Import] Error message:', error.message);

    // Send detailed error response
    res.status(500).json({
      success: false,
      error: 'Failed to import data',
      details: [
        `Error: ${error.message}`,
        'Please check server logs for more details.',
        'If the problem persists, try with a smaller backup file or contact support.'
      ],
      errorType: error.name,
      errorMessage: error.message
    });
  }
});

// Stream Settings - Reset all streams to original imported settings
app.post('/api/streams/reset-all', isAuthenticated, async (req, res) => {
  try {
    const result = await Stream.resetAllToOriginal(req.session.userId);

    res.json({
      success: true,
      resetCount: result.resetCount,
      skippedCount: result.skippedCount,
      message: `Reset ${result.resetCount} stream(s) to original settings. ${result.skippedCount} skipped.`
    });
  } catch (error) {
    console.error('Error resetting streams:', error);
    res.status(500).json({ success: false, error: 'Failed to reset stream settings' });
  }
});

// Find stream by stream_key - for YouTube Sync page shortcut to edit stream
app.get('/api/streams/by-stream-key/:streamKey', isAuthenticated, async (req, res) => {
  try {
    const streamKey = req.params.streamKey;
    if (!streamKey || streamKey.trim() === '') {
      return res.status(400).json({ success: false, error: 'Stream key is required' });
    }

    const stream = await Stream.findByStreamKey(streamKey, req.session.userId);
    if (!stream) {
      return res.status(404).json({ success: false, message: 'Stream not found in schedule' });
    }

    res.json({ success: true, stream });
  } catch (error) {
    console.error('Error finding stream by stream_key:', error);
    res.status(500).json({ success: false, error: 'Failed to find stream' });
  }
});

app.get('/api/streams/:id', isAuthenticated, async (req, res) => {
  try {
    const stream = await Stream.getStreamWithVideo(req.params.id);
    if (!stream) {
      return res.status(404).json({ success: false, error: 'Stream not found' });
    }
    if (stream.user_id !== req.session.userId) {
      return res.status(403).json({ success: false, error: 'Not authorized to access this stream' });
    }
    res.json({ success: true, stream });
  } catch (error) {
    console.error('Error fetching stream:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stream' });
  }
});
app.put('/api/streams/:id', isAuthenticated, async (req, res) => {
  try {
    const stream = await Stream.findById(req.params.id);
    if (!stream) {
      return res.status(404).json({ success: false, error: 'Stream not found' });
    }
    if (stream.user_id !== req.session.userId) {
      return res.status(403).json({ success: false, error: 'Not authorized to update this stream' });
    }
    const updateData = {};
    if (req.body.streamTitle) updateData.title = req.body.streamTitle;
    if (req.body.videoId) updateData.video_id = req.body.videoId;

    if (req.body.rtmpUrl) {
      updateData.rtmp_url = req.body.rtmpUrl;

      let platform = 'Custom';
      let platform_icon = 'ti-broadcast';
      if (req.body.rtmpUrl.includes('youtube.com')) {
        platform = 'YouTube';
        platform_icon = 'ti-brand-youtube';
      } else if (req.body.rtmpUrl.includes('facebook.com')) {
        platform = 'Facebook';
        platform_icon = 'ti-brand-facebook';
      } else if (req.body.rtmpUrl.includes('twitch.tv')) {
        platform = 'Twitch';
        platform_icon = 'ti-brand-twitch';
      } else if (req.body.rtmpUrl.includes('tiktok.com')) {
        platform = 'TikTok';
        platform_icon = 'ti-brand-tiktok';
      } else if (req.body.rtmpUrl.includes('instagram.com')) {
        platform = 'Instagram';
        platform_icon = 'ti-brand-instagram';
      } else if (req.body.rtmpUrl.includes('shopee.io')) {
        platform = 'Shopee Live';
        platform_icon = 'ti-brand-shopee';
      } else if (req.body.rtmpUrl.includes('restream.io')) {
        platform = 'Restream.io';
        platform_icon = 'ti-live-photo';
      }
      updateData.platform = platform;
      updateData.platform_icon = platform_icon;
    }

    if (req.body.streamKey) updateData.stream_key = req.body.streamKey;
    if (req.body.bitrate) updateData.bitrate = parseInt(req.body.bitrate);
    if (req.body.resolution) updateData.resolution = req.body.resolution;
    if (req.body.fps) updateData.fps = parseInt(req.body.fps);
    if (req.body.orientation) updateData.orientation = req.body.orientation;
    if (req.body.loopVideo !== undefined) {
      updateData.loop_video = req.body.loopVideo === 'true' || req.body.loopVideo === true;
    }
    if (req.body.useAdvancedSettings !== undefined) {
      updateData.use_advanced_settings = req.body.useAdvancedSettings === 'true' || req.body.useAdvancedSettings === true;
    }

    // Handle stream duration (in minutes - new format: hours + minutes)
    // IMPORTANT: If user sets duration, this takes priority over end_time
    let hasExplicitDuration = false;
    if (req.body.streamDurationHours !== undefined || req.body.streamDurationMinutes !== undefined) {
      const hours = parseInt(req.body.streamDurationHours) || 0;
      const minutes = parseInt(req.body.streamDurationMinutes) || 0;
      const totalMinutes = (hours * 60) + minutes;
      updateData.stream_duration_minutes = totalMinutes > 0 ? totalMinutes : null;
      hasExplicitDuration = totalMinutes > 0;
      console.log(`[API Update] Duration set: ${hours}h + ${minutes}m = ${totalMinutes} minutes, hasExplicitDuration=${hasExplicitDuration}`);
    }

    // Handle audio selection
    if (req.body.audioId !== undefined) {
      updateData.audio_id = req.body.audioId || null;
    }

    // Handle recurring schedule fields
    if (req.body.scheduleType !== undefined) {
      updateData.schedule_type = req.body.scheduleType || 'once';
    }
    if (req.body.recurringTime !== undefined) {
      updateData.recurring_time = req.body.recurringTime || null;
    }
    if (req.body.scheduleDays !== undefined) {
      try {
        const days = typeof req.body.scheduleDays === 'string'
          ? JSON.parse(req.body.scheduleDays)
          : req.body.scheduleDays;
        updateData.schedule_days = days ? JSON.stringify(days) : null;
      } catch (e) {
        updateData.schedule_days = null;
      }
    }
    if (req.body.recurringEnabled !== undefined) {
      // FIXED: Handle all possible truthy values for recurring_enabled
      updateData.recurring_enabled = (req.body.recurringEnabled === 'true' || req.body.recurringEnabled === true || req.body.recurringEnabled === 'on' || req.body.recurringEnabled === 1) ? 1 : 0;
    }

    // Set status to scheduled for recurring schedules
    if (updateData.schedule_type && (updateData.schedule_type === 'daily' || updateData.schedule_type === 'weekly')) {
      updateData.status = 'scheduled';
    }

    // FIXED: For 'once' schedule type, set status based on whether schedule_time is set
    // This ensures that when user changes from daily/weekly to once with a schedule_time,
    // the status is correctly set to 'scheduled'
    if (updateData.schedule_type === 'once' || (!updateData.schedule_type && stream.schedule_type === 'once')) {
      // Status will be set later based on scheduleStartTime
      // If scheduleStartTime is set, status will be 'scheduled'
      // If scheduleStartTime is not set, status will be 'offline'
    }

    const serverTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    function parseLocalDateTime(dateTimeString) {
      const [datePart, timePart] = dateTimeString.split('T');
      const [year, month, day] = datePart.split('-').map(Number);
      const [hours, minutes] = timePart.split(':').map(Number);

      return new Date(year, month - 1, day, hours, minutes);
    }

    if (req.body.scheduleStartTime) {
      const scheduleStartDate = parseLocalDateTime(req.body.scheduleStartTime);
      updateData.schedule_time = scheduleStartDate.toISOString();
      updateData.status = 'scheduled';

      // FIXED: Only use end_time for duration if user hasn't set explicit duration
      if (req.body.scheduleEndTime && !hasExplicitDuration) {
        const scheduleEndDate = parseLocalDateTime(req.body.scheduleEndTime);

        if (scheduleEndDate <= scheduleStartDate) {
          return res.status(400).json({
            success: false,
            error: 'End time must be after start time'
          });
        }

        updateData.end_time = scheduleEndDate.toISOString();
        const durationMs = scheduleEndDate - scheduleStartDate;
        const durationMinutes = Math.round(durationMs / (1000 * 60));
        // Only set duration from end_time if no explicit duration
        updateData.stream_duration_minutes = durationMinutes > 0 ? durationMinutes : null;
        updateData.duration = durationMinutes > 0 ? durationMinutes : null;
        console.log(`[API Update] Duration from end_time: ${durationMinutes} minutes`);
      } else if (req.body.scheduleEndTime && hasExplicitDuration) {
        // User set both duration and end_time - use duration, store end_time for reference only
        const scheduleEndDate = parseLocalDateTime(req.body.scheduleEndTime);
        updateData.end_time = scheduleEndDate.toISOString();
        console.log(`[API Update] Using explicit duration (${updateData.stream_duration_minutes} min), end_time stored for reference only`);
      } else if (hasExplicitDuration) {
        // Duration is set, clear end_time (mutual exclusion)
        updateData.end_time = null;
        console.log(`[API Update] Duration set (${updateData.stream_duration_minutes} min), clearing end_time (mutual exclusion)`);
      } else if ('scheduleEndTime' in req.body && (req.body.scheduleEndTime === '' || req.body.scheduleEndTime === null)) {
        // End time cleared - if no explicit duration, stream will be unlimited
        updateData.end_time = null;
        if (!hasExplicitDuration) {
          updateData.duration = null;
          console.log(`[API Update] End time cleared, no duration set - stream will be UNLIMITED`);
        }
      }
    } else if ('scheduleStartTime' in req.body && !req.body.scheduleStartTime) {
      updateData.schedule_time = null;
      // FIXED: Only set to offline if not a recurring schedule
      // For recurring schedules (daily/weekly), keep status as 'scheduled'
      const scheduleType = updateData.schedule_type || stream.schedule_type;
      if (scheduleType === 'daily' || scheduleType === 'weekly') {
        updateData.status = 'scheduled';
      } else {
        updateData.status = 'offline';
      }

      if (req.body.scheduleEndTime) {
        const scheduleEndDate = parseLocalDateTime(req.body.scheduleEndTime);
        updateData.end_time = scheduleEndDate.toISOString();
      } else if ('scheduleEndTime' in req.body && req.body.scheduleEndTime === '') {
        updateData.end_time = null;
        if (!hasExplicitDuration) {
          updateData.duration = null;
        }
      }
    } else if (req.body.scheduleEndTime) {
      const scheduleEndDate = parseLocalDateTime(req.body.scheduleEndTime);
      updateData.end_time = scheduleEndDate.toISOString();
    } else if ('scheduleEndTime' in req.body && req.body.scheduleEndTime === '') {
      updateData.end_time = null;
      if (!hasExplicitDuration) {
        updateData.duration = null;
      }
    }

    // FIXED: Ensure status is correctly set for 'once' schedule type
    // If schedule_type is 'once' and no schedule_time is set, status should be 'offline'
    const finalScheduleType = updateData.schedule_type || stream.schedule_type;
    const finalScheduleTime = updateData.schedule_time !== undefined ? updateData.schedule_time : stream.schedule_time;

    if (finalScheduleType === 'once') {
      if (finalScheduleTime) {
        // Once schedule with schedule_time should be 'scheduled'
        if (!updateData.status) {
          updateData.status = 'scheduled';
        }
      } else {
        // Once schedule without schedule_time should be 'offline'
        if (!updateData.status) {
          updateData.status = 'offline';
        }
      }
    }

    console.log(`[API Update] Final updateData: schedule_type=${finalScheduleType}, schedule_time=${updateData.schedule_time}, end_time=${updateData.end_time}, stream_duration_minutes=${updateData.stream_duration_minutes}, status=${updateData.status}`);

    const updatedStream = await Stream.update(req.params.id, updateData);
    res.json({ success: true, stream: updatedStream });
  } catch (error) {
    console.error('Error updating stream:', error);
    res.status(500).json({ success: false, error: 'Failed to update stream' });
  }
});
// Delete all streams for current user
app.delete('/api/streams/all', isAuthenticated, async (req, res) => {
  try {
    const streams = await Stream.findByUserId(req.session.userId);
    let deletedCount = 0;

    for (const stream of streams) {
      // Stop stream if live
      if (stream.status === 'live') {
        try {
          await streamingService.stopStream(stream.id);
        } catch (e) {
          console.error('Error stopping stream during delete all:', e);
        }
      }
      await Stream.delete(stream.id, req.session.userId);
      deletedCount++;
    }

    res.json({ success: true, deleted: deletedCount, message: `Deleted ${deletedCount} stream(s)` });
  } catch (error) {
    console.error('Error deleting all streams:', error);
    res.status(500).json({ success: false, error: 'Failed to delete all streams' });
  }
});

app.delete('/api/streams/:id', isAuthenticated, async (req, res) => {
  try {
    const stream = await Stream.findById(req.params.id);
    if (!stream) {
      return res.status(404).json({ success: false, error: 'Stream not found' });
    }
    if (stream.user_id !== req.session.userId) {
      return res.status(403).json({ success: false, error: 'Not authorized to delete this stream' });
    }
    await Stream.delete(req.params.id, req.session.userId);
    res.json({ success: true, message: 'Stream deleted successfully' });
  } catch (error) {
    console.error('Error deleting stream:', error);
    res.status(500).json({ success: false, error: 'Failed to delete stream' });
  }
});
app.post('/api/streams/:id/status', isAuthenticated, [
  body('status').isIn(['live', 'offline', 'scheduled']).withMessage('Invalid status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }
    const streamId = req.params.id;
    const stream = await Stream.findById(streamId);
    if (!stream) {
      return res.status(404).json({ success: false, error: 'Stream not found' });
    }
    if (stream.user_id !== req.session.userId) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    const newStatus = req.body.status;
    if (newStatus === 'live') {
      if (stream.status === 'live') {
        return res.json({
          success: false,
          error: 'Stream is already live',
          stream
        });
      }
      if (!stream.video_id) {
        return res.json({
          success: false,
          error: 'No video attached to this stream',
          stream
        });
      }
      const result = await streamingService.startStream(streamId);
      if (result.success) {
        const updatedStream = await Stream.getStreamWithVideo(streamId);
        return res.json({
          success: true,
          stream: updatedStream,
          isAdvancedMode: result.isAdvancedMode
        });
      } else {
        return res.status(500).json({
          success: false,
          error: result.error || 'Failed to start stream'
        });
      }
    } else if (newStatus === 'offline') {
      if (stream.status === 'live') {
        const result = await streamingService.stopStream(streamId);
        if (!result.success) {
          console.warn('Failed to stop FFmpeg process:', result.error);
        }
        // For one-time schedules, reset schedule_time
        if (stream.schedule_type === 'once') {
          await Stream.update(streamId, {
            schedule_time: null
          });
          console.log(`Reset schedule_time for stopped stream ${streamId}`);
        }
        // streamingService.stopStream already sets the correct status based on schedule type
        // So we don't need to update status again here
        const updatedStream = await Stream.getStreamWithVideo(streamId);
        return res.json({ success: true, stream: updatedStream });
      } else if (stream.status === 'scheduled') {
        // For scheduled streams that haven't started yet, set to offline
        // But for recurring streams, keep them as scheduled
        if (stream.schedule_type === 'once') {
          await Stream.update(streamId, {
            schedule_time: null,
            status: 'offline'
          });
          console.log(`Scheduled stream ${streamId} was cancelled`);
        } else {
          // For recurring streams (daily/weekly), just disable the recurring
          // but keep status as scheduled so user can re-enable later
          console.log(`Recurring stream ${streamId} stop requested - keeping scheduled status`);
        }
      }
      // Determine correct status based on schedule type
      const isRecurringEnabled = stream.recurring_enabled === true || stream.recurring_enabled === 1;
      const isRecurring = (stream.schedule_type === 'daily' || stream.schedule_type === 'weekly') && isRecurringEnabled;
      const finalStatus = isRecurring ? 'scheduled' : 'offline';

      const result = await Stream.updateStatus(streamId, finalStatus, req.session.userId);
      if (!result.updated) {
        return res.status(404).json({
          success: false,
          error: 'Stream not found or not updated'
        });
      }
      return res.json({ success: true, stream: result });
    } else {
      const result = await Stream.updateStatus(streamId, newStatus, req.session.userId);
      if (!result.updated) {
        return res.status(404).json({
          success: false,
          error: 'Stream not found or not updated'
        });
      }
      return res.json({ success: true, stream: result });
    }
  } catch (error) {
    console.error('Error updating stream status:', error);
    res.status(500).json({ success: false, error: 'Failed to update stream status' });
  }
});
// Start stream endpoint
app.post('/api/streams/:id/start', isAuthenticated, async (req, res) => {
  try {
    const streamId = req.params.id;
    const stream = await Stream.findById(streamId);
    if (!stream) {
      return res.status(404).json({ success: false, error: 'Stream not found' });
    }
    if (stream.user_id !== req.session.userId) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    if (stream.status === 'live') {
      return res.json({ success: false, error: 'Stream is already live' });
    }
    if (!stream.video_id) {
      return res.json({ success: false, error: 'No video attached to this stream' });
    }
    const result = await streamingService.startStream(streamId);
    if (result.success) {
      const updatedStream = await Stream.getStreamWithVideo(streamId);
      return res.json({ success: true, stream: updatedStream });
    } else {
      // Check if limit reached
      if (result.limitReached) {
        return res.status(403).json({
          success: false,
          error: result.error || 'Hubungi Admin Untuk Menambah Limit',
          limitReached: true,
          activeStreams: result.activeStreams,
          effectiveLimit: result.effectiveLimit
        });
      }
      return res.status(500).json({ success: false, error: result.error || 'Failed to start stream' });
    }
  } catch (error) {
    console.error('Error starting stream:', error);
    res.status(500).json({ success: false, error: 'Failed to start stream' });
  }
});

// Stop stream endpoint
app.post('/api/streams/:id/stop', isAuthenticated, async (req, res) => {
  try {
    const streamId = req.params.id;
    const stream = await Stream.findById(streamId);
    if (!stream) {
      return res.status(404).json({ success: false, error: 'Stream not found' });
    }
    if (stream.user_id !== req.session.userId) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    if (stream.status === 'live') {
      const result = await streamingService.stopStream(streamId);
      if (!result.success) {
        console.warn('Failed to stop FFmpeg process:', result.error);
      }
      // streamingService.stopStream already sets the correct status based on schedule type
      // So we just need to get the updated stream
      const updatedStream = await Stream.getStreamWithVideo(streamId);
      return res.json({ success: true, stream: updatedStream });
    }

    // For non-live streams, determine correct status based on schedule type
    const isRecurringEnabled = stream.recurring_enabled === true || stream.recurring_enabled === 1;
    const isRecurring = (stream.schedule_type === 'daily' || stream.schedule_type === 'weekly') && isRecurringEnabled;
    const finalStatus = isRecurring ? 'scheduled' : 'offline';

    await Stream.updateStatus(streamId, finalStatus, req.session.userId);
    const updatedStream = await Stream.getStreamWithVideo(streamId);
    return res.json({ success: true, stream: updatedStream });
  } catch (error) {
    console.error('Error stopping stream:', error);
    res.status(500).json({ success: false, error: 'Failed to stop stream' });
  }
});

app.get('/api/streams/check-key', isAuthenticated, async (req, res) => {
  try {
    const streamKey = req.query.key;
    const excludeId = req.query.excludeId || null;
    if (!streamKey) {
      return res.status(400).json({
        success: false,
        error: 'Stream key is required'
      });
    }
    const isInUse = await Stream.isStreamKeyInUse(streamKey, req.session.userId, excludeId);
    res.json({
      success: true,
      isInUse: isInUse,
      message: isInUse ? 'Stream key is already in use' : 'Stream key is available'
    });
  } catch (error) {
    console.error('Error checking stream key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check stream key'
    });
  }
});
app.get('/api/streams/:id/logs', isAuthenticated, async (req, res) => {
  try {
    const streamId = req.params.id;
    const stream = await Stream.findById(streamId);
    if (!stream) {
      return res.status(404).json({ success: false, error: 'Stream not found' });
    }
    if (stream.user_id !== req.session.userId) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    const logs = streamingService.getStreamLogs(streamId);
    const isActive = streamingService.isStreamActive(streamId);
    res.json({
      success: true,
      logs,
      isActive,
      stream
    });
  } catch (error) {
    console.error('Error fetching stream logs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stream logs' });
  }
});

app.get('/playlist', isAuthenticated, async (req, res) => {
  try {
    const playlists = await Playlist.findAll(req.session.userId);
    const videos = await Video.findAll(req.session.userId);
    const audios = await Audio.findAll(req.session.userId);
    res.render('playlist', {
      title: 'Playlist',
      active: 'playlist',
      user: await User.findById(req.session.userId),
      playlists: playlists,
      videos: videos,
      audios: audios
    });
  } catch (error) {
    console.error('Playlist error:', error);
    res.redirect('/dashboard');
  }
});

app.get('/api/playlists', isAuthenticated, async (req, res) => {
  try {
    const playlists = await Playlist.findAll(req.session.userId);

    playlists.forEach(playlist => {
      playlist.shuffle = playlist.is_shuffle;
    });

    res.json({ success: true, playlists });
  } catch (error) {
    console.error('Error fetching playlists:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch playlists' });
  }
});

app.post('/api/playlists', isAuthenticated, [
  body('name').trim().isLength({ min: 1 }).withMessage('Playlist name is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const playlistData = {
      name: req.body.name,
      description: req.body.description || null,
      is_shuffle: req.body.shuffle === 'true' || req.body.shuffle === true,
      user_id: req.session.userId
    };

    const playlist = await Playlist.create(playlistData);

    // Add videos
    if (req.body.videos && Array.isArray(req.body.videos) && req.body.videos.length > 0) {
      for (let i = 0; i < req.body.videos.length; i++) {
        await Playlist.addVideo(playlist.id, req.body.videos[i], i + 1);
      }
    }

    // Add audios
    if (req.body.audios && Array.isArray(req.body.audios) && req.body.audios.length > 0) {
      for (let i = 0; i < req.body.audios.length; i++) {
        await Playlist.addAudio(playlist.id, req.body.audios[i], i + 1);
      }
    }

    res.json({ success: true, playlist });
  } catch (error) {
    console.error('Error creating playlist:', error);
    res.status(500).json({ success: false, error: 'Failed to create playlist' });
  }
});

app.get('/api/playlists/:id', isAuthenticated, async (req, res) => {
  try {
    const playlist = await Playlist.findByIdWithMedia(req.params.id);
    if (!playlist) {
      return res.status(404).json({ success: false, error: 'Playlist not found' });
    }
    if (playlist.user_id !== req.session.userId) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    playlist.shuffle = playlist.is_shuffle;

    res.json({ success: true, playlist });
  } catch (error) {
    console.error('Error fetching playlist:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch playlist' });
  }
});

app.put('/api/playlists/:id', isAuthenticated, [
  body('name').trim().isLength({ min: 1 }).withMessage('Playlist name is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) {
      return res.status(404).json({ success: false, error: 'Playlist not found' });
    }
    if (playlist.user_id !== req.session.userId) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    const updateData = {
      name: req.body.name,
      description: req.body.description || null,
      is_shuffle: req.body.shuffle === 'true' || req.body.shuffle === true
    };

    const updatedPlaylist = await Playlist.update(req.params.id, updateData);

    // Update videos
    if (req.body.videos && Array.isArray(req.body.videos)) {
      const existingVideos = await Playlist.findByIdWithVideos(req.params.id);
      if (existingVideos && existingVideos.videos) {
        for (const video of existingVideos.videos) {
          await Playlist.removeVideo(req.params.id, video.id);
        }
      }

      for (let i = 0; i < req.body.videos.length; i++) {
        await Playlist.addVideo(req.params.id, req.body.videos[i], i + 1);
      }
    }

    // Update audios
    if (req.body.audios && Array.isArray(req.body.audios)) {
      await Playlist.clearAudios(req.params.id);

      for (let i = 0; i < req.body.audios.length; i++) {
        await Playlist.addAudio(req.params.id, req.body.audios[i], i + 1);
      }
    }

    res.json({ success: true, playlist: updatedPlaylist });
  } catch (error) {
    console.error('Error updating playlist:', error);
    res.status(500).json({ success: false, error: 'Failed to update playlist' });
  }
});

app.delete('/api/playlists/:id', isAuthenticated, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) {
      return res.status(404).json({ success: false, error: 'Playlist not found' });
    }
    if (playlist.user_id !== req.session.userId) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    await Playlist.delete(req.params.id);
    res.json({ success: true, message: 'Playlist deleted successfully' });
  } catch (error) {
    console.error('Error deleting playlist:', error);
    res.status(500).json({ success: false, error: 'Failed to delete playlist' });
  }
});

app.post('/api/playlists/:id/videos', isAuthenticated, [
  body('videoId').notEmpty().withMessage('Video ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) {
      return res.status(404).json({ success: false, error: 'Playlist not found' });
    }
    if (playlist.user_id !== req.session.userId) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    const video = await Video.findById(req.body.videoId);
    if (!video || video.user_id !== req.session.userId) {
      return res.status(404).json({ success: false, error: 'Video not found' });
    }

    const position = await Playlist.getNextPosition(req.params.id);
    await Playlist.addVideo(req.params.id, req.body.videoId, position);

    res.json({ success: true, message: 'Video added to playlist' });
  } catch (error) {
    console.error('Error adding video to playlist:', error);
    res.status(500).json({ success: false, error: 'Failed to add video to playlist' });
  }
});

app.delete('/api/playlists/:id/videos/:videoId', isAuthenticated, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) {
      return res.status(404).json({ success: false, error: 'Playlist not found' });
    }
    if (playlist.user_id !== req.session.userId) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    await Playlist.removeVideo(req.params.id, req.params.videoId);
    res.json({ success: true, message: 'Video removed from playlist' });
  } catch (error) {
    console.error('Error removing video from playlist:', error);
    res.status(500).json({ success: false, error: 'Failed to remove video from playlist' });
  }
});

app.put('/api/playlists/:id/videos/reorder', isAuthenticated, [
  body('videoPositions').isArray().withMessage('Video positions must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) {
      return res.status(404).json({ success: false, error: 'Playlist not found' });
    }
    if (playlist.user_id !== req.session.userId) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    await Playlist.updateVideoPositions(req.params.id, req.body.videoPositions);
    res.json({ success: true, message: 'Video order updated' });
  } catch (error) {
    console.error('Error reordering videos:', error);
    res.status(500).json({ success: false, error: 'Failed to reorder videos' });
  }
});

app.get('/api/server-time', (req, res) => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[now.getMonth()];
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const formattedTime = `${day} ${month} ${year} ${hours}:${minutes}:${seconds}`;
  res.json({
    serverTime: now.toISOString(),
    formattedTime: formattedTime
  });
});

// Audio API Routes
app.post('/api/audios/upload', isAuthenticated, (req, res, next) => {
  uploadAudio.single('audio')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          success: false,
          error: 'File too large. Maximum size is 500MB.'
        });
      }
      return res.status(400).json({
        success: false,
        error: err.message
      });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No audio file provided'
      });
    }

    const { processAudioForStreaming } = require('./utils/audioProcessor');

    const originalTitle = path.parse(req.file.originalname).name;
    const fullFilePath = path.join(__dirname, 'public', 'uploads', 'audios', req.file.filename);

    // Check if user wants to skip conversion (for faster upload but higher CPU during streaming)
    const skipConversion = req.body.skipConversion === 'true';

    let finalFilePath = fullFilePath;
    let finalFileName = req.file.filename;
    let processingMessage = 'Audio uploaded';

    if (skipConversion) {
      // Skip conversion - faster upload, but may use more CPU during streaming
      console.log(`[AudioUpload] Skipping conversion (user preference): ${req.file.filename}`);
      processingMessage = 'Audio uploaded (tanpa konversi)';
    } else {
      // Pre-process audio for optimal streaming (converts to AAC with clean timestamps)
      console.log(`[AudioUpload] Processing audio for streaming: ${req.file.filename}`);

      try {
        const result = await processAudioForStreaming(fullFilePath);
        finalFilePath = result.outputPath;
        finalFileName = path.basename(result.outputPath);
        console.log(`[AudioUpload] Audio processed successfully: ${finalFileName}`);
        processingMessage = result.skipped ? 'Audio uploaded (sudah optimal)' : 'Audio uploaded dan dioptimasi untuk streaming';
      } catch (processError) {
        console.error(`[AudioUpload] Processing failed, using original: ${processError.message}`);
        processingMessage = 'Audio uploaded (konversi gagal, menggunakan file asli)';
        // Continue with original file if processing fails
      }
    }

    const filePath = `/uploads/audios/${finalFileName}`;
    const fileSize = fs.statSync(finalFilePath).size;
    const format = path.extname(finalFileName).replace('.', '').toUpperCase();

    // Get audio duration
    const metadata = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(finalFilePath, (err, metadata) => {
        if (err) return reject(err);
        resolve(metadata);
      });
    });

    const duration = metadata.format.duration || 0;

    const audioData = {
      title: originalTitle,
      filepath: filePath,
      file_size: fileSize,
      duration,
      format,
      user_id: req.session.userId
    };

    const audio = await Audio.create(audioData);

    res.json({
      success: true,
      message: processingMessage,
      audio
    });

  } catch (error) {
    console.error('Audio upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload audio'
    });
  }
});

app.get('/api/audios', isAuthenticated, async (req, res) => {
  try {
    const audios = await Audio.findAll(req.session.userId);
    res.json({ success: true, audios });
  } catch (error) {
    console.error('Error fetching audios:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch audios' });
  }
});

app.post('/api/audios/:id/rename', isAuthenticated, [
  body('title').trim().isLength({ min: 1 }).withMessage('Title cannot be empty')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }
    const audio = await Audio.findById(req.params.id);
    if (!audio) {
      return res.status(404).json({ success: false, error: 'Audio not found' });
    }
    if (audio.user_id !== req.session.userId) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    await Audio.update(req.params.id, { title: req.body.title });
    res.json({ success: true, message: 'Audio renamed successfully' });
  } catch (error) {
    console.error('Error renaming audio:', error);
    res.status(500).json({ success: false, error: 'Failed to rename audio' });
  }
});

app.delete('/api/audios/:id', isAuthenticated, async (req, res) => {
  try {
    const audioId = req.params.id;
    const audio = await Audio.findById(audioId);
    if (!audio) {
      return res.status(404).json({ success: false, error: 'Audio not found' });
    }
    if (audio.user_id !== req.session.userId) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    await Audio.delete(audioId);
    res.json({ success: true, message: 'Audio deleted successfully' });
  } catch (error) {
    console.error('Error deleting audio:', error);
    res.status(500).json({ success: false, error: 'Failed to delete audio' });
  }
});

app.get('/stream/audio/:audioId', isAuthenticated, async (req, res) => {
  try {
    const audioId = req.params.audioId;
    const audio = await Audio.findById(audioId);
    if (!audio) {
      return res.status(404).send('Audio not found');
    }
    // Allow admin to access all audios, members can only access their own
    const user = await User.findById(req.session.userId);
    if (user.user_role !== 'admin' && audio.user_id !== req.session.userId) {
      return res.status(403).send('Not authorized');
    }
    const audioPath = path.join(__dirname, 'public', audio.filepath);
    if (!fs.existsSync(audioPath)) {
      return res.status(404).send('Audio file not found');
    }
    const stat = fs.statSync(audioPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    const ext = path.extname(audio.filepath).toLowerCase();
    let contentType = 'audio/mpeg';
    if (ext === '.wav') contentType = 'audio/wav';
    else if (ext === '.aac' || ext === '.m4a') contentType = 'audio/aac';

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = (end - start) + 1;
      const file = fs.createReadStream(audioPath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
      });
      file.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
      });
      fs.createReadStream(audioPath).pipe(res);
    }
  } catch (error) {
    console.error('Audio streaming error:', error);
    res.status(500).send('Error streaming audio');
  }
});

// Audio Google Drive Import
app.post('/api/audios/import-drive', isAuthenticated, [
  body('driveUrl').notEmpty().withMessage('Google Drive URL is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }
    const { driveUrl } = req.body;
    const { extractFileId } = require('./utils/googleDriveService');
    try {
      const fileId = extractFileId(driveUrl);
      const jobId = uuidv4();
      processGoogleDriveAudioImport(jobId, fileId, req.session.userId)
        .catch(err => console.error('Audio Drive import failed:', err));
      return res.json({
        success: true,
        message: 'Audio import started',
        jobId: jobId
      });
    } catch (error) {
      console.error('Google Drive URL parsing error:', error);
      return res.status(400).json({
        success: false,
        error: 'Invalid Google Drive URL format'
      });
    }
  } catch (error) {
    console.error('Error importing audio from Google Drive:', error);
    res.status(500).json({ success: false, error: 'Failed to import audio' });
  }
});

const audioImportJobs = {};
async function processGoogleDriveAudioImport(jobId, fileId, userId) {
  const { downloadFile } = require('./utils/googleDriveService');
  const { processAudioForStreaming } = require('./utils/audioProcessor');

  audioImportJobs[jobId] = {
    status: 'downloading',
    progress: 0,
    message: 'Starting download...'
  };

  try {
    const result = await downloadFile(fileId, (progress) => {
      let progressPercent = progress.progress;
      let message = '';

      if (progressPercent === -1 || progressPercent < 0) {
        const downloadedMB = (progress.downloaded / 1024 / 1024).toFixed(2);
        message = `Downloading: ${downloadedMB} MB downloaded...`;
        progressPercent = 0;
      } else {
        message = `Downloading: ${progressPercent}%`;
      }

      audioImportJobs[jobId] = {
        status: 'downloading',
        progress: progressPercent,
        message: message
      };
    }, 'audios');

    audioImportJobs[jobId] = {
      status: 'processing',
      progress: 100,
      message: 'Optimizing audio for streaming...'
    };

    // Pre-process audio for optimal streaming
    let audioFilePath = result.localFilePath;
    let finalFilename = result.filename;

    try {
      console.log(`[DriveImport] Processing audio: ${result.filename}`);
      const processResult = await processAudioForStreaming(audioFilePath);
      audioFilePath = processResult.outputPath;
      finalFilename = path.basename(processResult.outputPath);
      console.log(`[DriveImport] Audio processed: ${finalFilename}`);
    } catch (processError) {
      console.error(`[DriveImport] Processing failed, using original: ${processError.message}`);
    }

    // Get audio duration using ffprobe
    const metadata = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(audioFilePath, (err, metadata) => {
        if (err) return reject(err);
        resolve(metadata);
      });
    });

    const duration = metadata.format.duration || 0;
    let format = path.extname(finalFilename).toLowerCase().replace('.', '').toUpperCase();
    if (!format) format = 'AAC';

    const audioData = {
      title: path.basename(result.originalFilename, path.extname(result.originalFilename)),
      filepath: `/uploads/audios/${finalFilename}`,
      file_size: fs.statSync(audioFilePath).size,
      duration: duration,
      format: format,
      user_id: userId
    };

    await Audio.create(audioData);

    audioImportJobs[jobId] = {
      status: 'completed',
      progress: 100,
      message: 'Audio imported and optimized'
    };

  } catch (error) {
    console.error('Audio import error:', error);
    audioImportJobs[jobId] = {
      status: 'failed',
      progress: 0,
      message: error.message || 'Import failed'
    };
  }
}

// Batch Google Drive Import for Audio
const batchAudioImportJobs = {};

app.post('/api/audios/import-drive-batch', isAuthenticated, [
  body('driveUrls').isArray({ min: 1 }).withMessage('At least one Google Drive URL is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { driveUrls } = req.body;
    const { extractFileId } = require('./utils/googleDriveService');

    // Validate and extract file IDs
    const files = [];
    for (let i = 0; i < driveUrls.length; i++) {
      try {
        const fileId = extractFileId(driveUrls[i]);
        files.push({ index: i, link: driveUrls[i], fileId });
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: `Invalid Google Drive URL at position ${i + 1}: ${error.message}`
        });
      }
    }

    const batchId = uuidv4();

    // Start batch processing
    processBatchAudioImport(batchId, files, req.session.userId)
      .catch(err => console.error('Batch audio import failed:', err));

    return res.json({
      success: true,
      message: 'Batch audio import started',
      batchId: batchId,
      totalFiles: files.length
    });
  } catch (error) {
    console.error('Error starting batch audio import:', error);
    res.status(500).json({ success: false, error: 'Failed to start batch import' });
  }
});

app.get('/api/audios/import-batch-status/:batchId', isAuthenticated, async (req, res) => {
  const batchId = req.params.batchId;
  if (!batchAudioImportJobs[batchId]) {
    return res.status(404).json({ success: false, error: 'Batch import job not found' });
  }

  const job = batchAudioImportJobs[batchId];
  const summary = {
    total: job.files.length,
    completed: job.files.filter(f => f.status === 'completed').length,
    failed: job.files.filter(f => f.status === 'failed').length,
    pending: job.files.filter(f => f.status === 'pending').length,
    processing: job.files.filter(f => f.status === 'downloading' || f.status === 'processing').length
  };

  return res.json({
    success: true,
    status: {
      batchId,
      isComplete: job.isComplete,
      isCancelled: job.isCancelled,
      files: job.files,
      summary
    }
  });
});

app.post('/api/audios/import-batch-cancel/:batchId', isAuthenticated, async (req, res) => {
  const batchId = req.params.batchId;
  if (!batchAudioImportJobs[batchId]) {
    return res.status(404).json({ success: false, error: 'Batch import job not found' });
  }

  batchAudioImportJobs[batchId].isCancelled = true;

  return res.json({
    success: true,
    message: 'Batch audio import cancelled'
  });
});

async function processBatchAudioImport(batchId, files, userId) {
  const { downloadFile } = require('./utils/googleDriveService');

  // Initialize batch job
  batchAudioImportJobs[batchId] = {
    isComplete: false,
    isCancelled: false,
    files: files.map(f => ({
      index: f.index,
      link: f.link,
      fileId: f.fileId,
      status: 'pending',
      progress: 0,
      message: 'Waiting...',
      error: null,
      resultId: null
    }))
  };

  // Process files sequentially
  for (let i = 0; i < files.length; i++) {
    // Check if cancelled
    if (batchAudioImportJobs[batchId].isCancelled) {
      break;
    }

    const file = batchAudioImportJobs[batchId].files[i];
    file.status = 'downloading';
    file.message = 'Starting download...';

    try {
      // Download file
      const result = await downloadFile(file.fileId, (progress) => {
        let progressPercent = progress.progress;
        if (progressPercent === -1 || progressPercent < 0) {
          const downloadedMB = (progress.downloaded / 1024 / 1024).toFixed(2);
          file.progress = 0;
          file.message = `Downloading: ${downloadedMB} MB downloaded...`;
        } else {
          file.progress = progressPercent;
          file.message = `Downloading: ${progressPercent}%`;
        }
      }, 'audios');

      file.status = 'processing';
      file.progress = 100;
      file.message = 'Processing audio...';

      // Get audio duration using ffprobe
      const audioFilePath = result.localFilePath;
      const metadata = await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(audioFilePath, (err, metadata) => {
          if (err) return reject(err);
          resolve(metadata);
        });
      });

      const duration = metadata.format.duration || 0;
      let format = path.extname(result.filename).toLowerCase().replace('.', '').toUpperCase();
      if (!format) format = 'MP3';

      // Create audio record
      const audioData = {
        title: path.basename(result.originalFilename, path.extname(result.originalFilename)),
        filepath: `/uploads/audios/${result.filename}`,
        file_size: result.fileSize,
        duration: duration,
        format: format,
        user_id: userId
      };

      const audio = await Audio.create(audioData);

      file.status = 'completed';
      file.progress = 100;
      file.message = 'Audio imported successfully';
      file.resultId = audio.id;

    } catch (error) {
      console.error(`Error importing audio file ${i}:`, error);
      file.status = 'failed';
      file.progress = 0;
      file.message = error.message || 'Import failed';
      file.error = error.message || 'Import failed';
    }
  }

  batchAudioImportJobs[batchId].isComplete = true;

  // Clean up after 10 minutes
  setTimeout(() => {
    delete batchAudioImportJobs[batchId];
  }, 10 * 60 * 1000);
}

// ============================================
// STREAM TEMPLATES API
// ============================================
const StreamTemplate = require('./models/StreamTemplate');

// GET all templates for current user
app.get('/api/templates', isAuthenticated, async (req, res) => {
  try {
    const templates = await StreamTemplate.findByUserId(req.session.userId);
    res.json({ success: true, templates });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch templates' });
  }
});

// GET single template by ID
app.get('/api/templates/:id', isAuthenticated, async (req, res) => {
  try {
    const template = await StreamTemplate.findById(req.params.id);
    if (!template || template.user_id !== req.session.userId) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    res.json({ success: true, template });
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch template' });
  }
});

// POST create new template
app.post('/api/templates', isAuthenticated, async (req, res) => {
  try {
    const { name, video_id, audio_id, duration_hours, duration_minutes, loop_video, schedule_type, recurring_time, schedule_days, overwrite } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, error: 'Template name is required' });
    }

    // Check if name already exists
    const existing = await StreamTemplate.findByName(req.session.userId, name.trim());
    if (existing && !overwrite) {
      return res.status(409).json({
        success: false,
        error: 'Template name already exists',
        existingId: existing.id
      });
    }

    // If overwrite, delete existing first
    if (existing && overwrite) {
      await StreamTemplate.delete(existing.id, req.session.userId);
    }

    const template = await StreamTemplate.create({
      user_id: req.session.userId,
      name: name.trim(),
      video_id: video_id || null,
      audio_id: audio_id || null,
      duration_hours: parseInt(duration_hours, 10) || 0,
      duration_minutes: parseInt(duration_minutes, 10) || 0,
      loop_video: loop_video !== false,
      schedule_type: schedule_type || 'once',
      recurring_time: recurring_time || null,
      schedule_days: schedule_days || null
    });

    res.json({ success: true, template });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ success: false, error: 'Failed to create template' });
  }
});

// PUT update template
app.put('/api/templates/:id', isAuthenticated, async (req, res) => {
  try {
    const template = await StreamTemplate.findById(req.params.id);
    if (!template || template.user_id !== req.session.userId) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    const { name, video_id, audio_id, duration_hours, duration_minutes, loop_video, schedule_type, recurring_time, schedule_days } = req.body;

    // Check if new name conflicts with existing template
    if (name && name.trim() !== template.name) {
      const nameExists = await StreamTemplate.nameExists(req.session.userId, name.trim(), req.params.id);
      if (nameExists) {
        return res.status(409).json({ success: false, error: 'Template name already exists' });
      }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (video_id !== undefined) updateData.video_id = video_id;
    if (audio_id !== undefined) updateData.audio_id = audio_id;
    if (duration_hours !== undefined) updateData.duration_hours = parseInt(duration_hours, 10) || 0;
    if (duration_minutes !== undefined) updateData.duration_minutes = parseInt(duration_minutes, 10) || 0;
    if (loop_video !== undefined) updateData.loop_video = loop_video;
    if (schedule_type !== undefined) updateData.schedule_type = schedule_type;
    if (recurring_time !== undefined) updateData.recurring_time = recurring_time;
    if (schedule_days !== undefined) updateData.schedule_days = schedule_days;

    const updated = await StreamTemplate.update(req.params.id, updateData);
    res.json({ success: true, template: updated });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ success: false, error: 'Failed to update template' });
  }
});

// DELETE template
app.delete('/api/templates/:id', isAuthenticated, async (req, res) => {
  try {
    const template = await StreamTemplate.findById(req.params.id);
    if (!template || template.user_id !== req.session.userId) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    await StreamTemplate.delete(req.params.id, req.session.userId);
    res.json({ success: true, message: 'Template deleted' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ success: false, error: 'Failed to delete template' });
  }
});

// ============================================
// YouTube Sync Routes (Multiple Accounts Support)
// ============================================

// YouTube Sync Page - displays all connected accounts and their broadcasts
app.get('/youtube', isAuthenticated, async (req, res) => {
  try {
    // Get all connected YouTube accounts for this user
    const accounts = await YouTubeCredentials.findAllByUserId(req.session.userId);
    let allBroadcasts = [];

    // Fetch broadcasts from all connected accounts
    for (const account of accounts) {
      try {
        const accessToken = await youtubeService.getAccessToken(
          account.clientId,
          account.clientSecret,
          account.refreshToken
        );
        const broadcasts = await youtubeService.listBroadcasts(accessToken);
        // Add account info to each broadcast
        allBroadcasts = allBroadcasts.concat(broadcasts.map(b => ({
          ...b,
          accountId: account.id,
          channelName: account.channelName
        })));
      } catch (err) {
        console.error(`Error fetching broadcasts for account ${account.channelName}:`, err.message);
      }
    }

    // Sort broadcasts by scheduled time
    allBroadcasts.sort((a, b) => new Date(a.scheduledStartTime) - new Date(b.scheduledStartTime));

    res.render('youtube', {
      title: 'YouTube Sync',
      active: 'youtube',
      accounts,
      credentials: accounts.length > 0 ? accounts[0] : null, // For backward compatibility
      broadcasts: allBroadcasts
    });
  } catch (error) {
    console.error('YouTube page error:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load YouTube Sync page'
    });
  }
});

// Add new YouTube account (supports multiple accounts)
app.post('/api/youtube/credentials', isAuthenticated, async (req, res) => {
  try {
    const { clientId, clientSecret, refreshToken } = req.body;

    if (!clientId || !clientSecret || !refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Client ID, Client Secret, and Refresh Token are required'
      });
    }

    // Validate credentials
    const validation = await youtubeService.validateCredentials(clientId, clientSecret, refreshToken);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error || 'Invalid credentials'
      });
    }

    // Check if this channel is already connected
    const existingChannel = await YouTubeCredentials.existsByChannel(req.session.userId, validation.channelId);
    if (existingChannel) {
      return res.status(400).json({
        success: false,
        error: 'This YouTube channel is already connected'
      });
    }

    // Create new credentials (supports multiple accounts)
    const created = await YouTubeCredentials.create(req.session.userId, {
      clientId,
      clientSecret,
      refreshToken,
      channelName: validation.channelName,
      channelId: validation.channelId
    });

    res.json({
      success: true,
      id: created.id,
      channelName: validation.channelName,
      channelId: validation.channelId,
      isPrimary: created.isPrimary
    });
  } catch (error) {
    console.error('Error saving YouTube credentials:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to save credentials'
    });
  }
});

// Get all connected YouTube accounts
app.get('/api/youtube/accounts', isAuthenticated, async (req, res) => {
  try {
    const accounts = await YouTubeCredentials.findAllByUserId(req.session.userId);
    res.json({
      success: true,
      accounts: accounts.map(a => ({
        id: a.id,
        channelName: a.channelName,
        channelId: a.channelId,
        isPrimary: a.isPrimary,
        createdAt: a.createdAt
      }))
    });
  } catch (error) {
    console.error('Error fetching YouTube accounts:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch accounts' });
  }
});

// Check if credentials exist (backward compatibility)
app.get('/api/youtube/credentials', isAuthenticated, async (req, res) => {
  try {
    const accounts = await YouTubeCredentials.findAllByUserId(req.session.userId);
    const primary = accounts.find(a => a.isPrimary) || accounts[0];
    res.json({
      success: true,
      hasCredentials: accounts.length > 0,
      accountCount: accounts.length,
      channelName: primary?.channelName || null,
      channelId: primary?.channelId || null
    });
  } catch (error) {
    console.error('Error checking YouTube credentials:', error);
    res.status(500).json({ success: false, error: 'Failed to check credentials' });
  }
});

// Remove specific YouTube account by ID
app.delete('/api/youtube/credentials/:id', isAuthenticated, async (req, res) => {
  try {
    const credentialId = parseInt(req.params.id);

    // Verify the credential belongs to this user
    const credential = await YouTubeCredentials.findById(credentialId);
    if (!credential || credential.userId !== req.session.userId) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }

    await YouTubeCredentials.deleteById(credentialId);

    // If deleted account was primary, set another as primary
    const remaining = await YouTubeCredentials.findAllByUserId(req.session.userId);
    if (remaining.length > 0 && !remaining.some(a => a.isPrimary)) {
      await YouTubeCredentials.setPrimary(req.session.userId, remaining[0].id);
    }

    res.json({ success: true, message: 'Account disconnected' });
  } catch (error) {
    console.error('Error removing YouTube credentials:', error);
    res.status(500).json({ success: false, error: 'Failed to remove credentials' });
  }
});

// Remove all YouTube credentials (backward compatibility)
app.delete('/api/youtube/credentials', isAuthenticated, async (req, res) => {
  try {
    await YouTubeCredentials.delete(req.session.userId);
    res.json({ success: true, message: 'All credentials removed' });
  } catch (error) {
    console.error('Error removing YouTube credentials:', error);
    res.status(500).json({ success: false, error: 'Failed to remove credentials' });
  }
});

// Set primary YouTube account
app.put('/api/youtube/credentials/:id/primary', isAuthenticated, async (req, res) => {
  try {
    const credentialId = parseInt(req.params.id);

    // Verify the credential belongs to this user
    const credential = await YouTubeCredentials.findById(credentialId);
    if (!credential || credential.userId !== req.session.userId) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }

    await YouTubeCredentials.setPrimary(req.session.userId, credentialId);
    res.json({ success: true, message: 'Primary account updated' });
  } catch (error) {
    console.error('Error setting primary account:', error);
    res.status(500).json({ success: false, error: 'Failed to set primary account' });
  }
});

// Refresh channel info for a YouTube account
app.post('/api/youtube/credentials/:id/refresh', isAuthenticated, async (req, res) => {
  try {
    const credentialId = parseInt(req.params.id);

    // Verify the credential belongs to this user
    const credential = await YouTubeCredentials.findById(credentialId);
    if (!credential || credential.userId !== req.session.userId) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }

    // Try to refresh channel info
    const result = await YouTubeCredentials.refreshChannelInfo(credentialId, youtubeService);

    if (result.success) {
      res.json({
        success: true,
        channelName: result.channelName,
        message: 'Channel info refreshed successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to refresh channel info'
      });
    }
  } catch (error) {
    console.error('Error refreshing channel info:', error);
    res.status(500).json({ success: false, error: 'Failed to refresh channel info' });
  }
});

// Refresh all YouTube accounts channel info
app.post('/api/youtube/credentials/refresh-all', isAuthenticated, async (req, res) => {
  try {
    const accounts = await YouTubeCredentials.findAllByUserId(req.session.userId);
    const results = [];

    for (const account of accounts) {
      const result = await YouTubeCredentials.refreshChannelInfo(account.id, youtubeService);
      results.push({
        id: account.id,
        channelId: account.channelId,
        success: result.success,
        channelName: result.channelName || account.channelName,
        error: result.error
      });
    }

    const successCount = results.filter(r => r.success).length;
    res.json({
      success: true,
      message: `Refreshed ${successCount}/${accounts.length} accounts`,
      results
    });
  } catch (error) {
    console.error('Error refreshing all accounts:', error);
    res.status(500).json({ success: false, error: 'Failed to refresh accounts' });
  }
});

// ============================================
// YouTube Live Stats & Connection Monitoring
// ============================================

// Get live stats for all active broadcasts across all accounts
app.get('/api/youtube/live-stats', isAuthenticated, async (req, res) => {
  try {
    const accounts = await YouTubeCredentials.findAllByUserId(req.session.userId);
    const allStats = [];

    for (const account of accounts) {
      try {
        const accessToken = await youtubeService.getAccessToken(
          account.clientId,
          account.clientSecret,
          account.refreshToken
        );

        const stats = await youtubeService.getAllLiveBroadcastsWithStats(accessToken);

        if (stats.error) {
          allStats.push({
            accountId: account.id,
            channelName: account.channelName,
            error: stats.error
          });
        } else {
          // Add account info to each broadcast
          stats.forEach(s => {
            allStats.push({
              ...s,
              accountId: account.id,
              channelName: account.channelName
            });
          });
        }
      } catch (err) {
        console.error(`Error fetching live stats for ${account.channelName}:`, err.message);
        allStats.push({
          accountId: account.id,
          channelName: account.channelName,
          error: err.message
        });
      }
    }

    res.json({
      success: true,
      stats: allStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching live stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch live stats' });
  }
});

// Get live stats for a specific broadcast
app.get('/api/youtube/live-stats/:accountId/:broadcastId', isAuthenticated, async (req, res) => {
  try {
    const { accountId, broadcastId } = req.params;

    const account = await YouTubeCredentials.findById(parseInt(accountId));
    if (!account || account.userId !== req.session.userId) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }

    const accessToken = await youtubeService.getAccessToken(
      account.clientId,
      account.clientSecret,
      account.refreshToken
    );

    const stats = await youtubeService.getLiveStreamStats(accessToken, broadcastId);

    if (stats.error) {
      return res.status(400).json({ success: false, error: stats.error });
    }

    res.json({
      success: true,
      stats: {
        ...stats,
        accountId: account.id,
        channelName: account.channelName
      }
    });
  } catch (error) {
    console.error('Error fetching broadcast stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch broadcast stats' });
  }
});

// Test connection and get quota status for an account
app.get('/api/youtube/connection-status/:accountId', isAuthenticated, async (req, res) => {
  try {
    const accountId = parseInt(req.params.accountId);

    const account = await YouTubeCredentials.findById(accountId);
    if (!account || account.userId !== req.session.userId) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }

    const accessToken = await youtubeService.getAccessToken(
      account.clientId,
      account.clientSecret,
      account.refreshToken
    );

    const connectionStatus = await youtubeService.testConnection(accessToken);
    const quotaInfo = youtubeService.getQuotaInfo();

    res.json({
      success: true,
      accountId: account.id,
      channelName: account.channelName,
      connection: connectionStatus,
      quota: quotaInfo
    });
  } catch (error) {
    console.error('Error checking connection status:', error);
    res.status(500).json({ success: false, error: 'Failed to check connection status' });
  }
});

// Get connection status for all accounts
app.get('/api/youtube/connection-status', isAuthenticated, async (req, res) => {
  try {
    const accounts = await YouTubeCredentials.findAllByUserId(req.session.userId);
    const statuses = [];

    for (const account of accounts) {
      try {
        const accessToken = await youtubeService.getAccessToken(
          account.clientId,
          account.clientSecret,
          account.refreshToken
        );

        const connectionStatus = await youtubeService.testConnection(accessToken);

        statuses.push({
          accountId: account.id,
          channelName: account.channelName,
          isPrimary: account.isPrimary || false,
          connected: connectionStatus.connected,
          quotaOk: connectionStatus.quotaOk,
          error: connectionStatus.error
        });
      } catch (err) {
        statuses.push({
          accountId: account.id,
          channelName: account.channelName,
          isPrimary: account.isPrimary || false,
          connected: false,
          quotaOk: false,
          error: err.message
        });
      }
    }

    const quotaInfo = youtubeService.getQuotaInfo();

    res.json({
      success: true,
      accounts: statuses,
      quota: quotaInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error checking connection statuses:', error);
    res.status(500).json({ success: false, error: 'Failed to check connection statuses' });
  }
});

// List thumbnail folders (per user)
app.get('/api/thumbnail-folders', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    const thumbnailsDir = path.join(__dirname, 'public', 'uploads', 'thumbnails', String(userId));

    if (!fs.existsSync(thumbnailsDir)) {
      fs.mkdirSync(thumbnailsDir, { recursive: true });
    }

    const items = fs.readdirSync(thumbnailsDir, { withFileTypes: true });
    const folders = items
      .filter(item => item.isDirectory())
      .map(folder => {
        const folderPath = path.join(thumbnailsDir, folder.name);
        const files = fs.readdirSync(folderPath).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
        const stat = fs.statSync(folderPath);
        return {
          name: folder.name,
          count: files.length,
          maxAllowed: 20,
          mtime: stat.mtime
        };
      })
      .sort((a, b) => b.mtime - a.mtime);

    // Count root thumbnails (not in folders)
    const rootThumbnails = items
      .filter(item => item.isFile() && /\.(jpg|jpeg|png)$/i.test(item.name))
      .length;

    res.json({
      success: true,
      folders,
      rootCount: rootThumbnails,
      totalFolders: folders.length
    });
  } catch (error) {
    console.error('Error listing thumbnail folders:', error);
    res.status(500).json({ success: false, error: 'Failed to list folders' });
  }
});

// Create thumbnail folder
app.post('/api/thumbnail-folders', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Folder name is required' });
    }

    // Sanitize folder name
    const sanitizedName = name.trim().replace(/[^a-zA-Z0-9_\-\s]/g, '').substring(0, 50);
    if (!sanitizedName) {
      return res.status(400).json({ success: false, error: 'Invalid folder name' });
    }

    const thumbnailsDir = path.join(__dirname, 'public', 'uploads', 'thumbnails', String(userId));
    const folderPath = path.join(thumbnailsDir, sanitizedName);

    if (fs.existsSync(folderPath)) {
      return res.status(400).json({ success: false, error: 'Folder already exists' });
    }

    fs.mkdirSync(folderPath, { recursive: true });

    res.json({ success: true, folder: { name: sanitizedName, count: 0, maxAllowed: 20 } });
  } catch (error) {
    console.error('Error creating thumbnail folder:', error);
    res.status(500).json({ success: false, error: 'Failed to create folder' });
  }
});

// Rename thumbnail folder
app.put('/api/thumbnail-folders/:name', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    const oldName = req.params.name;
    const { newName } = req.body;

    if (!newName || !newName.trim()) {
      return res.status(400).json({ success: false, error: 'New folder name is required' });
    }

    // Validate folder name
    if (oldName.includes('..') || oldName.includes('/') || oldName.includes('\\')) {
      return res.status(400).json({ success: false, error: 'Invalid folder name' });
    }

    const sanitizedNewName = newName.trim().replace(/[^a-zA-Z0-9_\-\s]/g, '').substring(0, 50);
    if (!sanitizedNewName) {
      return res.status(400).json({ success: false, error: 'Invalid new folder name' });
    }

    const thumbnailsDir = path.join(__dirname, 'public', 'uploads', 'thumbnails', String(userId));
    const oldPath = path.join(thumbnailsDir, oldName);
    const newPath = path.join(thumbnailsDir, sanitizedNewName);

    if (!fs.existsSync(oldPath)) {
      return res.status(404).json({ success: false, error: 'Folder not found' });
    }

    if (fs.existsSync(newPath)) {
      return res.status(400).json({ success: false, error: 'A folder with that name already exists' });
    }

    fs.renameSync(oldPath, newPath);

    res.json({ success: true, folder: { name: sanitizedNewName } });
  } catch (error) {
    console.error('Error renaming thumbnail folder:', error);
    res.status(500).json({ success: false, error: 'Failed to rename folder' });
  }
});

// Delete thumbnail folder
app.delete('/api/thumbnail-folders/:name', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    const folderName = req.params.name;

    // Validate folder name
    if (folderName.includes('..') || folderName.includes('/') || folderName.includes('\\')) {
      return res.status(400).json({ success: false, error: 'Invalid folder name' });
    }

    const thumbnailsDir = path.join(__dirname, 'public', 'uploads', 'thumbnails', String(userId));
    const folderPath = path.join(thumbnailsDir, folderName);

    if (!fs.existsSync(folderPath)) {
      return res.status(404).json({ success: false, error: 'Folder not found' });
    }

    // Delete folder and all contents
    fs.rmSync(folderPath, { recursive: true, force: true });

    res.json({ success: true, message: 'Folder deleted successfully' });
  } catch (error) {
    console.error('Error deleting thumbnail folder:', error);
    res.status(500).json({ success: false, error: 'Failed to delete folder' });
  }
});

// List uploaded thumbnails (per user, supports folder parameter)
app.get('/api/thumbnails', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    const limit = req.query.limit ? parseInt(req.query.limit) : null;
    const folder = req.query.folder || null;

    let thumbnailsDir = path.join(__dirname, 'public', 'uploads', 'thumbnails', String(userId));
    let urlPrefix = `/uploads/thumbnails/${userId}`;

    // If folder specified, use that folder
    if (folder) {
      // Validate folder name
      if (folder.includes('..') || folder.includes('/') || folder.includes('\\')) {
        return res.status(400).json({ success: false, error: 'Invalid folder name' });
      }
      thumbnailsDir = path.join(thumbnailsDir, folder);
      urlPrefix = `${urlPrefix}/${folder}`;
    }

    // Check if directory exists
    if (!fs.existsSync(thumbnailsDir)) {
      return res.json({ success: true, thumbnails: [], count: 0, maxAllowed: 20, folder: folder });
    }

    const items = fs.readdirSync(thumbnailsDir, { withFileTypes: true });
    let thumbnails = items
      .filter(item => item.isFile() && /\.(jpg|jpeg|png)$/i.test(item.name))
      .map(file => {
        const stat = fs.statSync(path.join(thumbnailsDir, file.name));
        return {
          filename: file.name,
          path: `${urlPrefix}/${file.name}`,
          url: `${urlPrefix}/${file.name}`,
          folder: folder,
          mtime: stat.mtime
        };
      })
      // Sort alphabetically with numeric sorting (same as backend getSequentialThumbnailFromFolder)
      // This ensures frontend display order matches backend rotation order
      .sort((a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true, sensitivity: 'base' }));

    const totalCount = thumbnails.length;

    if (limit && limit > 0) {
      thumbnails = thumbnails.slice(0, limit);
    }

    res.json({ success: true, thumbnails, count: totalCount, maxAllowed: 20, folder: folder });
  } catch (error) {
    console.error('Error listing thumbnails:', error);
    res.status(500).json({ success: false, error: 'Failed to list thumbnails' });
  }
});

// Thumbnail upload middleware (memory storage)
const thumbnailUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowedFormats = ['image/jpeg', 'image/jpg', 'image/png'];
    if (allowedFormats.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG and PNG files are allowed'), false);
    }
  },
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB max
  }
});

// Upload thumbnail to user's gallery (max 20 per folder) - supports multiple files
app.post('/api/thumbnails', isAuthenticated, thumbnailUpload.array('thumbnail', 20), async (req, res) => {
  try {
    const userId = req.session.userId;
    const folder = req.body.folder || null;

    let thumbnailsDir = path.join(__dirname, 'public', 'uploads', 'thumbnails', String(userId));
    let urlPrefix = `/uploads/thumbnails/${userId}`;

    // If folder specified, use that folder
    if (folder) {
      // Validate folder name
      if (folder.includes('..') || folder.includes('/') || folder.includes('\\')) {
        return res.status(400).json({ success: false, error: 'Invalid folder name' });
      }
      thumbnailsDir = path.join(thumbnailsDir, folder);
      urlPrefix = `${urlPrefix}/${folder}`;
    }

    // Create directory if not exists
    if (!fs.existsSync(thumbnailsDir)) {
      fs.mkdirSync(thumbnailsDir, { recursive: true });
    }

    // Check current count (only files, not subdirectories)
    const items = fs.readdirSync(thumbnailsDir, { withFileTypes: true });
    const existingFiles = items.filter(item => item.isFile() && /\.(jpg|jpeg|png)$/i.test(item.name));
    const currentCount = existingFiles.length;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files uploaded' });
    }

    const filesToUpload = req.files;
    const availableSlots = 20 - currentCount;

    if (availableSlots <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 20 thumbnails allowed per folder. Please delete some before uploading new ones.'
      });
    }

    // Limit files to available slots
    const filesToProcess = filesToUpload.slice(0, availableSlots);
    const skippedCount = filesToUpload.length - filesToProcess.length;

    const uploadedThumbnails = [];

    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      const newFilename = `thumb_${Date.now()}_${i}${ext}`;
      const newPath = path.join(thumbnailsDir, newFilename);

      // Write buffer to file
      fs.writeFileSync(newPath, file.buffer);

      uploadedThumbnails.push({
        filename: newFilename,
        path: `${urlPrefix}/${newFilename}`,
        url: `${urlPrefix}/${newFilename}`,
        folder: folder
      });
    }

    res.json({
      success: true,
      thumbnails: uploadedThumbnails,
      // For backward compatibility with single upload
      thumbnail: uploadedThumbnails[0] || null,
      uploadedCount: uploadedThumbnails.length,
      skippedCount: skippedCount,
      count: currentCount + uploadedThumbnails.length,
      maxAllowed: 20,
      folder: folder
    });
  } catch (error) {
    console.error('Error uploading thumbnails:', error);
    res.status(500).json({ success: false, error: 'Failed to upload thumbnails' });
  }
});

// Delete thumbnail from user's gallery (supports folder parameter)
app.delete('/api/thumbnails/:filename', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    const filename = req.params.filename;
    const folder = req.query.folder || null;

    // Validate filename to prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ success: false, error: 'Invalid filename' });
    }

    let thumbnailPath = path.join(__dirname, 'public', 'uploads', 'thumbnails', String(userId));

    // If folder specified, use that folder
    if (folder) {
      // Validate folder name
      if (folder.includes('..') || folder.includes('/') || folder.includes('\\')) {
        return res.status(400).json({ success: false, error: 'Invalid folder name' });
      }
      thumbnailPath = path.join(thumbnailPath, folder);
    }

    thumbnailPath = path.join(thumbnailPath, filename);

    // Check if file exists and belongs to user
    if (!fs.existsSync(thumbnailPath)) {
      return res.status(404).json({ success: false, error: 'Thumbnail not found' });
    }

    // Delete the file
    fs.unlinkSync(thumbnailPath);

    res.json({ success: true, message: 'Thumbnail deleted successfully' });
  } catch (error) {
    console.error('Error deleting thumbnail:', error);
    res.status(500).json({ success: false, error: 'Failed to delete thumbnail' });
  }
});

// List YouTube streams (stream keys) - supports accountId parameter
app.get('/api/youtube/streams', isAuthenticated, async (req, res) => {
  try {
    const accountId = req.query.accountId ? parseInt(req.query.accountId) : null;
    let credentials;

    console.log('[/api/youtube/streams] Request with accountId:', accountId);

    if (accountId) {
      // Get specific account
      credentials = await YouTubeCredentials.findById(accountId);
      if (!credentials || credentials.userId !== req.session.userId) {
        console.log('[/api/youtube/streams] Account not found or unauthorized');
        return res.status(404).json({ success: false, error: 'Account not found' });
      }
    } else {
      // Get primary/first account
      credentials = await YouTubeCredentials.findByUserId(req.session.userId);
    }

    if (!credentials) {
      console.log('[/api/youtube/streams] No YouTube account connected');
      return res.status(400).json({
        success: false,
        error: 'YouTube account not connected'
      });
    }

    console.log('[/api/youtube/streams] Using account:', credentials.channelName);

    const accessToken = await youtubeService.getAccessToken(
      credentials.clientId,
      credentials.clientSecret,
      credentials.refreshToken
    );

    const streams = await youtubeService.listStreams(accessToken);
    console.log('[/api/youtube/streams] Found', streams.length, 'streams');

    res.json({ success: true, streams, accountId: credentials.id });
  } catch (error) {
    console.error('[/api/youtube/streams] Error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to list stream keys' });
  }
});

// Save stream key folder mapping
app.post('/api/stream-key-folder-mapping', isAuthenticated, async (req, res) => {
  try {
    const { streamKeyId, folderName } = req.body;
    const userId = req.session.userId;

    if (!streamKeyId) {
      return res.status(400).json({ success: false, error: 'Stream key ID is required' });
    }

    const db = require('./db/database').getDb();

    // Check if mapping exists and get current thumbnail_index
    const existing = await new Promise((resolve) => {
      db.get(`SELECT thumbnail_index, folder_name FROM stream_key_folder_mapping WHERE user_id = ? AND stream_key_id = ?`,
        [userId, streamKeyId], (err, row) => resolve(row));
    });

    // If folder changed, reset thumbnail_index to 0
    // If folder same, preserve thumbnail_index
    let newIndex = 0;
    if (existing) {
      if (existing.folder_name === (folderName || '')) {
        // Same folder, preserve index
        newIndex = existing.thumbnail_index || 0;
        console.log(`[stream-key-folder-mapping] Same folder, preserving index: ${newIndex}`);
      } else {
        // Different folder, reset index
        console.log(`[stream-key-folder-mapping] Folder changed from "${existing.folder_name}" to "${folderName || ''}", resetting index to 0`);
      }
    }

    // Upsert the mapping
    db.run(`
      INSERT INTO stream_key_folder_mapping (user_id, stream_key_id, folder_name, thumbnail_index, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, stream_key_id) DO UPDATE SET
        folder_name = excluded.folder_name,
        thumbnail_index = excluded.thumbnail_index,
        updated_at = CURRENT_TIMESTAMP
    `, [userId, streamKeyId, folderName || '', newIndex], function (err) {
      if (err) {
        console.error('[stream-key-folder-mapping] Error saving:', err.message);
        return res.status(500).json({ success: false, error: 'Failed to save mapping' });
      }

      console.log(`[stream-key-folder-mapping] Saved: ${streamKeyId} -> ${folderName || 'root'}, index: ${newIndex}`);
      res.json({ success: true, streamKeyId, folderName: folderName || '', thumbnailIndex: newIndex });
    });
  } catch (error) {
    console.error('[stream-key-folder-mapping] Error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to save mapping' });
  }
});

// Get stream key folder mapping
app.get('/api/stream-key-folder-mapping/:streamKeyId', isAuthenticated, async (req, res) => {
  try {
    const { streamKeyId } = req.params;
    const userId = req.session.userId;

    const db = require('./db/database').getDb();

    db.get(`
      SELECT folder_name, thumbnail_index FROM stream_key_folder_mapping
      WHERE user_id = ? AND stream_key_id = ?
    `, [userId, streamKeyId], (err, row) => {
      if (err) {
        console.error('[stream-key-folder-mapping] Error getting:', err.message);
        return res.status(500).json({ success: false, error: 'Failed to get mapping' });
      }

      if (row) {
        res.json({ success: true, streamKeyId, folderName: row.folder_name, thumbnailIndex: row.thumbnail_index || 0, found: true });
      } else {
        res.json({ success: true, streamKeyId, folderName: null, thumbnailIndex: 0, found: false });
      }
    });
  } catch (error) {
    console.error('[stream-key-folder-mapping] Error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to get mapping' });
  }
});

// Update thumbnail index for stream key
app.put('/api/stream-key-folder-mapping/:streamKeyId/thumbnail-index', isAuthenticated, async (req, res) => {
  try {
    const { streamKeyId } = req.params;
    const { thumbnailIndex } = req.body;
    const userId = req.session.userId;

    const db = require('./db/database').getDb();

    db.run(`
      UPDATE stream_key_folder_mapping 
      SET thumbnail_index = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND stream_key_id = ?
    `, [thumbnailIndex || 0, userId, streamKeyId], function (err) {
      if (err) {
        console.error('[stream-key-folder-mapping] Error updating thumbnail index:', err.message);
        return res.status(500).json({ success: false, error: 'Failed to update thumbnail index' });
      }

      if (this.changes === 0) {
        // Record doesn't exist, create it
        db.run(`
          INSERT INTO stream_key_folder_mapping (user_id, stream_key_id, folder_name, thumbnail_index, updated_at)
          VALUES (?, ?, '', ?, CURRENT_TIMESTAMP)
        `, [userId, streamKeyId, thumbnailIndex || 0], function (insertErr) {
          if (insertErr) {
            console.error('[stream-key-folder-mapping] Error creating record:', insertErr.message);
            return res.status(500).json({ success: false, error: 'Failed to create mapping' });
          }
          console.log(`[stream-key-folder-mapping] Created with thumbnail_index: ${streamKeyId} -> ${thumbnailIndex}`);
          res.json({ success: true, streamKeyId, thumbnailIndex: thumbnailIndex || 0 });
        });
      } else {
        console.log(`[stream-key-folder-mapping] Updated thumbnail_index: ${streamKeyId} -> ${thumbnailIndex}`);
        res.json({ success: true, streamKeyId, thumbnailIndex: thumbnailIndex || 0 });
      }
    });
  } catch (error) {
    console.error('[stream-key-folder-mapping] Error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to update thumbnail index' });
  }
});

// Increment thumbnail index for stream key (for reschedule)
app.post('/api/stream-key-folder-mapping/:streamKeyId/increment-thumbnail', isAuthenticated, async (req, res) => {
  try {
    const { streamKeyId } = req.params;
    const { totalThumbnails } = req.body;
    const userId = req.session.userId;

    const db = require('./db/database').getDb();

    // First get current index
    db.get(`
      SELECT thumbnail_index, folder_name FROM stream_key_folder_mapping 
      WHERE user_id = ? AND stream_key_id = ?
    `, [userId, streamKeyId], (err, row) => {
      if (err) {
        console.error('[stream-key-folder-mapping] Error getting current index:', err.message);
        return res.status(500).json({ success: false, error: 'Failed to get current index' });
      }

      const currentIndex = row ? (row.thumbnail_index || 0) : 0;
      const folderName = row ? (row.folder_name || '') : '';
      // Calculate next index - NO modulo! Just increment.
      // Modulo is applied when selecting thumbnail, not when storing index.
      const nextIndex = currentIndex + 1;

      console.log(`[stream-key-folder-mapping] Incrementing: ${streamKeyId} ${currentIndex} -> ${nextIndex}`);

      if (row) {
        // Update existing record
        db.run(`
          UPDATE stream_key_folder_mapping 
          SET thumbnail_index = ?, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ? AND stream_key_id = ?
        `, [nextIndex, userId, streamKeyId], function (updateErr) {
          if (updateErr) {
            console.error('[stream-key-folder-mapping] Error incrementing thumbnail index:', updateErr.message);
            return res.status(500).json({ success: false, error: 'Failed to increment thumbnail index' });
          }
          console.log(`[stream-key-folder-mapping] ✅ Incremented thumbnail_index: ${streamKeyId} ${currentIndex} -> ${nextIndex}`);
          res.json({
            success: true,
            streamKeyId,
            previousIndex: currentIndex,
            thumbnailIndex: nextIndex,
            folderName
          });
        });
      } else {
        // Create new record with index 1 (since we're incrementing from 0)
        db.run(`
          INSERT INTO stream_key_folder_mapping (user_id, stream_key_id, folder_name, thumbnail_index, updated_at)
          VALUES (?, ?, '', 1, CURRENT_TIMESTAMP)
        `, [userId, streamKeyId], function (insertErr) {
          if (insertErr) {
            console.error('[stream-key-folder-mapping] Error creating record:', insertErr.message);
            return res.status(500).json({ success: false, error: 'Failed to create mapping' });
          }
          console.log(`[stream-key-folder-mapping] ✅ Created with thumbnail_index: ${streamKeyId} -> 1`);
          res.json({
            success: true,
            streamKeyId,
            previousIndex: 0,
            thumbnailIndex: 1,
            folderName: ''
          });
        });
      }
    });
  } catch (error) {
    console.error('[stream-key-folder-mapping] Error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to increment thumbnail index' });
  }
});

// Initialize thumbnail rotation for a stream key (set starting index)
app.post('/api/stream-key-folder-mapping/:streamKeyId/init', isAuthenticated, async (req, res) => {
  try {
    const { streamKeyId } = req.params;
    const { folderName, thumbnailIndex } = req.body;
    const userId = req.session.userId;

    const db = require('./db/database').getDb();

    const index = parseInt(thumbnailIndex) || 0;
    const folder = folderName || '';

    db.run(`
      INSERT INTO stream_key_folder_mapping (user_id, stream_key_id, folder_name, thumbnail_index, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, stream_key_id) DO UPDATE SET
        folder_name = excluded.folder_name,
        thumbnail_index = excluded.thumbnail_index,
        updated_at = CURRENT_TIMESTAMP
    `, [userId, streamKeyId, folder, index], function (err) {
      if (err) {
        console.error('[stream-key-folder-mapping] Error initializing:', err.message);
        return res.status(500).json({ success: false, error: 'Failed to initialize' });
      }
      console.log(`[stream-key-folder-mapping] ✅ Initialized: ${streamKeyId} -> index=${index}, folder="${folder}"`);
      res.json({
        success: true,
        streamKeyId,
        thumbnailIndex: index,
        folderName: folder
      });
    });
  } catch (error) {
    console.error('[stream-key-folder-mapping] Error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to initialize' });
  }
});

// Get broadcast settings (including thumbnail folder)
app.get('/api/youtube/broadcast-settings/:broadcastId', isAuthenticated, async (req, res) => {
  try {
    const { broadcastId } = req.params;
    const accountId = req.query.accountId ? parseInt(req.query.accountId) : null;

    console.log(`[broadcast-settings] Getting settings for broadcast ${broadcastId}, accountId: ${accountId}`);

    const settings = await YouTubeBroadcastSettings.findByBroadcastId(broadcastId);

    if (settings) {
      // If settings exist but thumbnailFolder is null, try to get from template
      let thumbnailFolder = settings.thumbnailFolder;
      if ((thumbnailFolder === null || thumbnailFolder === undefined) && settings.templateId) {
        try {
          const template = await BroadcastTemplate.findById(settings.templateId);
          if (template && template.thumbnail_folder !== undefined) {
            thumbnailFolder = template.thumbnail_folder;
            console.log(`[broadcast-settings] Using thumbnail_folder from template ${settings.templateId}: ${thumbnailFolder || 'root'}`);
          }
        } catch (templateErr) {
          console.error('[broadcast-settings] Error getting template:', templateErr.message);
        }
      }

      // If still no thumbnailFolder, try to get from account's template
      if ((thumbnailFolder === null || thumbnailFolder === undefined) && accountId) {
        try {
          const templates = await BroadcastTemplate.findByUserId(req.session.userId);
          const accountTemplate = templates.find(t => t.account_id === accountId && t.thumbnail_folder !== null && t.thumbnail_folder !== undefined);
          if (accountTemplate) {
            thumbnailFolder = accountTemplate.thumbnail_folder;
            console.log(`[broadcast-settings] Using thumbnail_folder from account template "${accountTemplate.name}": ${thumbnailFolder || 'root'}`);
          }
        } catch (templateErr) {
          console.error('[broadcast-settings] Error getting account template:', templateErr.message);
        }
      }

      res.json({
        success: true,
        settings: {
          broadcastId: settings.broadcast_id,
          thumbnailFolder: thumbnailFolder,
          templateId: settings.templateId,
          enableAutoStart: settings.enableAutoStart,
          enableAutoStop: settings.enableAutoStop,
          unlistReplayOnEnd: settings.unlistReplayOnEnd,
          thumbnailIndex: settings.thumbnailIndex || 0,
          thumbnailPath: settings.thumbnailPath || null
        },
        found: true
      });
    } else {
      // No settings found - try to get thumbnail_folder from template for this account
      let fallbackFolder = null;
      let fallbackTemplateName = null;

      try {
        const templates = await BroadcastTemplate.findByUserId(req.session.userId);
        console.log(`[broadcast-settings] Found ${templates?.length || 0} templates for user`);

        if (templates && templates.length > 0) {
          // Log all templates for debugging
          templates.forEach(t => {
            console.log(`[broadcast-settings] Template: "${t.name}", account_id: ${t.account_id}, thumbnail_folder: ${t.thumbnail_folder === null ? 'NULL' : `"${t.thumbnail_folder}"`}, recurring: ${t.recurring_enabled}`);
          });

          // First try to find template for this specific account
          let matchingTemplate = null;

          if (accountId) {
            // Find template for this account, prefer recurring enabled, with thumbnail_folder set
            matchingTemplate = templates.find(t => t.account_id === accountId && t.recurring_enabled && t.thumbnail_folder !== null && t.thumbnail_folder !== undefined);
            console.log(`[broadcast-settings] Looking for recurring template with account_id ${accountId} and thumbnail_folder set: ${matchingTemplate ? 'found' : 'not found'}`);

            if (!matchingTemplate) {
              // Try any template for this account with thumbnail_folder set
              matchingTemplate = templates.find(t => t.account_id === accountId && t.thumbnail_folder !== null && t.thumbnail_folder !== undefined);
              console.log(`[broadcast-settings] Looking for any template with account_id ${accountId} and thumbnail_folder set: ${matchingTemplate ? 'found' : 'not found'}`);
            }

            if (!matchingTemplate) {
              // Try any template for this account (even without thumbnail_folder)
              matchingTemplate = templates.find(t => t.account_id === accountId);
              console.log(`[broadcast-settings] Looking for any template with account_id ${accountId}: ${matchingTemplate ? `found "${matchingTemplate.name}"` : 'not found'}`);
            }
          }

          // If no account-specific template with folder, use most recently used with folder
          if (!matchingTemplate || matchingTemplate.thumbnail_folder === null || matchingTemplate.thumbnail_folder === undefined) {
            const sortedTemplates = templates
              .filter(t => t.thumbnail_folder !== null && t.thumbnail_folder !== undefined)
              .sort((a, b) => {
                const aTime = a.last_run_at ? new Date(a.last_run_at).getTime() : 0;
                const bTime = b.last_run_at ? new Date(b.last_run_at).getTime() : 0;
                return bTime - aTime;
              });

            if (sortedTemplates.length > 0) {
              matchingTemplate = sortedTemplates[0];
              console.log(`[broadcast-settings] Using most recent template with folder: "${matchingTemplate.name}"`);
            }
          }

          if (matchingTemplate && matchingTemplate.thumbnail_folder !== null && matchingTemplate.thumbnail_folder !== undefined) {
            fallbackFolder = matchingTemplate.thumbnail_folder;
            fallbackTemplateName = matchingTemplate.name;
            console.log(`[broadcast-settings] Final fallback: template "${fallbackTemplateName}", folder: "${fallbackFolder}"`);
          } else {
            console.log(`[broadcast-settings] No template with thumbnail_folder found`);
          }
        }
      } catch (templateErr) {
        console.error('[broadcast-settings] Error getting fallback template:', templateErr.message);
      }

      res.json({
        success: true,
        settings: fallbackFolder !== null ? {
          thumbnailFolder: fallbackFolder,
          isFallback: true,
          fallbackTemplateName: fallbackTemplateName
        } : null,
        found: fallbackFolder !== null
      });
    }
  } catch (error) {
    console.error('[broadcast-settings] Error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to get broadcast settings' });
  }
});

// Get YouTube channel defaults for auto-fill - supports accountId parameter
app.get('/api/youtube/channel-defaults', isAuthenticated, async (req, res) => {
  try {
    const accountId = req.query.accountId ? parseInt(req.query.accountId) : null;
    let credentials;

    if (accountId) {
      credentials = await YouTubeCredentials.findById(accountId);
      if (!credentials || credentials.userId !== req.session.userId) {
        return res.status(404).json({ success: false, error: 'Account not found' });
      }
    } else {
      credentials = await YouTubeCredentials.findByUserId(req.session.userId);
    }

    if (!credentials) {
      return res.status(400).json({
        success: false,
        error: 'YouTube account not connected'
      });
    }

    const accessToken = await youtubeService.getAccessToken(
      credentials.clientId,
      credentials.clientSecret,
      credentials.refreshToken
    );

    const defaults = await youtubeService.getChannelDefaults(accessToken);
    res.json({ success: true, defaults, accountId: credentials.id });
  } catch (error) {
    console.error('Error fetching channel defaults:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch channel defaults' });
  }
});

// List YouTube broadcasts - supports accountId parameter
app.get('/api/youtube/broadcasts', isAuthenticated, async (req, res) => {
  try {
    const accountId = req.query.accountId ? parseInt(req.query.accountId) : null;

    if (accountId) {
      // Get broadcasts for specific account
      const credentials = await YouTubeCredentials.findById(accountId);
      if (!credentials || credentials.userId !== req.session.userId) {
        return res.status(404).json({ success: false, error: 'Account not found' });
      }

      const accessToken = await youtubeService.getAccessToken(
        credentials.clientId,
        credentials.clientSecret,
        credentials.refreshToken
      );

      const broadcasts = await youtubeService.listBroadcasts(accessToken);
      res.json({
        success: true,
        broadcasts: broadcasts.map(b => ({ ...b, accountId: credentials.id, channelName: credentials.channelName }))
      });
    } else {
      // Get broadcasts from all accounts
      const accounts = await YouTubeCredentials.findAllByUserId(req.session.userId);

      if (accounts.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'YouTube account not connected'
        });
      }

      let allBroadcasts = [];
      for (const account of accounts) {
        try {
          const accessToken = await youtubeService.getAccessToken(
            account.clientId,
            account.clientSecret,
            account.refreshToken
          );
          const broadcasts = await youtubeService.listBroadcasts(accessToken);
          allBroadcasts = allBroadcasts.concat(broadcasts.map(b => ({
            ...b,
            accountId: account.id,
            channelName: account.channelName
          })));
        } catch (err) {
          console.error(`Error fetching broadcasts for ${account.channelName}:`, err.message);
        }
      }

      res.json({ success: true, broadcasts: allBroadcasts });
    }
  } catch (error) {
    console.error('Error listing broadcasts:', error);
    res.status(500).json({ success: false, error: 'Failed to list broadcasts' });
  }
});

// Create YouTube broadcast - supports accountId parameter
app.post('/api/youtube/broadcasts', isAuthenticated, upload.single('thumbnail'), async (req, res) => {
  try {
    const accountId = req.body.accountId ? parseInt(req.body.accountId) : null;
    let credentials;

    if (accountId) {
      credentials = await YouTubeCredentials.findById(accountId);
      if (!credentials || credentials.userId !== req.session.userId) {
        return res.status(404).json({ success: false, error: 'Account not found' });
      }
    } else {
      credentials = await YouTubeCredentials.findByUserId(req.session.userId);
    }

    if (!credentials) {
      return res.status(400).json({
        success: false,
        error: 'YouTube account not connected'
      });
    }

    const { title, description, scheduledStartTime, privacyStatus, streamId, tags, categoryId, enableAutoStart, enableAutoStop, unlistReplayOnEnd, monetizationEnabled, adFrequency, alteredContent } = req.body;

    console.log('[API] Create broadcast - categoryId received:', categoryId);

    if (!title || !scheduledStartTime) {
      return res.status(400).json({
        success: false,
        error: 'Title and scheduled start time are required'
      });
    }

    // Validate scheduled time (at least 10 minutes in future)
    const scheduledDate = new Date(scheduledStartTime);
    const minTime = new Date(Date.now() + 10 * 60 * 1000);

    if (scheduledDate < minTime) {
      return res.status(400).json({
        success: false,
        error: 'Scheduled start time must be at least 10 minutes in the future'
      });
    }

    // Parse tags if provided as JSON string
    let parsedTags = [];
    if (tags) {
      try {
        parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
      } catch (e) {
        parsedTags = [];
      }
    }

    const accessToken = await youtubeService.getAccessToken(
      credentials.clientId,
      credentials.clientSecret,
      credentials.refreshToken
    );

    const finalCategoryId = categoryId || '22';
    console.log('[API] Create broadcast - using categoryId:', finalCategoryId);

    const broadcast = await youtubeService.createBroadcast(accessToken, {
      title,
      description: description || '',
      scheduledStartTime,
      privacyStatus: privacyStatus || 'unlisted',
      streamId: streamId || null,
      tags: parsedTags,
      categoryId: finalCategoryId,
      enableAutoStart: enableAutoStart === 'true' || enableAutoStart === true,
      enableAutoStop: enableAutoStop !== 'false' && enableAutoStop !== false, // Default true
      monetizationEnabled: monetizationEnabled === 'true' || monetizationEnabled === true,
      adFrequency: adFrequency || 'medium',
      alteredContent: alteredContent === 'true' || alteredContent === true
    });

    // Get thumbnail folder from request
    const thumbnailFolder = req.body.thumbnailFolder;
    const thumbnailIndex = parseInt(req.body.thumbnailIndex) || 0;
    const thumbnailPathFromRequest = req.body.thumbnailPath;

    console.log('[API] Create broadcast - thumbnail settings:', {
      thumbnailFolder: thumbnailFolder,
      thumbnailIndex: thumbnailIndex,
      thumbnailPath: thumbnailPathFromRequest,
      hasFile: !!req.file
    });

    // Save broadcast settings for later use (e.g., unlist replay on end, thumbnail folder)
    try {
      await YouTubeBroadcastSettings.upsert({
        broadcastId: broadcast.broadcastId,
        userId: req.session.userId,
        accountId: accountId || null,
        enableAutoStart: enableAutoStart === 'true' || enableAutoStart === true,
        enableAutoStop: enableAutoStop !== 'false' && enableAutoStop !== false,
        unlistReplayOnEnd: unlistReplayOnEnd === 'true' || unlistReplayOnEnd === true,
        originalPrivacyStatus: privacyStatus || 'unlisted',
        thumbnailFolder: thumbnailFolder !== undefined ? thumbnailFolder : null,
        thumbnailIndex: thumbnailIndex,
        thumbnailPath: thumbnailPathFromRequest || null
      });
      console.log('[API] Saved broadcast settings for:', broadcast.broadcastId, 'thumbnailFolder:', thumbnailFolder, 'thumbnailIndex:', thumbnailIndex, 'thumbnailPath:', thumbnailPathFromRequest);
    } catch (settingsErr) {
      console.error('[API] Error saving broadcast settings:', settingsErr.message);
      // Don't fail the request, just log the error
    }

    // Upload thumbnail if provided (either file upload, gallery selection, or from folder)
    const thumbnailPath = req.body.thumbnailPath;

    console.log('[API] Thumbnail upload decision:', {
      hasFile: !!req.file,
      thumbnailPath: thumbnailPath,
      thumbnailPathTruthy: !!thumbnailPath,
      thumbnailFolder: thumbnailFolder,
      thumbnailFolderDefined: thumbnailFolder !== undefined && thumbnailFolder !== null
    });

    if (req.file) {
      // Handle file upload (highest priority)
      try {
        const thumbnailResult = await youtubeService.uploadThumbnail(
          accessToken,
          broadcast.broadcastId,
          req.file.buffer
        );
        broadcast.thumbnailUrl = thumbnailResult.thumbnailUrl;
        console.log('[API] Thumbnail uploaded from file upload');
      } catch (thumbErr) {
        console.error('Error uploading thumbnail:', thumbErr.message);
      }
    } else if (thumbnailPath) {
      // Handle gallery selection (user explicitly selected a thumbnail - second priority)
      try {
        const fullPath = path.join(__dirname, 'public', thumbnailPath);
        console.log('[API] Using user-selected thumbnail:', thumbnailPath);
        if (fs.existsSync(fullPath)) {
          const imageBuffer = fs.readFileSync(fullPath);
          const thumbnailResult = await youtubeService.uploadThumbnail(
            accessToken,
            broadcast.broadcastId,
            imageBuffer
          );
          broadcast.thumbnailUrl = thumbnailResult.thumbnailUrl;
          console.log('[API] Thumbnail uploaded from user selection:', thumbnailPath);

          // Update youtube_broadcast_settings with the selected thumbnail path
          // thumbnailIndex from request is the index of the selected thumbnail
          try {
            await YouTubeBroadcastSettings.updateThumbnailSelection(broadcast.broadcastId, thumbnailIndex, thumbnailPath);
            console.log('[API] Updated broadcast settings with user-selected thumbnail index:', thumbnailIndex, 'path:', thumbnailPath);
          } catch (updateErr) {
            console.error('[API] Error updating broadcast thumbnail settings:', updateErr.message);
          }

          // IMPORTANT: Update GLOBAL thumbnail index with the NEXT index (selected + 1)
          // This ensures thumbnail rotation continues from the correct position
          // Use GLOBAL index (__GLOBAL__ + folder) for consistency across all stream keys
          const nextIndex = thumbnailIndex + 1;
          const db = require('./db/database').getDb();
          const globalStreamKeyId = '__GLOBAL__' + (thumbnailFolder || '');
          await new Promise((resolve, reject) => {
            db.run(`
              INSERT INTO stream_key_folder_mapping (user_id, stream_key_id, folder_name, thumbnail_index, updated_at)
              VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(user_id, stream_key_id) DO UPDATE SET
                thumbnail_index = excluded.thumbnail_index,
                folder_name = excluded.folder_name,
                updated_at = CURRENT_TIMESTAMP
            `, [req.session.userId, globalStreamKeyId, thumbnailFolder || '', nextIndex], function (err) {
              if (err) {
                console.error('[API] Error updating GLOBAL thumbnail index for user selection:', err.message);
                reject(err);
              } else {
                console.log('[API] ✅ Updated GLOBAL thumbnail index for user selection:', globalStreamKeyId, '-> next index:', nextIndex, '(folder:', thumbnailFolder || 'root', ')');
                resolve();
              }
            });
          });
        } else {
          console.error('[API] User-selected thumbnail not found:', fullPath);
        }
      } catch (thumbErr) {
        console.error('Error uploading gallery thumbnail:', thumbErr.message);
      }
    } else if (thumbnailFolder !== undefined && thumbnailFolder !== null) {
      // Handle thumbnail from folder (rotation mode - only if no specific thumbnail selected)
      try {
        let selectedThumbnailPath = null;
        // Use streamId from request body (already extracted above)
        const streamKeyId = streamId;

        console.log('[API] Rotation mode - streamKeyId:', streamKeyId, 'thumbnailFolder:', thumbnailFolder, 'requestThumbnailIndex:', thumbnailIndex);

        // Get GLOBAL thumbnail index for this folder (shared across all stream keys)
        // This ensures sequential rotation: stream key A gets #3, stream key B gets #4, etc.
        let currentIndex = 0;
        const currentFolder = thumbnailFolder || '';
        const globalStreamKeyId = '__GLOBAL__' + currentFolder;

        const db = require('./db/database').getDb();

        // Get global index for this user + folder combination
        const globalMapping = await new Promise((resolve) => {
          db.get(`SELECT thumbnail_index FROM stream_key_folder_mapping 
                  WHERE user_id = ? AND stream_key_id = ?`,
            [req.session.userId, globalStreamKeyId], (err, row) => {
              if (err) {
                console.error('[API] Error getting global folder mapping:', err.message);
              }
              resolve(row);
            });
        });

        if (globalMapping) {
          currentIndex = globalMapping.thumbnail_index || 0;
          console.log('[API] Got GLOBAL thumbnail index for folder "' + currentFolder + '":', currentIndex);
        } else {
          console.log('[API] No global index for folder "' + currentFolder + '", starting from 0');
          currentIndex = 0;
        }

        // Rotation mode: select next thumbnail in order
        const result = await scheduleService.getSequentialThumbnailFromFolder(req.session.userId, thumbnailFolder, currentIndex);
        console.log('[API] getSequentialThumbnailFromFolder result:', result);

        if (result && result.path) {
          selectedThumbnailPath = result.path;
          console.log('[API] Rotation mode - selected thumbnail:', selectedThumbnailPath, 'index:', currentIndex, '->', result.newIndex);

          // Update GLOBAL thumbnail index for this folder (shared across all stream keys)
          // Use special stream_key_id '__GLOBAL__{folder}' to store global index per folder
          if (result.newIndex !== undefined) {
            const globalStreamKeyId = '__GLOBAL__' + (thumbnailFolder || '');
            await new Promise((resolve, reject) => {
              db.run(`
                INSERT INTO stream_key_folder_mapping (user_id, stream_key_id, folder_name, thumbnail_index, updated_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id, stream_key_id) DO UPDATE SET
                  thumbnail_index = excluded.thumbnail_index,
                  folder_name = excluded.folder_name,
                  updated_at = CURRENT_TIMESTAMP
              `, [req.session.userId, globalStreamKeyId, thumbnailFolder || '', result.newIndex], function (err) {
                if (err) {
                  console.error('[API] Error updating GLOBAL thumbnail index:', err.message);
                  reject(err);
                } else {
                  console.log('[API] ✅ SAVED GLOBAL thumbnail index for folder "' + (thumbnailFolder || 'root') + '":', result.newIndex);
                  resolve();
                }
              });
            });
          } else {
            console.log('[API] ⚠️ NOT saving thumbnail index - newIndex:', result.newIndex);
          }

          // Update youtube_broadcast_settings with the actual thumbnail index and path
          // This is important for Edit Broadcast to show correct SAVED and NEXT indicators
          try {
            await YouTubeBroadcastSettings.updateThumbnailSelection(broadcast.broadcastId, currentIndex, selectedThumbnailPath);
            console.log('[API] Updated broadcast settings with thumbnail index:', currentIndex, 'path:', selectedThumbnailPath);
          } catch (updateErr) {
            console.error('[API] Error updating broadcast thumbnail settings:', updateErr.message);
          }
        }

        if (selectedThumbnailPath) {
          const fullPath = path.join(__dirname, 'public', selectedThumbnailPath);
          console.log('[API] Attempting to upload thumbnail:', selectedThumbnailPath);
          console.log('[API] Full path:', fullPath);
          console.log('[API] File exists:', fs.existsSync(fullPath));

          if (fs.existsSync(fullPath)) {
            const imageBuffer = fs.readFileSync(fullPath);
            console.log('[API] Image buffer size:', imageBuffer.length, 'bytes');

            try {
              const thumbnailResult = await youtubeService.uploadThumbnail(
                accessToken,
                broadcast.broadcastId,
                imageBuffer
              );
              broadcast.thumbnailUrl = thumbnailResult.thumbnailUrl;
              console.log('[API] ✅ Thumbnail uploaded successfully to YouTube:', thumbnailResult.thumbnailUrl);
            } catch (uploadErr) {
              console.error('[API] ❌ Failed to upload thumbnail to YouTube:', uploadErr.message);
              if (uploadErr.response) {
                console.error('[API] YouTube API error:', JSON.stringify(uploadErr.response.data, null, 2));
              }
            }
          } else {
            console.error('[API] ❌ Thumbnail file not found:', fullPath);
          }
        } else {
          console.log('[API] ⚠️ No thumbnail path selected for upload');
        }
      } catch (thumbErr) {
        console.error('Error uploading thumbnail from folder:', thumbErr.message);
      }
    }

    res.json({ success: true, broadcast });
  } catch (error) {
    console.error('Error creating broadcast:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create broadcast'
    });
  }
});

// Update YouTube broadcast - supports accountId parameter
app.put('/api/youtube/broadcasts/:id', isAuthenticated, async (req, res) => {
  try {
    const accountId = req.query.accountId ? parseInt(req.query.accountId) : null;
    const { title, description, scheduledStartTime, privacyStatus, categoryId, thumbnailFolder, thumbnailIndex, thumbnailPath } = req.body;

    console.log('[API] Update broadcast request:', {
      broadcastId: req.params.id,
      accountId,
      title,
      description: description ? description.substring(0, 50) + '...' : null,
      scheduledStartTime,
      privacyStatus,
      categoryId,
      thumbnailFolder,
      thumbnailIndex,
      thumbnailPath
    });

    let credentials;

    if (accountId) {
      credentials = await YouTubeCredentials.findById(accountId);
      if (!credentials || credentials.userId !== req.session.userId) {
        return res.status(404).json({ success: false, error: 'Account not found' });
      }
    } else {
      // Try to find the account that owns this broadcast by checking all accounts
      const accounts = await YouTubeCredentials.findAllByUserId(req.session.userId);
      for (const account of accounts) {
        try {
          const accessToken = await youtubeService.getAccessToken(
            account.clientId,
            account.clientSecret,
            account.refreshToken
          );
          const result = await youtubeService.updateBroadcast(accessToken, req.params.id, {
            title,
            description,
            scheduledStartTime,
            privacyStatus,
            categoryId
          });
          console.log('[API] Update broadcast success:', result);
          return res.json({ success: true, broadcast: result });
        } catch (err) {
          // Continue to next account if this one doesn't own the broadcast
          continue;
        }
      }
      return res.status(404).json({ success: false, error: 'Broadcast not found' });
    }

    const accessToken = await youtubeService.getAccessToken(
      credentials.clientId,
      credentials.clientSecret,
      credentials.refreshToken
    );

    const result = await youtubeService.updateBroadcast(accessToken, req.params.id, {
      title,
      description,
      scheduledStartTime,
      privacyStatus,
      categoryId
    });

    console.log('[API] Update broadcast success:', result);

    // Update thumbnail folder in broadcast settings if provided
    if (thumbnailFolder !== undefined) {
      try {
        // First try to update existing record
        const updated = await YouTubeBroadcastSettings.updateThumbnailFolder(req.params.id, thumbnailFolder);
        if (!updated) {
          // If no record exists, create one with upsert
          await YouTubeBroadcastSettings.upsert({
            broadcastId: req.params.id,
            userId: req.session.userId,
            accountId: accountId || null,
            thumbnailFolder: thumbnailFolder,
            thumbnailIndex: thumbnailIndex || 0,
            thumbnailPath: thumbnailPath || null
          });
          console.log('[API] Created new broadcast settings with thumbnail folder for:', req.params.id);
        } else {
          console.log('[API] Updated thumbnail folder for broadcast:', req.params.id, 'to:', thumbnailFolder || 'root');

          // Also update thumbnail index and path if provided
          if (thumbnailIndex !== undefined || thumbnailPath !== undefined) {
            await YouTubeBroadcastSettings.updateThumbnailSelection(req.params.id, thumbnailIndex || 0, thumbnailPath || null);
            console.log('[API] Updated thumbnail selection for broadcast:', req.params.id, 'index:', thumbnailIndex, 'path:', thumbnailPath);
          }
        }

        // NOTE: Do NOT update stream_key_folder_mapping on edit/reschedule
        // Thumbnail index should only be incremented when creating NEW broadcasts
        // Editing an existing broadcast should not affect the rotation index
        console.log('[API] Edit broadcast - NOT updating GLOBAL thumbnail index (only incremented on new broadcast creation)');
      } catch (settingsErr) {
        console.error('[API] Error updating thumbnail folder:', settingsErr.message);
        // Don't fail the request, just log the error
      }
    }

    res.json({ success: true, broadcast: result });
  } catch (error) {
    console.error('Error updating broadcast:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update broadcast'
    });
  }
});

// Delete YouTube broadcast - supports accountId parameter
app.delete('/api/youtube/broadcasts/:id', isAuthenticated, async (req, res) => {
  try {
    const accountId = req.query.accountId ? parseInt(req.query.accountId) : null;
    let credentials;

    if (accountId) {
      credentials = await YouTubeCredentials.findById(accountId);
      if (!credentials || credentials.userId !== req.session.userId) {
        return res.status(404).json({ success: false, error: 'Account not found' });
      }
    } else {
      // Try to find the account that owns this broadcast by checking all accounts
      const accounts = await YouTubeCredentials.findAllByUserId(req.session.userId);
      for (const account of accounts) {
        try {
          const accessToken = await youtubeService.getAccessToken(
            account.clientId,
            account.clientSecret,
            account.refreshToken
          );
          await youtubeService.deleteBroadcast(accessToken, req.params.id);
          return res.json({ success: true, message: 'Broadcast deleted' });
        } catch (err) {
          // Continue to next account if this one doesn't own the broadcast
          continue;
        }
      }
      return res.status(404).json({ success: false, error: 'Broadcast not found' });
    }

    const accessToken = await youtubeService.getAccessToken(
      credentials.clientId,
      credentials.clientSecret,
      credentials.refreshToken
    );

    await youtubeService.deleteBroadcast(accessToken, req.params.id);
    res.json({ success: true, message: 'Broadcast deleted' });
  } catch (error) {
    console.error('Error deleting broadcast:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete broadcast'
    });
  }
});

// Upload/change thumbnail for broadcast - supports accountId parameter
app.post('/api/youtube/broadcasts/:id/thumbnail', isAuthenticated, thumbnailUpload.single('thumbnail'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No thumbnail file provided'
      });
    }

    console.log('[Thumbnail Upload] File received:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      broadcastId: req.params.id,
      accountId: req.body.accountId
    });

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file type. Only JPG and PNG are allowed'
      });
    }

    // Validate file size (max 2MB)
    const maxSize = 2 * 1024 * 1024;
    if (req.file.size > maxSize) {
      return res.status(400).json({
        success: false,
        error: 'File too large. Maximum size is 2MB'
      });
    }

    const accountId = req.body.accountId ? parseInt(req.body.accountId) : null;
    let credentials;

    if (accountId) {
      credentials = await YouTubeCredentials.findById(accountId);
      if (!credentials || credentials.userId !== req.session.userId) {
        return res.status(404).json({ success: false, error: 'Account not found' });
      }
    } else {
      credentials = await YouTubeCredentials.findByUserId(req.session.userId);
    }

    if (!credentials) {
      return res.status(400).json({
        success: false,
        error: 'YouTube account not connected'
      });
    }

    const accessToken = await youtubeService.getAccessToken(
      credentials.clientId,
      credentials.clientSecret,
      credentials.refreshToken
    );

    // Normalize mimetype for YouTube API
    const mimeType = req.file.mimetype === 'image/jpg' ? 'image/jpeg' : req.file.mimetype;

    const result = await youtubeService.uploadThumbnail(
      accessToken,
      req.params.id,
      req.file.buffer,
      mimeType
    );

    console.log('[Thumbnail Upload] Success:', result);

    res.json({ success: true, thumbnailUrl: result.thumbnailUrl });
  } catch (error) {
    console.error('Error uploading thumbnail:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload thumbnail'
    });
  }
});

// ==================== BROADCAST TEMPLATE API ====================

// Create new broadcast template
app.post('/api/youtube/templates', isAuthenticated, async (req, res) => {
  try {
    const {
      name, title, description, privacyStatus, tags, categoryId,
      thumbnailPath, thumbnailFolder, pinnedThumbnail, streamKeyFolderMapping,
      streamId, accountId, titleIndex, pinnedTitleId, titleFolderId,
      // Recurring schedule fields
      recurringEnabled, recurringPattern, recurringTime, recurringDays
    } = req.body;

    console.log('[create-template] Received streamId:', streamId);
    console.log('[create-template] Received thumbnailFolder:', thumbnailFolder);
    console.log('[create-template] Received pinnedThumbnail:', pinnedThumbnail);
    console.log('[create-template] Received streamKeyFolderMapping:', streamKeyFolderMapping);
    console.log('[create-template] Received titleIndex:', titleIndex);
    console.log('[create-template] Received pinnedTitleId:', pinnedTitleId);
    console.log('[create-template] Received titleFolderId:', titleFolderId);
    console.log('[create-template] Received recurring config:', { recurringEnabled, recurringPattern, recurringTime, recurringDays });

    if (!name || !title || !accountId) {
      return res.status(400).json({
        success: false,
        error: 'Name, title, and accountId are required'
      });
    }

    // Verify account belongs to user
    const credentials = await YouTubeCredentials.findById(parseInt(accountId));
    if (!credentials || credentials.userId !== req.session.userId) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }

    // Parse stream key folder mapping if provided
    let parsedMapping = null;
    if (streamKeyFolderMapping) {
      try {
        parsedMapping = typeof streamKeyFolderMapping === 'string'
          ? JSON.parse(streamKeyFolderMapping)
          : streamKeyFolderMapping;
      } catch (e) {
        console.warn('[create-template] Failed to parse streamKeyFolderMapping:', e.message);
      }
    }

    // Validate and calculate next_run_at if recurring is enabled
    let next_run_at = null;
    if (recurringEnabled) {
      const { validateRecurringConfig, calculateNextRun, formatNextRunAt } = require('./utils/recurringUtils');

      // Normalize recurring_days
      const normalizedDays = Array.isArray(recurringDays) ? recurringDays : null;

      const validation = validateRecurringConfig({
        recurring_enabled: recurringEnabled,
        recurring_pattern: recurringPattern,
        recurring_time: recurringTime,
        recurring_days: normalizedDays
      });

      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: validation.errors.join(', ')
        });
      }

      // Calculate next run time
      const nextRun = calculateNextRun({
        recurring_pattern: recurringPattern,
        recurring_time: recurringTime,
        recurring_days: normalizedDays
      });
      if (nextRun) {
        next_run_at = formatNextRunAt(nextRun);
      }
    }

    // IMPORTANT: Handle thumbnailFolder correctly
    // - undefined or null means not provided -> will be auto-set below
    // - empty string "" means root folder (intentionally selected)
    // - non-empty string means specific folder name
    const finalThumbnailFolder = thumbnailFolder !== undefined ? thumbnailFolder : null;

    console.log('[create-template] thumbnailFolder processing:', {
      received: thumbnailFolder,
      type: typeof thumbnailFolder,
      final: finalThumbnailFolder
    });

    const template = await BroadcastTemplate.create({
      user_id: req.session.userId,
      account_id: parseInt(accountId),
      name,
      title,
      description: description || null,
      privacy_status: privacyStatus || 'unlisted',
      tags: tags || null,
      category_id: categoryId || '22',
      thumbnail_path: thumbnailPath || null,
      thumbnail_folder: finalThumbnailFolder,  // Use processed value - empty string is valid!
      thumbnail_index: 0,
      pinned_thumbnail: pinnedThumbnail || null,
      stream_key_folder_mapping: parsedMapping,
      stream_id: streamId || null,
      title_index: titleIndex || 0,
      pinned_title_id: pinnedTitleId || null,
      title_folder_id: titleFolderId || null,
      // Recurring schedule fields
      recurring_enabled: !!recurringEnabled,
      recurring_pattern: recurringPattern || null,
      recurring_time: recurringTime || null,
      recurring_days: Array.isArray(recurringDays) ? recurringDays : null,
      next_run_at: next_run_at
    });

    // Only auto-set thumbnail_folder if it was not provided at all (null)
    // Do NOT auto-set if it's empty string (root folder was intentionally selected)
    if (template.thumbnail_folder === null) {
      try {
        const thumbnailDir = path.join(__dirname, 'public', 'thumbnails');
        if (fs.existsSync(thumbnailDir)) {
          const folders = fs.readdirSync(thumbnailDir)
            .filter(f => fs.statSync(path.join(thumbnailDir, f)).isDirectory());
          if (folders.length > 0) {
            await BroadcastTemplate.update(template.id, { thumbnail_folder: folders[0] });
            template.thumbnail_folder = folders[0];
            console.log('[create-template] Auto-set thumbnail_folder to first folder:', folders[0]);
          }
        }
      } catch (folderErr) {
        console.warn('[create-template] Could not auto-set thumbnail_folder:', folderErr.message);
      }
    }

    console.log('[create-template] Created template with stream_id:', template.stream_id, 'thumbnail_folder:', template.thumbnail_folder, 'pinned_thumbnail:', template.pinned_thumbnail, 'title_index:', template.title_index, 'pinned_title_id:', template.pinned_title_id);
    console.log('[create-template] Recurring config saved:', { recurring_enabled: template.recurring_enabled, recurring_pattern: template.recurring_pattern, recurring_time: template.recurring_time, next_run_at: template.next_run_at });

    res.json({ success: true, template });
  } catch (error) {
    console.error('Error creating broadcast template:', error);
    res.status(error.message.includes('already exists') ? 400 : 500).json({
      success: false,
      error: error.message || 'Failed to create template'
    });
  }
});

// Create multi-broadcast template (save multiple broadcasts as one template)
app.post('/api/youtube/templates/multi', isAuthenticated, async (req, res) => {
  try {
    const { name, accountId, broadcasts, thumbnailFolder, streamKeyFolderMapping } = req.body;

    if (!name || !accountId || !broadcasts || broadcasts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Name, accountId, and broadcasts are required'
      });
    }

    // Verify account belongs to user
    const credentials = await YouTubeCredentials.findById(parseInt(accountId));
    if (!credentials || credentials.userId !== req.session.userId) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }

    // Parse stream key folder mapping if provided
    let parsedMapping = null;
    if (streamKeyFolderMapping) {
      try {
        parsedMapping = typeof streamKeyFolderMapping === 'string'
          ? JSON.parse(streamKeyFolderMapping)
          : streamKeyFolderMapping;
      } catch (e) {
        console.warn('[templates/multi] Failed to parse streamKeyFolderMapping:', e.message);
      }
    }

    // IMPORTANT: Handle thumbnailFolder correctly
    // - undefined means not provided
    // - empty string "" means root folder (intentionally selected)
    // - non-empty string means specific folder name
    const finalThumbnailFolder = thumbnailFolder !== undefined ? thumbnailFolder : null;

    console.log('[templates/multi] thumbnailFolder processing:', {
      received: thumbnailFolder,
      type: typeof thumbnailFolder,
      final: finalThumbnailFolder
    });

    // Ensure each broadcast has streamId, thumbnailPath, and thumbnailFolder preserved
    const broadcastsWithStreamId = broadcasts.map(b => ({
      title: b.title,
      description: b.description || '',
      privacyStatus: b.privacyStatus || 'unlisted',
      streamId: b.streamId || null,  // Preserve stream ID
      streamKey: b.streamKey || '',
      categoryId: b.categoryId || '22',
      tags: b.tags || [],
      thumbnailPath: b.thumbnailPath || b.thumbnail_path || null,  // Preserve thumbnail path
      // IMPORTANT: Use finalThumbnailFolder first, then fallback to broadcast's folder
      thumbnailFolder: finalThumbnailFolder !== null ? finalThumbnailFolder : (b.thumbnailFolder !== undefined ? b.thumbnailFolder : null),
      pinnedThumbnail: b.pinnedThumbnail || null  // Preserve pinned thumbnail
    }));

    console.log('[templates/multi] Saving broadcasts with data:', broadcastsWithStreamId.map(b => ({
      title: b.title,
      streamId: b.streamId,
      thumbnailPath: b.thumbnailPath,
      thumbnailFolder: b.thumbnailFolder,
      pinnedThumbnail: b.pinnedThumbnail,
      privacyStatus: b.privacyStatus
    })));

    // Create template with broadcasts data stored as JSON
    const template = await BroadcastTemplate.create({
      user_id: req.session.userId,
      account_id: parseInt(accountId),
      name,
      title: broadcasts[0].title, // Use first broadcast title as main title
      description: JSON.stringify(broadcastsWithStreamId), // Store all broadcasts as JSON in description
      privacy_status: broadcasts[0].privacyStatus || 'unlisted',
      tags: broadcasts[0].tags || null,
      category_id: broadcasts[0].categoryId || '22',
      thumbnail_path: null,
      thumbnail_folder: thumbnailFolder !== undefined ? thumbnailFolder : null,  // Save thumbnail folder for sequential selection
      thumbnail_index: 0,
      pinned_thumbnail: null,
      stream_key_folder_mapping: parsedMapping,
      stream_id: broadcasts[0].streamId || null  // Save first broadcast's stream_id
    });

    res.json({ success: true, template, broadcastCount: broadcasts.length });
  } catch (error) {
    console.error('Error creating multi-broadcast template:', error);
    res.status(error.message.includes('already exists') ? 400 : 500).json({
      success: false,
      error: error.message || 'Failed to create template'
    });
  }
});

// Export templates to JSON file
app.get('/api/youtube/templates/export', isAuthenticated, async (req, res) => {
  try {
    const backup = await backupService.exportTemplatesOnly(req.session.userId);
    const jsonString = backupService.formatTemplateBackupJson(backup);

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `templates-backup-${timestamp}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(jsonString);
  } catch (error) {
    console.error('Error exporting templates:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to export templates'
    });
  }
});

// Import templates from JSON file
app.post('/api/youtube/templates/import', isAuthenticated, uploadBackup.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    // Parse JSON file
    let backupData;
    try {
      backupData = JSON.parse(req.file.buffer.toString('utf8'));
    } catch (parseError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid JSON file'
      });
    }

    // Validate backup format
    const validation = backupService.validateTemplateBackup(backupData);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid backup format',
        details: validation.errors
      });
    }

    // Get account ID from request or use primary account
    let accountId = req.body.accountId;
    if (!accountId) {
      const accounts = await YouTubeCredentials.findAllByUserId(req.session.userId);
      const primaryAccount = accounts.find(a => a.isPrimary) || accounts[0];
      if (!primaryAccount) {
        return res.status(400).json({
          success: false,
          error: 'No YouTube account connected. Please connect an account first.'
        });
      }
      accountId = primaryAccount.id;
    }

    // Import templates
    const skipDuplicates = req.body.skipDuplicates === 'true' || req.body.skipDuplicates === true;
    const result = await backupService.importTemplatesOnly(
      backupData,
      req.session.userId,
      accountId,
      { skipDuplicates }
    );

    res.json({
      success: true,
      results: result
    });
  } catch (error) {
    console.error('Error importing templates:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to import templates'
    });
  }
});

// Get thumbnail folder from template by accountId
app.get('/api/youtube/template-folder/:accountId', isAuthenticated, async (req, res) => {
  try {
    const accountId = parseInt(req.params.accountId);

    // Get all templates for user
    const templates = await BroadcastTemplate.findByUserId(req.session.userId);

    // Find template for this account (prefer recurring enabled)
    let matchingTemplate = templates.find(t => t.account_id === accountId && t.recurring_enabled);
    if (!matchingTemplate) {
      matchingTemplate = templates.find(t => t.account_id === accountId);
    }

    if (matchingTemplate) {
      let folder = matchingTemplate.thumbnail_folder;

      // If template has no folder, get first available folder
      if (!folder) {
        try {
          const thumbnailDir = path.join(__dirname, 'public', 'thumbnails');
          if (fs.existsSync(thumbnailDir)) {
            const folders = fs.readdirSync(thumbnailDir)
              .filter(f => fs.statSync(path.join(thumbnailDir, f)).isDirectory());
            if (folders.length > 0) {
              folder = folders[0];
              console.log(`[template-folder] Template has no folder, using first available: ${folder}`);
            }
          }
        } catch (e) {
          console.warn('[template-folder] Error getting folders:', e.message);
        }
      }

      console.log(`[template-folder] Found template "${matchingTemplate.name}" for account ${accountId}, folder: ${folder}`);
      res.json({
        success: true,
        folder: folder,
        templateName: matchingTemplate.name,
        templateId: matchingTemplate.id
      });
    } else {
      // No template, get first available folder
      let firstFolder = null;
      try {
        const thumbnailDir = path.join(__dirname, 'public', 'thumbnails');
        if (fs.existsSync(thumbnailDir)) {
          const folders = fs.readdirSync(thumbnailDir)
            .filter(f => fs.statSync(path.join(thumbnailDir, f)).isDirectory());
          if (folders.length > 0) {
            firstFolder = folders[0];
          }
        }
      } catch (e) {
        console.warn('[template-folder] Error getting folders:', e.message);
      }

      console.log(`[template-folder] No template found for account ${accountId}, using first folder: ${firstFolder}`);
      res.json({ success: true, folder: firstFolder });
    }
  } catch (error) {
    console.error('[template-folder] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all templates for user
app.get('/api/youtube/templates', isAuthenticated, async (req, res) => {
  try {
    const templates = await BroadcastTemplate.findByUserId(req.session.userId);

    // Get all user's YouTube accounts for validation
    const userAccounts = await YouTubeCredentials.findAllByUserId(req.session.userId);
    const accountMap = new Map(userAccounts.map(a => [a.id, a]));

    // Parse broadcasts from description if it's a multi-broadcast template
    // Also validate account and add account_valid flag
    for (const template of templates) {
      try {
        if (template.description && template.description.startsWith('[')) {
          template.broadcasts = JSON.parse(template.description);
          template.isMultiBroadcast = true;
        }
      } catch (e) {
        // Not a multi-broadcast template, keep description as is
      }

      // Check if the account_id is still valid
      const account = accountMap.get(template.account_id);
      template.account_valid = !!account;

      // If channel_name is missing but account exists, try to get it
      if (!template.channel_name && account) {
        template.channel_name = account.channelName;

        // If still missing, try to refresh from YouTube API (async, don't wait)
        if (!template.channel_name && account.clientId && account.refreshToken) {
          // Fire and forget - refresh in background
          YouTubeCredentials.refreshChannelInfo(account.id, youtubeService)
            .then(result => {
              if (result.success) {
                console.log(`[API] Refreshed channel name for account ${account.id}: ${result.channelName}`);
              }
            })
            .catch(err => {
              console.warn(`[API] Failed to refresh channel name for account ${account.id}:`, err.message);
            });
        }
      }
    }

    res.json({ success: true, templates });
  } catch (error) {
    console.error('Error fetching broadcast templates:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch templates'
    });
  }
});


// Get all templates with recurring enabled (must be before :id route)
app.get('/api/youtube/templates/recurring', isAuthenticated, async (req, res) => {
  try {
    const templates = await BroadcastTemplate.findWithRecurringEnabled();

    // Filter to only user's templates
    const userTemplates = templates.filter(t => t.user_id === req.session.userId);

    res.json({
      success: true,
      templates: userTemplates.map(t => ({
        id: t.id,
        name: t.name,
        title: t.title,
        channel_name: t.channel_name,
        recurring_pattern: t.recurring_pattern,
        recurring_time: t.recurring_time,
        recurring_days: t.recurring_days,
        next_run_at: t.next_run_at,
        last_run_at: t.last_run_at
      }))
    });
  } catch (error) {
    console.error('Error getting recurring templates:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get recurring templates'
    });
  }
});

// Get template by ID
app.get('/api/youtube/templates/:id', isAuthenticated, async (req, res) => {
  try {
    const template = await BroadcastTemplate.findById(req.params.id);

    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    if (template.user_id !== req.session.userId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Parse broadcasts from description if it's a multi-broadcast template
    try {
      if (template.description && template.description.startsWith('[')) {
        template.broadcasts = JSON.parse(template.description);
        template.isMultiBroadcast = true;
      }
    } catch (e) {
      // Not a multi-broadcast template, keep description as is
    }

    // Validate account and get user's accounts for fallback selection
    const userAccounts = await YouTubeCredentials.findAllByUserId(req.session.userId);
    const account = userAccounts.find(a => a.id === template.account_id);
    template.account_valid = !!account;

    // If channel_name is missing but account exists, use account's channel name
    if (!template.channel_name && account) {
      template.channel_name = account.channelName;
    }

    // Include available accounts for re-create modal if account is invalid
    if (!template.account_valid && userAccounts.length > 0) {
      template.available_accounts = userAccounts.map(a => ({
        id: a.id,
        channelName: a.channelName,
        isPrimary: a.isPrimary
      }));
    }

    res.json({ success: true, template });
  } catch (error) {
    console.error('Error fetching broadcast template:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch template'
    });
  }
});

// Update template
app.put('/api/youtube/templates/:id', isAuthenticated, async (req, res) => {
  try {
    const template = await BroadcastTemplate.findById(req.params.id);

    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    if (template.user_id !== req.session.userId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const {
      name, title, description, privacyStatus, tags, categoryId,
      thumbnailPath, thumbnailFolder, pinnedThumbnail, streamKeyFolderMapping,
      streamId, accountId, titleIndex, pinnedTitleId, titleFolderId,
      // Recurring schedule fields
      recurringEnabled, recurringPattern, recurringTime, recurringDays
    } = req.body;

    console.log('[update-template] Received thumbnailFolder:', thumbnailFolder);
    console.log('[update-template] Received pinnedThumbnail:', pinnedThumbnail);
    console.log('[update-template] Received streamKeyFolderMapping:', streamKeyFolderMapping);
    console.log('[update-template] Received titleFolderId:', titleFolderId);

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (privacyStatus !== undefined) updateData.privacy_status = privacyStatus;
    if (tags !== undefined) updateData.tags = tags;
    if (categoryId !== undefined) updateData.category_id = categoryId;
    if (thumbnailPath !== undefined) updateData.thumbnail_path = thumbnailPath;
    if (thumbnailFolder !== undefined) updateData.thumbnail_folder = thumbnailFolder;
    if (pinnedThumbnail !== undefined) updateData.pinned_thumbnail = pinnedThumbnail;
    if (streamKeyFolderMapping !== undefined) {
      // Parse if string, otherwise use as-is
      if (typeof streamKeyFolderMapping === 'string') {
        try {
          updateData.stream_key_folder_mapping = JSON.parse(streamKeyFolderMapping);
        } catch (e) {
          updateData.stream_key_folder_mapping = streamKeyFolderMapping;
        }
      } else {
        updateData.stream_key_folder_mapping = streamKeyFolderMapping;
      }
    }
    if (streamId !== undefined) updateData.stream_id = streamId;
    if (accountId !== undefined) updateData.account_id = parseInt(accountId);
    if (titleIndex !== undefined) updateData.title_index = titleIndex;
    if (pinnedTitleId !== undefined) updateData.pinned_title_id = pinnedTitleId;
    if (titleFolderId !== undefined) updateData.title_folder_id = titleFolderId;

    // Handle recurring schedule fields
    if (recurringEnabled !== undefined) {
      updateData.recurring_enabled = !!recurringEnabled;

      if (recurringEnabled) {
        const { validateRecurringConfig, calculateNextRun, formatNextRunAt } = require('./utils/recurringUtils');

        // Normalize recurring_days
        const normalizedDays = Array.isArray(recurringDays) ? recurringDays : null;

        const validation = validateRecurringConfig({
          recurring_enabled: recurringEnabled,
          recurring_pattern: recurringPattern,
          recurring_time: recurringTime,
          recurring_days: normalizedDays
        });

        if (!validation.valid) {
          return res.status(400).json({
            success: false,
            error: validation.errors.join(', ')
          });
        }

        updateData.recurring_pattern = recurringPattern;
        updateData.recurring_time = recurringTime;
        updateData.recurring_days = normalizedDays;

        // Calculate next run time
        const nextRun = calculateNextRun({
          recurring_pattern: recurringPattern,
          recurring_time: recurringTime,
          recurring_days: normalizedDays
        });
        if (nextRun) {
          updateData.next_run_at = formatNextRunAt(nextRun);
        }
      } else {
        // Disable recurring - clear related fields
        updateData.recurring_pattern = null;
        updateData.recurring_time = null;
        updateData.recurring_days = null;
        updateData.next_run_at = null;
      }
    }

    const result = await BroadcastTemplate.update(req.params.id, updateData);

    console.log('[update-template] Updated template:', req.params.id, 'recurring_enabled:', updateData.recurring_enabled, 'next_run_at:', updateData.next_run_at);

    res.json({ success: true, template: result });
  } catch (error) {
    console.error('Error updating broadcast template:', error);
    res.status(error.message.includes('already exists') ? 400 : 500).json({
      success: false,
      error: error.message || 'Failed to update template'
    });
  }
});

// Delete template
app.delete('/api/youtube/templates/:id', isAuthenticated, async (req, res) => {
  try {
    const result = await BroadcastTemplate.delete(req.params.id, req.session.userId);

    if (!result.deleted) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting broadcast template:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete template'
    });
  }
});

// Update recurring configuration for a template
app.put('/api/youtube/templates/:id/recurring', isAuthenticated, async (req, res) => {
  try {
    const { recurring_enabled, recurring_pattern, recurring_time, recurring_days } = req.body;

    // Get template first to verify ownership
    const template = await BroadcastTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    if (template.user_id !== req.session.userId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Normalize recurring_days: ensure it's an array or null
    const normalizedDays = Array.isArray(recurring_days) ? recurring_days : null;

    // Validate recurring configuration
    const { validateRecurringConfig, calculateNextRun, formatNextRunAt } = require('./utils/recurringUtils');
    const validation = validateRecurringConfig({
      recurring_enabled,
      recurring_pattern,
      recurring_time,
      recurring_days: normalizedDays
    });

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.errors.join(', ')
      });
    }

    // Calculate next_run_at if enabling
    let next_run_at = null;
    if (recurring_enabled) {
      const nextRun = calculateNextRun({
        recurring_pattern,
        recurring_time,
        recurring_days: normalizedDays
      });
      if (nextRun) {
        next_run_at = formatNextRunAt(nextRun);
      }
    }

    // Update template
    const result = await BroadcastTemplate.updateRecurring(req.params.id, {
      recurring_enabled,
      recurring_pattern,
      recurring_time,
      recurring_days: normalizedDays,
      next_run_at
    });

    res.json({
      success: true,
      template: result
    });
  } catch (error) {
    console.error('Error updating template recurring:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update recurring configuration'
    });
  }
});

// Toggle recurring on/off for a template
app.post('/api/youtube/templates/:id/recurring/toggle', isAuthenticated, async (req, res) => {
  try {
    const { enabled } = req.body;

    // Get template first to verify ownership and get config
    const template = await BroadcastTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    if (template.user_id !== req.session.userId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // If enabling, validate that recurring config exists
    if (enabled) {
      if (!template.recurring_pattern || !template.recurring_time) {
        return res.status(400).json({
          success: false,
          error: 'Cannot enable recurring: pattern and time must be configured first'
        });
      }
      if (template.recurring_pattern === 'weekly' && (!template.recurring_days || template.recurring_days.length === 0)) {
        return res.status(400).json({
          success: false,
          error: 'Cannot enable recurring: weekly pattern requires days to be selected'
        });
      }
    }

    // Calculate next_run_at if enabling
    let next_run_at = null;
    if (enabled) {
      const { calculateNextRun, formatNextRunAt } = require('./utils/recurringUtils');
      const nextRun = calculateNextRun({
        recurring_pattern: template.recurring_pattern,
        recurring_time: template.recurring_time,
        recurring_days: template.recurring_days
      });
      next_run_at = formatNextRunAt(nextRun);
    }

    // Toggle recurring
    const result = await BroadcastTemplate.toggleRecurring(req.params.id, enabled, next_run_at);

    res.json({
      success: true,
      recurring_enabled: enabled,
      next_run_at: next_run_at
    });
  } catch (error) {
    console.error('Error toggling template recurring:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to toggle recurring'
    });
  }
});

// Create broadcast from template
app.post('/api/youtube/templates/:id/create-broadcast', isAuthenticated, async (req, res) => {
  try {
    const { scheduledStartTime } = req.body;

    if (!scheduledStartTime) {
      return res.status(400).json({
        success: false,
        error: 'Scheduled start time is required'
      });
    }

    // Get template
    const template = await BroadcastTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    if (template.user_id !== req.session.userId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    console.log('[create-broadcast-from-template] Template:', {
      id: template.id,
      name: template.name,
      stream_id: template.stream_id
    });

    // Get YouTube credentials
    const credentials = await YouTubeCredentials.findById(template.account_id);
    if (!credentials) {
      return res.status(400).json({
        success: false,
        error: 'YouTube account not found'
      });
    }

    // Get access token
    const accessToken = await youtubeService.getAccessToken(
      credentials.clientId,
      credentials.clientSecret,
      credentials.refreshToken
    );

    console.log('[create-broadcast-from-template] Using streamId:', template.stream_id);

    // Create broadcast on YouTube
    const broadcast = await youtubeService.createBroadcast(accessToken, {
      title: template.title,
      description: template.description || '',
      scheduledStartTime: new Date(scheduledStartTime).toISOString(),
      privacyStatus: template.privacy_status || 'unlisted',
      tags: template.tags || [],
      categoryId: template.category_id || '22',
      streamId: template.stream_id || null,
      // IMPORTANT: Always enable auto-start when creating from template
      // This ensures YouTube broadcast starts automatically when stream begins
      enableAutoStart: true,
      enableAutoStop: true
    });

    // Save broadcast settings for auto-start sync
    try {
      await YouTubeBroadcastSettings.upsert({
        broadcastId: broadcast.broadcastId || broadcast.id,
        userId: req.session.userId,
        accountId: template.account_id || null,
        enableAutoStart: true,
        enableAutoStop: true,
        unlistReplayOnEnd: true,
        originalPrivacyStatus: template.privacy_status || 'unlisted',
        thumbnailFolder: template.thumbnail_folder !== undefined ? template.thumbnail_folder : null,
        templateId: template.id
      });
    } catch (settingsErr) {
      console.error('[create-broadcast-from-template] Error saving broadcast settings:', settingsErr.message);
    }

    console.log('[create-broadcast-from-template] Created broadcast with streamKey:', broadcast.streamKey);

    // Upload thumbnail if template has one
    if (template.thumbnail_path) {
      try {
        const thumbnailBuffer = fs.readFileSync(path.join(__dirname, 'public', template.thumbnail_path));
        await youtubeService.uploadThumbnail(accessToken, broadcast.id, thumbnailBuffer);
      } catch (thumbError) {
        console.error('Error uploading thumbnail:', thumbError);
        // Continue without thumbnail
      }
    }

    res.json({
      success: true,
      broadcast: {
        id: broadcast.id,
        title: broadcast.title,
        scheduledStartTime: broadcast.scheduledStartTime,
        streamKey: broadcast.streamKey
      }
    });
  } catch (error) {
    console.error('Error creating broadcast from template:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create broadcast'
    });
  }
});

// Bulk create broadcasts from template
app.post('/api/youtube/templates/:id/bulk-create', isAuthenticated, async (req, res) => {
  try {
    const { schedules } = req.body;

    if (!schedules || !Array.isArray(schedules) || schedules.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one schedule is required'
      });
    }

    // Get template
    const template = await BroadcastTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    if (template.user_id !== req.session.userId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Get YouTube credentials
    const credentials = await YouTubeCredentials.findById(template.account_id);
    if (!credentials) {
      return res.status(400).json({
        success: false,
        error: 'YouTube account not found'
      });
    }

    // Get access token
    const accessToken = await youtubeService.getAccessToken(
      credentials.clientId,
      credentials.clientSecret,
      credentials.refreshToken
    );

    const results = {
      total: schedules.length,
      success: 0,
      failed: 0,
      broadcasts: [],
      errors: []
    };

    // Create broadcasts for each schedule
    for (const schedule of schedules) {
      try {
        const broadcast = await youtubeService.createBroadcast(accessToken, {
          title: template.title,
          description: template.description || '',
          scheduledStartTime: new Date(schedule).toISOString(),
          privacyStatus: template.privacy_status || 'unlisted',
          tags: template.tags || [],
          categoryId: template.category_id || '22',
          streamId: template.stream_id || null,
          // IMPORTANT: Always enable auto-start when creating from template
          // This ensures YouTube broadcast starts automatically when stream begins
          enableAutoStart: true,
          enableAutoStop: true
        });

        // Save broadcast settings for auto-start sync
        try {
          await YouTubeBroadcastSettings.upsert({
            broadcastId: broadcast.broadcastId,
            userId: req.session.userId,
            accountId: template.account_id || null,
            enableAutoStart: true,
            enableAutoStop: true,
            unlistReplayOnEnd: true,
            originalPrivacyStatus: template.privacy_status || 'unlisted',
            thumbnailFolder: template.thumbnail_folder !== undefined ? template.thumbnail_folder : null,
            templateId: template.id
          });
        } catch (settingsErr) {
          console.error('[bulk-create] Error saving broadcast settings:', settingsErr.message);
        }

        // Upload thumbnail if template has one
        if (template.thumbnail_path) {
          try {
            const thumbnailBuffer = fs.readFileSync(path.join(__dirname, 'public', template.thumbnail_path));
            await youtubeService.uploadThumbnail(accessToken, broadcast.broadcastId, thumbnailBuffer);
          } catch (thumbError) {
            console.error('Error uploading thumbnail for bulk create:', thumbError);
          }
        }

        results.success++;
        results.broadcasts.push({
          id: broadcast.broadcastId,
          title: broadcast.title,
          scheduledStartTime: broadcast.scheduledStartTime,
          streamKey: broadcast.streamKey
        });
      } catch (error) {
        results.failed++;
        results.errors.push({
          schedule,
          error: error.message
        });
      }
    }

    // Return 207 Multi-Status if there were partial failures
    const statusCode = results.failed > 0 && results.success > 0 ? 207 :
      results.failed === results.total ? 500 : 200;

    res.status(statusCode).json({
      success: results.failed === 0,
      ...results
    });
  } catch (error) {
    console.error('Error bulk creating broadcasts:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to bulk create broadcasts'
    });
  }
});

// ============================================
// RECURRING BROADCAST SCHEDULES API
// ============================================
const RecurringSchedule = require('./models/RecurringSchedule');
// scheduleService already imported at top of file

// Get all recurring schedules for user
app.get('/api/recurring-schedules', isAuthenticated, async (req, res) => {
  try {
    const schedules = await RecurringSchedule.findByUserId(req.session.userId);
    res.json({ success: true, schedules });
  } catch (error) {
    console.error('Error fetching recurring schedules:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch schedules' });
  }
});

// Create recurring schedule
app.post('/api/recurring-schedules', isAuthenticated, async (req, res) => {
  try {
    const { name, pattern, schedule_time, days_of_week, template_id, title_template, description, privacy_status, tags, account_id } = req.body;

    // Validate required fields
    if (!name || !pattern || !schedule_time || !account_id) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Must have either template_id or title_template
    if (!template_id && !title_template) {
      return res.status(400).json({ success: false, error: 'Please select a template or provide a title template' });
    }

    // Validate weekly schedule has days
    if (pattern === 'weekly') {
      const days = Array.isArray(days_of_week) ? days_of_week : [];
      if (days.length === 0) {
        return res.status(400).json({ success: false, error: 'Weekly schedule requires at least one day selected' });
      }
    }

    const schedule = await RecurringSchedule.create({
      user_id: req.session.userId,
      account_id,
      name,
      pattern,
      schedule_time,
      days_of_week: Array.isArray(days_of_week) ? JSON.stringify(days_of_week) : days_of_week,
      template_id: template_id || null,
      title_template: title_template || null,
      description,
      privacy_status: privacy_status || 'unlisted',
      tags: Array.isArray(tags) ? JSON.stringify(tags) : tags
    });

    // Schedule the job
    await scheduleService.scheduleJob(schedule);

    res.json({ success: true, schedule });
  } catch (error) {
    console.error('Error creating recurring schedule:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to create schedule' });
  }
});

// Get single recurring schedule
app.get('/api/recurring-schedules/:id', isAuthenticated, async (req, res) => {
  try {
    const schedule = await RecurringSchedule.findById(req.params.id);
    if (!schedule || schedule.user_id !== req.session.userId) {
      return res.status(404).json({ success: false, error: 'Schedule not found' });
    }
    res.json({ success: true, schedule });
  } catch (error) {
    console.error('Error fetching recurring schedule:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch schedule' });
  }
});

// Update recurring schedule
app.put('/api/recurring-schedules/:id', isAuthenticated, async (req, res) => {
  try {
    const schedule = await RecurringSchedule.findById(req.params.id);
    if (!schedule || schedule.user_id !== req.session.userId) {
      return res.status(404).json({ success: false, error: 'Schedule not found' });
    }

    const { name, pattern, schedule_time, days_of_week, template_id, title_template, description, privacy_status, tags, account_id } = req.body;

    // Validate weekly schedule has days
    if (pattern === 'weekly') {
      const days = Array.isArray(days_of_week) ? days_of_week : [];
      if (days.length === 0) {
        return res.status(400).json({ success: false, error: 'Weekly schedule requires at least one day selected' });
      }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (pattern !== undefined) updateData.pattern = pattern;
    if (schedule_time !== undefined) updateData.schedule_time = schedule_time;
    if (days_of_week !== undefined) updateData.days_of_week = Array.isArray(days_of_week) ? days_of_week : JSON.parse(days_of_week || '[]');
    if (template_id !== undefined) updateData.template_id = template_id;
    if (title_template !== undefined) updateData.title_template = title_template;
    if (description !== undefined) updateData.description = description;
    if (privacy_status !== undefined) updateData.privacy_status = privacy_status;
    if (tags !== undefined) updateData.tags = Array.isArray(tags) ? tags : JSON.parse(tags || '[]');
    if (account_id !== undefined) updateData.account_id = account_id;

    await RecurringSchedule.update(req.params.id, updateData);

    // Reload the schedule job
    await scheduleService.reloadSchedule(req.params.id);

    const updated = await RecurringSchedule.findById(req.params.id);
    res.json({ success: true, schedule: updated });
  } catch (error) {
    console.error('Error updating recurring schedule:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to update schedule' });
  }
});

// Delete recurring schedule
app.delete('/api/recurring-schedules/:id', isAuthenticated, async (req, res) => {
  try {
    const result = await RecurringSchedule.delete(req.params.id, req.session.userId);
    if (!result.deleted) {
      return res.status(404).json({ success: false, error: 'Schedule not found' });
    }

    // Cancel the job
    scheduleService.cancelJob(req.params.id);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting recurring schedule:', error);
    res.status(500).json({ success: false, error: 'Failed to delete schedule' });
  }
});

// Toggle recurring schedule active status
app.post('/api/recurring-schedules/:id/toggle', isAuthenticated, async (req, res) => {
  try {
    const schedule = await RecurringSchedule.findById(req.params.id);
    if (!schedule || schedule.user_id !== req.session.userId) {
      return res.status(404).json({ success: false, error: 'Schedule not found' });
    }

    const newStatus = !schedule.is_active;
    await RecurringSchedule.toggleActive(req.params.id, newStatus);

    // Reload or cancel the job based on new status
    if (newStatus) {
      await scheduleService.reloadSchedule(req.params.id);
    } else {
      scheduleService.cancelJob(req.params.id);
    }

    res.json({ success: true, is_active: newStatus });
  } catch (error) {
    console.error('Error toggling recurring schedule:', error);
    res.status(500).json({ success: false, error: 'Failed to toggle schedule' });
  }
});

// Run recurring schedule now (manual trigger)
app.post('/api/recurring-schedules/:id/run-now', isAuthenticated, async (req, res) => {
  try {
    const schedules = await RecurringSchedule.findActiveSchedules();
    const schedule = schedules.find(s => s.id === req.params.id && s.user_id === req.session.userId);

    if (!schedule) {
      return res.status(404).json({ success: false, error: 'Schedule not found or not active' });
    }

    console.log(`[API] Manual trigger for schedule: ${schedule.name}`);
    const result = await scheduleService.executeSchedule(schedule);

    res.json({
      success: true,
      message: 'Broadcast created successfully',
      broadcastId: result.broadcastId
    });
  } catch (error) {
    console.error('Error running schedule manually:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to run schedule' });
  }
});

// Manual trigger for template recurring schedule
app.post('/api/youtube/templates/:id/run-now', isAuthenticated, async (req, res) => {
  try {
    const template = await BroadcastTemplate.findById(req.params.id);

    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    if (template.user_id !== req.session.userId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Get credentials
    const credentials = await YouTubeCredentials.findById(template.account_id);
    if (!credentials) {
      return res.status(400).json({ success: false, error: 'YouTube account not found' });
    }

    // Merge credentials into template object
    const templateWithCreds = {
      ...template,
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      refresh_token: credentials.refreshToken
    };

    console.log(`[API] Manual trigger for template: ${template.name}`);
    const result = await scheduleService.executeTemplate(templateWithCreds);

    res.json({
      success: true,
      message: 'Broadcast(s) created successfully',
      results: result
    });
  } catch (error) {
    console.error('Error running template manually:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to run template' });
  }
});

// Debug: Force check all schedules now
app.post('/api/youtube/schedules/check-now', isAuthenticated, async (req, res) => {
  try {
    console.log(`[API] Manual schedule check triggered by user`);
    await scheduleService.checkSchedules();
    res.json({ success: true, message: 'Schedule check completed' });
  } catch (error) {
    console.error('Error checking schedules:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to check schedules' });
  }
});

// Debug: Get schedule service status
app.get('/api/youtube/schedules/status', isAuthenticated, async (req, res) => {
  try {
    const templates = await BroadcastTemplate.findWithRecurringEnabled();
    const { getWIBTime } = require('./utils/recurringUtils');
    const now = new Date();
    const wibTime = getWIBTime(now);

    res.json({
      success: true,
      currentTime: {
        utc: now.toISOString(),
        wib: `${String(wibTime.hours).padStart(2, '0')}:${String(wibTime.minutes).padStart(2, '0')}`,
        day: wibTime.day,
        dayOfMonth: wibTime.dayOfMonth
      },
      serviceInitialized: scheduleService.initialized,
      checkerRunning: !!scheduleService.checkInterval,
      templatesWithRecurring: templates.map(t => ({
        id: t.id,
        name: t.name,
        pattern: t.recurring_pattern,
        time: t.recurring_time,
        days: t.recurring_days,
        nextRunAt: t.next_run_at,
        lastRunAt: t.last_run_at,
        hasCredentials: !!(t.client_id && t.refresh_token)
      }))
    });
  } catch (error) {
    console.error('Error getting schedule status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== TITLE SUGGESTIONS API ====================

// Get all title suggestions for user
app.get('/api/title-suggestions', isAuthenticated, async (req, res) => {
  try {
    const streamKeyId = req.query.streamKeyId || null;
    const folderId = req.query.folderId || null;
    const titles = await TitleSuggestion.findByUserId(req.session.userId, streamKeyId, folderId);
    res.json({ success: true, titles });
  } catch (error) {
    console.error('Error fetching title suggestions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch titles' });
  }
});

// Search title suggestions
app.get('/api/title-suggestions/search', isAuthenticated, async (req, res) => {
  try {
    const keyword = req.query.q || '';
    if (!keyword.trim()) {
      return res.json({ success: true, titles: [] });
    }
    const titles = await TitleSuggestion.search(req.session.userId, keyword);
    res.json({ success: true, titles });
  } catch (error) {
    console.error('Error searching title suggestions:', error);
    res.status(500).json({ success: false, error: 'Failed to search titles' });
  }
});

// Get popular titles
app.get('/api/title-suggestions/popular', isAuthenticated, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const titles = await TitleSuggestion.getPopular(req.session.userId, limit);
    res.json({ success: true, titles });
  } catch (error) {
    console.error('Error fetching popular titles:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch popular titles' });
  }
});

// Get next title in rotation for a stream key
app.get('/api/title-suggestions/next', isAuthenticated, async (req, res) => {
  try {
    const { streamKeyId, currentIndex } = req.query;
    if (!streamKeyId) {
      return res.status(400).json({ success: false, error: 'streamKeyId is required' });
    }
    const result = await TitleSuggestion.getNextTitle(
      req.session.userId,
      streamKeyId,
      parseInt(currentIndex) || 0
    );
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error getting next title:', error);
    res.status(500).json({ success: false, error: 'Failed to get next title' });
  }
});

// Create new title suggestion
app.post('/api/title-suggestions', isAuthenticated, async (req, res) => {
  try {
    const { title, streamKeyId, folderId } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }
    const newTitle = await TitleSuggestion.create({
      user_id: req.session.userId,
      title: title.trim(),
      stream_key_id: streamKeyId || null,
      folder_id: folderId || null
    });
    res.json({ success: true, title: newTitle });
  } catch (error) {
    console.error('Error creating title suggestion:', error);
    if (error.message.includes('already exists')) {
      return res.status(400).json({ success: false, error: 'Title already exists' });
    }
    res.status(500).json({ success: false, error: 'Failed to create title' });
  }
});

// Update title suggestion
app.put('/api/title-suggestions/:id', isAuthenticated, async (req, res) => {
  try {
    const { title, streamKeyId } = req.body;
    const result = await TitleSuggestion.update(req.params.id, req.session.userId, {
      title,
      stream_key_id: streamKeyId
    });
    if (!result.updated) {
      return res.status(404).json({ success: false, error: 'Title not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating title suggestion:', error);
    if (error.message.includes('already exists')) {
      return res.status(400).json({ success: false, error: 'Title already exists' });
    }
    res.status(500).json({ success: false, error: 'Failed to update title' });
  }
});

// Toggle pin status for a title
app.post('/api/title-suggestions/:id/pin', isAuthenticated, async (req, res) => {
  try {
    const { isPinned } = req.body;
    const result = await TitleSuggestion.togglePin(req.params.id, req.session.userId, isPinned);
    if (!result.success) {
      return res.status(404).json({ success: false, error: result.error || 'Title not found' });
    }
    res.json({ success: true, is_pinned: result.is_pinned });
  } catch (error) {
    console.error('Error toggling title pin:', error);
    res.status(500).json({ success: false, error: 'Failed to update pin status' });
  }
});

// Increment use count (when title is selected)
app.post('/api/title-suggestions/:id/use', isAuthenticated, async (req, res) => {
  try {
    await TitleSuggestion.incrementUseCount(req.params.id, req.session.userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error incrementing title use count:', error);
    res.status(500).json({ success: false, error: 'Failed to update title' });
  }
});

// Delete title suggestion
app.delete('/api/title-suggestions/:id', isAuthenticated, async (req, res) => {
  try {
    const result = await TitleSuggestion.delete(req.params.id, req.session.userId);
    if (!result.deleted) {
      return res.status(404).json({ success: false, error: 'Title not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting title suggestion:', error);
    res.status(500).json({ success: false, error: 'Failed to delete title' });
  }
});

// Move title to folder
app.post('/api/title-suggestions/:id/move', isAuthenticated, async (req, res) => {
  try {
    const { folderId } = req.body;
    const result = await TitleSuggestion.moveToFolder(req.params.id, req.session.userId, folderId || null);
    if (!result.updated) {
      return res.status(404).json({ success: false, error: 'Title not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error moving title to folder:', error);
    res.status(500).json({ success: false, error: 'Failed to move title' });
  }
});

// ============================================
// Title Folder API Endpoints
// ============================================

// Get all folders for user
app.get('/api/title-folders', isAuthenticated, async (req, res) => {
  try {
    const folders = await TitleFolder.findByUserId(req.session.userId);
    res.json({ success: true, folders });
  } catch (error) {
    console.error('Error fetching title folders:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch folders' });
  }
});

// Create new folder
app.post('/api/title-folders', isAuthenticated, async (req, res) => {
  try {
    console.log('[API] POST /api/title-folders - userId:', req.session.userId);
    console.log('[API] Request body:', req.body);

    const { name, color } = req.body;
    if (!name || !name.trim()) {
      console.log('[API] Error: Folder name is required');
      return res.status(400).json({ success: false, error: 'Folder name is required' });
    }
    const folder = await TitleFolder.create({
      user_id: req.session.userId,
      name: name.trim(),
      color: color || '#8B5CF6'
    });
    console.log('[API] Folder created:', folder);
    res.json({ success: true, folder });
  } catch (error) {
    console.error('Error creating title folder:', error);
    if (error.message.includes('already exists')) {
      return res.status(400).json({ success: false, error: 'Folder name already exists' });
    }
    res.status(500).json({ success: false, error: 'Failed to create folder' });
  }
});

// Update folder
app.put('/api/title-folders/:id', isAuthenticated, async (req, res) => {
  try {
    const { name, color } = req.body;
    const result = await TitleFolder.update(req.params.id, req.session.userId, { name, color });
    if (!result.updated) {
      return res.status(404).json({ success: false, error: 'Folder not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating title folder:', error);
    if (error.message.includes('already exists')) {
      return res.status(400).json({ success: false, error: 'Folder name already exists' });
    }
    res.status(500).json({ success: false, error: 'Failed to update folder' });
  }
});

// Delete folder
app.delete('/api/title-folders/:id', isAuthenticated, async (req, res) => {
  try {
    const result = await TitleFolder.delete(req.params.id, req.session.userId);
    if (!result.deleted) {
      return res.status(404).json({ success: false, error: 'Folder not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting title folder:', error);
    res.status(500).json({ success: false, error: 'Failed to delete folder' });
  }
});

// ============================================
// Title Rotation Settings API Endpoints
// ============================================

// Get title rotation settings for user
app.get('/api/title-rotation/settings', isAuthenticated, async (req, res) => {
  try {
    const settings = await getUserTitleRotationSettings(req.session.userId);
    res.json({
      success: true,
      enabled: settings.enabled || false,
      folderId: settings.folderId || null,
      currentIndex: settings.currentIndex || 0
    });
  } catch (error) {
    console.error('Error getting title rotation settings:', error);
    res.status(500).json({ success: false, error: 'Failed to get settings' });
  }
});

// Save title rotation settings for user
app.post('/api/title-rotation/settings', isAuthenticated, async (req, res) => {
  try {
    const { enabled, folderId } = req.body;
    await saveTitleRotationSettings(req.session.userId, {
      enabled: enabled || false,
      folderId: folderId || null
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving title rotation settings:', error);
    res.status(500).json({ success: false, error: 'Failed to save settings' });
  }
});

// Get next title in rotation
app.get('/api/title-rotation/next', isAuthenticated, async (req, res) => {
  try {
    const folderId = req.query.folderId || null;
    const currentIndex = parseInt(req.query.currentIndex) || null;

    // Use provided currentIndex or get from settings
    let indexToUse = currentIndex;
    if (indexToUse === null) {
      const settings = await getUserTitleRotationSettings(req.session.userId);
      indexToUse = settings.currentIndex || 0;
    }

    const result = await TitleSuggestion.getNextTitle(
      req.session.userId,
      indexToUse,
      folderId
    );

    res.json({
      success: true,
      title: result.title,
      nextIndex: result.nextIndex,
      isPinned: result.isPinned,
      totalCount: result.totalCount || 0,
      currentPosition: result.currentPosition || 0
    });
  } catch (error) {
    console.error('Error getting next rotation title:', error);
    res.status(500).json({ success: false, error: 'Failed to get next title' });
  }
});

// Update title rotation index
app.post('/api/title-rotation/update-index', isAuthenticated, async (req, res) => {
  try {
    const { newIndex } = req.body;
    await updateTitleRotationIndex(req.session.userId, newIndex || 0);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating title rotation index:', error);
    res.status(500).json({ success: false, error: 'Failed to update index' });
  }
});

// Helper functions for title rotation settings (stored in user_settings table or similar)
async function getUserTitleRotationSettings(userId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM user_title_rotation_settings WHERE user_id = ?`,
      [userId],
      (err, row) => {
        if (err) {
          // Table might not exist, return defaults
          return resolve({ enabled: false, folderId: null, currentIndex: 0 });
        }
        if (row) {
          // Map database column names to camelCase
          resolve({
            enabled: row.enabled === 1,
            folderId: row.folder_id || null,
            currentIndex: row.current_index || 0
          });
        } else {
          resolve({ enabled: false, folderId: null, currentIndex: 0 });
        }
      }
    );
  });
}

async function saveTitleRotationSettings(userId, settings) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO user_title_rotation_settings (user_id, enabled, folder_id, current_index)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         enabled = excluded.enabled,
         folder_id = excluded.folder_id,
         updated_at = CURRENT_TIMESTAMP`,
      [userId, settings.enabled ? 1 : 0, settings.folderId, settings.currentIndex || 0],
      function (err) {
        if (err) {
          console.error('Error saving title rotation settings:', err.message);
          return reject(err);
        }
        resolve({ success: true });
      }
    );
  });
}

async function updateTitleRotationIndex(userId, newIndex) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE user_title_rotation_settings SET current_index = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
      [newIndex, userId],
      function (err) {
        if (err) {
          console.error('Error updating title rotation index:', err.message);
          return reject(err);
        }
        resolve({ success: true, updated: this.changes > 0 });
      }
    );
  });
}

// ============================================
// System Update API Endpoints (Admin only)
// ============================================

// Get current version
app.get('/api/system/version', isAuthenticated, async (req, res) => {
  try {
    // Read package.json fresh (don't use require cache)
    const packagePath = path.join(__dirname, 'package.json');
    const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    res.json({
      success: true,
      currentVersion: packageData.version || 'Unknown'
    });
  } catch (error) {
    console.error('Error getting version:', error);
    res.status(500).json({ success: false, error: 'Failed to get version', details: error.message });
  }
});

// Check for updates
app.get('/api/system/check-update', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { execSync } = require('child_process');

    // Read package.json fresh
    const packagePath = path.join(__dirname, 'package.json');
    const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const currentVersion = packageData.version || '0.0.0';

    // Get the app directory
    const appDir = __dirname;

    // Check if git is available
    try {
      execSync('git --version', { cwd: appDir, encoding: 'utf8', timeout: 5000 });
    } catch (gitCheckErr) {
      return res.json({
        success: false,
        error: 'Git is not installed or not available in PATH.'
      });
    }

    // Check if this is a git repository
    try {
      execSync('git rev-parse --git-dir', { cwd: appDir, encoding: 'utf8', timeout: 5000 });
    } catch (repoErr) {
      return res.json({
        success: false,
        error: 'This directory is not a git repository.'
      });
    }

    // Fetch latest from remote
    try {
      execSync('git fetch origin', { cwd: appDir, encoding: 'utf8', timeout: 60000, stdio: 'pipe' });
    } catch (fetchErr) {
      console.error('Git fetch error:', fetchErr.message);
      return res.json({
        success: false,
        error: 'Failed to fetch updates. Check your internet connection and git remote configuration.'
      });
    }

    // Check if there are updates available
    let behindCount = 0;
    let changelog = [];
    let currentBranch = 'main';

    try {
      // Get current branch
      currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: appDir, encoding: 'utf8', stdio: 'pipe' }).trim();

      // Count commits behind
      const behindOutput = execSync(`git rev-list HEAD..origin/${currentBranch} --count`, { cwd: appDir, encoding: 'utf8', stdio: 'pipe' }).trim();
      behindCount = parseInt(behindOutput, 10) || 0;

      // Get changelog from CHANGELOG.md file (remote version)
      if (behindCount > 0) {
        try {
          // Try to get remote CHANGELOG.md
          const remoteChangelog = execSync(`git show origin/${currentBranch}:CHANGELOG.md`, { cwd: appDir, encoding: 'utf8', stdio: 'pipe' });

          // Parse changelog to get entries for versions newer than current
          const parseChangelog = (content, currentVer, latestVer) => {
            const lines = content.split('\n');
            const entries = [];
            let inTargetVersion = false;
            let currentSection = '';

            for (const line of lines) {
              // Match version header like ## [2.2.0] - 2026-01-12
              const versionMatch = line.match(/^## \[(\d+\.\d+\.\d+)\]/);
              if (versionMatch) {
                const version = versionMatch[1];
                // Check if this version is newer than current
                if (compareVersions(version, currentVer) > 0) {
                  inTargetVersion = true;
                  entries.push(`📦 Version ${version}`);
                } else {
                  inTargetVersion = false;
                }
                continue;
              }

              if (inTargetVersion) {
                // Match section headers like ### Added, ### Changed, ### Fixed
                const sectionMatch = line.match(/^### (Added|Changed|Fixed|Removed|Security|Deprecated)/);
                if (sectionMatch) {
                  currentSection = sectionMatch[1];
                  continue;
                }

                // Match list items
                const itemMatch = line.match(/^- (.+)/);
                if (itemMatch && currentSection) {
                  const icon = currentSection === 'Added' ? '✨' :
                    currentSection === 'Changed' ? '🔄' :
                      currentSection === 'Fixed' ? '🐛' :
                        currentSection === 'Removed' ? '🗑️' :
                          currentSection === 'Security' ? '🔒' : '📝';
                  entries.push(`${icon} ${itemMatch[1]}`);
                }
              }
            }

            return entries.slice(0, 15); // Limit to 15 entries
          };

          // Simple version comparison function
          const compareVersions = (v1, v2) => {
            const parts1 = v1.split('.').map(Number);
            const parts2 = v2.split('.').map(Number);
            for (let i = 0; i < 3; i++) {
              if (parts1[i] > parts2[i]) return 1;
              if (parts1[i] < parts2[i]) return -1;
            }
            return 0;
          };

          // Get remote version first
          let remoteVersion = currentVersion;
          try {
            const remotePackage = execSync(`git show origin/${currentBranch}:package.json`, { cwd: appDir, encoding: 'utf8', stdio: 'pipe' });
            const remotePkg = JSON.parse(remotePackage);
            remoteVersion = remotePkg.version || currentVersion;
          } catch (e) { }

          changelog = parseChangelog(remoteChangelog, currentVersion, remoteVersion);

        } catch (changelogErr) {
          // Fallback to git commit messages if CHANGELOG.md not found
          console.log('Could not get CHANGELOG.md, falling back to git log:', changelogErr.message);
          try {
            const logOutput = execSync(`git log HEAD..origin/${currentBranch} --oneline --no-merges -n 10`, { cwd: appDir, encoding: 'utf8', stdio: 'pipe' });
            changelog = logOutput.trim().split('\n').filter(l => l.trim()).map(l => {
              // Remove commit hash prefix
              return l.replace(/^[a-f0-9]+\s+/, '');
            });
          } catch (logErr) {
            console.log('Could not get changelog:', logErr.message);
          }
        }
      }

      // Try to get remote package.json version
      let latestVersion = currentVersion;
      try {
        const remotePackage = execSync(`git show origin/${currentBranch}:package.json`, { cwd: appDir, encoding: 'utf8', stdio: 'pipe' });
        const remotePkg = JSON.parse(remotePackage);
        latestVersion = remotePkg.version || currentVersion;
      } catch (e) {
        // If can't get remote version, use current + indicator
        if (behindCount > 0) {
          latestVersion = `${currentVersion} (+${behindCount} commits)`;
        }
      }

      res.json({
        success: true,
        currentVersion,
        latestVersion,
        updateAvailable: behindCount > 0,
        commitsAhead: 0,
        commitsBehind: behindCount,
        branch: currentBranch,
        changelog
      });
    } catch (gitErr) {
      console.error('Git check error:', gitErr.message);
      res.json({
        success: false,
        error: 'Failed to check for updates: ' + gitErr.message
      });
    }
  } catch (error) {
    console.error('Error checking for updates:', error);
    res.status(500).json({ success: false, error: 'Failed to check for updates: ' + error.message });
  }
});

// Perform update
app.post('/api/system/perform-update', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    const appDir = __dirname;
    const log = [];
    const { mode } = req.body; // 'normal', 'stash', or 'force'

    const addLog = (message) => {
      console.log(`[Update] ${message}`);
      log.push(message);
    };

    addLog('Starting update process...');

    // Get current branch
    let currentBranch = 'main';
    try {
      currentBranch = (await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: appDir, timeout: 5000 })).stdout.trim();
    } catch (e) {
      currentBranch = 'main';
    }

    // Check for local changes
    let hasLocalChanges = false;
    try {
      const { stdout: statusOutput } = await execAsync('git status --porcelain', { cwd: appDir, timeout: 10000 });
      hasLocalChanges = statusOutput.trim().length > 0;
      if (hasLocalChanges) {
        addLog('Detected local changes in repository');
      }
    } catch (e) {
      // Continue anyway
    }

    // Handle based on mode
    if (mode === 'stash' && hasLocalChanges) {
      // Stash local changes
      addLog('Stashing local changes...');
      try {
        await execAsync('git stash push -m "Auto-stash before update"', { cwd: appDir, timeout: 30000 });
        addLog('Local changes stashed successfully');
      } catch (stashErr) {
        addLog(`Stash warning: ${stashErr.message}`);
      }
    } else if (mode === 'force') {
      // Force reset to remote
      addLog('Force resetting to remote version...');
      try {
        await execAsync(`git fetch origin ${currentBranch}`, { cwd: appDir, timeout: 60000 });
        await execAsync(`git reset --hard origin/${currentBranch}`, { cwd: appDir, timeout: 30000 });
        addLog('Force reset completed');
      } catch (resetErr) {
        addLog(`Reset error: ${resetErr.message}`);
        return res.json({
          success: false,
          error: 'Failed to reset repository',
          log
        });
      }
    }

    // Step 1: Git pull (skip if force mode already did reset)
    if (mode !== 'force') {
      addLog('Pulling latest changes from repository...');
      try {
        const { stdout: pullOutput, stderr: pullStderr } = await execAsync('git pull', { cwd: appDir, timeout: 120000 });
        addLog(pullOutput.trim() || pullStderr.trim() || 'Git pull completed');
      } catch (pullErr) {
        const errorMsg = pullErr.message || '';

        // Check if error is due to local changes
        if (errorMsg.includes('local changes') || errorMsg.includes('would be overwritten') || errorMsg.includes('Please commit') || errorMsg.includes('Please stash')) {
          addLog(`Git pull error: ${errorMsg}`);
          return res.json({
            success: false,
            error: 'Local changes conflict with update',
            hasConflict: true,
            conflictMessage: 'Your local changes would be overwritten by the update. Choose how to proceed:',
            log
          });
        }

        addLog(`Git pull error: ${errorMsg}`);
        return res.json({
          success: false,
          error: 'Failed to pull updates from repository',
          log
        });
      }
    }

    // Restore stashed changes if we stashed them
    if (mode === 'stash' && hasLocalChanges) {
      addLog('Restoring stashed changes...');
      try {
        await execAsync('git stash pop', { cwd: appDir, timeout: 30000 });
        addLog('Stashed changes restored');
      } catch (popErr) {
        addLog(`Warning: Could not restore stashed changes automatically. Use 'git stash pop' manually if needed.`);
      }
    }

    // Step 2: npm install
    addLog('Installing dependencies...');
    try {
      const { stdout: npmOutput, stderr: npmStderr } = await execAsync('npm install', { cwd: appDir, timeout: 300000 });
      const output = npmOutput.trim() || npmStderr.trim();
      const npmLines = output.split('\n').slice(-5).join('\n');
      addLog(npmLines || 'npm install completed');
    } catch (npmErr) {
      addLog(`npm install warning: ${npmErr.message}`);
      // Don't fail on npm warnings, continue
    }

    addLog('Update completed successfully!');
    addLog('Restarting application...');

    // Send response before restart
    res.json({
      success: true,
      message: 'Update completed successfully. Application will restart.',
      log
    });

    // Step 3: Restart PM2 (delayed to allow response to be sent)
    setTimeout(async () => {
      try {
        // Try PM2 restart first
        await execAsync('pm2 restart ozanglive', { cwd: appDir, timeout: 30000 });
        console.log('[Update] PM2 restart successful');
      } catch (pm2Err) {
        console.log('[Update] PM2 restart failed, trying alternative methods...', pm2Err.message);
        try {
          // Try PM2 with ecosystem file
          await execAsync('pm2 restart ecosystem.config.js', { cwd: appDir, timeout: 30000 });
          console.log('[Update] Ecosystem restart successful');
        } catch (e) {
          console.log('[Update] Ecosystem restart failed, process will exit for manual restart');
          // Exit process - systemd or PM2 should restart it
          process.exit(0);
        }
      }
    }, 2000);

  } catch (error) {
    console.error('Error performing update:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform update: ' + error.message,
      log: [`Error: ${error.message}`]
    });
  }
});

// Global error handler - catches any unhandled errors in routes
app.use((err, req, res, next) => {
  console.error('Global error handler caught:', err);
  console.error('Stack:', err.stack);

  // Don't leak error details in production
  const isDev = process.env.NODE_ENV !== 'production';

  // Check if headers already sent
  if (res.headersSent) {
    return next(err);
  }

  // Handle different error types
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).render('error', {
      title: 'Error',
      message: 'Session expired. Please refresh and try again.',
      error: isDev ? err : {}
    });
  }

  // Default error response
  res.status(err.status || 500);

  // Check if request expects JSON
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.json({
      success: false,
      error: isDev ? err.message : 'An unexpected error occurred'
    });
  }

  // Render error page
  res.render('error', {
    title: 'Error',
    message: isDev ? err.message : 'An unexpected error occurred',
    error: isDev ? err : {}
  });
});

// 404 handler - must be after all routes
app.use((req, res) => {
  res.status(404);

  // Check if request expects JSON
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.json({
      success: false,
      error: 'Not found'
    });
  }

  res.render('error', {
    title: '404 Not Found',
    message: 'The page you are looking for does not exist.',
    error: {}
  });
});

// REMOVED: Watchdog interval - was adding unnecessary overhead
// The app should run without constant monitoring

// Start server after database is ready
async function startServer() {
  // Wait for database to be fully initialized
  try {
    console.log('[Startup] Waiting for database initialization...');
    await waitForDbInit();

    // Verify all tables exist
    const verification = await verifyTables();
    if (!verification.success) {
      console.warn(`[Startup] Warning: Missing tables: ${verification.missingTables.join(', ')}`);
    }

    console.log('[Startup] Database ready, starting server...');

    // Initialize TitleFolder table
    try {
      await TitleFolder.initTable();
      console.log('[Startup] TitleFolder table initialized');
    } catch (err) {
      console.log('[Startup] TitleFolder table may already exist');
    }
  } catch (dbError) {
    console.error('[Startup] Database initialization error:', dbError.message);
    console.error('[Startup] Attempting to continue - tables might already exist');
  }

  httpServer = app.listen(port, '0.0.0.0', async () => {
    const ipAddresses = getLocalIpAddresses();
    console.log(`OzangLive running at:`);
    if (ipAddresses && ipAddresses.length > 0) {
      ipAddresses.forEach(ip => {
        console.log(`  http://${ip}:${port}`);
      });
    } else {
      console.log(`  http://localhost:${port}`);
    }

    // FIXED: Don't reset live streams on startup - let syncStreamStatuses handle it
    // The old code was resetting ALL live streams to offline, even if FFmpeg was still running
    // This caused status mismatch when the app restarted but streams were still active
    try {
      const liveStreams = await Stream.findAll(null, 'live');
      if (liveStreams && liveStreams.length > 0) {
        console.log(`[Startup] Found ${liveStreams.length} streams marked as 'live' in database`);
        console.log('[Startup] Status will be verified by syncStreamStatuses after scheduler init');
        // Don't reset here - syncStreamStatuses will check if FFmpeg is actually running
      }
    } catch (error) {
      console.error('[Startup] Error checking live streams:', error.message);
    }

    // Initialize scheduler
    try {
      schedulerService.init(streamingService);
    } catch (error) {
      console.error('Error initializing scheduler:', error.message);
      // Don't crash - scheduler can be retried
    }

    // Initialize recurring broadcast schedule service
    try {
      console.log('[Startup] Initializing recurring schedule service...');
      await scheduleService.init();
    } catch (error) {
      console.error('[Startup] Error initializing recurring schedule service:', error.message);
      // Don't crash - schedule service can be retried
    }

    // REMOVED: Don't sync stream statuses on startup
    // This was causing live streams to be incorrectly marked as offline
    // The periodic sync (every 15 min) will handle cleanup later
    // Status changes should only happen when:
    // 1. User manually starts/stops a stream
    // 2. FFmpeg process exits (handled by exit event)
    // 3. Duration is reached (handled by scheduler)
    console.log('[Startup] Skipping initial sync - status will be managed by events');

    console.log('OzangLive startup complete');

    // Signal to PM2 that app is ready
    if (process.send) {
      process.send('ready');
      console.log('[Startup] Sent ready signal to PM2');
    }
  });

  // Handle server errors
  httpServer.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`[Startup] Port ${port} is already in use. Please close the other application or use a different port.`);
    } else {
      console.error('[Startup] Server error:', error);
    }
  });

  // OPTIMIZED: Reduced timeouts to prevent resource exhaustion
  httpServer.timeout = 5 * 60 * 1000; // 5 minutes (was 30)
  httpServer.keepAliveTimeout = 2 * 60 * 1000; // 2 minutes (was 30)
  httpServer.headersTimeout = 65 * 1000; // 65 seconds (must be > keepAliveTimeout)

  // Limit max connections to prevent resource exhaustion on 1GB VPS
  httpServer.maxConnections = 100;
}

// Start the server
startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
