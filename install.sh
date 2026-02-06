#!/bin/bash

set -e

# ================================
# PASSWORD VALIDATION FUNCTIONS
# ================================

# Fungsi untuk validasi password
# Returns: 0 jika password benar, 1 jika salah
validate_password() {
    local input_password="$1"
    local correct_password="1988"
    
    if [ "$input_password" = "$correct_password" ]; then
        return 0
    else
        return 1
    fi
}

# Fungsi untuk menampilkan pesan gagal
show_failure_message() {
    echo
    echo "================================"
    echo "❌ INSTALASI DIBATALKAN"
    echo "================================"
    echo
    echo "Password salah 3 kali berturut-turut."
    echo "Untuk mendapatkan password instalasi,"
    echo "silakan hubungi developer:"
    echo
    echo "📱 WhatsApp: 089621453431"
    echo
    echo "================================"
}

# Fungsi untuk meminta password dari user
# Returns: 0 jika password benar, 1 jika gagal setelah 3 percobaan
prompt_password() {
    local max_attempts=3
    local attempt=1
    local password=""
    
    # Cek apakah /dev/tty tersedia untuk input interaktif
    if [ ! -t 0 ] && [ ! -e /dev/tty ]; then
        echo "❌ Error: Tidak dapat membaca input interaktif."
        echo "   Jalankan script secara langsung, bukan via pipe."
        return 1
    fi
    
    echo "🔐 Instalasi ini memerlukan password."
    echo "   Hubungi developer untuk mendapatkan password."
    echo
    
    while [ $attempt -le $max_attempts ]; do
        printf "🔑 Masukkan password instalasi: "
        
        # Baca password dari /dev/tty (terminal langsung) untuk mendukung curl | bash
        stty -echo 2>/dev/null </dev/tty || true
        read -r password </dev/tty
        stty echo 2>/dev/null </dev/tty || true
        echo
        
        # Cek jika password kosong
        if [ -z "$password" ]; then
            remaining=$((max_attempts - attempt))
            if [ $remaining -gt 0 ]; then
                echo "❌ Password tidak boleh kosong! Sisa percobaan: $remaining"
                echo
            fi
            attempt=$((attempt + 1))
            continue
        fi
        
        if validate_password "$password"; then
            echo
            echo "✅ Password benar! Melanjutkan instalasi..."
            echo
            return 0
        else
            remaining=$((max_attempts - attempt))
            if [ $remaining -gt 0 ]; then
                echo "❌ Password salah! Sisa percobaan: $remaining"
                echo
            fi
            attempt=$((attempt + 1))
        fi
    done
    
    # Gagal setelah 3 percobaan
    show_failure_message
    return 1
}

echo "================================"
echo "   OzangLive Quick Installer   "
echo "================================"
echo

# ================================
# PASSWORD VALIDATION
# ================================
# Meminta password sebelum instalasi dimulai
if ! prompt_password; then
    exit 1
fi

# Cek apakah sudah ada instalasi sebelumnya
if [ -d "$HOME/ozanglivepublic" ] || pm2 list 2>/dev/null | grep -q "ozanglive"; then
    echo "⚠️  Instalasi OzangLive sudah ada!"
    echo
    echo "🗑️  Menghapus instalasi lama..."
    pm2 delete ozanglive 2>/dev/null || true
    pm2 save 2>/dev/null || true
    rm -rf "$HOME/ozanglivepublic"
    echo "✅ Instalasi lama dihapus"
    echo
fi

echo "🔄 Updating sistem..."
sudo apt update && sudo apt upgrade -y

# Cek dan install Node.js jika belum ada
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "✅ Node.js sudah terinstall: $(node -v)"
fi

# Cek dan install FFmpeg jika belum ada
if ! command -v ffmpeg &> /dev/null; then
    echo "🎬 Installing FFmpeg..."
    sudo apt install ffmpeg -y
else
    echo "✅ FFmpeg sudah terinstall"
fi

# Cek dan install Git jika belum ada
if ! command -v git &> /dev/null; then
    echo "📦 Installing Git..."
    sudo apt install git -y
else
    echo "✅ Git sudah terinstall"
fi

echo "📥 Clone repository..."
cd "$HOME"
git clone https://github.com/meteoradja-ytmjk/ozanglivepublic
cd ozanglivepublic

echo "⚙️ Installing dependencies..."
npm install
npm run generate-secret

echo "🕐 Setup timezone ke Asia/Jakarta..."
sudo timedatectl set-timezone Asia/Jakarta

echo "🔧 Setup firewall..."
sudo ufw allow ssh
sudo ufw allow 7575
sudo ufw --force enable

# Cek dan install PM2 jika belum ada
if ! command -v pm2 &> /dev/null; then
    echo "🚀 Installing PM2..."
    sudo npm install -g pm2
else
    echo "✅ PM2 sudah terinstall"
fi

echo "▶️ Starting OzangLive..."
pm2 start app.js --name ozanglive
pm2 save
pm2 startup

echo
echo "================================"
echo "✅ INSTALASI SELESAI!"
echo "================================"

SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "IP_SERVER")
echo
echo "🌐 URL Akses: http://$SERVER_IP:7575"
echo
echo "📋 Langkah selanjutnya:"
echo "1. Buka URL di browser"
echo "2. Buat username & password"
echo "3. Setelah membuat akun, lakukan Sign Out kemudian login kembali untuk sinkronisasi database"
echo
echo "📌 Perintah berguna:"
echo "   pm2 status         - Cek status"
echo "   pm2 logs ozanglive - Lihat logs"
echo "   pm2 restart ozanglive - Restart app"
echo "================================"
