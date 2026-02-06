#!/bin/bash

echo "================================"
echo "   OzangLive Uninstaller   "
echo "================================"
echo

echo "🛑 Stopping OzangLive..."
pm2 stop ozanglive 2>/dev/null || true
pm2 delete ozanglive 2>/dev/null || true
pm2 save 2>/dev/null || true

echo "🗑️  Menghapus folder ozanglivepublic..."
rm -rf "$HOME/ozanglivepublic"

echo "🧹 Membersihkan PM2..."
pm2 kill 2>/dev/null || true

echo "🔥 Menghapus PM2..."
sudo npm uninstall -g pm2 2>/dev/null || true

echo "📦 Menghapus Node.js..."
sudo apt remove -y nodejs 2>/dev/null || true
sudo apt autoremove -y

echo "🎬 Menghapus FFmpeg..."
sudo apt remove -y ffmpeg 2>/dev/null || true
sudo apt autoremove -y

echo "🔧 Reset firewall..."
sudo ufw delete allow 7575 2>/dev/null || true

echo "🧹 Membersihkan cache..."
sudo apt clean
sudo apt autoclean

echo
echo "================================"
echo "✅ UNINSTALL SELESAI!"
echo "================================"
echo
echo "VPS sudah bersih dari OzangLive."
echo "Untuk install ulang, jalankan:"
echo "curl -fsSL https://raw.githubusercontent.com/meteoradja-ytmjk/ozanglivepublic/main/install.sh | bash"
echo "================================"
