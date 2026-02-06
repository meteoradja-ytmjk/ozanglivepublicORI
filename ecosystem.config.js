/**
 * PM2 Ecosystem Configuration
 * 
 * PM2 is a process manager for Node.js applications that provides:
 * - Auto-restart on crash
 * - Load balancing (cluster mode)
 * - Log management
 * - Memory monitoring
 * - Zero-downtime reload
 * 
 * Usage:
 *   Install PM2: npm install -g pm2
 *   Start app:   pm2 start ecosystem.config.js
 *   Stop app:    pm2 stop ozanglive
 *   Restart:     pm2 restart ozanglive
 *   View logs:   pm2 logs ozanglive
 *   Monitor:     pm2 monit
 *   Status:      pm2 status
 *   
 * Auto-start on system boot:
 *   pm2 startup
 *   pm2 save
 */

module.exports = {
  apps: [
    {
      name: 'ozanglive',
      script: 'app.js',
      
      // Instance configuration
      instances: 1, // Single instance (streaming apps shouldn't use cluster mode)
      exec_mode: 'fork', // Fork mode for single instance
      
      // Auto-restart configuration - BALANCED for stability
      autorestart: true,
      watch: false, // Don't watch for file changes in production
      max_restarts: 100, // Allow many restarts (app should be resilient)
      min_uptime: '10s', // Wait 10 seconds before considering app stable
      restart_delay: 3000, // Wait 3 seconds between restarts
      
      // Memory management - CONSERVATIVE for 1GB VPS
      // CRITICAL: Set lower to prevent OOM killer from killing the process
      max_memory_restart: '600M', // Restart at 600MB to leave room for system
      
      // Environment variables
      env: {
        NODE_ENV: 'production',
        PORT: 7575,
        // CRITICAL: Disable Node.js memory warnings that can cause issues
        NODE_OPTIONS: '--max-old-space-size=512 --no-warnings'
      },
      
      env_development: {
        NODE_ENV: 'development',
        PORT: 7575
      },
      
      // Logging - OPTIMIZED to prevent disk space issues
      log_file: './logs/pm2-combined.log',
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_size: '50M', // Rotate logs at 50MB
      retain: 3, // Keep only 3 log files
      
      // Graceful shutdown
      kill_timeout: 20000, // 20 seconds to allow cleanup
      listen_timeout: 10000, // 10 seconds to start listening
      
      // Crash handling - STABLE recovery
      exp_backoff_restart_delay: 100, // Start with 100ms delay
      
      // Node.js arguments - REMOVED from here, using NODE_OPTIONS instead
      // This prevents issues with argument parsing
      node_args: [],
      
      // Cron restart - ENABLED: restart every day at 4 AM WIB to prevent memory buildup
      cron_restart: '0 4 * * *',
      
      // Source map support for better error traces
      source_map_support: true,
      
      // CRITICAL: Don't combine with other processes
      combine_logs: false,
      
      // CRITICAL: Increase wait time for ready signal
      wait_ready: true,
      
      // CRITICAL: Don't kill on SIGINT during development
      treekill: true
    }
  ]
};
