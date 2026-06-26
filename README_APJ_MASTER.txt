# APJ Produk Outlet V96 - Print Pesanan 58mm Font 14px Fix

Basis: V95 Print Pesanan 58mm Blank & Nama Pemesan Sheet Fix.

## Perubahan V96
- Print Pesanan 58mm tidak lagi bold semua.
- Font utama struk pesanan dinaikkan menjadi 14px.
- Body/data menggunakan font-weight 500.
- Label penting tetap bold 700.
- Judul dan brand tetap tebal agar struk mudah dibaca.
- Query string produk-outlet.html dinaikkan ke ?v=96 agar cache browser tidak memakai JS/CSS lama.

## Cara pasang
1. Replace seluruh file frontend dari paket ini.
2. Upload ulang CODE_GS_APJ_INVENTORI_MASTER.txt ke Apps Script jika belum memakai V95.
3. Deploy ulang Apps Script bila Code.gs diganti.
4. Buka aplikasi lalu tekan Ctrl + F5.
5. Tes Produk Outlet > Pesanan > Cetak 58mm.
