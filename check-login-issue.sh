#!/bin/bash
# Check and Fix Login Issue

echo "=========================================="
echo "OzangLive Login Diagnostic"
echo "=========================================="
echo ""

cd ~/ozanglivepublic || exit 1

echo "1. Checking if database exists..."
if [ -f "db/streamflow.db" ]; then
    echo "✅ Database file exists"
else
    echo "❌ Database file NOT found!"
    exit 1
fi

echo ""
echo "2. Checking users in database..."
sqlite3 db/streamflow.db "SELECT id, username, user_role, status FROM users;" 2>/dev/null || {
    echo "❌ Error reading database"
    exit 1
}

echo ""
echo "3. Checking admin user..."
sqlite3 db/streamflow.db "SELECT username, user_role, status FROM users WHERE user_role='admin';" 2>/dev/null

echo ""
echo "4. Checking application logs for login errors..."
pm2 logs ozanglive --lines 50 --nostream | grep -i "login\|auth\|password" || echo "No login-related errors found"

echo ""
echo "=========================================="
echo "Diagnostic complete!"
echo "=========================================="
