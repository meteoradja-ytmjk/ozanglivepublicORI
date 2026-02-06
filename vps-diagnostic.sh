#!/bin/bash
# VPS Diagnostic Script for OzangLive
# This script checks common issues that prevent VPS access

echo "=== OzangLive VPS Diagnostic ==="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}[1/7] PM2${NC}"
if command -v pm2 &> /dev/null; then
    pm2 status
    echo ""
    echo "Logs:"
    pm2 logs ozanglive --lines 20 --nostream
else
    echo -e "${RED}PM2 tidak ada${NC}"
fi
echo ""

echo -e "${YELLOW}[2/7] .env${NC}"
if [ -f ~/ozanglivepublic/.env ]; then
    echo -e "${GREEN}✓ Ada${NC}"
    cat ~/ozanglivepublic/.env
else
    echo -e "${RED}✗ Tidak ada${NC}"
    echo "Fix: cd ~/ozanglivepublic && node generate-secret.js"
fi
echo ""

echo -e "${YELLOW}[3/7] Port 7575${NC}"
if command -v netstat &> /dev/null; then
    netstat -tulpn 2>/dev/null | grep 7575 || echo -e "${RED}✗ Mati${NC}"
elif command -v ss &> /dev/null; then
    ss -tulpn 2>/dev/null | grep 7575 || echo -e "${RED}✗ Mati${NC}"
else
    echo "Skip (netstat/ss tidak ada)"
fi
echo ""

echo -e "${YELLOW}[4/7] Firewall${NC}"
if command -v ufw &> /dev/null; then
    sudo ufw status
else
    echo "UFW tidak ada"
fi
echo ""

echo -e "${YELLOW}[5/7] Akses Lokal${NC}"
if command -v curl &> /dev/null; then
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:7575 | grep -q "200\|302\|301"; then
        echo -e "${GREEN}✓ OK${NC}"
    else
        echo -e "${RED}✗ Gagal${NC}"
        curl -v http://localhost:7575 2>&1 | head -20
    fi
else
    echo "Skip (curl tidak ada)"
fi
echo ""

echo -e "${YELLOW}[6/7] Memory${NC}"
free -h
echo ""

echo -e "${YELLOW}[7/7] OOM Killer${NC}"
dmesg | grep -i "killed process" | tail -5 || echo "✓ Tidak ada"
echo ""

echo ""
echo "=== Selesai ==="
echo ""
echo "Fix:"
echo "1. .env: cd ~/ozanglivepublic && node generate-secret.js && pm2 restart ozanglive"
echo "2. Port: pm2 restart ozanglive"
echo "3. Firewall: sudo ufw allow 7575/tcp && sudo ufw reload"
echo "4. Port busy: sudo fuser -k 7575/tcp && pm2 restart ozanglive"
echo ""
