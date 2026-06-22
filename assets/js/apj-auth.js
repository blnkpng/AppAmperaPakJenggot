/* APJ AUTH V18 - session, permission, akses ditolak */
(function () {
  'use strict';

  function cfg() { return window.APJ_CONFIG || {}; }
  function keys() { return (cfg().storage || {}); }

  function safeJson(value, fallback) {
    try { return value ? JSON.parse(value) : fallback; } catch (e) { return fallback; }
  }

  function getSession() {
    const k = keys();
    const active = localStorage.getItem(k.active || 'APJ_SESSION_ACTIVE') === 'true';
    const user = safeJson(localStorage.getItem(k.user || 'APJ_USER_DATA'), null) || {};
    return {
      active: active,
      token: localStorage.getItem(k.token || 'APJ_SESSION_TOKEN') || '',
      userId: localStorage.getItem(k.userId || 'APJ_USER_ID') || user.userId || '',
      username: localStorage.getItem(k.username || 'APJ_USER_USERNAME') || user.username || '',
      name: localStorage.getItem(k.name || 'APJ_USER_NAME') || user.nama || user.name || '',
      level: localStorage.getItem(k.level || 'APJ_USER_LEVEL') || user.level || '',
      outlet: localStorage.getItem(k.outlet || 'APJ_USER_OUTLET') || user.outlet || user.outletUtama || '',
      outletAccess: localStorage.getItem(k.outletAccess || 'APJ_USER_OUTLET_ACCESS') || user.outletAkses || '',
      permissions: safeJson(localStorage.getItem(k.permissions || 'APJ_USER_PERMISSIONS'), {}),
      modules: safeJson(localStorage.getItem(k.modules || 'APJ_MODULE_ACCESS'), [])
    };
  }

  function saveSession(result) {
    const k = keys();
    const user = (result && result.user) || {};
    const permissions = result.permissions || user.permissions || {};
    const modules = result.modules || result.moduleAccess || user.modules || [];
    localStorage.setItem(k.active || 'APJ_SESSION_ACTIVE', 'true');
    localStorage.setItem(k.token || 'APJ_SESSION_TOKEN', result.sessionToken || result.token || result.authToken || '');
    localStorage.setItem(k.userId || 'APJ_USER_ID', user.userId || user.USER_ID || '');
    localStorage.setItem(k.username || 'APJ_USER_USERNAME', user.username || user.USERNAME || '');
    localStorage.setItem(k.name || 'APJ_USER_NAME', user.nama || user.NAMA || user.name || '');
    localStorage.setItem(k.level || 'APJ_USER_LEVEL', user.level || user.LEVEL || '');
    localStorage.setItem(k.outlet || 'APJ_USER_OUTLET', user.outlet || user.outletUtama || user.OUTLET_UTAMA || '');
    localStorage.setItem(k.outletAccess || 'APJ_USER_OUTLET_ACCESS', user.outletAkses || user.OUTLET_AKSES || '');
    localStorage.setItem(k.permissions || 'APJ_USER_PERMISSIONS', JSON.stringify(permissions || {}));
    localStorage.setItem(k.modules || 'APJ_MODULE_ACCESS', JSON.stringify(modules || []));
    localStorage.setItem(k.user || 'APJ_USER_DATA', JSON.stringify(user));
  }

  function clearSession() {
    Object.keys(keys()).forEach(function (key) {
      localStorage.removeItem(keys()[key]);
    });
    // kompatibilitas key lama
    ['APJ_SESSION_ACTIVE','APJ_SESSION_TOKEN','APJ_USER_NAME','APJ_USER_LEVEL','APJ_USER_OUTLET','APJ_USER_PERMISSIONS','APJ_MODULE_ACCESS','APJ_USER_DATA','APJ_USER_USERNAME'].forEach(function (key) {
      localStorage.removeItem(key);
    });
  }

  function normalizeBool(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value > 0;
    return String(value || '').trim().toUpperCase() === 'Y' || String(value || '').trim().toUpperCase() === 'TRUE';
  }

  function hasPermission(permissionKey) {
    if (!permissionKey) return true;
    const session = getSession();
    const level = String(session.level || '').toUpperCase();
    if (level === 'OWNER' || level === 'SUPERADMIN') return true;
    return normalizeBool(session.permissions && session.permissions[permissionKey]);
  }

  function requireLogin() {
    const session = getSession();
    if (!session.active) {
      window.location.href = (cfg().loginPage || 'index.html');
      return false;
    }
    return true;
  }

  function requirePermission(permissionKey, targetSelector) {
    if (!requireLogin()) return false;
    if (!permissionKey || hasPermission(permissionKey)) return true;
    renderAccessDenied(targetSelector, permissionKey);
    return false;
  }

  function renderAccessDenied(targetSelector, permissionKey) {
    const target = document.querySelector(targetSelector || '#apjPageContent') || document.querySelector('main') || document.body;
    target.innerHTML = '<section class="apj-access-denied"><div class="apj-card apj-denied-card"><div class="apj-denied-icon">🔒</div><h1 class="apj-denied-title">Akses Ditolak</h1><p class="apj-denied-text">Akun Anda belum memiliki izin untuk membuka halaman ini. Menu tetap ditampilkan sebagai Lock agar alur sistem mudah dipahami.</p><button class="apj-btn apj-btn-primary" type="button" onclick="window.location.href=\'dashboard.html\'">Kembali ke Dashboard</button></div></section>';
    if (window.APJToast) window.APJToast.warning('Akses menu terkunci: ' + (permissionKey || '-'));
  }

  function logout() {
    clearSession();
    window.location.href = (cfg().loginPage || 'index.html');
  }

  window.APJAuth = {
    getSession: getSession,
    saveSession: saveSession,
    clearSession: clearSession,
    hasPermission: hasPermission,
    requireLogin: requireLogin,
    requirePermission: requirePermission,
    renderAccessDenied: renderAccessDenied,
    logout: logout
  };
})();
