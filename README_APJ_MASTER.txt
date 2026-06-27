# APJ Produk Outlet V98 - Rekap Print 58mm Fix

Fokus update:
- Tombol rekap produk outlet diganti dari `Cetak 58mm` menjadi `Cetak Rekap` agar tidak rancu dengan Print Pesanan.
- Print Rekap Produk Outlet 58mm sekarang memakai popup print nyata, bukan iframe tersembunyi.
- CSS print rekap diganti ke `@page { size: 58mm 297mm; margin: 0 }` agar kasus preview muncul tetapi hasil printer kosong berkurang.
- Fix V97 tetap dibawa: Pesanan Lauk | Qty | Catatan.
- Fix V96/V95 tetap dibawa: font Pesanan 14px dan kompatibilitas Nama Pemesan/Nama Pesanan.

Pasang:
1. Replace frontend.
2. Upload ulang `CODE_GS_APJ_INVENTORI_MASTER.txt` ke Apps Script bila belum memakai V97/V95.
3. Deploy ulang Apps Script.
4. Tekan Ctrl + F5 di browser.
