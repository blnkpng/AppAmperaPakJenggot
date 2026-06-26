/* APJ LAYOUT V18 - topbar, greeting, init umum */
(function () {
  'use strict';

  function session() { return window.APJAuth ? window.APJAuth.getSession() : {}; }

  function greeting() {
    const h = new Date().getHours();
    if (h < 10) return 'Selamat Pagi';
    if (h < 15) return 'Selamat Siang';
    if (h < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  }

  function initials(name) {
    return String(name || 'APJ').split(/\s+/).filter(Boolean).slice(0,2).map(function (w) { return w.charAt(0).toUpperCase(); }).join('') || 'APJ';
  }

  function renderTopbar(options) {
    const target = document.getElementById('apjTopbar');
    if (!target) return;
    const s = session();
    const pageTitle = (options && options.title) || window.APJ_PAGE_TITLE || document.title || 'APJ Central';
    const pageSubtitle = (options && options.subtitle) || window.APJ_PAGE_SUBTITLE || 'Satu pintu operasional APJ';
    target.className = 'apj-topbar';
    target.innerHTML = '<div class="apj-flex apj-items-center apj-gap-3" style="min-width:0"><button class="apj-mobile-menu-btn" type="button" data-apj-toggle-sidebar aria-label="Buka menu">☰</button><div class="apj-topbar-title"><div class="apj-greeting">' + greeting() + ', ' + (s.name || 'Tim APJ') + '</div><div class="apj-page-subtitle">' + pageSubtitle + '</div></div></div><div class="apj-topbar-actions"><div class="apj-user-chip"><div class="apj-user-avatar">' + initials(s.name) + '</div><div class="apj-user-info"><div class="apj-user-name">' + (s.name || '-') + '</div><div class="apj-user-meta">' + (s.level || '-') + ' • ' + (s.outlet || '-') + '</div></div></div></div>';
  }

  function ensureMobileBackdrop() {
    let el = document.getElementById('apjMobileBackdrop');
    if (el) return;
    el = document.createElement('div');
    el.id = 'apjMobileBackdrop';
    el.className = 'apj-mobile-backdrop';
    el.addEventListener('click', function () {
      document.body.classList.remove('apj-sidebar-mobile-open');
      el.classList.remove('apj-show');
    });
    document.body.appendChild(el);
  }

  function init(options) {
    ensureMobileBackdrop();
    if (window.APJAuth && options && options.requireLogin !== false) {
      if (!window.APJAuth.requireLogin()) return;
    }
    if (window.APJSidebar) window.APJSidebar.init();
    renderTopbar(options || {});
    if (window.APJTable) window.APJTable.init();
    if (window.APJGuide) window.APJGuide.init();
    if (window.APJ_PAGE_PERMISSION && window.APJAuth) window.APJAuth.requirePermission(window.APJ_PAGE_PERMISSION, '#apjPageContent');
  }

  window.APJLayout = {
    init: init,
    renderTopbar: renderTopbar,
    greeting: greeting
  };
})();
