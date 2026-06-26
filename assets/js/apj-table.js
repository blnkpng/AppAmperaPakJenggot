/* APJ TABLE V18 - tabel desktop, card otomatis di HP */
(function () {
  'use strict';

  function prepare(table) {
    if (!table || table.dataset.apjReady === 'Y') return;
    table.classList.add('apj-responsive-table');
    const headers = Array.from(table.querySelectorAll('thead th')).map(function (th) { return th.textContent.trim(); });
    table.querySelectorAll('tbody tr').forEach(function (tr) {
      Array.from(tr.children).forEach(function (td, index) {
        if (!td.getAttribute('data-label')) td.setAttribute('data-label', headers[index] || 'Data');
      });
    });
    const wrap = table.closest('.apj-table-wrap');
    if (wrap) wrap.classList.add('apj-mobile-card');
    table.dataset.apjReady = 'Y';
  }

  function init(selector) {
    document.querySelectorAll(selector || '.apj-table').forEach(prepare);
  }

  function refresh(selector) {
    document.querySelectorAll(selector || '.apj-table').forEach(function (table) {
      table.dataset.apjReady = 'N';
      prepare(table);
    });
  }

  function emptyRow(table, message) {
    const cols = table.querySelectorAll('thead th').length || 1;
    const tbody = table.querySelector('tbody') || table.appendChild(document.createElement('tbody'));
    tbody.innerHTML = '<tr><td colspan="' + cols + '" class="apj-text-center apj-text-muted">' + (message || 'Belum ada data.') + '</td></tr>';
    refresh();
  }

  window.APJTable = { init: init, refresh: refresh, prepare: prepare, emptyRow: emptyRow };
})();
