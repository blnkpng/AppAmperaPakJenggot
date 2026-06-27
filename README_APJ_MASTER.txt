# APJ Produk Outlet V105 - Transfer & Lihat Stok PIC Fix

Fokus versi ini hanya dua halaman:

1. `transfer-produksi.html`
2. `lihat-stok.html`

## Perbaikan Transfer Produk

Dropdown `Penanggung Jawab Penerima` sebelumnya sudah mulai membaca daftar PIC, tetapi tombol/select bisa tetap dalam kondisi disabled karena halaman masih menunggu proses tambahan memuat PIC.

Di V105:

- Dropdown langsung aktif setelah data awal dari backend Inventory masuk.
- Proses tambahan memuat PIC berjalan di background.
- Kalau data tambahan berhasil, dropdown diperbarui tanpa mengunci form.
- Sumber resmi tetap APJ_CORE_USER sheet `USER` melalui backend Inventory.

## Perbaikan Lihat Stok → Cetak Rekap

Modal Cetak Rekap sebelumnya masih mengambil PIC dari jalur lama, sehingga yang muncul hanya user login.

Di V105:

- Supervisor/PIC di modal Cetak Rekap mengambil daftar dari backend Inventory.
- Backend Inventory membaca langsung APJ_CORE_USER sheet `USER`.
- Field Supervisor, PIC 1, dan PIC 2 memakai daftar karyawan yang sama.

## Sumber PIC resmi

Spreadsheet APJ_CORE_USER:
`1grC_hqmGUCqL9EaPvaIJpZ-ooaI5Gv1sYYJxZXqsWFk`

Sheet:
`USER`

Backend Inventory membaca langsung dengan:
`SpreadsheetApp.openById(APJ_INV_V3.CORE_USER.SPREADSHEET_ID)`

Tidak memakai `UrlFetchApp`, jadi tidak memicu izin `script.external_request`.

## Cara pasang

1. Replace frontend dari paket V105.
2. Upload `CODE_GS_APJ_INVENTORI_MASTER.txt` ke Apps Script Inventory.
3. Deploy ulang.
4. Jalankan function `cekPicCoreUserV104` dari editor Apps Script untuk cek daftar PIC.
5. Refresh browser dengan `Ctrl + F5`.

## Cek sukses

- Transfer Produk: dropdown Penanggung Jawab Penerima bisa diklik dan tidak disabled.
- Lihat Stok → Cetak Rekap: pilihan Supervisor/PIC menampilkan semua karyawan aktif dari APJ_CORE_USER.USER.
