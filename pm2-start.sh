#!/bin/bash

# PM2 Start Script for OzangLive
# This script helps manage the OzangLive application with PM2

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   OzangLive PM2 Manager${NC}"
echo -e "${GREEN}========================================${NC}"

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${RED}PM2 is not installed!${NC}"
    echo -e "${YELLOW}Installing PM2 globally...${NC}"
    npm install -g pm2
fi

# Check command argument
case "$1" in
    start)
        echo -e "${GREEN}Starting OzangLive...${NC}"
        pm2 start ecosystem.config.js
        pm2 save
        ;;
    stop)
        echo -e "${YELLOW}Stopping OzangLive...${NC}"
        pm2 stop ozanglive
        ;;
    restart)
        echo -e "${YELLOW}Restarting OzangLive...${NC}"
        pm2 restart ozanglive
        ;;
    reload)
        echo -e "${YELLOW}Reloading OzangLive (zero-downtime)...${NC}"
        pm2 reload ozanglive
        ;;
    status)
        pm2 status
        ;;
    logs)
        pm2 logs ozanglive --lines 100
        ;;
    monit)
        pm2 monit
        ;;
    startup)
        echo -e "${GREEN}Setting up PM2 to start on system boot...${NC}"
        pm2 startup
        pm2 save
        echo -e "${GREEN}PM2 will now auto-start OzangLive on system boot${NC}"
        ;;
    delete)
        echo -e "${RED}Removing OzangLive from PM2...${NC}"
        pm2 delete ozanglive
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|reload|status|logs|monit|startup|delete}"
        echo ""
        echo "Commands:"
        echo "  start   - Start OzangLive with PM2"
        echo "  stop    - Stop OzangLive"
        echo "  restart - Restart OzangLive"
        echo "  reload  - Zero-downtime reload"
        echo "  status  - Show PM2 process status"
        echo "  logs    - View application logs"
        echo "  monit   - Open PM2 monitoring dashboard"
        echo "  startup - Configure PM2 to start on system boot"
        echo "  delete  - Remove OzangLive from PM2"
        exit 1
        ;;
esac

echo -e "${GREEN}Done!${NC}"
