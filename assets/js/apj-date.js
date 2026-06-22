/* APJ DATE V18 - dropdown tanggal/bulan/tahun selaras CSS */
(function () {
  'use strict';

  const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

  function pad(n) { return String(n).padStart(2, '0'); }

  function fillSelect(select, values, placeholder) {
    select.innerHTML = '<option value="">' + placeholder + '</option>' + values.map(function (item) {
      return '<option value="' + item.value + '">' + item.label + '</option>';
    }).join('');
  }

  function initDateGroup(prefix, options) {
    const day = document.getElementById(prefix + 'Day');
    const month = document.getElementById(prefix + 'Month');
    const year = document.getElementById(prefix + 'Year');
    if (!day || !month || !year) return;
    const now = new Date();
    const minYear = (options && options.minYear) || 1950;
    const maxYear = (options && options.maxYear) || now.getFullYear();
    fillSelect(day, Array.from({ length: 31 }, function (_, i) { return { value: pad(i + 1), label: pad(i + 1) }; }), 'Tanggal');
    fillSelect(month, MONTHS.map(function (m, i) { return { value: pad(i + 1), label: m }; }), 'Bulan');
    const years = [];
    for (let y = maxYear; y >= minYear; y--) years.push({ value: String(y), label: String(y) });
    fillSelect(year, years, 'Tahun');
  }

  function getDate(prefix) {
    const d = document.getElementById(prefix + 'Day');
    const m = document.getElementById(prefix + 'Month');
    const y = document.getElementById(prefix + 'Year');
    if (!d || !m || !y || !d.value || !m.value || !y.value) return '';
    return d.value + '/' + m.value + '/' + y.value;
  }

  function setDate(prefix, value) {
    const d = document.getElementById(prefix + 'Day');
    const m = document.getElementById(prefix + 'Month');
    const y = document.getElementById(prefix + 'Year');
    if (!d || !m || !y) return;
    const raw = String(value || '').trim();
    if (!raw) { d.value = ''; m.value = ''; y.value = ''; return; }
    let parts = raw.match(/^(\d{4})\D+(\d{1,2})\D+(\d{1,2})$/);
    if (parts) { d.value = pad(parts[3]); m.value = pad(parts[2]); y.value = parts[1]; return; }
    parts = raw.match(/^(\d{1,2})\D+(\d{1,2})\D+(\d{2,4})$/);
    if (!parts) return;
    d.value = pad(parts[1]);
    m.value = pad(parts[2]);
    y.value = parts[3].length === 2 ? '20' + parts[3] : parts[3];
  }

  window.APJDate = { initDateGroup: initDateGroup, getDate: getDate, setDate: setDate };
})();
