/* APJ Dashboard V21 - Central + Inventory + Absensi foundation */
(function () {
  'use strict';

  const MENU_GROUP_KEY = 'APJ_DASHBOARD_MENU_GROUPS_V22';
  const SIDEBAR_KEY = 'APJ_SIDEBAR_COLLAPSED';
  const PAGE_MODE = (document.body && document.body.getAttribute('data-dashboard-mode')) || 'central';
  const PAGE_META = {
    central: {
      badge: 'APJ Central',
      title: 'Dashboard Utama APJ',
      subtitle: 'Ringkasan lintas modul. Inventory aktif, Absensi dan Keuangan siap masuk bertahap.',
      descOwner: 'Ringkasan pusat untuk Owner: Inventory aktif hari ini, slot Absensi dan Keuangan sudah disiapkan.',
      descOperator: 'Pintu utama APJ Central. Menu dan akses tetap mengikuti permission role.',
      loading: 'Menarik data Dashboard Utama APJ...',
      loadingSub: 'Inventory V3 aktif; Absensi dan Keuangan disiapkan bertahap.'
    },
    inventory: {
      badge: 'Inventory V3',
      title: 'Dashboard Inventory',
      subtitle: 'Kontrol stok gudang, preparasi, produksi, transfer produk, outlet, opname, dan audit.',
      descOwner: 'Ringkasan Inventory V3 dari master item, jurnal stok, produksi, transfer, outlet, dan audit.',
      descOperator: 'Tampilan Inventory mengikuti permission role. Menu terkunci tetap terlihat agar alur sistem jelas.',
      loading: 'Menarik data Dashboard Inventory...',
      loadingSub: 'Sinkron dengan MASTER_ITEM, JURNAL_STOK, dan STOK_AKHIR.'
    },
    absensi: {
      badge: 'Absensi',
      title: 'Dashboard Absensi',
      subtitle: 'Fondasi monitoring kehadiran, shift, belum absen, checkout, terlambat, dan lembur.',
      descOwner: 'Dashboard Absensi sudah disiapkan sebagai modul mandiri. Integrasi API absensi bisa dicicil tanpa mengubah struktur menu.',
      descOperator: 'Dashboard Absensi disiapkan untuk monitoring karyawan sesuai role HR/Supervisor/Owner.',
      loading: 'Menyiapkan Dashboard Absensi...',
      loadingSub: 'Layout siap. Data live menyusul saat API absensi disambungkan.'
    }
  };
  let currentSession = null;

  const MENU_ITEMS = [
    { module:'Inventori', group:'Inventori / Dashboard', label:'Dashboard Inventory', href:'dashboard-inventory.html', permission:['inventory','lihatStok','inputStok'], desc:'Ringkasan stok, produksi, transfer, outlet, dan audit.', tone:'blue' },
    { module:'Inventori', group:'Inventori / Stok Gudang', label:'Input Stok', href:'input-stok.html', permission:['inputStok'], desc:'Barang masuk dari supplier/pembelian.', tone:'emerald' },
    { module:'Inventori', group:'Inventori / Stok Gudang', label:'Output Stok', href:'output-stok.html', permission:['outputStok'], desc:'Barang keluar gudang/non-produksi.', tone:'rose' },
    { module:'Inventori', group:'Inventori / Dapur Produksi', label:'Preparasi', href:'preparasi.html', permission:['preparasi'], desc:'Bahan mentah menjadi semi-finished.', tone:'amber' },
    { module:'Inventori', group:'Inventori / Dapur Produksi', label:'Produksi', href:'produksi.html', permission:['produksi'], desc:'Semi-finished menjadi produk siap transfer.', tone:'amber' },
    { module:'Inventori', group:'Inventori / Dapur Produksi', label:'Transfer Produk', href:'transfer-produksi.html', permission:['transferProduksi','transferProduk'], desc:'Kirim produk pusat ke outlet.', tone:'violet' },
    { module:'Inventori', group:'Inventori / Outlet', label:'Produk Outlet', href:'produk-outlet.html', permission:['produkOutlet'], desc:'Stok, terjual, dan opname outlet.', tone:'sky' },
    { module:'Inventori', group:'Inventori / Stok Gudang', label:'Stok Opname', href:'stok-opname.html', permission:['stokOpname'], desc:'Koreksi stok fisik.', tone:'blue' },
    { module:'Inventori', group:'Inventori / Stok Gudang', label:'Lihat Stok', href:'lihat-stok.html', permission:['lihatStok'], desc:'Monitoring STOK_AKHIR.', tone:'slate' },
    { module:'Inventori', group:'Inventori / Setup & Audit', label:'Setup Inventory', href:'setup-inventory.html', permission:['setupInventory','admin'], desc:'Master kategori, item, produk, resep.', tone:'violet', admin:true },
    { module:'Inventori', group:'Inventori / Setup & Audit', label:'Jurnal Stok / Audit', href:'riwayat-transaksi.html', permission:['riwayatTransaksi'], desc:'Audit dari JURNAL_STOK.', tone:'blue' },
    { module:'HR / Absensi', group:'HR / Absensi / Dashboard', label:'Dashboard Absensi', href:'dashboard-absensi.html', permission:['dashboardAbsensi','absensiAdmin','absensiDiri'], desc:'Kehadiran, belum absen, checkout, dan shift.', tone:'sky' },
    { module:'HR / Absensi', group:'HR / Absensi / Absensi', label:'Check In / Check Out', href:'#', permission:['absensiDiri'], desc:'Absensi mandiri karyawan.', tone:'emerald', comingSoon:true },
    { module:'HR / Absensi', group:'HR / Absensi / Absensi', label:'Rekap Absensi', href:'#', permission:['absensiAdmin'], desc:'Rekap hadir, terlambat, dan belum checkout.', tone:'blue', comingSoon:true },
    { module:'HR / Absensi', group:'HR / Absensi / Karyawan', label:'Data Karyawan', href:'#', permission:['absensiAdmin'], desc:'Master karyawan, outlet, dan jadwal.', tone:'slate', comingSoon:true },
    { module:'Keuangan', group:'Keuangan / Dashboard', label:'Dashboard Keuangan', href:'#', permission:['keuangan','dashboardKeuangan'], desc:'Ringkasan kas, bank, biaya, dan laporan.', tone:'emerald', comingSoon:true }
  ];

  document.addEventListener('DOMContentLoaded', initDashboard);

  function initDashboard() {
    bindSidebarInteractions();
    initMenuGroups();
    highlightCurrentMenu();
    applyPageModeChrome();
    renderMiniCalendar();

    if (window.APJAuth && !window.APJAuth.requireLogin()) return;
    currentSession = getSession();
    if (!currentSession.active) {
      window.location.href = (window.APJ_CONFIG && window.APJ_CONFIG.loginPage) || 'index.html';
      return;
    }

    hydrateUser(currentSession);
    setupAccessUI(currentSession);
    const refreshBtn = document.getElementById('refreshDashboardBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', function () {
      if (PAGE_MODE === 'absensi') renderAbsensiPlaceholder(true);
      else loadDashboardData(true);
    });
    if (PAGE_MODE === 'absensi') renderAbsensiPlaceholder(false);
    else loadDashboardData(false);
    document.querySelectorAll('#sidebar a').forEach(function (link) { link.addEventListener('click', closeMobileSidebar); });
  }

  function getSession() {
    if (window.APJAuth && window.APJAuth.getSession) return window.APJAuth.getSession();
    return {
      active: localStorage.getItem('APJ_SESSION_ACTIVE') === 'true',
      token: localStorage.getItem('APJ_SESSION_TOKEN') || '',
      username: localStorage.getItem('APJ_USER_USERNAME') || '',
      name: localStorage.getItem('APJ_USER_NAME') || 'Pengguna',
      level: localStorage.getItem('APJ_USER_LEVEL') || '',
      outlet: localStorage.getItem('APJ_USER_OUTLET') || '',
      outletAccess: localStorage.getItem('APJ_USER_OUTLET_ACCESS') || '',
      permissions: safeParseJSON(localStorage.getItem('APJ_USER_PERMISSIONS') || '{}')
    };
  }

  function hydrateUser(session) {
    const name = session.name || session.nama || session.username || 'Pengguna';
    const level = session.level || 'USER';
    setText('displayNama', name);
    setText('displayLevel', level);
    setText('displayInisial', String(name || 'U').charAt(0).toUpperCase());
    setText('welcomeNama', name);
    setText('greetingText', getGreetingLabel());
  }

  function getGreetingLabel(date) {
    const hour = (date || new Date()).getHours();
    if (hour >= 4 && hour < 11) return 'Selamat pagi';
    if (hour >= 11 && hour < 15) return 'Selamat siang';
    if (hour >= 15 && hour < 18) return 'Selamat sore';
    return 'Selamat malam';
  }

  function setupAccessUI(session) {
    document.querySelectorAll('[data-admin-menu]').forEach(function (el) {
      el.classList.toggle('hidden', !isAdmin(session));
    });

    document.querySelectorAll('#dashboardSidebarMenu [data-permission]').forEach(function (el) {
      const keys = String(el.getAttribute('data-permission') || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
      const allowed = hasAnyPermission(session, keys);
      el.classList.toggle('nav-locked', !allowed);
      el.setAttribute('aria-disabled', allowed ? 'false' : 'true');
      if (!allowed && !el.dataset.lockBound) {
        el.dataset.lockBound = 'Y';
        el.addEventListener('click', function (event) {
          event.preventDefault();
          showToast('Menu masih terkunci. Cek LEVEL_PERMISSION / MODUL_ACCESS di APJ Core User.', 'warning');
        });
      }
    });
  }


  function getPageMenus(session, mode) {
    let rows = MENU_ITEMS.slice();
    if (mode === 'inventory') rows = rows.filter(function (m) { return m.module === 'Inventori'; });
    else if (mode === 'absensi') rows = rows.filter(function (m) { return m.module === 'HR / Absensi'; });
    else {
      rows = rows.filter(function (m) {
        return m.label.indexOf('Dashboard') !== -1 || m.module === 'Inventori';
      });
    }
    return rows;
  }

  function applyPageModeChrome() {
    const meta = PAGE_META[PAGE_MODE] || PAGE_META.central;
    const topTitle = document.querySelector('.topbar-title h2');
    const topDesc = document.querySelector('.topbar-title p');
    if (topTitle) topTitle.textContent = meta.title;
    if (topDesc) topDesc.textContent = meta.subtitle;
    const loading = document.getElementById('loadingState');
    if (loading) {
      const bold = loading.querySelector('p.font-bold');
      const sub = loading.querySelector('p.text-xs');
      if (bold) bold.textContent = meta.loading;
      if (sub) sub.textContent = meta.loadingSub;
    }
    document.title = meta.title + ' | APJ Central';
    setText('modeBadge', meta.badge);
    setText('modeDescription', meta.descOwner);
  }

  function highlightCurrentMenu() {
    const path = (location.pathname.split('/').pop() || 'dashboard.html').toLowerCase();
    document.querySelectorAll('#dashboardSidebarMenu a.nav-item').forEach(function (a) {
      const href = (a.getAttribute('href') || '').split('#')[0].toLowerCase();
      const active = href && href !== '#' && href === path;
      a.classList.toggle('active', active);
      if (active) {
        let node = a.parentElement;
        while (node && node.id !== 'dashboardSidebarMenu') {
          if (node.hasAttribute && node.hasAttribute('data-menu-group')) setDashboardMenuGroup(node, true);
          node = node.parentElement;
        }
      }
    });
  }

  function renderAbsensiPlaceholder(isManualRefresh) {
    const data = {
      mode: isOwner(currentSession) ? 'owner' : 'operator',
      today: formatDateHuman(new Date()),
      syncAt: new Date().toLocaleString('id-ID'),
      kpi: { totalKaryawan: 0, hadir: 0, belumAbsen: 0, belumCheckout: 0, terlambat: 0, lembur: 0, outletAktif: 5, shiftAktif: 0 },
      categorySummary: [
        { kategori:'Outlet LAHOR', totalItem:0, totalStok:0, kritis:0, kosong:0 },
        { kategori:'Outlet SENISONO', totalItem:0, totalStok:0, kritis:0, kosong:0 },
        { kategori:'Outlet PUJON', totalItem:0, totalStok:0, kritis:0, kosong:0 },
        { kategori:'Outlet NGUJUNG', totalItem:0, totalStok:0, kritis:0, kosong:0 },
        { kategori:'Outlet POKOPEK', totalItem:0, totalStok:0, kritis:0, kosong:0 }
      ],
      criticalItems: [
        { nama:'API Absensi', kategori:'Integrasi', status:'Belum disambungkan', stok:0, satuan:'' },
        { nama:'Mapping shift', kategori:'Setup HR', status:'Siapkan ID_JADWAL', stok:0, satuan:'' },
        { nama:'Rekap outlet', kategori:'Dashboard', status:'Slot siap', stok:0, satuan:'' }
      ],
      topMovements: [
        { nama:'Check In / Check Out', kategori:'Fitur inti', qty:0, jenis:'Absensi' },
        { nama:'Belum Absen', kategori:'Monitoring', qty:0, jenis:'Absensi' },
        { nama:'Belum Checkout', kategori:'Monitoring', qty:0, jenis:'Absensi' }
      ],
      recentActivities: [],
      locationSummary: [
        { lokasi:'LAHOR', totalTransaksi:0, masuk:0, keluar:0 },
        { lokasi:'SENISONO', totalTransaksi:0, masuk:0, keluar:0 },
        { lokasi:'PUJON', totalTransaksi:0, masuk:0, keluar:0 },
        { lokasi:'NGUJUNG', totalTransaksi:0, masuk:0, keluar:0 },
        { lokasi:'POKOPEK', totalTransaksi:0, masuk:0, keluar:0 }
      ],
      quickMenus: getPageMenus(currentSession, 'absensi').map(function (m) { return Object.assign({}, m, { disabled: !menuAllowed(currentSession, m) }); })
    };
    setText('primaryPanelTitle', 'Ringkasan Outlet Absensi');
    setText('primaryPanelDesc', 'Slot rekap kehadiran per outlet. Data live menyusul setelah API absensi aktif.');
    setText('attentionTitle', 'Setup Absensi Perlu Disiapkan');
    setText('attentionDesc', 'Fondasi dashboard aman dulu, isi data dicicil pelan-pelan.');
    setText('activityTitle', 'Aktivitas Absensi Terbaru');
    setText('activityDesc', 'Akan terisi dari ABSENSI setelah API disambungkan.');
    renderDashboard(data);
    if (isManualRefresh) showToast('Dashboard Absensi siap. Data live menunggu API absensi.', 'info');
  }

  async function loadDashboardData(isManualRefresh) {
    const loading = document.getElementById('loadingState');
    const content = document.getElementById('dashboardContent');
    if (loading && content) {
      loading.classList.remove('hidden');
      content.classList.add('hidden');
    }

    try {
      const [dashRes, stokRes, riwayatRes] = await Promise.allSettled([
        inventoryCall(actionName('dashboard', 'getDashboardData'), userPayload()),
        inventoryCall(actionName('stokAkhir', 'getStokAkhirReport'), userPayload({ limit: 5000 })),
        inventoryCall(actionName('riwayat', 'getRiwayatTransaksi'), userPayload({ limit: 250 }))
      ]);

      const dash = unpackSettled(dashRes, {});
      const stok = unpackSettled(stokRes, { data: [] });
      const riwayat = unpackSettled(riwayatRes, { data: [] });
      const data = normalizeDashboardData(dash, stok, riwayat, currentSession);
      renderDashboard(data);
      if (isManualRefresh) showToast('Dashboard sudah disegarkan.', 'success');
    } catch (error) {
      renderDashboardError(error);
    }
  }

  function actionName(key, fallback) {
    return (((window.APJ_CONFIG || {}).actions || {}).inventory || {})[key] || fallback;
  }

  function userPayload(extra) {
    return Object.assign({
      sessionToken: currentSession && currentSession.token,
      userName: currentSession && (currentSession.name || currentSession.username),
      username: currentSession && currentSession.username,
      level: currentSession && currentSession.level,
      outlet: currentSession && currentSession.outlet,
      permissions: currentSession && currentSession.permissions
    }, extra || {});
  }

  async function inventoryCall(action, payload) {
    if (window.APJApi && window.APJApi.inventory) return window.APJApi.inventory(action, payload || {});
    const cfg = window.APJ_CONFIG || {};
    const url = cfg.inventoryApiUrl || (cfg.apis && cfg.apis.inventory);
    if (!url) throw new Error('URL Inventory API belum diatur.');
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      redirect: 'follow',
      body: JSON.stringify(Object.assign({}, payload || {}, { action: action }))
    });
    return response.json();
  }

  function unpackSettled(result, fallback) {
    if (!result || result.status !== 'fulfilled') return fallback;
    const value = result.value || fallback;
    if (value && value.success === false) return fallback;
    return value;
  }

  function normalizeDashboardData(dash, stokRes, riwayatRes, session) {
    const stokRows = Array.isArray(stokRes.data) ? stokRes.data : (Array.isArray(stokRes.raw) ? stokRes.raw : []);
    const riwayatRows = Array.isArray(riwayatRes.data) ? riwayatRes.data : [];
    const today = dateISO(new Date());
    const todayRows = riwayatRows.filter(function (r) { return dateISO(r.tanggal || r.timestamp) === today; });
    const activeMenus = MENU_ITEMS.filter(function (m) { return menuAllowed(session, m); });
    const dashKpi = dash.kpi || {};

    const totalItem = Number(dashKpi.totalItem || stokRows.length || 0);
    const totalKategori = Number(dashKpi.totalKategori || unique(stokRows.map(function (r) { return r.kategori || r.Kategori || r['Kategori']; })).length || 0);
    const stokKosong = Number(dashKpi.stokKosong || dashKpi.habis || countByStatus(stokRows, ['HABIS', 'KOSONG']) || 0);
    const stokKritis = Number(dashKpi.stokKritis || dashKpi.menipis || countByStatus(stokRows, ['MENIPIS', 'KRITIS', 'WASPADA']) || 0);

    return {
      mode: isOwner(session) ? 'owner' : 'operator',
      today: formatDateHuman(new Date()),
      syncAt: dash.serverTime || dash.updatedAt || new Date().toLocaleString('id-ID'),
      kpi: {
        totalItem: totalItem,
        totalKategori: totalKategori,
        transaksiHariIni: todayRows.length,
        inputHariIni: countJenis(todayRows, ['Input', 'INPUT_STOK']),
        outputHariIni: countJenis(todayRows, ['Output', 'OUTPUT_STOK', 'Produk Outlet']),
        produksiHariIni: countJenis(todayRows, ['Produksi', 'PRODUKSI']),
        preparasiHariIni: countJenis(todayRows, ['Preparasi', 'PREPARASI']),
        transferHariIni: countJenis(todayRows, ['Transfer', 'TRANSFER_PRODUK']),
        stokKritis: stokKritis,
        stokKosong: stokKosong,
        aksesAktif: activeMenus.length,
        lokasiAktif: unique(riwayatRows.map(function (r) { return (r.lokasi || '') + ' ' + (r.outlet || ''); })).length || 1
      },
      categorySummary: buildCategorySummary(stokRows, dash.kategori || dash.categorySummary || []),
      criticalItems: buildCriticalItems(stokRows),
      topMovements: buildTopMovements(todayRows.length ? todayRows : riwayatRows),
      recentActivities: riwayatRows.slice(0, 12),
      locationSummary: buildLocationSummary(riwayatRows),
      quickMenus: getPageMenus(session, PAGE_MODE).map(function (m) { return Object.assign({}, m, { disabled: !menuAllowed(session, m) }); })
    };
  }

  function countByStatus(rows, statuses) {
    const set = statuses.map(function (s) { return s.toUpperCase(); });
    return rows.filter(function (r) {
      const status = String(r.status || r.Status || r['Status'] || '').toUpperCase();
      return set.some(function (s) { return status.indexOf(s) !== -1; });
    }).length;
  }

  function countJenis(rows, needles) {
    const low = needles.map(function (n) { return String(n).toLowerCase(); });
    return rows.filter(function (r) {
      const text = [r.jenis, r.modul, r.arah, r.keterangan].join(' ').toLowerCase();
      return low.some(function (n) { return text.indexOf(n.toLowerCase()) !== -1; });
    }).length;
  }

  function buildCategorySummary(stokRows, fallbackKategori) {
    const map = {};
    stokRows.forEach(function (r) {
      const kategori = r.kategori || r.Kategori || r['Kategori'] || 'Tanpa Kategori';
      if (!map[kategori]) map[kategori] = { kategori: kategori, totalItem: 0, totalStok: 0, kritis: 0, kosong: 0 };
      const qty = num(r.stokTersedia || r['Stok Akhir'] || r.stokAkhir || r.qty || 0);
      const status = String(r.status || r.Status || '').toUpperCase();
      map[kategori].totalItem += 1;
      map[kategori].totalStok += qty;
      if (status.indexOf('HABIS') !== -1 || status.indexOf('KOSONG') !== -1) map[kategori].kosong += 1;
      else if (status.indexOf('MENIPIS') !== -1 || status.indexOf('KRITIS') !== -1 || status.indexOf('WASPADA') !== -1) map[kategori].kritis += 1;
    });
    let out = Object.keys(map).map(function (k) { map[k].totalStok = round(map[k].totalStok); return map[k]; });
    if (!out.length && Array.isArray(fallbackKategori)) {
      out = fallbackKategori.map(function (r) {
        return { kategori: r['Nama Kategori'] || r.namaKategori || r.nama || r.kategori || '-', totalItem: 0, totalStok: 0, kritis: 0, kosong: 0 };
      });
    }
    return out.sort(function (a, b) { return (b.totalItem || 0) - (a.totalItem || 0); }).slice(0, 8);
  }

  function buildCriticalItems(stokRows) {
    return stokRows.map(function (r) {
      return {
        id: r.id || r.idItem || r['ID Item'] || '',
        nama: r.nama || r.namaItem || r['Nama Item'] || r.namaBarang || '-',
        kategori: r.kategori || r.Kategori || r['Kategori'] || '-',
        stok: num(r.stokTersedia || r.stokAkhir || r['Stok Akhir'] || 0),
        satuan: r.satuan || r.satuanStok || r['Satuan'] || r['Satuan Stok'] || '',
        status: r.status || r.Status || ''
      };
    }).filter(function (r) {
      const s = String(r.status || '').toUpperCase();
      return s.indexOf('HABIS') !== -1 || s.indexOf('KOSONG') !== -1 || s.indexOf('MENIPIS') !== -1 || s.indexOf('KRITIS') !== -1 || r.stok < 0;
    }).sort(function (a, b) { return a.stok - b.stok; }).slice(0, 8);
  }

  function buildTopMovements(rows) {
    const map = {};
    rows.forEach(function (r) {
      const id = r.idBarang || r.idItem || r['ID Item'] || r.namaBarang || r.nama || '-';
      const key = String(id);
      if (!map[key]) map[key] = { id: key, nama: r.namaBarang || r.nama || r['Nama Item'] || key, kategori: r.kategori || r.Kategori || '', qty: 0, jenis: r.jenis || r.modul || '' };
      map[key].qty += Math.abs(num(r.qty || r.qtyMasuk || r.qtyKeluar || r.qtyAdjust || 0));
    });
    return Object.keys(map).map(function (k) { map[k].qty = round(map[k].qty); return map[k]; }).sort(function (a, b) { return b.qty - a.qty; }).slice(0, 8);
  }

  function buildLocationSummary(rows) {
    const map = {};
    rows.forEach(function (r) {
      const lokasi = String(r.lokasi || r.outlet || 'PUSAT').trim() || 'PUSAT';
      if (!map[lokasi]) map[lokasi] = { lokasi: lokasi, totalTransaksi: 0, masuk: 0, keluar: 0 };
      map[lokasi].totalTransaksi += 1;
      map[lokasi].masuk += num(r.qtyMasuk || 0);
      map[lokasi].keluar += num(r.qtyKeluar || 0);
    });
    let out = Object.keys(map).map(function (k) { map[k].masuk = round(map[k].masuk); map[k].keluar = round(map[k].keluar); return map[k]; });
    if (!out.length) out = [{ lokasi:'PUSAT / OUTLET', totalTransaksi:0, masuk:0, keluar:0 }];
    return out.slice(0, 6);
  }

  function renderDashboard(data) {
    const loading = document.getElementById('loadingState');
    const content = document.getElementById('dashboardContent');
    if (loading) loading.classList.add('hidden');
    if (content) content.classList.remove('hidden');
    setText('syncDate', 'Update: ' + (data.syncAt || data.today || '-'));

    const isOwnerMode = data.mode === 'owner';
    const meta = PAGE_META[PAGE_MODE] || PAGE_META.central;
    setText('modeBadge', isOwnerMode ? meta.badge + ' • Owner' : meta.badge);
    setText('modeDescription', isOwnerMode ? meta.descOwner : meta.descOperator);
    setText('quickMenuDesc', PAGE_MODE === 'central' ? 'Shortcut lintas modul. Modul belum aktif tetap ditandai jelas.' : (isOwnerMode ? 'Menu modul ini untuk owner/admin.' : 'Menu aktif mengikuti LEVEL_PERMISSION.'));

    renderKpis(data.kpi || {});
    renderCategories(data.categorySummary || []);
    renderMovements(data.topMovements || []);
    renderCriticalItems(data.criticalItems || []);
    renderActivities(data.recentActivities || []);
    renderLocations(data.locationSummary || []);
    renderQuickMenus(data.quickMenus || []);
    renderMiniActions(data.quickMenus || []);
    renderAgenda(data.recentActivities || []);
  }

  function renderKpis(k) {
    let mainCards;
    let miniCards;

    if (PAGE_MODE === 'central') {
      mainCards = [
        { label:'Inventory', value:k.totalItem || 0, suffix:'Item aktif', tone:'blue', trend:'Live' },
        { label:'Stok Prioritas', value:(k.stokKritis || 0) + (k.stokKosong || 0), suffix:'Perlu cek', tone:'amber', trend:'Inventory' },
        { label:'Absensi', value:'Siap', suffix:'Dashboard mandiri', tone:'sky', trend:'Fondasi' },
        { label:'Keuangan', value:'Siap', suffix:'Slot modul', tone:'emerald', trend:'Berikutnya' }
      ];
      miniCards = [
        { label:'Transaksi Stok', value:k.transaksiHariIni || 0, tone:'emerald' },
        { label:'Transfer', value:k.transferHariIni || 0, tone:'violet' },
        { label:'Menu Aktif', value:k.aksesAktif || 0, tone:'slate' },
        { label:'Sub Utama', value:3, tone:'blue' }
      ];
    } else if (PAGE_MODE === 'absensi') {
      mainCards = [
        { label:'Total Karyawan', value:k.totalKaryawan || 0, suffix:'Master karyawan', tone:'blue', trend:'Siap API' },
        { label:'Hadir', value:k.hadir || 0, suffix:'Hari ini', tone:'emerald', trend:'Live nanti' },
        { label:'Belum Absen', value:k.belumAbsen || 0, suffix:'Perlu follow-up', tone:'amber', trend:'HR' },
        { label:'Belum Checkout', value:k.belumCheckout || 0, suffix:'Pantau outlet', tone:'rose', trend:'HR' }
      ];
      miniCards = [
        { label:'Terlambat', value:k.terlambat || 0, tone:'amber' },
        { label:'Lembur', value:k.lembur || 0, tone:'violet' },
        { label:'Outlet', value:k.outletAktif || 5, tone:'sky' },
        { label:'Shift', value:k.shiftAktif || 0, tone:'slate' }
      ];
    } else {
      mainCards = [
        { label:'Total Item', value:k.totalItem || 0, suffix:'MASTER_ITEM', tone:'blue', trend:'Aktif' },
        { label:'Transaksi', value:k.transaksiHariIni || 0, suffix:'Hari ini', tone:'emerald', trend:'JURNAL_STOK' },
        { label:'Output', value:k.outputHariIni || 0, suffix:'Keluar/jual', tone:'rose', trend:'Operasional' },
        { label:'Stok Kritis', value:(k.stokKritis || 0) + (k.stokKosong || 0), suffix:'Perlu cek', tone:'amber', trend:'Prioritas' }
      ];
      miniCards = [
        { label:'Preparasi', value:k.preparasiHariIni || 0, tone:'amber' },
        { label:'Produksi', value:k.produksiHariIni || 0, tone:'amber' },
        { label:'Transfer', value:k.transferHariIni || 0, tone:'violet' },
        { label:'Menu Aktif', value:k.aksesAktif || 0, tone:'slate' }
      ];
    }

    html('kpiGrid', mainCards.map(function (card) {
      return '<div class="kpi-card tone-' + esc(card.tone) + '">' +
        '<div class="kpi-top"><div class="min-w-0"><p class="kpi-label">' + esc(card.label) + '</p><p class="text-xs mt-1" style="color:var(--muted)">' + esc(card.suffix) + '</p></div><div class="kpi-icon">' + iconForTone(card.tone) + '</div></div>' +
        '<div><div class="kpi-value"><strong>' + esc(formatNumber(card.value)) + '</strong></div><div class="kpi-footer"><span>' + esc(card.trend) + '</span><b>Live</b></div></div>' +
        '</div>';
    }).join(''));
    html('miniKpiGrid', miniCards.map(function (card) {
      return '<div class="mini-stat tone-' + esc(card.tone) + '"><div class="min-w-0"><p>' + esc(card.label) + '</p><strong>' + esc(formatNumber(card.value)) + '</strong></div><span class="flat-icon-sm">' + iconForTone(card.tone) + '</span></div>';
    }).join(''));
  }

  function renderCategories(rows) {
    if (!rows.length) return html('categoryList', emptyState('Belum ada ringkasan kategori.'));
    html('categoryList', rows.map(function (r) {
      const risk = Number(r.kritis || 0) + Number(r.kosong || 0);
      const tone = risk ? 'amber' : 'emerald';
      return '<div class="soft-row"><div class="flex items-start justify-between gap-3"><div class="min-w-0"><p class="row-title">' + esc(r.kategori || r.nama || '-') + '</p><p class="row-sub">' + esc(formatNumber(r.totalItem || 0)) + ' item • stok total ' + esc(formatNumber(r.totalStok || 0)) + '</p></div><span class="pill tone-' + tone + '">' + esc(formatNumber(risk)) + ' prioritas</span></div></div>';
    }).join(''));
  }

  function renderMovements(rows) {
    if (!rows.length) return html('movementList', emptyState('Belum ada pergerakan transaksi.'));
    html('movementList', rows.map(function (r) {
      return '<div class="soft-row"><div class="flex items-start justify-between gap-3"><div class="min-w-0"><p class="row-title">' + esc(r.nama || '-') + '</p><p class="row-sub">' + esc(r.kategori || r.jenis || '-') + '</p></div><span class="pill tone-blue">' + esc(formatNumber(r.qty || 0)) + '</span></div></div>';
    }).join(''));
  }

  function renderCriticalItems(rows) {
    if (!rows.length) return html('criticalList', emptyState('Stok kritis belum terdeteksi. Tetap cek fisik, jangan cuma percaya layar.'));
    html('criticalList', rows.map(function (r) {
      const tone = String(r.status || '').toUpperCase().indexOf('HABIS') !== -1 || Number(r.stok) <= 0 ? 'rose' : 'amber';
      return '<div class="soft-row"><div class="flex items-start justify-between gap-3"><div class="min-w-0"><p class="row-title">' + esc(r.nama || '-') + '</p><p class="row-sub">' + esc(r.kategori || '-') + ' • ' + esc(r.status || 'Perlu cek') + '</p></div><span class="pill tone-' + tone + '">' + esc(formatNumber(r.stok || 0)) + ' ' + esc(r.satuan || '') + '</span></div></div>';
    }).join(''));
  }

  function renderActivities(rows) {
    if (!rows.length) return html('activityList', emptyState('Belum ada aktivitas terbaru.'));
    html('activityList', rows.slice(0, 8).map(function (r) {
      const jenis = r.jenis || r.modul || '-';
      const tone = toneFromJenis(jenis);
      return '<div class="soft-row"><div class="flex items-start justify-between gap-3"><div class="min-w-0"><p class="row-title">' + esc(jenis) + ' • ' + esc(r.namaBarang || r.nama || r.idBarang || '-') + '</p><p class="row-sub">' + esc(r.tanggal || '') + ' • ' + esc(r.petugas || '-') + ' • ' + esc(r.outlet || r.lokasi || '') + '</p></div><span class="pill tone-' + tone + '">' + esc(formatNumber(r.qty || r.qtyMasuk || r.qtyKeluar || 0)) + '</span></div></div>';
    }).join(''));
  }

  function renderLocations(rows) {
    if (!rows.length) return html('locationList', emptyState('Belum ada data lokasi.'));
    html('locationList', rows.map(function (r) {
      return '<div class="soft-row"><div class="flex items-start justify-between gap-3"><div class="min-w-0"><p class="row-title">' + esc(r.lokasi || '-') + '</p><p class="row-sub">Masuk ' + esc(formatNumber(r.masuk || 0)) + ' • Keluar ' + esc(formatNumber(r.keluar || 0)) + '</p></div><span class="pill tone-slate">' + esc(formatNumber(r.totalTransaksi || 0)) + ' trx</span></div></div>';
    }).join(''));
  }

  function renderQuickMenus(menus) {
    const rows = menus.filter(function (m) { return !m.admin || isAdmin(currentSession); }).slice(0, 10);
    if (!rows.length) return html('quickMenuGrid', emptyState('Belum ada menu aktif.'));
    html('quickMenuGrid', rows.map(function (menu) {
      const disabled = !!menu.disabled;
      const coming = !!menu.comingSoon;
      const tag = disabled ? 'div' : 'a';
      const href = disabled ? '' : ' href="' + esc(menu.href) + '"';
      const suffix = coming ? ' • Segera' : (disabled ? ' 🔒' : '');
      return '<' + tag + href + ' class="soft-row quick-card ' + (disabled ? 'opacity-60 cursor-not-allowed' : '') + '"><div class="flex items-start gap-3"><span class="flat-icon-sm tone-' + esc(menu.tone || 'blue') + '">' + iconForTone(menu.tone || 'blue') + '</span><div class="min-w-0"><p class="row-title">' + esc(menu.label || '-') + suffix + '</p><p class="row-sub clamp-1">' + esc(menu.desc || '') + '</p></div></div></' + tag + '>';
    }).join(''));
  }

  function renderMiniActions(menus) {
    const visible = menus.filter(function (m) { return !m.disabled && m.href !== 'dashboard.html'; }).slice(0, 4);
    html('quickActionMini', visible.map(function (menu) {
      return '<a href="' + esc(menu.href) + '" class="pill" style="background:var(--surface-solid);border-color:var(--border);color:var(--text);box-shadow:var(--shadow-soft)">' + esc(menu.label) + '</a>';
    }).join(''));
  }

  function renderAgenda(rows) {
    const today = dateISO(new Date());
    const list = rows.filter(function (r) { return dateISO(r.tanggal || r.timestamp) === today; }).slice(0, 4);
    if (!list.length) return html('agendaList', emptyState('Belum ada agenda dari transaksi hari ini.'));
    html('agendaList', '<div class="list-stack">' + list.map(function (r, idx) {
      return '<div class="soft-row"><p class="row-title">' + esc(timeFromText(r.timestamp) || agendaTime(idx)) + ' • ' + esc(r.jenis || r.modul || 'Aktivitas') + '</p><p class="row-sub">' + esc(r.namaBarang || r.keterangan || '-') + '</p></div>';
    }).join('') + '</div>');
  }

  function renderMiniCalendar() {
    const el = document.getElementById('calendarGrid');
    if (!el) return;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const today = now.getDate();
    const first = new Date(year, month, 1);
    const start = (first.getDay() + 6) % 7;
    const days = new Date(year, month + 1, 0).getDate();
    setText('calendarMonth', now.toLocaleDateString('id-ID', { month:'long', year:'numeric' }));
    const labels = ['S','S','R','K','J','S','M'];
    let cells = labels.map(function (d) { return '<div class="calendar-cell calendar-label">' + d + '</div>'; }).join('');
    for (let i = 0; i < start; i++) cells += '<div class="calendar-cell muted"></div>';
    for (let d = 1; d <= days; d++) cells += '<div class="calendar-cell ' + (d === today ? 'today' : '') + '">' + d + '</div>';
    el.innerHTML = cells;
  }

  function renderDashboardError(error) {
    const message = error && error.message ? error.message : 'Gagal memuat dashboard.';
    const loading = document.getElementById('loadingState');
    if (loading) loading.innerHTML = '<div class="text-rose-500 font-extrabold mb-1">Dashboard gagal dimuat.</div><div class="text-xs" style="color:var(--muted)">' + esc(message) + '</div>';
    showToast('Gagal memuat dashboard. Cek deploy Code.gs Inventory V3.', 'error');
  }

  function hasAnyPermission(session, keys) {
    if (!keys || !keys.length) return true;
    if (isOwner(session)) return true;
    if (keys.indexOf('admin') !== -1 && isAdmin(session)) return true;
    const perms = (session && session.permissions) || {};
    return keys.some(function (key) {
      return boolPerm(perms[key]) || boolPerm(perms[normalizePermission(key)]) || boolPerm(perms[String(key).toUpperCase()]);
    });
  }

  function menuAllowed(session, menu) { if (menu && menu.comingSoon) return false; return hasAnyPermission(session, menu.permission || []); }
  function isOwner(session) { return ['OWNER','SUPERADMIN','SUPER ADMIN'].indexOf(String(session && session.level || '').trim().toUpperCase()) !== -1; }
  function isAdmin(session) { return isOwner(session) || ['SUPERVISOR'].indexOf(String(session && session.level || '').trim().toUpperCase()) !== -1; }
  function boolPerm(v) { if (v === true) return true; if (typeof v === 'number') return v > 0; const s = String(v || '').toUpperCase(); return ['Y','YA','YES','TRUE','1','AKTIF'].indexOf(s) !== -1; }
  function normalizePermission(v) { return String(v || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, ''); }

  function bindSidebarInteractions() {
    const sidebarToggle = document.querySelector('[data-sidebar-collapse]');
    if (sidebarToggle && sidebarToggle.dataset.bound !== 'Y') {
      sidebarToggle.dataset.bound = 'Y';
      sidebarToggle.addEventListener('click', toggleSidebarCollapse);
    }
    document.querySelectorAll('#dashboardSidebarMenu [data-coming-soon-menu]').forEach(function (link) {
      if (link.dataset.boundSoon === 'Y') return;
      link.dataset.boundSoon = 'Y';
      link.addEventListener('click', function (event) {
        event.preventDefault();
        showToast((link.getAttribute('data-coming-soon-menu') || 'Menu ini') + ' sedang disiapkan. Struktur tempatnya sudah aman.', 'info');
      });
    });
    document.querySelectorAll('#dashboardSidebarMenu [data-menu-toggle]').forEach(function (button) {
      if (button.dataset.bound === 'Y') return;
      button.dataset.bound = 'Y';
      button.addEventListener('click', function (event) {
        event.preventDefault();
        if (document.getElementById('sidebar') && document.getElementById('sidebar').classList.contains('sidebar-collapsed')) return;
        toggleDashboardMenuGroup(button.getAttribute('data-menu-toggle'));
      });
    });
    applySidebarState();
  }

  function initMenuGroups() {
    const saved = safeParseJSON(localStorage.getItem(MENU_GROUP_KEY) || '{}');
    document.querySelectorAll('#dashboardSidebarMenu [data-menu-group]').forEach(function (group) {
      const key = group.getAttribute('data-menu-group');
      const shouldOpen = typeof saved[key] === 'boolean' ? saved[key] : group.classList.contains('open');
      setDashboardMenuGroup(group, shouldOpen);
    });
  }

  function setDashboardMenuGroup(group, open) {
    if (!group) return;
    group.classList.toggle('open', !!open);
    const button = group.querySelector('.nav-group-toggle');
    if (button) button.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function toggleDashboardMenuGroup(key) {
    const group = document.querySelector('#dashboardSidebarMenu [data-menu-group="' + cssEscape(key) + '"]');
    if (!group) return;
    const next = !group.classList.contains('open');
    setDashboardMenuGroup(group, next);
    const saved = safeParseJSON(localStorage.getItem(MENU_GROUP_KEY) || '{}');
    saved[key] = next;
    localStorage.setItem(MENU_GROUP_KEY, JSON.stringify(saved));
  }

  function openMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (!sidebar || !backdrop) return;
    sidebar.classList.remove('-translate-x-full');
    backdrop.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
  }

  function closeMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (!sidebar || !backdrop) return;
    sidebar.classList.add('-translate-x-full');
    backdrop.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  }

  function setSidebarCollapsed(collapsed) {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    const active = !!collapsed && window.innerWidth >= 1024;
    sidebar.classList.toggle('sidebar-collapsed', active);
    document.body.classList.toggle('sidebar-collapsed-active', active);
  }

  function applySidebarState() { setSidebarCollapsed(localStorage.getItem(SIDEBAR_KEY) === 'true'); }

  function toggleSidebarCollapse(event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    const sidebar = document.getElementById('sidebar');
    if (!sidebar || window.innerWidth < 1024) return;
    const next = !sidebar.classList.contains('sidebar-collapsed');
    localStorage.setItem(SIDEBAR_KEY, next ? 'true' : 'false');
    setSidebarCollapsed(next);
  }

  function showLogoutModal() {
    const modal = document.getElementById('logoutModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    requestAnimationFrame(function () {
      modal.querySelector('.modal-overlay')?.classList.remove('opacity-0');
      modal.querySelector('.modal-content')?.classList.remove('opacity-0', 'scale-95');
    });
  }

  function closeLogoutModal() {
    const modal = document.getElementById('logoutModal');
    if (!modal) return;
    modal.querySelector('.modal-overlay')?.classList.add('opacity-0');
    modal.querySelector('.modal-content')?.classList.add('opacity-0', 'scale-95');
    setTimeout(function () { modal.classList.add('hidden'); }, 160);
  }

  async function executeLogout() {
    try { if (window.APJApi && window.APJApi.logout) await window.APJApi.logout(); } catch (e) {}
    if (window.APJAuth && window.APJAuth.logout) window.APJAuth.logout();
    else {
      localStorage.clear();
      window.location.href = (window.APJ_CONFIG && window.APJ_CONFIG.loginPage) || 'index.html';
    }
  }

  document.addEventListener('keydown', function (event) { if (event.key === 'Escape') { closeMobileSidebar(); closeLogoutModal(); } });
  window.addEventListener('resize', function () { if (window.innerWidth >= 1024) closeMobileSidebar(); applySidebarState(); });

  function showToast(message, type) {
    if (window.APJToast) {
      const method = type === 'error' ? 'error' : type === 'warning' ? 'warning' : type === 'success' ? 'success' : 'info';
      window.APJToast[method](message || '-');
      return;
    }
    const toast = document.getElementById('customToast');
    const msg = document.getElementById('toastMessage');
    if (msg) msg.textContent = message || '-';
    if (toast) { toast.classList.add('show'); setTimeout(function () { toast.classList.remove('show'); }, 3200); }
  }

  function setText(id, value) { const el = document.getElementById(id); if (el) el.textContent = value == null ? '' : String(value); }
  function html(id, value) { const el = document.getElementById(id); if (el) el.innerHTML = value || ''; }
  function safeParseJSON(text) { try { return text ? JSON.parse(text) : {}; } catch (e) { return {}; } }
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>'"]/g, function (ch) { return { '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[ch]; }); }
  function num(value) { if (typeof value === 'number') return Number.isFinite(value) ? value : 0; let s = String(value == null ? '' : value).trim().replace(/\s/g, ''); if (!s) return 0; const comma = s.lastIndexOf(','), dot = s.lastIndexOf('.'); if (comma !== -1 && dot !== -1) s = comma > dot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, ''); else if (comma !== -1) s = s.replace(',', '.'); const n = parseFloat(s); return Number.isFinite(n) ? n : 0; }
  function round(n) { return Math.round((Number(n) || 0) * 1000000) / 1000000; }
  function unique(arr) { const seen = {}; return (arr || []).map(function (x) { return String(x || '').trim(); }).filter(function (x) { if (!x || seen[x]) return false; seen[x] = true; return true; }); }
  function formatNumber(value) { const n = Number(value || 0); if (!Number.isFinite(n)) return String(value || 0); return new Intl.NumberFormat('id-ID').format(n); }
  function formatDateHuman(date) { return date.toLocaleDateString('id-ID', { weekday:'long', day:'2-digit', month:'long', year:'numeric' }); }
  function dateISO(value) { if (!value) return ''; if (Object.prototype.toString.call(value) === '[object Date]') return value.toISOString().slice(0, 10); const s = String(value); const iso = s.match(/\d{4}-\d{2}-\d{2}/); if (iso) return iso[0]; const dmy = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/); if (dmy) return String(dmy[3]).padStart(4, '20') + '-' + String(dmy[2]).padStart(2, '0') + '-' + String(dmy[1]).padStart(2, '0'); return ''; }
  function emptyState(text) { return '<div class="soft-row"><p class="row-sub">' + esc(text) + '</p></div>'; }
  function toneFromJenis(jenis) { const j = String(jenis || '').toLowerCase(); if (j.includes('input')) return 'emerald'; if (j.includes('output') || j.includes('terjual')) return 'rose'; if (j.includes('preparasi')) return 'amber'; if (j.includes('produksi')) return 'amber'; if (j.includes('transfer')) return 'violet'; if (j.includes('opname')) return 'blue'; return 'slate'; }
  function timeFromText(value) { const m = String(value || '').match(/\b(\d{1,2}:\d{2})\b/); return m ? m[1] : ''; }
  function agendaTime(idx) { return ['09:00','11:30','14:00','16:00'][idx] || '--:--'; }
  function cssEscape(value) { if (window.CSS && window.CSS.escape) return window.CSS.escape(value); return String(value || '').replace(/"/g, '\\"'); }

  function iconForTone(tone) {
    if (tone === 'emerald') return iconBox();
    if (tone === 'rose') return iconArrowDown();
    if (tone === 'amber') return iconWarning();
    if (tone === 'violet') return iconTransfer();
    if (tone === 'sky') return iconStore();
    if (tone === 'slate') return iconGrid();
    return iconChart();
  }
  function iconChart(){ return '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 19V5m4 14v-7m4 7V8m4 11v-4m4 4H4"/></svg>'; }
  function iconBox(){ return '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16ZM3.3 7.2 12 12l8.7-4.8M12 22V12"/></svg>'; }
  function iconArrowDown(){ return '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v14m0 0 5-5m-5 5-5-5M5 21h14"/></svg>'; }
  function iconWarning(){ return '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0ZM12 9v4m0 4h.01"/></svg>'; }
  function iconTransfer(){ return '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h11m0 0-3-3m3 3-3 3M17 17H6m0 0 3 3m-3-3 3-3"/></svg>'; }
  function iconStore(){ return '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 10h16M6 10v10h12V10M8 10V6a4 4 0 0 1 8 0v4M9 15h2m2 0h2"/></svg>'; }
  function iconGrid(){ return '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z"/></svg>'; }

  Object.assign(window, {
    openMobileSidebar: openMobileSidebar,
    closeMobileSidebar: closeMobileSidebar,
    toggleSidebarCollapse: toggleSidebarCollapse,
    toggleDashboardMenuGroup: toggleDashboardMenuGroup,
    showLogoutModal: showLogoutModal,
    closeLogoutModal: closeLogoutModal,
    executeLogout: executeLogout
  });
})();
