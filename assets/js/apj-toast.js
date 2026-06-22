/* APJ TOAST V18 - notifikasi bawah tengah */
(function () {
  'use strict';

  function icon(type) {
    if (type === 'success') return '✓';
    if (type === 'error') return '×';
    if (type === 'warning') return '!';
    return 'i';
  }

  function ensureToast() {
    let toast = document.getElementById('apjToast');
    if (toast) return toast;
    toast = document.createElement('div');
    toast.id = 'apjToast';
    toast.className = 'apj-toast';
    toast.innerHTML = '<div class="apj-toast-inner"><div class="apj-toast-icon" id="apjToastIcon">i</div><div class="apj-toast-message" id="apjToastMessage"></div></div>';
    document.body.appendChild(toast);
    return toast;
  }

  function show(message, type, duration) {
    const cfg = window.APJ_CONFIG || {};
    const toast = ensureToast();
    const toastIcon = document.getElementById('apjToastIcon');
    const toastMessage = document.getElementById('apjToastMessage');
    const kind = type || 'info';
    toast.className = 'apj-toast apj-toast-' + kind + ' apj-show';
    toastIcon.textContent = icon(kind);
    toastMessage.textContent = message || '-';
    window.clearTimeout(window.__apjToastTimer);
    window.__apjToastTimer = window.setTimeout(function () {
      toast.classList.remove('apj-show');
    }, duration || (cfg.ui && cfg.ui.toastDuration) || 3800);
  }

  window.APJToast = {
    show: show,
    success: function (m, d) { show(m, 'success', d); },
    error: function (m, d) { show(m, 'error', d); },
    warning: function (m, d) { show(m, 'warning', d); },
    info: function (m, d) { show(m, 'info', d); }
  };
})();
