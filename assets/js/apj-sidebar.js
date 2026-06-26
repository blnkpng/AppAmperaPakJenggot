/* APJ SIDEBAR V18 - sidebar dinamis dari MODULE_ACCESS + permission */
(function () {
  'use strict';

  const FALLBACK_MODULES = [
    { MODULE_ID:'MOD-001', APP_GROUP:'CORE', MODULE_KEY:'DASHBOARD', MODULE_NAME:'Dashboard', PARENT_MENU:'ROOT', URL:'dashboard.html', PERMISSION_KEY:'dashboard', MENU_ORDER:1, IS_MENU:'Y', STATUS:'AKTIF', ICON:'dashboard' },
    { MODULE_ID:'MOD-002', APP_GROUP:'INVENTORY', MODULE_KEY:'INPUT_STOK', MODULE_NAME:'Input Stok', PARENT_MENU:'Inventory', URL:'input-stok.html', PERMISSION_KEY:'inputStok', MENU_ORDER:10, IS_MENU:'Y', STATUS:'AKTIF', ICON:'input' },
    { MODULE_ID:'MOD-003', APP_GROUP:'INVENTORY', MODULE_KEY:'OUTPUT_STOK', MODULE_NAME:'Output Stok', PARENT_MENU:'Inventory', URL:'output-stok.html', PERMISSION_KEY:'outputStok', MENU_ORDER:20, IS_MENU:'Y', STATUS:'AKTIF', ICON:'output' },
    { MODULE_ID:'MOD-004', APP_GROUP:'INVENTORY', MODULE_KEY:'TRANSFER_PRODUKSI', MODULE_NAME:'Transfer Produk Outlet', PARENT_MENU:'Inventory', URL:'transfer-produksi.html', PERMISSION_KEY:'transferProduksi', MENU_ORDER:30, IS_MENU:'Y', STATUS:'AKTIF', ICON:'transfer' },
    { MODULE_ID:'MOD-005', APP_GROUP:'INVENTORY', MODULE_KEY:'PRODUK_OUTLET', MODULE_NAME:'Produk Outlet', PARENT_MENU:'Inventory', URL:'produk-outlet.html', PERMISSION_KEY:'produkOutlet', MENU_ORDER:40, IS_MENU:'Y', STATUS:'AKTIF', ICON:'outlet' },
    { MODULE_ID:'MOD-006', APP_GROUP:'INVENTORY', MODULE_KEY:'STOK_OPNAME', MODULE_NAME:'Stok Opname', PARENT_MENU:'Inventory', URL:'stok-opname.html', PERMISSION_KEY:'stokOpname', MENU_ORDER:50, IS_MENU:'Y', STATUS:'AKTIF', ICON:'opname' },
    { MODULE_ID:'MOD-007', APP_GROUP:'INVENTORY', MODULE_KEY:'LIHAT_STOK', MODULE_NAME:'Lihat Stok', PARENT_MENU:'Inventory', URL:'lihat-stok.html', PERMISSION_KEY:'lihatStok', MENU_ORDER:60, IS_MENU:'Y', STATUS:'AKTIF', ICON:'stock' },
    { MODULE_ID:'MOD-008', APP_GROUP:'INVENTORY', MODULE_KEY:'RIWAYAT_TRANSAKSI', MODULE_NAME:'Riwayat Transaksi', PARENT_MENU:'Inventory', URL:'riwayat-transaksi.html', PERMISSION_KEY:'riwayatTransaksi', MENU_ORDER:70, IS_MENU:'Y', STATUS:'AKTIF', ICON:'history' },
    { MODULE_ID:'MOD-009', APP_GROUP:'ABSENSI', MODULE_KEY:'ABSENSI_DIRI', MODULE_NAME:'Absensi Saya', PARENT_MENU:'Absensi', URL:'absensi.html', PERMISSION_KEY:'absensiDiri', MENU_ORDER:100, IS_MENU:'Y', STATUS:'AKTIF', ICON:'attendance' },
    { MODULE_ID:'MOD-010', APP_GROUP:'ABSENSI', MODULE_KEY:'REKAP_ABSENSI', MODULE_NAME:'Rekap Absensi', PARENT_MENU:'Absensi', URL:'rekap-absensi.html', PERMISSION_KEY:'absensiAdmin', MENU_ORDER:110, IS_MENU:'Y', STATUS:'AKTIF', ICON:'report' },
    { MODULE_ID:'MOD-011', APP_GROUP:'KEUANGAN', MODULE_KEY:'KEUANGAN_DASHBOARD', MODULE_NAME:'Keuangan', PARENT_MENU:'Keuangan', URL:'', PERMISSION_KEY:'keuangan', MENU_ORDER:200, IS_MENU:'Y', STATUS:'NONAKTIF', ICON:'money' },
    { MODULE_ID:'MOD-012', APP_GROUP:'CORE', MODULE_KEY:'ADMIN_SISTEM', MODULE_NAME:'Admin Sistem', PARENT_MENU:'Admin Setup', URL:'admin.html', PERMISSION_KEY:'admin', MENU_ORDER:900, IS_MENU:'Y', STATUS:'AKTIF', ICON:'settings' }
  ];

  function cfg() { return window.APJ_CONFIG || {}; }
  function storageKey() { return (cfg().storage && cfg().storage.modules) || 'APJ_MODULE_ACCESS'; }
  function safeJson(value, fallback) { try { return value ? JSON.parse(value) : fallback; } catch (e) { return fallback; } }
  function activePath() { return (location.pathname.split('/').pop() || 'dashboard.html').toLowerCase(); }
  function isActive(url) { return String(url || '').toLowerCase() === activePath(); }
  function isY(v) { return String(v || '').trim().toUpperCase() === 'Y' || v === true; }
  function isAktif(v) { return String(v || '').trim().toUpperCase() === 'AKTIF'; }
  function sortByOrder(a,b) { return Number(a.MENU_ORDER || a.menuOrder || 999) - Number(b.MENU_ORDER || b.menuOrder || 999); }

  function icon(name) {
    const n = String(name || '').toLowerCase();
    const map = {
      dashboard:'M4 13h6V4H4v9Zm10 7h6V4h-6v16ZM4 20h6v-5H4v5Zm10 0h6v-8h-6v8Z',
      input:'M12 3v12m0 0 4-4m-4 4-4-4M4 21h16',
      output:'M12 21V9m0 0 4 4m-4-4-4 4M4 3h16',
      transfer:'M7 7h11m0 0-3-3m3 3-3 3M17 17H6m0 0 3 3m-3-3 3-3',
      outlet:'M3 10h18M5 10l1.5-5h11L19 10v9H5v-9Zm4 9v-5h6v5',
      opname:'M9 11l2 2 4-5M5 4h14v16H5V4Z',
      stock:'M21 8.5 12 3 3 8.5l9 5.2 9-5.2ZM3 8.5v7L12 21l9-5.5v-7',
      history:'M12 8v5l3 2M21 12a9 9 0 1 1-3-6.7',
      attendance:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 8a7 7 0 0 0-14 0',
      report:'M4 19V5m0 14h16M8 16v-5m4 5V8m4 8v-7',
      money:'M12 6v12m4-9a4 4 0 0 0-4-2H9.5a2.5 2.5 0 0 0 0 5H14a2.5 2.5 0 0 1 0 5h-2a4 4 0 0 1-4-2',
      settings:'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.4-3.5a7.8 7.8 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7.2 7.2 0 0 0-1.7-1L15 3h-4l-.4 3a7.2 7.2 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a7.8 7.8 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7.2 7.2 0 0 0 1.7 1l.4 3h4l.4-3a7.2 7.2 0 0 0 1.7-1l2.4 1 2-3.5-2.1-1.5c.1-.3.1-.7.1-1Z'
    };
    return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="' + (map[n] || map.dashboard) + '"/></svg>';
  }

  function getModules() {
    const stored = safeJson(localStorage.getItem(storageKey()), []);
    const modules = Array.isArray(stored) && stored.length ? stored : FALLBACK_MODULES;
    return modules.map(function (m) {
      return {
        moduleId: m.MODULE_ID || m.moduleId || '',
        group: m.APP_GROUP || m.group || '',
        key: m.MODULE_KEY || m.moduleKey || '',
        name: m.MODULE_NAME || m.name || m.moduleName || '',
        parent: m.PARENT_MENU || m.parent || 'ROOT',
        url: m.URL || m.url || '',
        permission: m.PERMISSION_KEY || m.permission || m.permissionKey || '',
        order: m.MENU_ORDER || m.order || 999,
        isMenu: m.IS_MENU || m.isMenu || 'Y',
        status: m.STATUS || m.status || 'AKTIF',
        icon: m.ICON || m.icon || 'dashboard'
      };
    }).filter(function (m) { return isY(m.isMenu) && isAktif(m.status); }).sort(sortByOrder);
  }

  function getOpenGroups() {
    return safeJson(localStorage.getItem((cfg().ui && cfg().ui.sidebarOpenGroupKey) || 'APJ_SIDEBAR_OPEN_GROUPS'), {});
  }
  function saveOpenGroups(groups) { localStorage.setItem((cfg().ui && cfg().ui.sidebarOpenGroupKey) || 'APJ_SIDEBAR_OPEN_GROUPS', JSON.stringify(groups || {})); }

  function linkHtml(item) {
    const comingSoon = !item.url || !isAktif(item.status);
    const locked = !comingSoon && window.APJAuth && !window.APJAuth.hasPermission(item.permission);
    const active = item.url && isActive(item.url);
    const href = comingSoon ? '#' : (item.url || '#');
    const stateClass = comingSoon ? 'apj-coming-soon' : (locked ? 'apj-locked' : '');
    const stateAttr = comingSoon ? ' data-coming-soon="Y"' : ' data-locked="' + (locked ? 'Y' : 'N') + '"';
    const badge = comingSoon ? '<span class="apj-soon-badge">Segera Hadir</span>' : (locked ? '<span class="apj-lock-badge">🔒 Lock</span>' : '');
    return '<a href="' + href + '" class="apj-nav-link ' + (active ? 'apj-active ' : '') + stateClass + '" data-url="' + href + '" data-permission="' + (item.permission || '') + '"' + stateAttr + ' data-name="' + item.name + '"><span class="apj-nav-icon">' + icon(item.icon) + '</span><span class="apj-nav-text">' + item.name + '</span>' + badge + '</a>';
  }

  function build() {
    const mount = document.getElementById('apjSidebar');
    if (!mount) return;
    const modules = getModules();
    const roots = modules.filter(function (m) { return String(m.parent).toUpperCase() === 'ROOT'; });
    const grouped = {};
    modules.filter(function (m) { return String(m.parent).toUpperCase() !== 'ROOT'; }).forEach(function (m) {
      grouped[m.parent] = grouped[m.parent] || [];
      grouped[m.parent].push(m);
    });
    const openGroups = getOpenGroups();
    const active = activePath();
    Object.keys(grouped).forEach(function (name) {
      if (grouped[name].some(function (m) { return String(m.url || '').toLowerCase() === active; })) openGroups[name] = true;
    });
    const groupOrder = ['Inventory','Absensi','Keuangan','Admin Setup'];
    const groups = Object.keys(grouped).sort(function (a,b) {
      const ai = groupOrder.indexOf(a), bi = groupOrder.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

    let html = '<aside class="apj-sidebar"><div class="apj-sidebar-brand"><div class="apj-brand-icon">' + icon('stock') + '</div><div class="apj-brand-text"><div class="apj-brand-title">APJ Central</div><div class="apj-brand-subtitle">V18 Unified</div></div><button class="apj-sidebar-toggle" type="button" data-apj-toggle-sidebar aria-label="Toggle sidebar">☰</button></div><nav class="apj-nav">';
    html += '<div class="apj-nav-section"><div class="apj-nav-section-label">Utama</div>';
    roots.forEach(function (item) { html += linkHtml(item); });
    html += '</div>';
    groups.forEach(function (group) {
      const isOpen = !!openGroups[group];
      const groupIcon = group === 'Inventory' ? 'stock' : group === 'Absensi' ? 'attendance' : group === 'Keuangan' ? 'money' : 'settings';
      html += '<div class="apj-nav-section apj-nav-group ' + (isOpen ? 'apj-open' : '') + '" data-group="' + group + '"><button class="apj-nav-group-btn" type="button"><span class="apj-nav-icon">' + icon(groupIcon) + '</span><span class="apj-nav-text">' + group + '</span><span class="apj-chevron">⌄</span></button><div class="apj-subnav">';
      grouped[group].sort(sortByOrder).forEach(function (item) { html += linkHtml(item); });
      html += '</div></div>';
    });
    html += '</nav><div class="apj-sidebar-footer"><button class="apj-btn-guide" type="button" data-apj-guide><span>📘 Panduan</span></button><button class="apj-btn-logout" type="button" data-apj-logout><span>Keluar</span></button></div></aside>';
    mount.innerHTML = html;
    bind();
  }

  function bind() {
    document.querySelectorAll('.apj-nav-group-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const group = btn.closest('.apj-nav-group');
        const name = group.getAttribute('data-group');
        const groups = getOpenGroups();
        group.classList.toggle('apj-open');
        groups[name] = group.classList.contains('apj-open');
        saveOpenGroups(groups);
      });
    });
    document.querySelectorAll('.apj-nav-link').forEach(function (link) {
      link.addEventListener('click', function (event) {
        const comingSoon = link.getAttribute('data-coming-soon') === 'Y';
        const locked = link.getAttribute('data-locked') === 'Y';
        const permission = link.getAttribute('data-permission');
        const url = link.getAttribute('data-url');
        const name = link.getAttribute('data-name') || (link.querySelector('.apj-nav-text') ? link.querySelector('.apj-nav-text').textContent.trim() : 'Menu');
        if (comingSoon) {
          event.preventDefault();
          if (window.APJToast) window.APJToast.info(name + ' segera hadir. Modulnya belum dibuat.');
          return;
        }
        if (locked) {
          event.preventDefault();
          if (window.APJAuth) window.APJAuth.renderAccessDenied('#apjPageContent', permission);
          return;
        }
        if (!url || url === '#') {
          event.preventDefault();
          if (window.APJToast) window.APJToast.info('Modul ini belum memiliki halaman aktif.');
        }
      });
    });
    const logout = document.querySelector('[data-apj-logout]');
    if (logout) logout.addEventListener('click', function () { if (window.APJAuth) window.APJAuth.logout(); });
    const guide = document.querySelector('[data-apj-guide]');
    if (guide) guide.addEventListener('click', function () { if (window.APJGuide) window.APJGuide.open(); });
    document.querySelectorAll('[data-apj-toggle-sidebar]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (window.matchMedia('(max-width: 860px)').matches) {
          document.body.classList.toggle('apj-sidebar-mobile-open');
          const backdrop = document.getElementById('apjMobileBackdrop');
          if (backdrop) backdrop.classList.toggle('apj-show', document.body.classList.contains('apj-sidebar-mobile-open'));
        } else {
          document.body.classList.toggle('apj-sidebar-collapsed');
          localStorage.setItem((cfg().ui && cfg().ui.sidebarCollapsedKey) || 'APJ_SIDEBAR_COLLAPSED', document.body.classList.contains('apj-sidebar-collapsed') ? 'Y' : 'N');
        }
      });
    });
  }

  function init() {
    if (localStorage.getItem((cfg().ui && cfg().ui.sidebarCollapsedKey) || 'APJ_SIDEBAR_COLLAPSED') === 'Y') document.body.classList.add('apj-sidebar-collapsed');
    build();
  }

  window.APJSidebar = { init: init, build: build, getModules: getModules };
})();


/* APP-APJ V2.5 - coming soon semantics patch */
