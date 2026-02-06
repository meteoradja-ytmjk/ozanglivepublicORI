const si = require('systeminformation');
const os = require('os');
const { exec } = require('child_process');

let previousNetworkData = null;
let previousTimestamp = null;

// Cache for system stats - ULTRA OPTIMIZED for minimal CPU
let cachedStats = null;
let lastCacheTime = 0;
const CACHE_TTL = 120000; // Cache for 2 minutes (was 1 minute)

// CPU tracking for Node.js process
let lastNodeCpuUsage = null;
let lastNodeCpuTime = 0;

// Cache for FFmpeg CPU - ULTRA OPTIMIZED
let cachedFFmpegCpu = 0;
let lastFFmpegCheck = 0;
const FFMPEG_CHECK_INTERVAL = 120000; // Check FFmpeg CPU every 2 minutes (was 30 seconds)

// Cache for active stream count (lightweight alternative to FFmpeg CPU check)
let cachedActiveStreams = 0;
let lastActiveStreamCheck = 0;
const ACTIVE_STREAM_CHECK_INTERVAL = 30000; // Check active streams every 30 seconds

/**
 * Wrap a promise with timeout to prevent hanging
 */
function withTimeout(promise, ms, fallback) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms))
  ]);
}

/**
 * Get Node.js process CPU usage (lightweight)
 */
function getNodeCpuUsage() {
  try {
    const now = Date.now();
    const currentUsage = process.cpuUsage();
    
    if (!lastNodeCpuUsage || !lastNodeCpuTime) {
      lastNodeCpuUsage = currentUsage;
      lastNodeCpuTime = now;
      return 0;
    }
    
    const timeDelta = (now - lastNodeCpuTime) * 1000; // microseconds
    if (timeDelta <= 0) return 0;
    
    const userDelta = currentUsage.user - lastNodeCpuUsage.user;
    const systemDelta = currentUsage.system - lastNodeCpuUsage.system;
    const totalDelta = userDelta + systemDelta;
    
    const cpuCount = os.cpus().length;
    const cpuPercent = (totalDelta / timeDelta) * 100 / cpuCount;
    
    lastNodeCpuUsage = currentUsage;
    lastNodeCpuTime = now;
    
    return Math.max(0, Math.min(100, cpuPercent));
  } catch (e) {
    return 0;
  }
}

/**
 * Get active stream count (lightweight - no external process spawn)
 * This is used to estimate FFmpeg CPU without expensive process queries
 */
function getActiveStreamCount() {
  const now = Date.now();
  
  // Return cached value if fresh
  if ((now - lastActiveStreamCheck) < ACTIVE_STREAM_CHECK_INTERVAL) {
    return cachedActiveStreams;
  }
  
  try {
    // Try to get from streamingService if available
    const streamingService = require('./streamingService');
    if (streamingService && typeof streamingService.getActiveStreams === 'function') {
      const activeStreams = streamingService.getActiveStreams();
      cachedActiveStreams = Array.isArray(activeStreams) ? activeStreams.length : 0;
    }
  } catch (e) {
    // Ignore - streamingService may not be loaded yet
  }
  
  lastActiveStreamCheck = now;
  return cachedActiveStreams;
}

/**
 * Get FFmpeg processes CPU usage - ULTRA OPTIMIZED
 * Uses estimation based on active stream count instead of expensive process queries
 * Each stream in copy mode uses ~1-2% CPU, encoding mode uses ~5-10% CPU
 */
async function getFFmpegCpuUsage() {
  const now = Date.now();
  
  // Return cached value if fresh
  if ((now - lastFFmpegCheck) < FFMPEG_CHECK_INTERVAL) {
    return cachedFFmpegCpu;
  }
  
  // OPTIMIZED: Use lightweight estimation instead of spawning external processes
  // This saves significant CPU by avoiding exec() calls
  const activeStreams = getActiveStreamCount();
  
  // Estimate: ~2% CPU per stream in copy mode (which is the default)
  // This is a reasonable estimate for FFmpeg with -c copy
  const estimatedCpu = activeStreams * 2;
  
  cachedFFmpegCpu = Math.min(100, estimatedCpu);
  lastFFmpegCheck = now;
  
  return cachedFFmpegCpu;
}

/**
 * Get combined CPU usage (Node.js + FFmpeg only)
 * This excludes browser, IDE, and other system processes
 */
async function getStreamingCpuUsage() {
  const nodeCpu = getNodeCpuUsage();
  const ffmpegCpu = await getFFmpegCpuUsage();
  
  return Math.round(nodeCpu + ffmpegCpu);
}

