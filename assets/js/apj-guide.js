/* APJ GUIDE V18 - modal panduan per halaman */
(function () {
  'use strict';

  const DEFAULT_GUIDES = {
    'dashboard.html': {
      title: 'Panduan Dashboard',
      subtitle: 'Ringkasan utama APJ Central.',
      items: ['Lihat ringkasan operasional sesuai akses akun.', 'Menu terkunci tetap tampil dengan label Lock.', 'Gunakan sidebar untuk pindah modul.']
    },
    'input-stok.html': {
      title: 'Panduan Input Stok',
      subtitle: 'Mencatat stok barang masuk.',
      items: ['Pilih kategori yang sesuai akses.', 'Isi item dan qty dengan benar.', 'Simpan setelah data dicek.']
    },
    'output-stok.html': {
      title: 'Panduan Output Stok',
      subtitle: 'Mencatat stok keluar atau pemakaian.',
      items: ['Pilih kategori dan barang.', 'Isi qty keluar.', 'Pastikan stok cukup sebelum simpan.']
    },
    'transfer-produksi.html': {
      title: 'Panduan Transfer Produk Outlet',
      subtitle: 'Transfer produk dari dapur ke outlet.',
      items: ['Pilih outlet tujuan.', 'Isi jumlah produk transfer.', 'Cetak surat jalan jika diperlukan.']
    },
    'produk-outlet.html': {
      title: 'Panduan Produk Outlet',
      subtitle: 'Input terjual dan opname produk outlet.',
      items: ['Kasir hanya melihat outlet sesuai akses.', 'Isi produk terjual atau stok opname.', 'Print laporan bila dibutuhkan.']
    },
    'stok-opname.html': {
      title: 'Panduan Stok Opname',
      subtitle: 'Koreksi stok fisik.',
      items: ['Pilih kategori/barang.', 'Isi selisih atau hasil opname.', 'Catat keterangan bila ada perbedaan.']
    },
    'lihat-stok.html': {
      title: 'Panduan Lihat Stok',
      subtitle: 'Melihat stok akhir dan status barang.',
      items: ['Gunakan filter kategori/cari.', 'Perhatikan status stok.', 'Export/print untuk laporan.']
    },
    'riwayat-inventory.html': {
      title: 'Panduan Riwayat Transaksi',
      subtitle: 'Audit semua transaksi stok.',
      items: ['Filter tanggal, jenis transaksi, dan pencarian.', 'Cek ID/nama barang serta petugas.', 'Gunakan export/print bila perlu.']
    },
    'admin.html': {
      title: 'Panduan Admin Sistem',
      subtitle: 'Kelola user, role, modul, dan permission.',
      items: ['Tambah/edit user dari Admin.', 'Atur status aktif/nonaktif.', 'Kelola modul dan akses dengan hati-hati.']
    }
  };

  function currentPage() { return (location.pathname.split('/').pop() || 'dashboard.html').toLowerCase(); }

  function getGuide() {
    return window.APJ_PAGE_GUIDE || DEFAULT_GUIDES[currentPage()] || {
      title: 'Panduan APJ',
      subtitle: 'Panduan umum halaman ini.',
      items: ['Pastikan data diisi dengan benar.', 'Jika akses terkunci, hubungi Owner/Admin.', 'Gunakan akun sendiri untuk audit yang rapi.']
    };
  }

  function ensureModal() {
    let modal = document.getElementById('apjGuideModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'apjGuideModal';
    modal.className = 'apj-modal';
    modal.innerHTML = '<div class="apj-modal-card"><div class="apj-modal-header"><div><h2 class="apj-modal-title" id="apjGuideTitle">Panduan</h2><p class="apj-modal-subtitle" id="apjGuideSubtitle"></p></div><button type="button" class="apj-modal-close" data-apj-close-guide>×</button></div><div id="apjGuideBody"></div><div class="apj-modal-footer"><button class="apj-btn apj-btn-primary" type="button" data-apj-close-guide>Mengerti</button></div></div>';
    document.body.appendChild(modal);
    modal.querySelectorAll('[data-apj-close-guide]').forEach(function (btn) { btn.addEventListener('click', close); });
    modal.addEventListener('click', function (event) { if (event.target === modal) close(); });
    return modal;
  }

  function open() {
    const guide = getGuide();
    const modal = ensureModal();
    document.getElementById('apjGuideTitle').textContent = guide.title || 'Panduan';
    document.getElementById('apjGuideSubtitle').textContent = guide.subtitle || '';
    const items = Array.isArray(guide.items) ? guide.items : [];
    document.getElementById('apjGuideBody').innerHTML = '<ol style="margin:0;padding-left:20px;color:#cbd5e1;line-height:1.8;font-size:.92rem">' + items.map(function (item) { return '<li>' + item + '</li>'; }).join('') + '</ol>';
    modal.classList.add('apj-show');
  }

  function close() {
    const modal = document.getElementById('apjGuideModal');
    if (modal) modal.classList.remove('apj-show');
  }

  function init() { ensureModal(); }

  window.APJGuide = { init: init, open: open, close: close, getGuide: getGuide };
})();
