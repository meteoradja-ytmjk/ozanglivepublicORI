# Fitur Unlist Live Replay

## Deskripsi
Fitur "Unlist replay when stream ends" memungkinkan video replay otomatis berubah menjadi unlisted setelah live stream selesai. Fitur ini **default ON** tapi user bisa matikan jika tidak mau.

## Perbedaan dengan Auto-Start/Stop
- **Auto-start stream**: Selalu ON (hidden, tidak bisa diubah user)
- **Auto-stop stream**: Selalu ON (hidden, tidak bisa diubah user)
- **Unlist replay**: Default ON (visible toggle, user bisa matikan jika tidak mau)

## Cara Kerja

### 1. UI (User Interface)
- Opsi toggle switch tersedia di form Create Broadcast
- Lokasi: Di bawah section Tags, sebelum Thumbnail
- Default: **ON (aktif)**
- User dapat mematikan jika tidak ingin replay otomatis unlisted

### 2. Backend Process - Delayed Retry Mechanism
Karena YouTube API tidak mendukung setting "auto unlist on end" saat create broadcast, kami menggunakan **delayed retry mechanism**:

**Saat stream selesai:**
1. Cek apakah user mengaktifkan `unlistReplayOnEnd` (default: ON)
2. Jika **OFF** → tidak ada yang dilakukan
3. Jika **ON** → schedule unlist dengan delay 1 menit
4. Setelah delay, coba unlist video menggunakan Videos API
5. Jika video masih processing → retry setiap 30 detik (max 5x)
6. Jika berhasil → video menjadi unlisted
7. Jika gagal setelah 5x retry → log error dan stop

**Kenapa perlu delay & retry?**
- YouTube butuh waktu untuk processing replay setelah stream ends
- Video baru bisa di-unlist setelah processing selesai
- Retry mechanism memastikan unlist berhasil meskipun processing lambat

### 3. Implementasi Teknis

**File yang terlibat:**
- `views/youtube.ejs` - UI toggle switch (opsional)
- `public/js/youtube.js` - Handle form submission
- `services/youtubeService.js` - Method `unlistBroadcast()` dengan retry logic
- `services/unlistReplayService.js` - **NEW**: Service untuk delayed retry mechanism
- `services/streamingService.js` - Call unlistReplayService saat stream ends
- `services/youtubeStatusSync.js` - Call unlistReplayService saat broadcast complete
- `models/YouTubeBroadcastSettings.js` - Simpan setting per broadcast
- `db/database.js` - Field `unlist_replay_on_end` di tabel

**Flow:**
```
User Create Broadcast
  ↓
User PILIH apakah mau unlist replay (toggle ON/OFF, default ON)
  ↓
Setting disimpan ke database (youtube_broadcast_settings)
  ↓
Stream dimulai dan berjalan
  ↓
Stream selesai (stopStream)
  ↓
Cek: apakah unlistReplayOnEnd = true?
  ├─ NO → Selesai (tidak ada yang dilakukan)
  └─ YES → Schedule unlist (delay 1 menit)
       ↓
       Wait 1 minute (beri waktu YouTube processing)
       ↓
       Attempt 1: Unlist video via Videos API
       ├─ Success → Selesai ✓
       ├─ Video not ready → Wait 30s, Attempt 2
       ├─ Still processing → Wait 30s, Attempt 3
       ├─ ... (max 5 attempts)
       └─ Failed after 5x → Log error, give up
```

**Retry Configuration:**
- Initial delay: 60 seconds (1 menit)
- Retry interval: 30 seconds
- Max retries: 5 attempts
- Total max time: ~3.5 minutes

## Keuntungan
1. **Default ON** - Privasi terjaga by default, user bisa matikan jika tidak mau
2. **Privasi otomatis** - Replay tidak langsung public (jika tetap ON)
3. **Kontrol penuh** - User bisa review/edit replay sebelum dipublikasikan
4. **Reliable** - Retry mechanism handle YouTube processing delays
5. **Non-blocking** - Tidak mengganggu proses stop stream jika gagal

## Catatan Penting
- Fitur ini **default ON** - user bisa matikan jika tidak mau
- Hanya bekerja untuk broadcast yang dibuat melalui aplikasi
- Memerlukan YouTube API credentials yang valid
- Menggunakan Videos API (bukan LiveBroadcasts API) untuk better compatibility
- Retry mechanism memastikan unlist berhasil meskipun replay masih processing
- Jika API call gagal setelah 5x retry, akan di-log tapi tidak crash aplikasi

## Troubleshooting

**Unlist tidak berfungsi?**
1. Pastikan toggle "Unlist replay when stream ends" tidak dimatikan (default ON)
2. Cek log untuk melihat retry attempts
3. Pastikan YouTube credentials masih valid
4. Video mungkin butuh waktu lebih lama untuk processing (normal)

**Video masih public setelah stream?**
- Cek apakah toggle dimatikan saat create broadcast (default: ON)
- Lihat log `[UnlistReplayService]` untuk status retry
- Jika gagal setelah 5x retry, unlist manual via YouTube Studio

