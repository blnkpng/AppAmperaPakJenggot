/* APJ GUIDE V18.3 - modal panduan modul yang lebih menarik */
(function () {
  'use strict';

  const DEFAULT_GUIDES = {
    'input-stok.html': {
      title: 'Cara pakai Input Stok',
      subtitle: 'Popup ini membantu petugas memahami alur input barang masuk supaya pencatatan stok APJ tetap rapi.',
      items: [
        { title: 'Pilih tanggal & kategori', desc: 'Tanggal adalah tanggal barang masuk. Kategori menentukan master barang yang muncul.' },
        { title: 'Tambah baris barang', desc: 'Klik + Tambah Baris Barang, lalu pilih nama barang yang dibeli atau ditambahkan.' },
        { title: 'Isi qty dengan benar', desc: 'Qty Masuk adalah jumlah beli. Qty Stok/Riil adalah jumlah yang masuk ke stok sistem.' },
        { title: 'Cek item preparasi', desc: 'Untuk item parent seperti ayam potong, sistem bisa membuka baris hasil preparasi otomatis.' }
      ],
      note: 'Pastikan satuan beli dan satuan stok sudah sesuai sebelum menekan Simpan Transaksi Input.'
    },
    'output-stok.html': {
      title: 'Cara pakai Output Stok',
      subtitle: 'Gunakan halaman ini untuk mencatat barang keluar, pemakaian, atau kebutuhan produksi.',
      items: [
        { title: 'Pilih kategori', desc: 'Kategori membatasi daftar barang agar petugas hanya memilih item yang relevan.' },
        { title: 'Isi barang keluar', desc: 'Pilih nama barang lalu isi qty keluar sesuai pemakaian nyata.' },
        { title: 'Cek stok akhir', desc: 'Pastikan stok mencukupi supaya tidak ada selisih pencatatan.' },
        { title: 'Simpan transaksi', desc: 'Simpan setelah semua baris dan keterangan diperiksa.' }
      ]
    },
    'transfer-produksi.html': {
      title: 'Cara pakai Transfer Produk Outlet',
      subtitle: 'Dipakai dapur untuk mencatat produk jadi yang dikirim ke outlet.',
      items: [
        { title: 'Pilih outlet tujuan', desc: 'Outlet menentukan daftar produk aktif yang bisa ditransfer.' },
        { title: 'Isi jumlah transfer', desc: 'Masukkan jumlah produk yang benar-benar dikirim.' },
        { title: 'Simpan data', desc: 'Hanya baris dengan qty lebih dari 0 yang disimpan.' },
        { title: 'Cetak surat jalan', desc: 'Gunakan Surat Jalan untuk dokumen kirim ke outlet.' }
      ]
    },
    'produk-outlet.html': {
      title: 'Cara pakai Produk Outlet',
      subtitle: 'Halaman kasir untuk stok produk outlet, produk terjual, dan opname harian.',
      items: [
        { title: 'Cek outlet aktif', desc: 'Kasir hanya melihat data sesuai outlet aksesnya.' },
        { title: 'Input terjual', desc: 'Masukkan produk yang terjual pada hari berjalan.' },
        { title: 'Opname produk', desc: 'Gunakan opname jika stok fisik berbeda dengan sistem.' },
        { title: 'Print laporan', desc: 'Cetak laporan harian jika diperlukan.' }
      ]
    },
    'stok-opname.html': {
      title: 'Cara pakai Stok Opname',
      subtitle: 'Dipakai untuk koreksi stok fisik agar data sistem tetap sesuai lapangan.',
      items: [
        { title: 'Pilih kategori & barang', desc: 'Ambil item yang sedang dihitung fisiknya.' },
        { title: 'Isi hasil opname', desc: 'Masukkan jumlah fisik atau selisih sesuai format halaman.' },
        { title: 'Tambahkan keterangan', desc: 'Catat penyebab selisih agar audit lebih jelas.' },
        { title: 'Simpan koreksi', desc: 'Simpan setelah data dicek petugas.' }
      ]
    },
    'lihat-stok.html': {
      title: 'Cara pakai Lihat Stok',
      subtitle: 'Gunakan halaman ini untuk memantau stok akhir dan status barang.',
      items: [
        { title: 'Gunakan filter', desc: 'Filter kategori atau pencarian nama barang untuk mempercepat pengecekan.' },
        { title: 'Perhatikan status', desc: 'Status aman, waspada, atau kritis membantu menentukan prioritas belanja.' },
        { title: 'Cek detail stok', desc: 'Bandingkan qty masuk, keluar, dan stok akhir.' },
        { title: 'Cetak laporan', desc: 'Gunakan print/export untuk kebutuhan audit.' }
      ]
    },
    'riwayat-transaksi.html': {
      title: 'Cara pakai Riwayat Transaksi',
      subtitle: 'Riwayat dipakai untuk audit input, output, produksi, transfer, dan opname.',
      items: [
        { title: 'Pilih rentang tanggal', desc: 'Gunakan tanggal awal dan akhir sesuai kebutuhan audit.' },
        { title: 'Filter jenis transaksi', desc: 'Pilih jenis agar data lebih fokus.' },
        { title: 'Cari item/petugas', desc: 'Gunakan pencarian untuk melihat barang atau petugas tertentu.' },
        { title: 'Cetak bila perlu', desc: 'Print atau export untuk laporan.' }
      ]
    },
    'admin.html': {
      title: 'Cara pakai Admin Sistem',
      subtitle: 'Admin digunakan untuk mengelola user, akses, permission, dan master data.',
      items: [
        { title: 'Kelola user', desc: 'Tambah, edit, aktifkan, atau nonaktifkan user sesuai kebutuhan.' },
        { title: 'Atur level & outlet', desc: 'Pastikan role dan outlet user benar agar akses data tidak salah.' },
        { title: 'Cek permission', desc: 'Permission menentukan menu aktif atau Lock.' },
        { title: 'Pantau audit', desc: 'Gunakan log untuk melihat aktivitas penting sistem.' }
      ]
    }
  };

  function currentPage() { return (location.pathname.split('/').pop() || 'dashboard.html').toLowerCase(); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>'"]/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]); }); }

  function getGuide() {
    if (window.APJ_ENABLE_GUIDE === false) return null;
    return window.APJ_PAGE_GUIDE || DEFAULT_GUIDES[currentPage()] || {
      title: 'Panduan APJ',
      subtitle: 'Panduan umum halaman ini.',
      items: [
        { title: 'Isi data dengan benar', desc: 'Pastikan semua input sudah sesuai sebelum disimpan.' },
        { title: 'Perhatikan akses', desc: 'Jika menu terkunci, hubungi Owner/Admin.' },
        { title: 'Gunakan akun sendiri', desc: 'Akun sendiri membuat audit transaksi lebih rapi.' }
      ]
    };
  }

  function normalizeItem(item, idx) {
    if (typeof item === 'string') return { title: 'Langkah ' + (idx + 1), desc: item };
    return {
      title: item.title || item.judul || ('Langkah ' + (idx + 1)),
      desc: item.desc || item.description || item.text || item.keterangan || ''
    };
  }

  function ensureModal() {
    let modal = document.getElementById('apjGuideModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'apjGuideModal';
    modal.className = 'apj-modal';
    modal.innerHTML = '<div class="apj-modal-card apj-guide-modal-card"><button type="button" class="apj-modal-close" data-apj-close-guide style="position:absolute;right:22px;top:22px;z-index:2">×</button><div class="apj-guide-kicker">Panduan Modul</div><h2 class="apj-guide-title" id="apjGuideTitle">Panduan</h2><p class="apj-guide-subtitle" id="apjGuideSubtitle"></p><div id="apjGuideBody"></div><div class="apj-modal-footer"><button class="apj-btn apj-btn-primary" type="button" data-apj-close-guide>Mengerti</button></div></div>';
    document.body.appendChild(modal);
    modal.querySelectorAll('[data-apj-close-guide]').forEach(function (btn) { btn.addEventListener('click', close); });
    modal.addEventListener('click', function (event) { if (event.target === modal) close(); });
    return modal;
  }

  function open() {
    const guide = getGuide();
    if (!guide) return;
    const modal = ensureModal();
    document.getElementById('apjGuideTitle').textContent = guide.title || 'Panduan';
    document.getElementById('apjGuideSubtitle').textContent = guide.subtitle || '';
    const items = (Array.isArray(guide.items) ? guide.items : []).map(normalizeItem);
    let html = '<div class="apj-guide-grid">' + items.map(function (item, idx) {
      return '<div class="apj-guide-step"><div class="apj-guide-step-number">' + (idx + 1) + '</div><div><h3 class="apj-guide-step-title">' + esc(item.title) + '</h3><p class="apj-guide-step-desc">' + esc(item.desc) + '</p></div></div>';
    }).join('') + '</div>';
    if (guide.note) html += '<div class="apj-guide-note">' + esc(guide.note) + '</div>';
    document.getElementById('apjGuideBody').innerHTML = html;
    modal.classList.add('apj-show');
  }

  function close() {
    const modal = document.getElementById('apjGuideModal');
    if (modal) modal.classList.remove('apj-show');
  }

  function init() { if (getGuide()) ensureModal(); }

  window.APJGuide = { init: init, open: open, close: close, getGuide: getGuide };
})();
