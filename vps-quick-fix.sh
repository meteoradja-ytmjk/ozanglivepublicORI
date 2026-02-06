#!/bin/bash
# Quick Fix Script for OzangLive VPS Access Issues

echo "=================================="
echo "OzangLive Quick Fix Script"
echo "=================================="
echo ""

cd ~/ozanglivepublic || exit 1

# Fix 1: Ensure .env exists
echo "[1/5] Checking .env file..."
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cp .env.example .env
    
    # Generate SESSION_SECRET
    echo "Generating SESSION_SECRET..."
    node generate-secret.js
    
    echo "✓ .env file created"
else
    echo "✓ .env file exists"
    
    # Check if SESSION_SECRET exists
    if ! grep -q "SESSION_SECRET=" .env; then
        echo "Adding SESSION_SECRET..."
        node generate-secret.js
    fi
fi
echo ""

# Fix 2: Kill any process using port 7575
echo "[2/5] Checking port 7575..."
if sudo fuser 7575/tcp 2>/dev/null; then
    echo "Killing process on port 7575..."
    sudo fuser -k 7575/tcp
    sleep 2
    echo "✓ Port cleared"
else
    echo "✓ Port is free"
fi
echo ""

# Fix 3: Ensure firewall allows port 7575
echo "[3/5] Configuring firewall..."
sudo ufw allow 7575/tcp 2>/dev/null
sudo ufw allow ssh 2>/dev/null
echo "✓ Firewall configured"
echo ""

# Fix 4: Restart PM2
echo "[4/5] Restarting application..."
pm2 stop ozanglive 2>/dev/null
pm2 delete ozanglive 2>/dev/null
pm2 start ecosystem.config.js
pm2 save
echo "✓ Application restarted"
echo ""

# Fix 5: Verify
echo "[5/5] Verifying application..."
sleep 3
pm2 status

echo ""
echo "=================================="
echo "Quick Fix Complete!"
echo "=================================="
echo ""
echo "Testing local access..."
sleep 2

if curl -s -o /dev/null -w "%{http_code}" http://localhost:7575 | grep -q "200\|302\|301"; then
    echo "✓ Application is running!"
    echo ""
    echo "Access your application at:"
    echo "http://$(curl -s ifconfig.me):7575"
else
    echo "✗ Application may not be running correctly"
    echo ""
    echo "Check logs with: pm2 logs ozanglive"
fi
echo ""
