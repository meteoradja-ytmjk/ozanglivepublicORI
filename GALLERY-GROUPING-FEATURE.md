# Gallery Grouping Feature

## Fitur Baru: Auto-Grouping Video & Audio Berdasarkan Nama File

### Apa yang Berubah?
File video dan audio sekarang dikelompokkan secara otomatis berdasarkan kesamaan nama file dengan sistem collapse/expand yang rapi dan pintar.

### Fitur Utama:

#### 1. **Grouping Berdasarkan Nama File**
- Video dan audio dikelompokkan otomatis berdasarkan kesamaan nama
- Sistem mendeteksi pola nama seperti:
  - `Video 1`, `Video 2`, `Video 3` → Dikelompokkan sebagai "Video"
  - `Live Grupera 1`, `Live Grupera 2` → Dikelompokkan sebagai "Live Grupera"
  - `Album-1`, `Album-2` → Dikelompokkan sebagai "Album"
- Setiap grup menampilkan jumlah file di dalamnya
- File dalam grup diurutkan dari yang terbaru

#### 2. **Auto-Hide untuk Grup Lama**
- 2 grup terbaru otomatis terbuka (expanded)
- Grup yang lebih lama otomatis tertutup (collapsed)
- Menghemat ruang layar dan membuat tampilan lebih rapi

#### 3. **Collapse/Expand Manual**
- Klik pada header grup untuk membuka/menutup
- Icon chevron menunjukkan status (↓ = terbuka, → = tertutup)
- State tersimpan di localStorage (tetap ingat pilihan user)

#### 4. **Tombol Quick Action**
- **Expand All** (↓↓): Buka semua grup sekaligus
- **Collapse All** (↑↑): Tutup semua grup sekaligus
- Tombol tersedia di sebelah search bar

#### 5. **Search yang Cerdas**
- Saat search, grup dengan hasil pencarian otomatis terbuka
- Grup tanpa hasil pencarian disembunyikan
- Clear search untuk kembali ke tampilan normal

#### 6. **Sort Alfabetis**
- **A to Z**: Urutkan grup berdasarkan nama (A-Z)
- **Z to A**: Urutkan grup berdasarkan nama (Z-A)
- Sorting bekerja pada level grup

### Tampilan Visual:

#### Video Groups:
- Border kiri biru (primary color)
- Icon folder di header grup
- Animasi smooth saat expand/collapse

#### Audio Groups:
- Border kiri hijau (green)
- Icon folder di header grup
- Styling konsisten dengan video

### Contoh Grouping:

**Sebelum:**
```
- Live Grupera 5
- Live Grupera 4
- Live Grupera 3
- Live Grupera 2
- Live Grupera 1
- Live Baru (6 Salju)
- Album-1
```

**Sesudah:**
```
📁 Live Grupera (5 videos)
   ├─ Live Grupera 5
   ├─ Live Grupera 4
   ├─ Live Grupera 3
   ├─ Live Grupera 2
   └─ Live Grupera 1

📁 Live Baru (6 Salju) (1 video)
   └─ Live Baru (6 Salju)

📁 Album (1 audio)
   └─ Album-1
```

### Keuntungan:
✅ Tampilan lebih rapi dan terorganisir
✅ Mudah menemukan file dengan nama serupa
✅ Performa lebih baik (file dalam grup tertutup tidak langsung di-render)
✅ User experience lebih baik dengan auto-hide
✅ State tersimpan (tidak perlu expand ulang setiap reload)
✅ Cocok untuk file dengan pola penamaan berurutan

### Technical Details:
- Algoritma grouping menghapus angka dan karakter khusus di akhir nama
- Menggunakan localStorage untuk menyimpan state collapse/expand
- CSS transitions untuk animasi smooth
- JavaScript vanilla (no dependencies)
- Kompatibel dengan fitur search dan sort yang sudah ada
- Responsive design (mobile & desktop)

### Pola Nama yang Dikenali:
- Angka di akhir: `Video 1`, `Video 2`, `Video 3`
- Dengan tanda hubung: `Live-1`, `Live-2`
- Dengan underscore: `Audio_1`, `Audio_2`
- Dengan kurung: `File (1)`, `File (2)`, `File [3]`
- Kombinasi: `My Video - 01`, `My Video - 02`

