# Fix Thumbnail Folder - Deployment Guide

## Perubahan
- Hapus opsi "Root" dari dropdown
- Otomatis pilih folder dari template atau folder pertama
- Auto-fix template yang tidak punya folder

## File yang Perlu Di-deploy

```
app.js
public/js/youtube.js
views/youtube.ejs
scripts/auto-fix-template-folder.js
```

## Langkah Deploy di VPS

### 1. Upload file
```bash
scp app.js user@vps:/path/to/streamflow/
scp public/js/youtube.js user@vps:/path/to/streamflow/public/js/
scp views/youtube.ejs user@vps:/path/to/streamflow/views/
scp scripts/auto-fix-template-folder.js user@vps:/path/to/streamflow/scripts/
```

### 2. AUTO-FIX semua template
```bash
cd /path/to/streamflow
node scripts/auto-fix-template-folder.js
```

Script ini akan otomatis mengisi `thumbnail_folder` untuk semua template yang NULL dengan folder pertama yang tersedia.

### 3. Restart aplikasi
```bash
pm2 restart streamflow
```

### 4. Clear browser cache
- Tekan Ctrl+Shift+R di browser
- Test edit broadcast
- Folder harus otomatis terpilih (bukan kosong)
