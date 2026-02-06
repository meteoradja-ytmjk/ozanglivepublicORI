const fs = require('fs');
const path = require('path');
const util = require('util');

const logDir = path.join(process.cwd(), 'logs');
const logFilePath = path.join(logDir, 'app.log');

// Ensure log directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Store original console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;
const originalConsoleDebug = console.debug;

// Log buffer for async writing - ULTRA OPTIMIZED for minimal CPU
let logBuffer = [];
let isWriting = false;
const MAX_BUFFER_SIZE = 500; // ULTRA: Flush after 500 entries
const FLUSH_INTERVAL = 60000; // ULTRA: Flush every 60 seconds - minimal disk I/O

/**
 * Write buffered logs to file asynchronously
 * This prevents blocking the event loop
 */
async function flushLogBuffer() {
  if (isWriting || logBuffer.length === 0) return;
  
  isWriting = true;
  const logsToWrite = logBuffer.splice(0, logBuffer.length);
  
  try {
    const content = logsToWrite.join('');
    await fs.promises.appendFile(logFilePath, content);
  } catch (err) {
    // If write fails, don't crash - just log to console
    originalConsoleError('Failed to write to log file:', err.message);
  } finally {
    isWriting = false;
  }
}

/**
 * Add log entry to buffer (non-blocking)
 */
function writeToLogFile(level, ...args) {
  try {
    const timestamp = new Date().toISOString();
    const message = args.map(arg => {
      if (typeof arg === 'string') return arg;
      try {
        return util.inspect(arg, { depth: 3, colors: false, maxStringLength: 1000 });
      } catch {
        return '[Object]';
      }
    }).join(' ');
    
    const logEntry = `${timestamp} [${level.toUpperCase()}] ${message}\n`;
    logBuffer.push(logEntry);
    
    // Flush if buffer is full
    if (logBuffer.length >= MAX_BUFFER_SIZE) {
      flushLogBuffer();
    }
  } catch (err) {
    // Never crash on logging errors
  }
}

// Periodic flush - interval will be tracked by app.js global override
const flushIntervalId = setInterval(() => {
  flushLogBuffer();
}, FLUSH_INTERVAL);

// Ensure interval is cleaned up on process exit
process.on('exit', () => {
  clearInterval(flushIntervalId);
});

// Flush on exit
process.on('beforeExit', () => {
  if (logBuffer.length > 0) {
    try {
      fs.appendFileSync(logFilePath, logBuffer.join(''));
      logBuffer = [];
    } catch (err) {
      // Ignore
    }
  }
});

// Override console methods
console.log = (...args) => {
  originalConsoleLog.apply(console, args);
  writeToLogFile('log', ...args);
};

console.error = (...args) => {
  originalConsoleError.apply(console, args);
  writeToLogFile('error', ...args);
};

console.warn = (...args) => {
  originalConsoleWarn.apply(console, args);
  writeToLogFile('warn', ...args);
};

console.info = (...args) => {
  originalConsoleInfo.apply(console, args);
  writeToLogFile('info', ...args);
};

console.debug = (...args) => {
  originalConsoleDebug.apply(console, args);
  writeToLogFile('debug', ...args);
};

console.log('Logger initialized (async mode). Output will be written to console and logs/app.log');
