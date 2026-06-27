# APJ Produk Outlet V100 - Output PIC & Preparasi Sisa Logic Fix

Fokus update:
- Menu Output Stok: PIC saat tujuan `Transfer Outlet` sekarang mengambil semua karyawan aktif dari Core User, bukan hanya petugas login.
- Fallback Core User dibuat lebih kuat: mencoba beberapa action umum (`getTransferSignatureUsers`, `getSignatureUsers`, `getDaftarPenandatangan`, `getActiveUsers`, `getKaryawanAktif`, `getAllUsers`, `adminGetUsers`, `getBootstrap`).
- Menu Preparasi: logika `Sisa Otomatis = Total Bahan - Total Hasil` dimatikan karena salah secara lapangan ketika bahan/hasil beda satuan atau lebih dari satu bahan.
- Catatan susut/sisa sekarang manual dan hanya menjadi keterangan proses. Stok tetap berubah dari tabel `Bahan Keluar` dan `Hasil Masuk`.
- Resep preparasi sekarang membawa qty standar bahan/hasil saat resep dipilih, lalu tetap bisa diedit sesuai fisik nyata.
- Fix V99/V98/V97/V96/V95 tetap dibawa.

Prinsip Preparasi V100:
1. Bahan Keluar = stok bahan asal berkurang.
2. Hasil Masuk = stok hasil preparasi bertambah.
3. Susut/rusak/hilang/sisa = catatan proses, bukan hitung otomatis lintas item.
4. Kalau ada sisa bahan yang benar-benar kembali menjadi stok, jangan dimasukkan sebagai bahan keluar; atau buat item hasil khusus untuk sisa tersebut bila memang perlu dikontrol.

Pasang:
1. Replace frontend.
2. Upload ulang `CODE_GS_APJ_INVENTORI_MASTER.txt` ke Apps Script bila belum memakai versi master terbaru.
3. Deploy ulang Apps Script.
4. Tekan Ctrl + F5 di browser.
