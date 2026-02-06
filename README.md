<p align="center">
  <img src="public/images/logo.png" alt="OzangLive Logo" width="120">
  <h1 align="center">OzangLive</h1>
  <p align="center">
    <strong>Cloud Streaming Solution</strong><br>
    Platform streaming berbasis cloud dengan FFmpeg untuk live streaming ke berbagai platform
  </p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-2.2.0-blue.svg" alt="Version">
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg" alt="Node">
  <img src="https://img.shields.io/badge/platform-linux%20%7C%20docker-lightgrey.svg" alt="Platform">
  <img src="https://img.shields.io/badge/license-MIT-orange.svg" alt="License">
</p>

<p align="center">
  <a href="#-fitur">Fitur</a> •
  <a href="#-instalasi">Instalasi</a> •
  <a href="#-konfigurasi">Konfigurasi</a> •
  <a href="#-importexport--backup">Import/Export</a> •
  <a href="#-youtube-api-setup">YouTube API</a> •
  <a href="#-dokumentasi">Dokumentasi</a>
</p>

---

## 📋 Daftar Isi

- [Fitur](#-fitur)
- [Instalasi](#-instalasi)
  - [Quick Install](#quick-install-vps-ubuntudebian)
  - [Manual Installation](#manual-installation)
  - [Docker Installation](#docker-installation)
- [Update Aplikasi](#-update-aplikasi)
- [Konfigurasi](#-konfigurasi)
- [Import/Export & Backup](#-importexport--backup)
- [YouTube API Setup](#-youtube-api-setup)
- [PM2 Commands](#-pm2-commands)
- [Troubleshooting](#-troubleshooting)
- [System Requirements](#-system-requirements)

---

## ✨ Fitur

<table>
<tr>
<td width="50%">

### 🎥 Streaming
- Multi-Platform (YouTube, Facebook, Twitch, TikTok, Instagram, Shopee Live, Restream.io)
- Scheduled Streaming (sekali, harian, mingguan)
- Loop Video & Audio Overlay
- Playlist Support

</td>
<td width="50%">

### 📺 YouTube Integration
- YouTube Sync & Multi-Account
- Broadcast Templates
- Recurring Schedules (harian/mingguan)
- Auto Status Sync

</td>
</tr>
<tr>
<td width="50%">

### 📁 Media Management
- Video Gallery dengan Upload Queue
- Multiple File Upload
- Google Drive Import
- Thumbnail Support

</td>
<td width="50%">

### 💾 Backup & Restore
- Comprehensive Backup (semua data)
- Selective Export
- Easy Import dengan Duplicate Handling
- **Backward Compatibility** - Auto-detect & convert old format
- Migration Helper untuk format lama

</td>
</tr>
<tr>
<td width="50%">

### 👥 User Management
- Multi-User (Admin/Member)
- Live Limit per User
- Dashboard Monitoring
- Stream History

</td>
<td width="50%">

### 🔒 Security
- Session Management
- Rate Limiting
- CSRF Protection

</td>
</tr>
</table>

---

## 🚀 Instalasi

### Quick Install (VPS Ubuntu/Debian)

```bash
curl -fsSL https://raw.githubusercontent.com/meteoradja-ytmjk/ozanglivepublic/main/install.sh | bash
```
### Untuk reset VPS jika Sebelumnya sudah ada / Terinstal 

```bash
curl -fsSL https://raw.githubusercontent.com/meteoradja-ytmjk/ozanglivepublic/main/uninstall.sh | bash
```

> 💡 **Installer otomatis mendeteksi** jika sudah ada instalasi sebelumnya dan memberikan pilihan:
> - **Install ulang** - Hapus instalasi lama dan install fresh
> - **Update saja** - Pertahankan data, update kode terbaru
> - **Batalkan** - Tidak melakukan apa-apa
> 💡 Installer otomatis mendeteksi instalasi sebelumnya dan memberikan pilihan: **Install ulang**, **Update saja**, atau **Batalkan**

### Manual Installation

```bash
# Update sistem & install dependencies
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs ffmpeg git

# Clone & setup
git clone https://github.com/meteoradja-ytmjk/ozanglivepublic
cd ozanglivepublic
npm install
npm run generate-secret

# Setup firewall
sudo ufw allow ssh && sudo ufw allow 7575 && sudo ufw --force enable

# Start dengan PM2
sudo npm install -g pm2
pm2 start ecosystem.config.js
pm2 save && pm2 startup
```

### Docker Installation

```bash
git clone https://github.com/meteoradja-ytmjk/ozanglivepublic
cd ozanglivepublic
cp .env.example .env
node generate-secret.js
docker-compose up -d
```

---

## 🔄 Update Aplikasi

### Quick Update

```bash
cd ~/ozanglivepublic && git pull && npm install && pm2 restart ozanglive
```
### Jika adamasalah di Quick Update
```bash
cd ~/ozanglivepublic
git reset --hard HEAD
git pull
npm install
pm2 restart ozanglive
```

### Fresh Install (Replace Total)
```bash
cd ~/ozanglivepublic && git fetch origin && git reset --hard origin/main && npm install && pm2 restart ozanglive
```

> ⚠️ Backup database sebelum menjalankan: `cp db/streamflow.db db/streamflow.db.backup`

---

## ⚙️ Konfigurasi

### Environment Variables (.env)

| Variable | Default | Deskripsi |
|----------|---------|-----------|
| `PORT` | `7575` | Port aplikasi |
| `SESSION_SECRET` | - | Secret key untuk session (auto-generated) |
| `NODE_ENV` | `production` | Environment mode |

### Generate Session Secret

```bash
npm run generate-secret
```

---

## 💾 Import/Export & Backup

### Export Data

OzangLive mendukung export data lengkap atau selektif:

1. Buka **Settings** → **Export Data**
2. Pilih kategori yang ingin diexport:
   - Streams (konfigurasi streaming)
   - YouTube Credentials
   - Broadcast Templates
   - Recurring Schedules
   - Stream Templates
   - Playlists
   - Title Folders & Suggestions
   - Thumbnail Files
3. Klik **Export Data**
4. File JSON akan otomatis terdownload

### Import Data

**Fitur Backward Compatibility** - Sistem otomatis mendeteksi dan mengkonversi format lama!

1. Buka **Settings** → **Import Data**
2. Upload file backup JSON (format lama atau baru)
3. Centang **"Skip data duplikat"** jika tidak ingin duplikasi
4. Klik **Import Data**

**Format Detection:**
- ✅ Format baru (dengan metadata) → Import langsung
- ✅ Format lama (tanpa metadata) → Auto-convert ke format baru
- ✅ Enhanced error logging untuk troubleshooting

### Migration Helper

Sistem dilengkapi dengan **Migration Helper Service** yang:
- Auto-deteksi format backup (lama vs baru)
- Konversi otomatis format lama ke format baru
- Migrasi field names dan struktur data
- Menambahkan default values untuk field yang hilang
- Logging detail untuk debugging

**File terkait:**
- `services/migration-helper.js` - Migration service
- `services/backupService.js` - Import/export logic
- `app.js` - Enhanced error logging

### Troubleshooting Import

Jika import gagal, periksa:

1. **Server logs** - Cari log dengan prefix `[Import]`
2. **Error message** - Sistem akan menampilkan error detail
3. **File structure** - Log akan menampilkan struktur file

**Log yang berguna:**
```bash
pm2 logs ozanglive --lines 100 | grep "\[Import\]"
```

---

## 📺 YouTube API Setup

### Step 1: Buat Project di Google Cloud

1. Buka [Google Cloud Console](https://console.cloud.google.com)
2. **Select Project** → **New Project** → Buat project baru

### Step 2: Aktifkan YouTube Data API

1. **APIs & Services** → **Library**
2. Cari **YouTube Data API v3** → **Enable**

### Step 3: Setup OAuth Consent Screen

1. **APIs & Services** → **OAuth consent screen**
2. Pilih **External** → Isi informasi yang diperlukan
3. Klik **Audience**
4. Tambahkan email ke **Test users**

### Step 4: Buat OAuth Client ID

1. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth Client ID**
2. Pilih **Web application**
3. Authorized redirect URIs: `https://developers.google.com/oauthplayground`
4. Simpan **CLIENT_ID** dan **CLIENT_SECRET**

### Step 5: Generate Refresh Token

1. Buka [OAuth Playground](https://developers.google.com/oauthplayground)
2. ⚙️ Settings → ✅ **Use your own OAuth credentials**
3. Masukkan Client ID & Client Secret
4. Scope: `https://www.googleapis.com/auth/youtube`
5. **Authorize APIs** → Login → **Exchange authorization code for tokens**
6. Salin **Refresh Token**

### Step 6: Masukkan di OzangLive

Menu **YouTube** → **Tambah Akun** → Masukkan credentials → **Simpan**

---

## 📋 PM2 Commands

| Command | Deskripsi |
|---------|-----------|
| `pm2 status` | Cek status aplikasi |
| `pm2 logs ozanglive` | Lihat logs real-time |
| `pm2 restart ozanglive` | Restart aplikasi |
| `pm2 stop ozanglive` | Stop aplikasi |
| `pm2 monit` | Monitor resource usage |

---

## 🔧 Troubleshooting

### Reset Password Admin
```bash
node reset-password.js
```

### Port Already in Use (EADDRINUSE)

**Linux/VPS:**
```bash
sudo fuser -k 7575/tcp && pm2 restart ozanglive
```

**Windows:**
```bash
netstat -ano | findstr :7575
taskkill /PID <PID> /F
```

### Lihat Logs
```bash
pm2 logs ozanglive --lines 100
tail -f logs/app.log
```

---
Untuk kernel upgrade yang bikin proses install stuck/gagal. Coba ini:

1. Fix dpkg yang mungkin terkunci:
```bash
sudo killall dpkg apt apt-get 2>/dev/null
sudo rm -f /var/lib/dpkg/lock*
sudo rm -f /var/lib/apt/lists/lock
sudo rm -f /var/cache/apt/archives/lock
sudo dpkg --configure -a
```
2. Set non-interactive supaya gak muncul dialog lagi:
```bash
export DEBIAN_FRONTEND=noninteractive
```
3. Update sistem tanpa dialog:
```bash
sudo apt-get update
sudo apt-get upgrade -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"
```
4. Reboot dulu biar kernel baru aktif:
```bash
sudo reboot
```
5. Setelah reboot, baru jalankan install ulang:
```bash
export DEBIAN_FRONTEND=noninteractive
./install.sh
```

## 📊 System Requirements

| Spec | Minimum | Recommended |
|------|---------|-------------|
| **OS** | Ubuntu 20.04+ / Debian 11+ | Ubuntu 22.04 LTS |
| **CPU** | 2 Core | 4 Core |
| **RAM** | 2 GB | 4 GB |
| **Storage** | 20 GB SSD | 50 GB SSD |
| **Network** | 10 Mbps upload | 50 Mbps upload |

---
## 📊 Delet User
```bash
# Install sqlite3 dulu
sudo apt install sqlite3 -y
```bash

```bash
# Masuk ke folder aplikasi
cd /home/Ozang88/ozanglivepublic

# Hapus user
sqlite3 db/streamflow.db "DELETE FROM users WHERE id = 'f53ed9e0-ba33-4fd1-8626-b4b51a4bc8da';"

# Verifikasi sudah terhapus
sqlite3 db/streamflow.db "SELECT id, username FROM users;"
```
lalu
```bash
cd /home/Ozang88/ozanglivepublic

sqlite3 db/streamflow.db "DELETE FROM users WHERE id = 'f53ed9e0-ba33-4fd1-8626-b4b51a4bc8da';"

# Verifikasi
sqlite3 db/streamflow.db "SELECT id, username FROM users;"
```
```bash
cd ~/ozanglivepublic
npm start
```
------------  PM2 JIKA EROR -------------- 

```bash
pm2 start npm --name ozanglive -- start
```
```bash
pm2 restart ozanglive
```
```bash
pm2 save
```


## 📊 Bersihkan VPS
```bash
chmod +x scripts/cleanup-vps.sh
sudo ./scripts/cleanup-vps.sh
```

## 📁 Struktur Project

```
ozanglivepublic/
├── app.js                 # Main application
├── db/streamflow.db       # SQLite database
├── logs/                  # Application logs
├── middleware/            # Express middlewares
├── models/                # Database models
├── public/                # Static files (css, js, uploads)
├── services/              # Business logic
├── views/                 # EJS templates
├── ecosystem.config.js    # PM2 configuration
└── docker-compose.yml     # Docker configuration
```

---

## 🔐 Security Recommendations

1. **HTTPS** - Setup Nginx reverse proxy dengan SSL
2. **Change Default Port** - Ubah port 7575 ke port lain
3. **Firewall** - Batasi akses hanya dari IP tertentu
4. **Regular Updates** - Selalu update dependencies

---

## 🌐 Akses Aplikasi

1. Buka browser: `http://IP_SERVER:7575`
2. Buat akun admin pertama
3. Login dan mulai streaming!

---

## 📄 License

MIT License - Lihat [LICENSE.md](LICENSE.md)

---

<p align="center">
  <sub>Built with ❤️ by OzangLive Team</sub>
</p>
"# ozanglivepublic" 
"# ozanglivepublic" 
"# ozanglivepublicORI" 
