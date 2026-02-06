# Export Data Troubleshooting Guide

## Perbaikan yang Dilakukan

### 1. Error Handling yang Lebih Baik
- Menambahkan logging detail di setiap tahap export
- Menampilkan pesan error yang lebih informatif di frontend
- Menangkap dan melempar error dengan benar di setiap fungsi export

### 2. Size Limit untuk Thumbnail Files
- Menambahkan limit 30MB untuk thumbnail files
- Thumbnail files yang melebihi limit akan di-skip
- Template mapping tetap di-export meskipun thumbnail di-skip
- Menampilkan warning jika ada files yang di-skip

### 3. Validasi dan Monitoring
- Menambahkan logging ukuran backup di setiap tahap
- Memvalidasi ukuran total backup sebelum dikirim
- Menampilkan warning jika ukuran mendekati limit 50MB

## Cara Menggunakan

### Export Data
1. Buka Settings > Backup & Restore
2. Pilih kategori yang ingin di-export
3. Klik "Export Semua Data"
4. File JSON akan otomatis terdownload

### Jika Export Gagal

#### 1. Cek Console Browser
Buka Developer Tools (F12) dan lihat tab Console untuk error detail:
```
[Export] Selected categories: [...]
[Export] Sending request to /api/backup/export-all
[Export] Response status: ...
```

#### 2. Cek Log Server
Lihat file `logs/app.log` untuk error di backend:
```bash
type logs\app.log | Select-String -Pattern "Export" -Context 3,3 | Select-Object -Last 20
```

#### 3. Test Export Manual
Jalankan test script untuk memeriksa export:
```bash
node test-export.js
```

Ganti `userId` di file `test-export.js` dengan user ID yang valid.

#### 4. Ukuran Terlalu Besar
Jika export gagal karena ukuran terlalu besar:
- Uncheck kategori "Thumbnail Files" untuk mengurangi ukuran
- Export kategori secara terpisah (export streams saja, lalu youtube credentials, dll)
- Thumbnail files akan di-skip otomatis jika melebihi 30MB

#### 5. Thumbnail Files Banyak yang Di-skip
Jika banyak thumbnail di-skip:
- Export kategori lain terlebih dahulu (tanpa thumbnail_files)
- Backup thumbnail files secara manual dari folder `public/uploads/thumbnails/[userId]`
- Atau tingkatkan limit di `services/backupService.js` (line ~720):
  ```javascript
  const MAX_TOTAL_SIZE = 30 * 1024 * 1024; // Ubah nilai ini
  ```

## Kategori Export

1. **streams** - Konfigurasi stream
2. **youtube_credentials** - Kredensial YouTube
3. **broadcast_templates** - Template broadcast
4. **recurring_schedules** - Jadwal recurring
5. **stream_templates** - Template stream
6. **playlists** - Playlist dan video
7. **title_folders** - Folder title manager
8. **title_suggestions** - Title suggestions
9. **thumbnail_files** - File thumbnail (max 30MB)

## Limits

- **Total Export Size**: 50MB (Express body parser limit)
- **Thumbnail Files**: 30MB (untuk menyisakan ruang untuk data lain)
- **Request Timeout**: Default Express timeout

## Troubleshooting Umum

### Error: "Gagal export data"
- Cek console browser untuk detail error
- Cek log server untuk error backend
- Pastikan user sudah login dan session valid

### Error: "Export failed"
- Cek apakah ada error di fungsi export individual
- Cek apakah database accessible
- Cek apakah folder thumbnails readable

### Warning: "Some thumbnail files were skipped"
- Normal jika Anda memiliki banyak thumbnail
- Template mapping tetap di-export
- Backup thumbnail secara manual jika diperlukan

### Export Sangat Lambat
- Normal jika ada banyak thumbnail files
- Thumbnail di-encode sebagai base64 yang memakan waktu
- Pertimbangkan untuk export tanpa thumbnail files

## Monitoring

### Cek Ukuran Data
```javascript
// Di browser console setelah export
console.log('[Export] Blob size:', blob.size, 'bytes');
console.log('[Export] Size in MB:', (blob.size / (1024 * 1024)).toFixed(2));
```

### Cek Metadata
Buka file JSON hasil export dan lihat bagian `metadata`:
```json
{
  "metadata": {
    "exportDate": "...",
    "appVersion": "1.0.0",
    "exportType": "comprehensive",
    "counts": {
      "streams": 5,
      "thumbnail_folders": 10,
      "thumbnail_skipped_files": 3,
      "thumbnail_total_size_mb": "28.50"
    }
  }
}
```

## Kontak Support

Jika masalah masih berlanjut:
1. Kumpulkan log dari browser console
2. Kumpulkan log dari `logs/app.log`
3. Catat kategori yang di-export
4. Catat ukuran data yang di-export
5. Hubungi developer dengan informasi di atas
