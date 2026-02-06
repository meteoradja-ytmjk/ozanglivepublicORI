#!/bin/bash

# OzangLive Health Monitor Script
# Run this as a cron job every 5 minutes:
# */5 * * * * /path/to/ozanglive/scripts/health-monitor.sh >> /path/to/ozanglive/logs/health-monitor.log 2>&1

# Configuration
APP_URL="http://localhost:7575/health"
APP_NAME="ozanglive"
MAX_RETRIES=3
RETRY_DELAY=10
LOG_FILE="./logs/health-monitor.log"

# Colors (for terminal output)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Timestamp
timestamp() {
    date "+%Y-%m-%d %H:%M:%S"
}

log() {
    echo "[$(timestamp)] $1"
}

# Check if PM2 is running the app
check_pm2_status() {
    pm2 describe $APP_NAME > /dev/null 2>&1
    return $?
}

# Check HTTP health endpoint
check_health() {
    local response
    response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 --max-time 30 "$APP_URL")
    echo "$response"
}

# Restart the application
restart_app() {
    log "Restarting $APP_NAME..."
    pm2 restart $APP_NAME
    sleep 5
}

# Main health check logic
main() {
    log "Starting health check..."
    
    # Check if PM2 process exists
    if ! check_pm2_status; then
        log "ERROR: $APP_NAME not found in PM2. Starting..."
        cd "$(dirname "$0")/.." || exit 1
        pm2 start ecosystem.config.js
        pm2 save
        exit 0
    fi
    
    # Check health endpoint with retries
    for i in $(seq 1 $MAX_RETRIES); do
        http_code=$(check_health)
        
        if [ "$http_code" = "200" ]; then
            log "Health check PASSED (HTTP $http_code)"
            exit 0
        elif [ "$http_code" = "503" ]; then
            log "WARNING: Service degraded (HTTP $http_code)"
            # Don't restart on degraded, just log
            exit 0
        else
            log "WARNING: Health check failed (HTTP $http_code), attempt $i/$MAX_RETRIES"
            
            if [ $i -lt $MAX_RETRIES ]; then
                sleep $RETRY_DELAY
            fi
        fi
    done
    
    # All retries failed - restart
    log "ERROR: Health check failed after $MAX_RETRIES attempts. Restarting..."
    restart_app
    
    # Verify restart worked
    sleep 10
    http_code=$(check_health)
    
    if [ "$http_code" = "200" ]; then
        log "Restart successful, health check PASSED"
    else
        log "ERROR: Restart may have failed, health check returned HTTP $http_code"
    fi
}

# Run main function
main
