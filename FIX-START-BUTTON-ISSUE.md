# Fix: Tombol Start Hijau Tidak Berfungsi

## Masalah yang Ditemukan

Setelah investigasi mendalam, ditemukan **2 masalah utama**:

### 1. ✅ File Path Salah (SUDAH DIPERBAIKI)
- Video dan audio file path di database tidak menyertakan folder `public/`
- Menyebabkan FFmpeg tidak dapat menemukan file
- **Status: SUDAH DIPERBAIKI** dengan script `fix-video-paths.js` dan `fix-double-slash.js`

### 2. ❌ Stream Key Tidak Valid (PERLU DIPERBAIKI MANUAL)
- Stream key yang tersimpan sudah **expired** atau **tidak valid**
- YouTube menolak koneksi RTMP dengan error: `I/O error`
- **Status: PERLU UPDATE STREAM KEY BARU**

## Error yang Terjadi

```
rtmp://a.rtmp.youtube.com/live2/e064-v6bv-mmkd-usct-85wg: I/O error
FFmpeg exited early with code 1
```

Ini berarti:
- Stream key `e064-v6bv-mmkd-usct-85wg` sudah tidak valid
- YouTube menolak koneksi streaming
- Tombol start tidak bisa berfungsi sampai stream key diupdate

## Solusi

### Cara 1: Update Stream Key via Script (RECOMMENDED)

1. Dapatkan stream key baru dari YouTube Studio:
   - Buka https://studio.youtube.com
   - Klik "Create" > "Go Live"
   - Pilih tab "Stream"
   - Copy stream key yang baru

2. Jalankan script update:
   ```bash
   node update-stream-key.js
   ```

3. Pilih stream yang ingin diupdate
4. Paste stream key baru
5. Selesai!

### Cara 2: Update via Database Langsung

```bash
node
```

Kemudian di Node.js console:

```javascript
const { db } = require('./db/database');

// Lihat semua stream
db.all('SELECT id, title, stream_key FROM streams', [], (err, rows) => {
  console.log(rows);
});

// Update stream key (ganti STREAM_ID dan NEW_KEY)
db.run('UPDATE streams SET stream_key = ? WHERE id = ?', 
  ['NEW_KEY_FROM_YOUTUBE', 'STREAM_ID'], 
  (err) => {
    if (err) console.error(err);
    else console.log('Updated!');
  }
);
```

### Cara 3: Update via Web Interface

1. Login ke aplikasi
2. Buka halaman Schedule/Streams
3. Edit stream yang bermasalah
4. Update stream key dengan yang baru dari YouTube Studio
5. Save

## Verifikasi

Setelah update stream key, test dengan:

```bash
node test-ffmpeg-rtmp.js
```

Jika berhasil, akan muncul:
```
✅ SUCCESS! FFmpeg can connect to RTMP server
The stream key is valid and working
```

## Perbaikan Kode yang Sudah Dilakukan

### 1. Fix File Path di `streamingService.js`

**Sebelum:**
```javascript
const videoPath = path.join(projectRoot, 'public', relativeVideoPath);
```

**Sesudah:**
```javascript
const videoPath = relativeVideoPath.startsWith('public/') 
  ? path.join(projectRoot, relativeVideoPath)
  : path.join(projectRoot, 'public', relativeVideoPath);
```

Ini mencegah path menjadi `public/public/...`

### 2. Fix Database Paths

Script `fix-video-paths.js` dan `fix-double-slash.js` sudah memperbaiki:
- 5 video paths
- 4 audio paths

Semua path sekarang dalam format yang benar: `public/uploads/videos/...`

## Catatan Penting

### Mengapa Stream Key Expired?

Stream key YouTube bisa expired karena:
1. **Broadcast sudah selesai** - Setiap broadcast punya stream key unik
2. **Broadcast dihapus** - Jika broadcast dihapus di YouTube Studio
3. **Terlalu lama tidak digunakan** - YouTube bisa menonaktifkan key yang tidak digunakan
4. **Broadcast sudah dimulai** - Key hanya bisa digunakan sekali per broadcast

### Best Practice

1. **Gunakan Persistent Stream Key** (jika tersedia di akun YouTube Anda):
   - Buka YouTube Studio > Settings > Stream
   - Aktifkan "Persistent stream key"
   - Key ini tidak akan expired

2. **Atau buat broadcast baru setiap kali**:
   - Gunakan YouTube API untuk create broadcast otomatis
   - Aplikasi ini sudah support YouTube API integration

3. **Monitor stream status**:
   - Check log file: `logs/app.log`
   - Lihat error FFmpeg untuk diagnosa cepat

## Testing

Untuk test apakah stream bisa start:

```bash
# Test koneksi RTMP
node test-ffmpeg-rtmp.js

# Test start stream lengkap
node test-start-stream.js

# Check stream di database
node check-streams-debug.js
```

## Kesimpulan

**Masalah utama:** Stream key tidak valid/expired
**Solusi:** Update stream key dengan yang baru dari YouTube Studio
**Status:** File path sudah diperbaiki, tinggal update stream key

Setelah stream key diupdate, tombol start hijau akan berfungsi normal! 🎉
