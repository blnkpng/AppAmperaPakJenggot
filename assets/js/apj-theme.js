/*
  APJ THEME V18.2 - Dark / Light mode
  Default: dark. Preference stored in localStorage APJ_THEME_MODE.
*/
(function(){
  'use strict';
  var STORAGE_KEY = 'APJ_THEME_MODE';
  var VALID = { dark:true, light:true, auto:true };

  function getStoredMode(){
    try { return localStorage.getItem(STORAGE_KEY) || 'dark'; } catch(e) { return 'dark'; }
  }
  function getSystemMode(){
    try {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    } catch(e) { return 'dark'; }
  }
  function normalizeMode(mode){
    mode = String(mode || '').toLowerCase();
    return VALID[mode] ? mode : 'dark';
  }
  function resolveMode(mode){
    mode = normalizeMode(mode || getStoredMode());
    return mode === 'auto' ? getSystemMode() : mode;
  }
  function labelFor(mode){
    mode = normalizeMode(mode || getStoredMode());
    if (mode === 'auto') return 'Auto';
    return resolveMode(mode) === 'light' ? 'Light' : 'Dark';
  }
  function iconFor(mode){
    var resolved = resolveMode(mode || getStoredMode());
    return resolved === 'light' ? '☀' : '☾';
  }
  function apply(mode, persist){
    mode = normalizeMode(mode || getStoredMode());
    var resolved = resolveMode(mode);
    var root = document.documentElement;
    root.setAttribute('data-theme', resolved);
    root.setAttribute('data-theme-mode', mode);
    root.classList.remove('apj-theme-dark','apj-theme-light');
    root.classList.add('apj-theme-' + resolved);
    if (document.body) {
      document.body.setAttribute('data-theme', resolved);
      document.body.setAttribute('data-theme-mode', mode);
      document.body.classList.remove('apj-theme-dark','apj-theme-light');
      document.body.classList.add('apj-theme-' + resolved);
    }
    if (persist !== false) {
      try { localStorage.setItem(STORAGE_KEY, mode); } catch(e) {}
    }
    updateControls(mode);
    return resolved;
  }
  function setMode(mode){
    return apply(mode, true);
  }
  function toggle(){
    var current = normalizeMode(getStoredMode());
    var next = resolveMode(current) === 'light' ? 'dark' : 'light';
    var resolved = apply(next, true);
    if (window.APJToast) {
      window.APJToast.info('Mode ' + (resolved === 'light' ? 'Light' : 'Dark') + ' aktif.');
    }
    return resolved;
  }
  function cycle(){
    return toggle();
  }
  function updateControls(mode){
    mode = normalizeMode(mode || getStoredMode());
    var label = labelFor(mode);
    var icon = iconFor(mode);
    var buttons = document.querySelectorAll('[data-apj-theme-toggle]');
    for (var i=0;i<buttons.length;i++) {
      var btn = buttons[i];
      btn.setAttribute('aria-label','Ganti mode tema. Saat ini ' + label);
      btn.setAttribute('title','Tema: ' + label + '. Klik untuk ganti.');
      btn.setAttribute('aria-pressed', resolveMode(mode) === 'light' ? 'true' : 'false');
      var iconEl = btn.querySelector('[data-apj-theme-icon]');
      var labelEl = btn.querySelector('[data-apj-theme-label]');
      if (iconEl) iconEl.textContent = icon;
      if (labelEl) labelEl.textContent = label;
    }
  }
  function init(){
    apply(getStoredMode(), false);
    document.addEventListener('click', function(event){
      var btn = event.target.closest && event.target.closest('[data-apj-theme-toggle]');
      if (!btn) return;
      event.preventDefault();
      toggle();
    });
    updateControls(getStoredMode());
  }

  window.APJTheme = {
    init:init,
    apply:apply,
    setMode:setMode,
    toggle:toggle,
    cycle:cycle,
    getMode:getStoredMode,
    getResolvedMode:function(){ return resolveMode(getStoredMode()); }
  };

  apply(getStoredMode(), false);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  try {
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: light)');
      var onChange = function(){ if (normalizeMode(getStoredMode()) === 'auto') apply('auto', false); };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
  } catch(e) {}
})();


