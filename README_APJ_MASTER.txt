# APJ Produk Outlet V97 - Pesanan Lauk Qty Catatan Fix

Fokus perbaikan:
- Form Pesanan Outlet: setiap baris lauk sekarang punya kolom Lauk, Qty, dan Catatan.
- Print Pesanan 58mm: rincian dicetak sebagai tabel Lauk | Qty | Catatan.
- Font print tetap 14px, tidak bold semua.
- Code.gs tetap membawa fix V95 untuk Nama Pemesan/Nama Pesanan dan menambah header detail Qty Lauk + Catatan Lauk.

Cara pasang:
1. Replace frontend paket ini.
2. Upload CODE_GS_APJ_INVENTORI_MASTER.txt ke Apps Script Inventory.
3. Deploy ulang Apps Script.
4. Buka browser lalu Ctrl + F5.
