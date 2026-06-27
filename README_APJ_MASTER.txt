# APJ V10.2 / V108 - Setup Inventory Fix

Paket ini melanjutkan APP_V.10.0 / V105 final.

Fokus V106:
- Membuat halaman `setup-inventory.html` yang sebelumnya belum ada.
- Menambahkan CSS selaras tampilan APJ.
- Menambahkan JS CRUD Setup Inventory.
- Setup dipakai agar admin tidak perlu bolak-balik buka Google Sheet untuk master dasar.

## Menu Setup Inventory berisi apa?

### 1. Kategori
Untuk mengatur kelompok stok:
- Bahan Utama
- Bahan Baku/Bumbu
- Bahan Preparasi
- Produk Jadi
- Kemasan
- Minuman & Barang Dagang
- Kebersihan/Operasional

Aksi:
- Tambah kategori
- Edit kategori
- Hapus/nonaktifkan kategori

### 2. Item
Untuk mengatur semua barang yang dihitung stoknya:
- Bahan mentah
- Bumbu
- Barang preparasi/setengah jadi
- Produk jadi
- Barang dagang
- Kemasan
- Operasional

Aksi:
- Tambah item
- Edit item
- Hapus/nonaktifkan item
- Atur satuan
- Atur item tampil di modul Input, Output, Preparasi, Produksi, Transfer Produk

### 3. Resep Produksi
Untuk mengatur resep dari bahan/setengah jadi menjadi produk jadi.

Contoh:
- Ayam Kremes 8 -> Ayam Goreng 8
- Begedel Setengah Jadi + Telur -> Begedel Goreng

Aksi:
- Tambah resep produksi
- Edit resep produksi
- Tambah bahan resep lebih dari satu
- Hapus/nonaktifkan resep

### 4. Resep Preparasi
Untuk mengatur standar bahan mentah menjadi bahan siap olah.

Contoh:
- Ayam Potong -> Ayam Kremes / Ayam Premix
- Kentang + bumbu -> Begedel Setengah Jadi
- Kikil mentah -> Kikil siap olah

Aksi:
- Tambah resep preparasi
- Edit resep preparasi
- Hapus/nonaktifkan resep preparasi

## Logika penting

Hapus data master tidak menghapus baris permanen. Sistem menandai data sebagai nonaktif agar histori transaksi tidak rusak.

Resep hanya standar. Jumlah nyata tetap bisa disesuaikan pada transaksi Preparasi/Produksi. Sisa, susut, rusak, atau hilang dicatat saat transaksi, bukan dihitung otomatis di master.

## File baru V106

- `setup-inventory.html`
- `assets/css/pages/apj-setup-inventory.css`
- `assets/js/pages/apj-setup-inventory.js`
- `DOKUMENTASI_APJ_V106_SETUP_INVENTORY.txt`

## Cara pasang

1. Replace frontend dari paket ini.
2. Upload ulang `CODE_GS_APJ_INVENTORI_MASTER.txt` ke Apps Script Inventory.
3. Deploy ulang Apps Script Inventory.
4. Buka `setup-inventory.html`.
5. Refresh browser dengan `Ctrl + F5`.

## Catatan

Module Jurnal/Riwayat belum dibuat di V106. Setelah halaman Setup aman, lanjut ke `riwayat-inventory.html`.

============================================================
UPDATE V108 - SETUP INVENTORY FIX
============================================================
- Panduan Setup Inventory dibuat solid/tidak transparan.
- Light mode Setup Inventory dirapikan agar nyaman dibaca.
- Resep Preparasi sekarang mendukung banyak bahan seperti Resep Produksi.
- Tambah Item: Urutan otomatis dari kategori terpilih.
- Baris bahan Resep Produksi/Preparasi diberi nomor otomatis.
- Backend RESEP_PREPARASI mendukung 1 ID resep dengan banyak baris bahan.


[APJ V108]
- Setup Inventory: kartu ringkasan Kategori/Item/Resep Produksi/Resep Preparasi dirapikan khusus light mode dan dark mode.
- CSS halaman Setup sekarang dimuat setelah apj-theme.css agar patch halaman tidak kalah oleh tema global.


=== V109 RIWAYAT INVENTORY ===
- Menambahkan riwayat-inventory.html untuk audit JURNAL_STOK.
- Menambahkan CSS/JS halaman: apj-riwayat-inventory.css dan apj-riwayat-inventory.js.
- Link menu Jurnal Stok / Audit diarahkan ke riwayat-inventory.html.
- riwayat-transaksi.html dibuat sebagai redirect kompatibilitas.
- Fitur: filter tanggal, jenis, arah, lokasi/outlet, keyword, limit, summary, export CSV, dan cetak rekap A4.
