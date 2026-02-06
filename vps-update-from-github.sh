#!/bin/bash
# Update VPS dengan kode terbaru dari GitHub

echo "=========================================="
echo "Updating OzangLive from GitHub"
echo "=========================================="
echo ""

cd ~/ozanglivepublic || exit 1

echo "1. Stopping application..."
pm2 stop ozanglive

echo ""
echo "2. Pulling latest changes from GitHub..."
git fetch origin
git reset --hard origin/main

echo ""
echo "3. Installing dependencies (if any new)..."
npm install

echo ""
echo "4. Starting application..."
pm2 start ozanglive

echo ""
echo "5. Checking status..."
sleep 5
pm2 status

echo ""
echo "6. Checking port 7575..."
sudo ss -tulpn | grep 7575

echo ""
echo "7. Recent logs..."
pm2 logs ozanglive --lines 20 --nostream

echo ""
echo "=========================================="
echo "Update complete!"
echo "Application should be running at:"
echo "http://$(curl -s ifconfig.me):7575"
echo "=========================================="
