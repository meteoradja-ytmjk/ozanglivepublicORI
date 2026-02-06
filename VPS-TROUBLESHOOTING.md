# VPS Troubleshooting Guide - OzangLive

Panduan lengkap untuk mengatasi masalah akses aplikasi OzangLive di VPS.

## 🔍 Quick Diagnostic

Jalankan script diagnostic otomatis:

```bash
cd ~/ozanglivepublic
chmod +x vps-diagnostic.sh
./vps-diagnostic.sh
```

## 🚀 Quick Fix (Automated)

Script ini akan otomatis memperbaiki masalah umum:

```bash
cd ~/ozanglivepublic
chmod +x vps-quick-fix.sh
./vps-quick-fix.sh
```

Script akan:
1. ✅ Membuat/memeriksa file `.env`
2. ✅ Generate `SESSION_SECRET` jika belum ada
3. ✅ Membersihkan port 7575 jika sedang digunakan
4. ✅ Mengkonfigurasi firewall
5. ✅ Restart aplikasi dengan PM2
6. ✅ Verifikasi aplikasi berjalan

---

## 🔧 Manual Troubleshooting

### Problem 1: Missing .env File

**Symptoms:**
- PM2 logs menunjukkan: `SESSION_SECRET is not set`
- Aplikasi restart terus-menerus

**Solution:**
```bash
cd ~/ozanglivepublic
node generate-secret.js
pm2 restart ozanglive
```

---

### Problem 2: Port Already in Use

**Symptoms:**
- PM2 logs: `EADDRINUSE: Port 7575 already in use`
- Aplikasi status: `errored`

**Solution:**
```bash
# Kill process using port 7575
sudo fuser -k 7575/tcp

# Restart application
pm2 restart ozanglive
```

---

### Problem 3: Firewall Blocking

**Symptoms:**
- Aplikasi berjalan di VPS (curl localhost:7575 works)
- Tidak bisa diakses dari luar (browser timeout)

**Solution:**
```bash
# Allow port 7575
sudo ufw allow 7575/tcp
sudo ufw allow ssh
sudo ufw reload

# Verify
sudo ufw status
```

**IMPORTANT:** Juga periksa firewall di VPS provider (Security Groups, Cloud Firewall, dll)

---

### Problem 4: Application Not Running

**Symptoms:**
- `pm2 status` shows `stopped` or `errored`
- Port 7575 tidak listening

**Solution:**
```bash
cd ~/ozanglivepublic

# Stop and delete old process
pm2 stop ozanglive
pm2 delete ozanglive

# Start fresh
pm2 start ecosystem.config.js
pm2 save

# Check status
pm2 status
pm2 logs ozanglive --lines 50
```

---

### Problem 5: Out of Memory (OOM)

**Symptoms:**
- Aplikasi crash random
- `dmesg` shows "killed process"
- VPS RAM < 1GB

**Solution:**

Edit `ecosystem.config.js`, reduce memory limit:

```javascript
max_memory_restart: '400M', // Reduce from 600M
```

Then restart:
```bash
pm2 restart ozanglive
```

---

## 📊 Verification Commands

### Check PM2 Status
```bash
pm2 status
pm2 logs ozanglive --lines 50
```

### Check Port Listening
```bash
sudo netstat -tulpn | grep 7575
# OR
sudo ss -tulpn | grep 7575
```

### Test Local Access
```bash
curl http://localhost:7575
```

### Test External Access (from your computer)
```bash
curl http://YOUR_VPS_IP:7575
```

### Check Firewall
```bash
sudo ufw status
```

### Check Memory
```bash
free -h
```

### Check for OOM Events
```bash
dmesg | grep -i "killed process"
```

---

## 🎯 Expected Results

### PM2 Status
```
┌─────┬──────────────┬─────────┬─────────┬──────────┐
│ id  │ name         │ status  │ restart │ uptime   │
├─────┼──────────────┼─────────┼─────────┼──────────┤
│ 0   │ ozanglive    │ online  │ 0       │ 5m       │
└─────┴──────────────┴─────────┴─────────┴──────────┘
```

### Port Listening
```
tcp  0  0  0.0.0.0:7575  0.0.0.0:*  LISTEN  12345/node
```

### Local Access
```bash
$ curl http://localhost:7575
# Should return HTML or redirect to /login
```

### Firewall
```
Status: active

To                         Action      From
--                         ------      ----
7575/tcp                   ALLOW       Anywhere
22/tcp                     ALLOW       Anywhere
```

---

## 🆘 Still Not Working?

Kumpulkan informasi berikut dan hubungi support:

```bash
# Run diagnostic
cd ~/ozanglivepublic
./vps-diagnostic.sh > diagnostic-output.txt

# Get PM2 logs
pm2 logs ozanglive --lines 100 --nostream > pm2-logs.txt

# Get system info
uname -a > system-info.txt
free -h >> system-info.txt
df -h >> system-info.txt
```

Kirimkan file:
- `diagnostic-output.txt`
- `pm2-logs.txt`
- `system-info.txt`

---

## 📝 Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| `EADDRINUSE` | Port 7575 sudah digunakan | `sudo fuser -k 7575/tcp` |
| `SESSION_SECRET is not set` | Missing .env | `node generate-secret.js` |
| `Cannot find module` | Missing dependencies | `npm install` |
| `SQLITE_BUSY` | Database locked | Restart aplikasi |
| Connection timeout | Firewall blocking | Check UFW & VPS firewall |
| `killed process` | Out of memory | Reduce `max_memory_restart` |

---

## 🔐 Security Checklist

- [ ] Firewall enabled (`sudo ufw status`)
- [ ] Only necessary ports open (22, 7575)
- [ ] SESSION_SECRET is strong (not default)
- [ ] Regular updates (`git pull && npm install`)
- [ ] PM2 auto-start configured (`pm2 startup`)

---

## 📞 Support

Jika masih ada masalah setelah mengikuti panduan ini, silakan:

1. Jalankan `./vps-diagnostic.sh`
2. Screenshot output
3. Screenshot `pm2 logs ozanglive`
4. Hubungi support dengan informasi tersebut
