# APJ Produk Outlet V99 - Cetak Rekap Font Besar Fix

Fokus update:
- Hasil print `Cetak Rekap` 58mm diperbesar karena versi sebelumnya masih terlalu kecil.
- Layout rekap diganti dari tabel 7 kolom kecil menjadi format kartu per produk:
  - Nama produk besar.
  - Stok akhir tampil paling jelas di kanan.
  - Awal, Masuk, Jual, dan Koreksi tampil di kotak kecil bawahnya.
- Font utama rekap naik dari 8.6px menjadi sekitar 12.4px, nama produk sekitar 13.6px, header sekitar 16px.
- Tombol tetap bernama `Cetak Rekap`.
- Fix V98 tetap dibawa: popup print 58mm untuk menghindari preview tampil tapi hasil fisik kosong.
- Fix V97 tetap dibawa: Pesanan Lauk | Qty | Catatan.
- Fix V96/V95 tetap dibawa: font Pesanan 14px dan kompatibilitas Nama Pemesan/Nama Pesanan.

Pasang:
1. Replace frontend.
2. Upload ulang `CODE_GS_APJ_INVENTORI_MASTER.txt` ke Apps Script bila belum memakai V97/V95.
3. Deploy ulang Apps Script.
4. Tekan Ctrl + F5 di browser.