async function getSystemStats() {
  // Return cached stats if fresh
  const now = Date.now();
  if (cachedStats && (now - lastCacheTime) < CACHE_TTL) {
    return { ...cachedStats, timestamp: now };
  }
  
  try {
    // Get streaming CPU (Node.js + FFmpeg only)
    const cpuUsage = await getStreamingCpuUsage();
    
    // Get memory and network with timeout
    const [memData, networkData, diskData] = await Promise.all([
      withTimeout(si.mem(), 2000, { total: 0, active: 0, available: 0 }),
      withTimeout(si.networkStats(), 2000, []),
      withTimeout(getDiskUsage(), 2000, { total: "0 GB", used: "0 GB", free: "0 GB", usagePercent: 0, drive: "N/A" })
    ]);
    
    const networkSpeed = calculateNetworkSpeed(networkData);
    
    const formatMemory = (bytes) => {
      if (bytes >= 1073741824) {
        return (bytes / 1073741824).toFixed(2) + " GB";
      } else {
        return (bytes / 1048576).toFixed(2) + " MB";
      }
    };
    
    const stats = {
      cpu: {
        usage: cpuUsage,
        cores: os.cpus().length
      },
      memory: {
        total: formatMemory(memData.total),
        used: formatMemory(memData.active),
        free: formatMemory(memData.available),
        usagePercent: memData.total > 0 ? Math.round((memData.active / memData.total) * 100) : 0
      },
      network: networkSpeed,
      disk: diskData,
      platform: process.platform,
      timestamp: now
    };
    
    // Update cache
    cachedStats = stats;
    lastCacheTime = now;
    
    return stats;
  } catch (error) {
    console.error('Error getting system stats:', error.message);
    
    if (cachedStats) {
      return { ...cachedStats, timestamp: Date.now() };
    }
    
    return {
      cpu: { usage: 0, cores: os.cpus().length },
      memory: { total: "0 GB", used: "0 GB", free: "0 GB", usagePercent: 0 },
      network: { download: 0, upload: 0, downloadFormatted: '0 Mbps', uploadFormatted: '0 Mbps' },
      disk: { total: "0 GB", used: "0 GB", free: "0 GB", usagePercent: 0, drive: "N/A" },
      platform: process.platform,
      timestamp: Date.now()
    };
  }
}

function calculateNetworkSpeed(networkData) {
  const currentTimestamp = Date.now();
  
  if (!previousNetworkData || !previousTimestamp) {
    previousNetworkData = networkData;
    previousTimestamp = currentTimestamp;
    return {
      download: 0,
      upload: 0,
      downloadFormatted: '0 Mbps',
      uploadFormatted: '0 Mbps'
    };
  }
  
  const timeDiff = (currentTimestamp - previousTimestamp) / 1000;
  
  const currentTotal = networkData
    .filter(iface => !iface.iface.includes('lo') && !iface.iface.includes('Loopback'))
    .reduce((acc, iface) => ({
      rx_bytes: acc.rx_bytes + (iface.rx_bytes || 0),
      tx_bytes: acc.tx_bytes + (iface.tx_bytes || 0)
    }), { rx_bytes: 0, tx_bytes: 0 });
  
  const previousTotal = previousNetworkData
    .filter(iface => !iface.iface.includes('lo') && !iface.iface.includes('Loopback'))
    .reduce((acc, iface) => ({
      rx_bytes: acc.rx_bytes + (iface.rx_bytes || 0),
      tx_bytes: acc.tx_bytes + (iface.tx_bytes || 0)
    }), { rx_bytes: 0, tx_bytes: 0 });
  
  const downloadBps = Math.max(0, (currentTotal.rx_bytes - previousTotal.rx_bytes) / timeDiff);
  const uploadBps = Math.max(0, (currentTotal.tx_bytes - previousTotal.tx_bytes) / timeDiff);
  
  const downloadMbps = (downloadBps * 8) / (1024 * 1024);
  const uploadMbps = (uploadBps * 8) / (1024 * 1024);
  
  previousNetworkData = networkData;
  previousTimestamp = currentTimestamp;
  
  return {
    download: downloadMbps,
    upload: uploadMbps,
    downloadFormatted: formatSpeed(downloadMbps),
    uploadFormatted: formatSpeed(uploadMbps)
  };
}

function formatSpeed(speedMbps) {
  if (speedMbps >= 1000) {
    return (speedMbps / 1000).toFixed(2) + ' Gbps';
  } else if (speedMbps >= 1) {
    return speedMbps.toFixed(2) + ' Mbps';
  } else {
    return (speedMbps * 1000).toFixed(0) + ' Kbps';
  }
}

async function getDiskUsage() {
  try {
    const fsSize = await si.fsSize();
    const platform = process.platform;
    
    let targetDisk;
    
    if (platform === 'win32') {
      const currentDrive = process.cwd().charAt(0).toUpperCase();
      targetDisk = fsSize.find(disk => disk.mount.charAt(0).toUpperCase() === currentDrive);
      
      if (!targetDisk) {
        targetDisk = fsSize.find(disk => disk.mount.charAt(0).toUpperCase() === 'C');
      }
    } else {
      targetDisk = fsSize.find(disk => disk.mount === '/');
    }
    
    if (!targetDisk) {
      targetDisk = fsSize[0];
    }
    
    if (!targetDisk) {
      return {
        total: "0 GB",
        used: "0 GB", 
        free: "0 GB",
        usagePercent: 0,
        drive: "N/A"
      };
    }
    
    const formatDisk = (bytes) => {
      if (bytes >= 1099511627776) {
        return (bytes / 1099511627776).toFixed(2) + " TB";
      } else if (bytes >= 1073741824) {
        return (bytes / 1073741824).toFixed(2) + " GB";
      } else {
        return (bytes / 1048576).toFixed(2) + " MB";
      }
    };
    
    const usagePercent = targetDisk.size > 0 ? 
      Math.round(((targetDisk.size - targetDisk.available) / targetDisk.size) * 100) : 0;
    
    return {
      total: formatDisk(targetDisk.size),
      used: formatDisk(targetDisk.size - targetDisk.available),
      free: formatDisk(targetDisk.available),
      usagePercent: usagePercent,
      drive: targetDisk.mount || targetDisk.fs || "Unknown"
    };
  } catch (error) {
    console.error('Error getting disk usage:', error);
    return {
      total: "0 GB",
      used: "0 GB",
      free: "0 GB", 
      usagePercent: 0,
      drive: "N/A"
    };
  }
}

module.exports = { getSystemStats };
