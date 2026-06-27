# APJ Produk Outlet V104 - PIC Direct Core User Fix

Fokus versi ini: PIC / Penanggung Jawab di menu Output Stok dan Transfer Produk diambil langsung dari APJ_CORE_USER sheet USER.

## Sumber PIC resmi

Spreadsheet APJ_CORE_USER:
`1grC_hqmGUCqL9EaPvaIJpZ-ooaI5Gv1sYYJxZXqsWFk`

Sheet:
`USER`

Backend Inventory membaca langsung dengan:
`SpreadsheetApp.openById(APJ_INV_V3.CORE_USER.SPREADSHEET_ID)`

Tidak memakai `UrlFetchApp`, jadi tidak memicu izin `script.external_request`.

## Yang berubah

- `CORE_USER.SPREADSHEET_ID` sudah diisi dengan ID APJ_CORE_USER.
- Output Stok membaca daftar PIC dari Core User.
- Transfer Produk membaca daftar Penanggung Jawab dari Core User.
- Sumber fallback hanya dipakai kalau Core User tidak terbaca.
- Tombol/cache dinaikkan ke `?v=104`.

## Cara pasang

1. Replace frontend dari paket V104.
2. Upload `CODE_GS_APJ_INVENTORI_MASTER.txt` ke Apps Script Inventory.
3. Deploy ulang.
4. Jalankan function `cekPicCoreUserV104` dari editor Apps Script untuk cek daftar PIC.
5. Jika muncul permintaan izin, izinkan akses spreadsheet.
6. Refresh browser dengan `Ctrl + F5`.

## Cek sukses

Function `cekPicCoreUserV104` harus mengembalikan total PIC lebih dari 1 dan daftar nama dari sheet USER. Jika masih hanya 1 nama, berarti Apps Script Inventory belum punya akses ke spreadsheet APJ_CORE_USER atau header/status di sheet USER perlu dicek.
