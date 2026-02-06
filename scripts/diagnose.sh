#!/bin/bash

# OzangLive Diagnostic Script
# Run this on VPS to diagnose issues

echo "=========================================="
echo "   OzangLive Diagnostic Report"
echo "=========================================="
echo ""

# System Info
echo "=== System Info ==="
echo "Date: $(date)"
echo "Uptime: $(uptime)"
echo ""

# Memory
echo "=== Memory Usage ==="
free -h
echo ""

# Disk
echo "=== Disk Usage ==="
df -h /
echo ""

# PM2 Status
echo "=== PM2 Status ==="
pm2 status
echo ""

# PM2 Process Info
echo "=== PM2 Process Details ==="
pm2 describe ozanglive 2>/dev/null || echo "ozanglive not found in PM2"
echo ""

# Recent PM2 Logs (last 50 lines)
echo "=== Recent PM2 Logs (last 50 lines) ==="
pm2 logs ozanglive --nostream --lines 50 2>/dev/null || echo "No logs available"
echo ""

# Recent Error Logs
echo "=== Recent Error Logs (last 30 lines) ==="
pm2 logs ozanglive --err --nostream --lines 30 2>/dev/null || echo "No error logs"
echo ""

# Check if app is responding
echo "=== Health Check ==="
curl -s -o /dev/null -w "HTTP Status: %{http_code}\nResponse Time: %{time_total}s\n" --connect-timeout 10 --max-time 30 http://localhost:7575/health 2>/dev/null || echo "Health check failed - app not responding"
echo ""

# Check active connections
echo "=== Active Connections on Port 7575 ==="
netstat -an | grep :7575 | head -20 || ss -an | grep :7575 | head -20
echo ""

# Check FFmpeg processes
echo "=== FFmpeg Processes ==="
ps aux | grep ffmpeg | grep -v grep || echo "No FFmpeg processes running"
echo ""

# Node.js processes
echo "=== Node.js Processes ==="
ps aux | grep node | grep -v grep
echo ""

# Check app.log
echo "=== Recent App Logs (last 30 lines) ==="
tail -30 ./logs/app.log 2>/dev/null || echo "No app.log found"
echo ""

echo "=========================================="
echo "   Diagnostic Complete"
echo "=========================================="
echo ""
echo "If app is not responding, try:"
echo "  pm2 restart ozanglive"
echo ""
echo "To see live logs:"
echo "  pm2 logs ozanglive"
