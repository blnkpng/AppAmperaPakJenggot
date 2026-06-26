# APJ Produk Outlet V95 - Print Pesanan 58mm Blank & Nama Pemesan Sheet Fix

Paket ini berbasis file final sementara Produk Outlet terbaru.

## Perubahan V95
- Format print Pesanan 58mm diperbesar agar lebih terbaca di printer thermal.
- Print memakai popup cetak nyata, menunggu render dokumen, dan ukuran @page eksplisit 58mm x 297mm untuk mengurangi risiko hasil cetak kosong.
- Nama Pemesan diperbaiki agar tersimpan dan tampil di cetak ulang walaupun sheet masih memakai header lama/typo `Nama Pesanan`.
- Backend append pesanan: penulisan data mengikuti posisi header aktual sheet, sekaligus mengisi alias header lama jika kolom tersebut masih ada.
- File pendamping menggunakan format MASTER.

## File yang diupload
- produk-outlet.html
- assets/css/pages/apj-produk-outlet.css
- assets/js/pages/apj-produk-outlet.js
- CODE_GS_APJ_INVENTORI_MASTER.txt

## Catatan
Setelah mengganti Code.gs, deploy ulang Apps Script Inventory dan tekan Ctrl+F5 di browser.
