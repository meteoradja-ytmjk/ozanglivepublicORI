#!/bin/bash

# ===========================================
# VPS Cleanup Script for StreamFlow
# Jalankan sebelum fresh install
# Usage: chmod +x cleanup-vps.sh && sudo ./cleanup-vps.sh
# ===========================================

set -e

echo "=========================================="
echo "  StreamFlow VPS Cleanup Script"
echo "=========================================="
echo ""

# Konfirmasi
read -p "PERINGATAN: Script ini akan menghapus semua data aplikasi. Lanjutkan? (y/N): " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "Dibatalkan."
    exit 0
fi

# Deteksi lokasi aplikasi
APP_DIR=$(pwd)
if [[ "$APP_DIR" == *"streamflow"* ]] || [ -f "$APP_DIR/app.js" ]; then
    echo "Detected app directory: $APP_DIR"
else
    APP_DIR="/var/www/streamflow"
    echo "Using default app directory: $APP_DIR"
fi

echo ""
echo "[1/7] Menghentikan PM2 processes..."
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true
pm2 kill 2>/dev/null || true

echo "[2/7] Menghapus PM2 startup..."
pm2 unstartup 2>/dev/null || true
pm2 save --force 2>/dev/null || true

echo "[3/7] Membersihkan PM2 logs dan dump..."
pm2 flush 2>/dev/null || true
rm -rf ~/.pm2/logs/* 2>/dev/null || true
rm -rf ~/.pm2/dump.pm2 2>/dev/null || true

echo "[4/7] Menghapus database files..."
rm -f "$APP_DIR/db/"*.db 2>/dev/null || true
rm -f "$APP_DIR/db/"*.db-shm 2>/dev/null || true
rm -f "$APP_DIR/db/"*.db-wal 2>/dev/null || true

echo "[5/7] Menghapus uploaded files..."
rm -rf "$APP_DIR/public/uploads/"* 2>/dev/null || true

echo "[6/7] Menghapus node_modules..."
rm -rf "$APP_DIR/node_modules" 2>/dev/null || true

echo "[7/7] Membersihkan npm cache..."
npm cache clean --force 2>/dev/null || true

echo ""
echo "=========================================="
echo "  Cleanup selesai!"
echo "=========================================="
echo ""
echo "Opsi selanjutnya:"
echo "  1. Fresh install di folder yang sama:"
echo "     git pull && npm install && cp .env.example .env"
echo ""
echo "  2. Hapus folder dan clone ulang:"
echo "     cd .. && rm -rf streamflow"
echo "     git clone <repo-url> streamflow"
echo "     cd streamflow && npm install"
echo ""
echo "  3. Jalankan aplikasi:"
echo "     npm start atau pm2 start ecosystem.config.js"
echo ""