/* APP-APJ V2.5 - global coming soon nav handler */
(function(){
  'use strict';
  function notify(message, type){
    if (typeof window.showToast === 'function') return window.showToast(message, type || 'info');
    if (window.APJToast && typeof window.APJToast.info === 'function') return window.APJToast.info(message);
    alert(message);
  }
  document.addEventListener('DOMContentLoaded', function(){
    document.querySelectorAll('[data-coming-soon-menu]').forEach(function(link){
      if (link.dataset.apjSoonBound === 'Y') return;
      link.dataset.apjSoonBound = 'Y';
      link.addEventListener('click', function(event){
        event.preventDefault();
        event.stopPropagation();
        var name = link.getAttribute('data-coming-soon-menu') || 'Menu';
        notify(name + ' segera hadir. Modulnya belum dibuat, jadi bukan masalah akses akun.', 'info');
      });
    });
  });
})();


/* APP-APJ V2.6 - unified access gate + sidebar Lock semantics */
(function(){
  'use strict';

  var PAGE_PERMISSIONS = {
    'dashboard.html': 'dashboard',
    'input-stok.html': 'inputStok',
    'output-stok.html': 'outputStok',
    'transfer-produksi.html': 'transferProduksi',
    'produk-outlet.html': 'produkOutlet',
    'stok-opname.html': 'stokOpname',
    'lihat-stok.html': 'lihatStok',
    'riwayat-transaksi.html': 'riwayatTransaksi',
    'admin.html': 'admin'
  };

  var INVENTORY_PERMISSIONS = ['dashboard','inputStok','outputStok','transferProduksi','produkOutlet','stokOpname','lihatStok','riwayatTransaksi','admin'];

  function pageName(){ return (location.pathname.split('/').pop() || 'dashboard.html').toLowerCase(); }
  function safeJson(value, fallback){ try { return value ? JSON.parse(value) : fallback; } catch(e){ return fallback; } }
  function norm(value){ return String(value == null ? '' : value).trim().toUpperCase(); }
  function isYes(value){ return value === true || value === 1 || norm(value) === 'Y' || norm(value) === 'TRUE' || norm(value) === 'YA'; }
  function level(){ return norm(localStorage.getItem('APJ_USER_LEVEL') || ''); }
  function permissions(){ return safeJson(localStorage.getItem('APJ_USER_PERMISSIONS') || '{}', {}) || {}; }
  function isFullAccess(){ var l = level(); return l === 'OWNER' || l === 'SUPERADMIN'; }
  function hasPermission(key){ if (!key) return true; if (isFullAccess()) return true; return isYes(permissions()[key]); }
  function hasAnyInventoryAccess(){
    if (isFullAccess()) return true;
    var p = permissions();
    return INVENTORY_PERMISSIONS.some(function(key){ return isYes(p[key]); });
  }
  function permissionForHref(href){
    var clean = String(href || '').split('#')[0].split('?')[0].split('/').pop().toLowerCase();
    return PAGE_PERMISSIONS[clean] || '';
  }
  function canOpenHref(href){
    var clean = String(href || '').split('#')[0].split('?')[0].split('/').pop().toLowerCase();
    if (!clean || clean === '#') return true;
    if (clean === 'dashboard.html') return hasAnyInventoryAccess();
    var key = PAGE_PERMISSIONS[clean];
    return !key || hasPermission(key);
  }
  function currentCanOpen(){
    var current = pageName();
    if (current === 'index.html') return true;
    if (current === 'dashboard.html') return hasAnyInventoryAccess();
    return canOpenHref(current);
  }
  function getPageLabel(file){
    var map = {
      'dashboard.html':'Dashboard', 'input-stok.html':'Input Stok', 'output-stok.html':'Output Stok',
      'transfer-produksi.html':'Transfer Produk Outlet', 'produk-outlet.html':'Produk Outlet',
      'stok-opname.html':'Stok Opname', 'lihat-stok.html':'Lihat Stok', 'riwayat-transaksi.html':'Riwayat Transaksi', 'admin.html':'Admin Sistem'
    };
    return map[file || pageName()] || 'Menu';
  }
  function ensureLockBadge(link){
    if (!link || link.querySelector('.nav-lock')) return;
    var oldSoon = link.querySelector('.nav-soon');
    if (oldSoon) return;
    var badge = document.createElement('span');
    badge.className = 'nav-lock';
    badge.textContent = 'Lock';
    link.appendChild(badge);
  }
  function renderDenied(target, options){
    options = options || {};
    var mount = target || document.querySelector('#apjPageContent') || document.querySelector('.page-scroll') || document.querySelector('main') || document.body;
    var menuName = options.menuName || getPageLabel(pageName());
    var message = options.message || ('Menu ini hanya tersedia untuk role dengan izin ' + menuName + '.');
    var html = '<section class="apj-unified-denied" data-apj-access-denied="Y">' +
      '<div class="apj-unified-denied-card">' +
      '<div class="apj-unified-denied-icon">🔒</div>' +
      '<div class="apj-unified-denied-copy"><h2>Akses Ditolak</h2><p>' + escapeHtml(message) + '</p></div>' +
      '</div>' +
      '</section>';
    if (mount.classList && mount.classList.contains('page-scroll')) {
      mount.innerHTML = html;
    } else if (mount.tagName && mount.tagName.toLowerCase() === 'main') {
      var topbar = mount.querySelector('.topbar');
      mount.querySelectorAll(':scope > *:not(.topbar)').forEach(function(el){ el.remove(); });
      var div = document.createElement('div');
      div.className = 'page-scroll';
      div.innerHTML = html;
      if (topbar) topbar.insertAdjacentElement('afterend', div); else mount.appendChild(div);
    } else {
      mount.innerHTML = html;
    }
  }
  function escapeHtml(value){
    return String(value == null ? '' : value).replace(/[&<>'"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]; });
  }
  function syncSidebarLocks(){
    document.querySelectorAll('.nav-item[href]').forEach(function(link){
      if (link.classList.contains('nav-coming-soon') || link.getAttribute('data-coming-soon-menu')) return;
      var href = link.getAttribute('href') || '';
      var clean = href.split('#')[0].split('?')[0].split('/').pop().toLowerCase();
      if (!PAGE_PERMISSIONS[clean] && clean !== 'dashboard.html') return;
      if (!canOpenHref(href)) {
        link.classList.add('nav-locked');
        link.setAttribute('data-locked-menu', link.getAttribute('title') || (link.querySelector('.nav-text') ? link.querySelector('.nav-text').textContent.trim() : getPageLabel(clean)));
        link.setAttribute('aria-disabled','true');
        ensureLockBadge(link);
      } else {
        link.classList.remove('nav-locked');
        link.removeAttribute('data-locked-menu');
        link.removeAttribute('aria-disabled');
        var badge = link.querySelector('.nav-lock');
        if (badge) badge.remove();
      }
    });
    document.querySelectorAll('.nav-locked').forEach(function(link){
      if (link.dataset.apjLockBound === 'Y') return;
      link.dataset.apjLockBound = 'Y';
      link.addEventListener('click', function(event){
        event.preventDefault();
        var name = link.getAttribute('data-locked-menu') || 'Menu';
        if (window.APJToast && typeof window.APJToast.warning === 'function') window.APJToast.warning(name + ' terkunci untuk akun ini.');
        else if (typeof window.showToast === 'function') window.showToast(name + ' terkunci untuk akun ini.', 'warning');
      });
    });
  }
  function gateCurrentPage(){
    if (localStorage.getItem('APJ_SESSION_ACTIVE') !== 'true') return;
    var current = pageName();
    if (current === 'index.html') return;
    if (!currentCanOpen()) {
      renderDenied(null, { menuName: getPageLabel(current) });
    }
  }
  function init(){
    syncSidebarLocks();
    // Run once more after page-specific JS has initialized DOM and possible active state.
    setTimeout(syncSidebarLocks, 80);
    setTimeout(gateCurrentPage, 120);
  }
  document.addEventListener('DOMContentLoaded', init);
  window.APJAccessUI = {
    hasPermission: hasPermission,
    hasAnyInventoryAccess: hasAnyInventoryAccess,
    canOpenHref: canOpenHref,
    currentCanOpen: currentCanOpen,
    renderDenied: renderDenied,
    syncSidebarLocks: syncSidebarLocks
  };
})();
