/* APJ LEGACY BRIDGE V18
   Membantu halaman inventori lama hidup saat CSS/JS mulai dipindah ke assets.
   Tidak mengganti logic halaman; hanya helper umum yang aman dipakai berulang. */
(function () {
  'use strict';
  function cfg() { return window.APJ_CONFIG || {}; }
  function inventoryUrl() { return cfg().inventoryApiUrl || (cfg().apis && cfg().apis.inventory) || ''; }
  function coreUrl() { return cfg().coreApiUrl || (cfg().apis && cfg().apis.core) || ''; }
  function session() { return window.APJAuth ? window.APJAuth.getSession() : {
    active: localStorage.getItem('APJ_SESSION_ACTIVE') === 'true',
    token: localStorage.getItem('APJ_SESSION_TOKEN') || '',
    name: localStorage.getItem('APJ_USER_NAME') || '',
    level: localStorage.getItem('APJ_USER_LEVEL') || '',
    outlet: localStorage.getItem('APJ_USER_OUTLET') || ''
  }; }
  function initials(name) {
    return String(name || 'APJ').split(/\s+/).filter(Boolean).slice(0,2).map(function (w) { return w.charAt(0).toUpperCase(); }).join('') || 'APJ';
  }
  function hydrateUserChrome() {
    var s = session();
    var map = { displayNama:s.name || '-', displayLevel:s.level || '-', displayInisial:initials(s.name), namaPetugas:s.name || '-' };
    Object.keys(map).forEach(function (id) { var el = document.getElementById(id); if (el) el.textContent = map[id]; });
    return s;
  }
  function requireSession() {
    var s = session();
    if (!s.active || !s.token) { window.location.href = (cfg().loginPage || 'index.html'); return false; }
    return true;
  }
  function showAdminMenu(levelValue) {
    var level = String(levelValue || session().level || '').trim().toLowerCase();
    var show = ['owner','superadmin','super admin','supervisor'].indexOf(level) !== -1;
    document.querySelectorAll('[data-admin-menu], #adminMenuLink').forEach(function (el) { el.classList.toggle('hidden', !show); el.classList.toggle('apj-hidden', !show); });
    return show;
  }
  function applySidebarState() {
    var collapsed = localStorage.getItem('APJ_SIDEBAR_COLLAPSED') === 'Y' || localStorage.getItem('APJ_SIDEBAR_COLLAPSED') === 'true';
    var sidebar = document.getElementById('sidebar') || document.getElementById('apjSidebar');
    if (sidebar) sidebar.classList.toggle('sidebar-collapsed', collapsed);
    document.body.classList.toggle('sidebar-collapsed-active', collapsed);
    document.body.classList.toggle('apj-sidebar-collapsed', collapsed);
  }
  function toggleSidebar() {
    var next = !(localStorage.getItem('APJ_SIDEBAR_COLLAPSED') === 'Y' || localStorage.getItem('APJ_SIDEBAR_COLLAPSED') === 'true');
    localStorage.setItem('APJ_SIDEBAR_COLLAPSED', next ? 'Y' : 'N');
    applySidebarState();
  }
  function initMobileSidebar() {
    var btn = document.getElementById('mobileMenuBtn') || document.querySelector('[data-apj-toggle-sidebar]');
    var backdrop = document.getElementById('sidebarBackdrop') || document.getElementById('apjMobileBackdrop');
    if (btn) btn.addEventListener('click', function () { document.body.classList.add('mobile-sidebar-open','apj-sidebar-mobile-open'); if (backdrop) backdrop.classList.add('show','apj-show'); });
    if (backdrop) backdrop.addEventListener('click', function () { document.body.classList.remove('mobile-sidebar-open','apj-sidebar-mobile-open'); backdrop.classList.remove('show','apj-show'); });
  }
  function initLegacyChrome() {
    hydrateUserChrome();
    showAdminMenu();
    applySidebarState();
    initMobileSidebar();
    var toggle = document.getElementById('sidebarToggle');
    if (toggle && !toggle.dataset.apjBridgeReady) { toggle.addEventListener('click', toggleSidebar); toggle.dataset.apjBridgeReady = 'Y'; }
  }
  window.APJLegacy = {
    inventoryUrl: inventoryUrl,
    coreUrl: coreUrl,
    session: session,
    initials: initials,
    hydrateUserChrome: hydrateUserChrome,
    requireSession: requireSession,
    showAdminMenu: showAdminMenu,
    applySidebarState: applySidebarState,
    toggleSidebar: toggleSidebar,
    initMobileSidebar: initMobileSidebar,
    initLegacyChrome: initLegacyChrome
  };
  document.addEventListener('DOMContentLoaded', initLegacyChrome);
})();
