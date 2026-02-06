# PM2 Process Manager Guide for OzangLive

PM2 adalah process manager untuk Node.js yang menyediakan fitur auto-restart, monitoring, dan log management.

## Quick Setup untuk VPS (Recommended)

```bash
# 1. Install PM2
npm install -g pm2

# 2. Start aplikasi
cd ~/ozanglive
pm2 start ecosystem.config.js

# 3. Setup auto-start saat boot
pm2 startup
pm2 save

# 4. Setup health monitor cron (optional tapi recommended)
chmod +x scripts/health-monitor.sh
crontab -e
# Tambahkan baris ini:
# */5 * * * * /root/ozanglive/scripts/health-monitor.sh >> /root/ozanglive/logs/health-monitor.log 2>&1
```

## Instalasi PM2

```bash
npm install -g pm2
```

## Cara Penggunaan

### Menjalankan Aplikasi dengan PM2

```bash
# Menggunakan npm script
npm run pm2:start

# Atau langsung dengan PM2
pm2 start ecosystem.config.js

# Atau menggunakan script helper
./pm2-start.sh start    # Linux/Mac
pm2-start.bat start     # Windows
```

### Perintah PM2 Umum

| Perintah | Deskripsi |
|----------|-----------|
| `npm run pm2:start` | Menjalankan aplikasi |
| `npm run pm2:stop` | Menghentikan aplikasi |
| `npm run pm2:restart` | Restart aplikasi |
| `npm run pm2:reload` | Zero-downtime reload |
| `npm run pm2:logs` | Melihat log aplikasi |
| `npm run pm2:status` | Melihat status proses |
| `npm run pm2:monit` | Membuka dashboard monitoring |

### Auto-Start saat Boot

Untuk menjalankan OzangLive otomatis saat server/komputer dinyalakan:

```bash
# Generate startup script
pm2 startup

# Simpan konfigurasi saat ini
pm2 save
```

## Fitur PM2 yang Dikonfigurasi

### Auto-Restart
- Aplikasi akan otomatis restart jika crash
- Maksimal 10 restart dalam waktu singkat
- Delay 4 detik sebelum restart

### Memory Management
- Restart otomatis jika memory melebihi 1GB
- Heap size dibatasi 1GB

### Logging
- Log disimpan di folder `logs/`
- `pm2-combined.log` - Semua log
- `pm2-out.log` - Output log
- `pm2-error.log` - Error log

### Graceful Shutdown
- Timeout 30 detik untuk graceful shutdown
- Memastikan semua stream dihentikan dengan benar

## Monitoring

### Dashboard Real-time
```bash
pm2 monit
```

### Status Proses
```bash
pm2 status
```

### Log Real-time
```bash
pm2 logs ozanglive --lines 100
```

## Troubleshooting

### Aplikasi Terus Restart
Cek log untuk melihat penyebab crash:
```bash
pm2 logs ozanglive --err --lines 200
```

### Memory Tinggi
Restart manual untuk membersihkan memory:
```bash
pm2 restart ozanglive
```

### Menghapus dari PM2
```bash
pm2 delete ozanglive
```

## Konfigurasi Lanjutan

File konfigurasi: `ecosystem.config.js`

Opsi yang bisa diubah:
- `max_memory_restart` - Batas memory untuk restart
- `max_restarts` - Maksimal restart
- `restart_delay` - Delay sebelum restart
- `cron_restart` - Jadwal restart berkala (uncomment untuk mengaktifkan)


## Setup Cron Health Monitor (Untuk VPS)

Health monitor akan mengecek aplikasi setiap 5 menit dan restart otomatis jika tidak responsif:

```bash
# Buat script executable
chmod +x scripts/health-monitor.sh

# Edit crontab
crontab -e

# Tambahkan baris ini (sesuaikan path):
*/5 * * * * /root/ozanglive/scripts/health-monitor.sh >> /root/ozanglive/logs/health-monitor.log 2>&1
```

## Optimasi untuk VPS 1GB RAM

Konfigurasi sudah dioptimasi untuk VPS dengan RAM terbatas:
- Heap Node.js dibatasi 512MB
- Auto-restart jika memory > 700MB
- Garbage collection lebih sering
- Daily restart jam 4 pagi untuk mencegah memory buildup

## One-Line Update Command

Untuk update dari git dan restart:

```bash
cd ~/ozanglive && git fetch origin && git reset --hard origin/main && npm install && pm2 restart ozanglive
```

## Troubleshooting VPS

### Aplikasi Tidak Bisa Diakses tapi Streaming Jalan

Ini biasanya karena Node.js crash tapi FFmpeg tetap jalan. Solusi:

```bash
# Restart aplikasi
pm2 restart ozanglive

# Cek log untuk penyebab crash
pm2 logs ozanglive --err --lines 100
```

### Memory Tinggi

```bash
# Cek memory usage
pm2 monit

# Force restart untuk clear memory
pm2 restart ozanglive
```

### Cek Status Kesehatan

```bash
# Via curl
curl http://localhost:7575/health

# Via PM2
pm2 status
```
