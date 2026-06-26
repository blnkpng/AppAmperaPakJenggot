
/*
 * APJ STOK OPNAME V50 - Inventory V3
 * - Data barang dari MASTER_ITEM / STOK_AKHIR melalui backend Inventory V3.
 * - Tampilan petugas hanya nama barang, bukan kode teknis.
 * - Opname hanya koreksi fisik stok gudang pusat.
 */
(function () {
  'use strict';

  const CONFIG = window.APJ_CONFIG || {};
  const API_URL = CONFIG.inventoryApiUrl || (CONFIG.apis && CONFIG.apis.inventory) || 'https://script.google.com/macros/s/AKfycbzisWWG4QzlI2_xB9arSGLAx0zn3Rgcu_Jt9tFXpJZTcXohFXwmE0sDTGCxf-i2OL0k/exec';
  const CORE_API_URL = CONFIG.coreApiUrl || (CONFIG.apis && CONFIG.apis.core) || '';
  const STORAGE = CONFIG.storage || {};
  const STORAGE_KEYS = {
    active: STORAGE.active || 'APJ_SESSION_ACTIVE',
    token: STORAGE.token || 'APJ_SESSION_TOKEN',
    name: STORAGE.name || 'APJ_USER_NAME',
    level: STORAGE.level || 'APJ_USER_LEVEL',
    outlet: STORAGE.outlet || 'APJ_USER_OUTLET',
    permissions: STORAGE.permissions || 'APJ_USER_PERMISSIONS'
  };

  const STATE = {
    categories: [],
    items: [],
    itemById: {}
  };

  document.addEventListener('DOMContentLoaded', initPage);

  async function initPage() {
    if (localStorage.getItem(STORAGE_KEYS.active) !== 'true' || !localStorage.getItem(STORAGE_KEYS.token)) {
      window.location.href = CONFIG.loginPage || 'index.html';
      return;
    }

    initUserHeader();
    initSidebar();
    initModalCloseOnEsc();

    const tanggal = document.getElementById('tanggalInput');
    if (tanggal && !tanggal.value) tanggal.value = todayInputValue();

    const btnSimpan = document.getElementById('btnSimpan');
    if (btnSimpan) btnSimpan.addEventListener('click', saveStokOpname);

    await loadKategoriV3();

    setTimeout(() => {
      if (sessionStorage.getItem('APJ_OPNAME_HELP_SEEN_V33') !== 'true') openOpnameHelpModal(true);
    }, 450);
  }

  function initUserHeader() {
    const nama = localStorage.getItem(STORAGE_KEYS.name) || localStorage.getItem('APJ_USER_USERNAME') || 'Pengguna';
    const level = localStorage.getItem(STORAGE_KEYS.level) || '-';
    setText('namaPetugas', nama);
    setText('displayNama', nama);
    setText('displayLevel', level);
    setText('displayInisial', makeInitial(nama));
  }

  function makeInitial(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'U';
    if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
    return (parts[0].slice(0, 1) + parts[parts.length - 1].slice(0, 1)).toUpperCase();
  }

  function todayInputValue() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value == null ? '' : String(value);
  }

  function getToken() {
    return localStorage.getItem(STORAGE_KEYS.token) || localStorage.getItem('APJ_SESSION_TOKEN') || '';
  }

  function getPetugas() {
    return localStorage.getItem(STORAGE_KEYS.name) || localStorage.getItem('APJ_USER_NAME') || localStorage.getItem('APJ_USER_USERNAME') || '';
  }

  async function callInventory(action, payload) {
    const body = Object.assign({}, payload || {}, {
      action,
      sessionToken: getToken(),
      token: getToken(),
      appName: 'APJ_INVENTORY',
      _clientTs: Date.now(),
      _requestId: 'WEB-' + Date.now() + '-' + Math.random().toString(16).slice(2)
    });

    return requestInventoryJson(body, { retries: 3, timeoutMs: 45000 });
  }

  async function requestInventoryJson(body, options) {
    const retries = Number((options && options.retries) || 3);
    const timeoutMs = Number((options && options.timeoutMs) || 45000);
    let lastError = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
      try {
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          redirect: 'follow',
          cache: 'no-store',
          body: JSON.stringify(body),
          signal: controller ? controller.signal : undefined
        });
        if (timer) clearTimeout(timer);

        const text = await response.text();
        const json = parseInventoryJsonResponse(text);
        if (!response.ok && (!json || json.success !== false)) {
          throw new Error('Server Inventory sedang tidak siap. Coba ulangi beberapa saat lagi.');
        }
        return json;
      } catch (err) {
        if (timer) clearTimeout(timer);
        lastError = err;
        const shouldRetry = attempt < retries && isRetryableApiError(err);
        if (!shouldRetry) break;
        await waitApiRetry(attempt);
      }
    }

    throw new Error(normalizeApiErrorMessage(lastError));
  }

  function parseInventoryJsonResponse(text) {
    const raw = String(text || '').trim();
    if (!raw) throw new Error('Server belum mengirim data. Silakan coba lagi.');

    try { return JSON.parse(raw); }
    catch (firstErr) {
      // Kadang Apps Script / Google mengembalikan teks tambahan atau HTML saat cold start/redirect.
      // Ambil blok JSON pertama supaya request yang sebenarnya sukses tetap bisa dipakai.
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try { return JSON.parse(raw.slice(start, end + 1)); }
        catch (secondErr) {}
      }
      const preview = raw.replace(/\s+/g, ' ').slice(0, 140);
      const err = new Error('Respons server belum siap atau bukan data JSON. Silakan coba lagi.');
      err.serverPreview = preview;
      throw err;
    }
  }

  function isRetryableApiError(err) {
    const msg = String(err && err.message || '').toLowerCase();
    return !msg ||
      msg.includes('fetch') ||
      msg.includes('network') ||
      msg.includes('abort') ||
      msg.includes('timeout') ||
      msg.includes('json') ||
      msg.includes('server belum') ||
      msg.includes('respons server') ||
      msg.includes('tidak siap');
  }

  function normalizeApiErrorMessage(err) {
    const msg = String(err && err.message || '').trim();
    if (!msg) return 'Koneksi server belum stabil. Silakan coba lagi.';
    if (/abort|timeout/i.test(msg)) return 'Server Inventory terlalu lama merespons. Silakan coba lagi.';
    if (/json|respons server|server belum|bukan data/i.test(msg)) return 'Server Inventory sedang sibuk atau belum siap. Silakan tekan ulang tombol setelah beberapa detik.';
    return msg;
  }

  function waitApiRetry(attempt) {
    const delay = Math.min(3500, 650 * Math.pow(2, attempt - 1)) + Math.floor(Math.random() * 250);
    return new Promise(resolve => setTimeout(resolve, delay));
  }


  async function loadKategoriV3() {
    const select = document.getElementById('kategoriSelect');
    if (!select) return;
    select.innerHTML = '<option disabled selected value="">Memuat kategori...</option>';
    setStatus('Mengambil daftar kategori...');
    try {
      const result = await callInventory('getDashboardData', {});
      if (!result.success) throw new Error(result.message || 'Gagal memuat kategori.');
      const rows = Array.isArray(result.kategori) ? result.kategori : [];
      STATE.categories = rows
        .map(row => normalizeCategory(row))
        .filter(cat => cat.nama && cat.aktif !== 'N')
        .sort((a, b) => (Number(a.urutan || 999) - Number(b.urutan || 999)) || a.nama.localeCompare(b.nama, 'id'));

      if (!STATE.categories.length) {
        select.innerHTML = '<option disabled selected value="">Kategori belum tersedia</option>';
        setStatus('Kategori barang belum tersedia.');
        return showToast('Kategori barang aktif belum tersedia.', 'warning');
      }

      select.innerHTML = '<option disabled selected value="">-- Pilih Kategori --</option>' + STATE.categories.map(cat => `<option value="${escapeHtml(cat.nama)}">${escapeHtml(cat.nama)}</option>`).join('');
      select.onchange = handleKategoriChange;
      setStatus('Pilih kategori untuk mulai opname.');
    } catch (err) {
      select.innerHTML = '<option disabled selected value="">Gagal memuat kategori</option>';
      setStatus('Gagal memuat kategori.');
      showToast(err.message || 'Gagal memuat kategori barang.', 'error');
    }
  }

  function normalizeCategory(row) {
    return {
      id: pick(row, ['ID Kategori', 'idKategori', 'id', 'ID']),
      nama: pick(row, ['Nama Kategori', 'namaKategori', 'nama', 'kategori']),
      tipe: pick(row, ['Tipe Stok', 'tipeStok']),
      urutan: pick(row, ['Urutan', 'urutan']),
      aktif: String(pick(row, ['Aktif', 'aktif']) || 'Y').toUpperCase()
    };
  }

  async function handleKategoriChange() {
    const kategori = document.getElementById('kategoriSelect')?.value || '';
    if (!kategori) return;
    setTableMessage('Memuat data stok sistem...', false, true);
    setStatus('Memuat barang...');
    try {
      const result = await callInventory('getBarang', { kategori, context: 'operasional' });
      if (!result.success) throw new Error(result.message || 'Gagal memuat barang.');
      const rows = Array.isArray(result.data) ? result.data : [];
      STATE.items = rows.map(normalizeItem).filter(item => item.id && item.nama);
      STATE.itemById = {};
      STATE.items.forEach(item => { STATE.itemById[item.id] = item; });

      if (!STATE.items.length) {
        setTableMessage('Belum ada barang aktif pada kategori ini.', true);
        setStatus('Kategori ini belum memiliki barang aktif.');
        return;
      }

      clearRows();
      document.getElementById('btnTambahBaris').disabled = false;
      tambahBarisOpname();
      setStatus(`${STATE.items.length} barang siap dipilih.`);
      showToast(`${STATE.items.length} barang siap dipilih.`, 'success');
    } catch (err) {
      setTableMessage('Gagal memuat data stok. Silakan coba lagi.', true);
      setStatus('Gagal memuat data stok.');
      showToast(err.message || 'Gagal memuat data stok.', 'error');
    }
  }

  function normalizeItem(row) {
    return {
      id: String(row.id || row.idItem || row['ID Item'] || '').trim(),
      nama: String(row.nama || row.namaItem || row['Nama Item'] || '').trim(),
      kategori: String(row.kategori || row['Kategori'] || '').trim(),
      stok: numberFrom(row.stokTersedia || row.stokAkhir || row['Stok Akhir'] || 0),
      satuan: String(row.satuanStok || row.satuan || row['Satuan Stok'] || row['Satuan'] || '-').trim() || '-'
    };
  }

  function buildBarangOptions(selectedId) {
    return '<option value="" disabled selected>-- Pilih Barang --</option>' + STATE.items.map(item => {
      const selected = selectedId && selectedId === item.id ? ' selected' : '';
      return `<option value="${escapeHtml(item.id)}"${selected}>${escapeHtml(item.nama)}</option>`;
    }).join('');
  }

  function clearRows() {
    const tbody = document.getElementById('itemTableBody');
    if (tbody) tbody.innerHTML = '';
    updateSummary();
  }


  function buildTableLoadingHtml(message) {
    const safeMessage = escapeHtml(message || 'Memuat data...');
    return `<div class="apj-table-loading-simple" role="status" aria-live="polite">
      <span class="apj-table-spinner-simple" aria-hidden="true"></span>
      <span class="apj-table-loading-text"><strong>${safeMessage}</strong><small>Mohon tunggu, data sedang disiapkan.</small></span>
    </div>`;
  }

  function setTableMessage(message, isError, isLoading) {
    const tbody = document.getElementById('itemTableBody');
    if (!tbody) return;
    if (isLoading) {
      tbody.innerHTML = `<tr class="opname-empty-row apj-loading-row-simple"><td class="apj-loading-cell-simple" colspan="6">${buildTableLoadingHtml(message)}</td></tr>`;
    } else {
      const tone = isError ? 'text-rose-600 dark:text-rose-300' : '';
      tbody.innerHTML = `<tr class="opname-empty-row"><td class="empty-cell p-8 text-center ${tone}" colspan="6">${escapeHtml(message)}</td></tr>`;
    }
    const btn = document.getElementById('btnTambahBaris');
    if (btn) btn.disabled = true;
    updateSummary();
  }

  function tambahBarisOpname() {
    if (!STATE.items.length) {
      showToast('Pilih kategori terlebih dahulu.', 'warning');
      return;
    }
    const tbody = document.getElementById('itemTableBody');
    if (!tbody) return;
    const empty = tbody.querySelector('.opname-empty-row');
    if (empty) tbody.innerHTML = '';

    const tr = document.createElement('tr');
    tr.className = 'opname-row item-row';
    tr.innerHTML = `
      <td data-label="Nama Barang" class="p-3 opname-name-cell">
        <select class="form-control select-barang" onchange="updateBarangOpname(this)">${buildBarangOptions('')}</select>
        <p class="row-help">Pilih nama barang yang dihitung fisiknya.</p>
      </td>
      <td data-label="Stok Sistem" class="p-3 text-center">
        <strong class="label-stok-sistem">0</strong>
        <span class="row-unit label-satuan-system">-</span>
      </td>
      <td data-label="Stok Fisik" class="p-3 text-center">
        <input class="form-control input-fisik text-center" min="0" oninput="calcSelisihOpname(this)" placeholder="0" step="any" type="number" />
      </td>
      <td data-label="Selisih" class="p-3 text-center"><strong class="label-selisih">0</strong></td>
      <td data-label="Alasan Koreksi" class="p-3"><input class="form-control input-alasan" placeholder="Opsional, contoh: rusak/susut/salah hitung" type="text" /></td>
      <td data-label="Aksi" class="p-3 text-center"><button class="row-delete" onclick="hapusBarisOpname(this)" type="button">Hapus</button></td>
    `;
    tbody.appendChild(tr);
    updateSummary();
  }

  function updateBarangOpname(select) {
    const tr = select.closest('.opname-row');
    const item = STATE.itemById[select.value];
    if (!tr || !item) return;
    tr.querySelector('.label-stok-sistem').textContent = formatNumber(item.stok);
    tr.querySelector('.label-satuan-system').textContent = item.satuan;
    calcSelisihOpname(tr.querySelector('.input-fisik'));
  }

  function calcSelisihOpname(input) {
    const tr = input.closest('.opname-row');
    if (!tr) return;
    const select = tr.querySelector('.select-barang');
    const item = STATE.itemById[select.value];
    const stokSistem = item ? numberFrom(item.stok) : numberFrom(tr.querySelector('.label-stok-sistem')?.textContent || 0);
    const fisikText = input.value;
    const fisik = fisikText === '' ? 0 : numberFrom(fisikText);
    const selisih = fisikText === '' ? 0 : round(fisik - stokSistem);
    const el = tr.querySelector('.label-selisih');
    el.textContent = formatNumber(selisih);
    el.className = 'label-selisih ' + (selisih < 0 ? 'selisih-minus' : selisih > 0 ? 'selisih-plus' : 'selisih-zero');
    updateSummary();
  }

  function hapusBarisOpname(button) {
    const tr = button.closest('.opname-row');
    if (tr) tr.remove();
    if (!document.querySelectorAll('.opname-row').length) {
      if (STATE.items.length) tambahBarisOpname();
      else setTableMessage('Pilih kategori untuk mulai stok opname.', false);
    }
    updateSummary();
  }

  function updateSummary() {
    const rows = Array.from(document.querySelectorAll('.opname-row'));
    let itemCount = 0;
    let plus = 0;
    let minus = 0;
    rows.forEach(row => {
      const select = row.querySelector('.select-barang');
      if (!select || !select.value) return;
      itemCount++;
      const selisih = numberFrom(row.querySelector('.label-selisih')?.textContent || 0);
      if (selisih > 0) plus++;
      if (selisih < 0) minus++;
    });
    setText('countItem', `${itemCount} item`);
    setText('countPlus', plus);
    setText('countMinus', minus);
  }

  async function saveStokOpname() {
    const tanggal = document.getElementById('tanggalInput')?.value || '';
    const kategori = document.getElementById('kategoriSelect')?.value || '';
    if (!tanggal || !kategori) return showToast('Tanggal dan kategori wajib diisi.', 'warning');

    const rows = Array.from(document.querySelectorAll('.opname-row'));
    const data = [];
    const selected = new Set();
    for (const row of rows) {
      const select = row.querySelector('.select-barang');
      const fisikInput = row.querySelector('.input-fisik');
      const id = select ? select.value : '';
      const fisikText = fisikInput ? fisikInput.value : '';
      if (!id && fisikText === '') continue;
      if (!id) return showToast('Pilih nama barang pada setiap baris yang diisi.', 'warning');
      if (fisikText === '' || numberFrom(fisikText) < 0) return showToast('Isi stok fisik dengan angka yang benar.', 'warning');
      if (selected.has(id)) return showToast('Barang tidak boleh dobel dalam satu transaksi opname.', 'warning');
      selected.add(id);
      const item = STATE.itemById[id];
      if (!item) return showToast('Data barang tidak ditemukan. Silakan pilih ulang barang.', 'error');
      const stokSistem = numberFrom(item.stok);
      const stokFisik = numberFrom(fisikText);
      const selisih = round(stokFisik - stokSistem);
      data.push({
        tanggal,
        petugas: getPetugas(),
        idItem: item.id,
        nama: item.nama,
        kategori: item.kategori || kategori,
        stokSistem,
        stokFisik,
        selisih,
        satuan: item.satuan,
        alasan: row.querySelector('.input-alasan')?.value || ''
      });
    }

    if (!data.length) return showToast('Belum ada data opname untuk disimpan.', 'warning');

    const btn = document.getElementById('btnSimpan');
    const original = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan...'; }
    setText('saveHint', 'Mohon tunggu, stok opname sedang disimpan.');

    try {
      const result = await callInventory('simpanStokOpname', {
        tanggal,
        petugas: getPetugas(),
        lokasi: 'PUSAT',
        outlet: 'ALL',
        rows: data
      });
      if (!result.success) throw new Error(result.message || 'Gagal menyimpan stok opname.');
      showToast(result.message || 'Stok opname berhasil disimpan.', 'success');
      setText('saveHint', 'Stok opname berhasil disimpan. Halaman akan dimuat ulang.');
      setTimeout(() => window.location.reload(), 1400);
    } catch (err) {
      showToast(err.message || 'Gagal menyimpan stok opname.', 'error');
      if (btn) { btn.disabled = false; btn.textContent = original || 'Simpan Stok Opname'; }
      setText('saveHint', 'Periksa data, lalu coba simpan kembali.');
    }
  }

  function setStatus(text) { setText('statusInfo', text); }

  function pick(obj, keys) {
    for (const key of keys) {
      if (obj && obj[key] != null && String(obj[key]).trim() !== '') return String(obj[key]).trim();
    }
    return '';
  }

  function numberFrom(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    let raw = String(value == null ? '' : value).trim().replace(/\s/g, '');
    if (!raw) return 0;
    const comma = raw.lastIndexOf(',');
    const dot = raw.lastIndexOf('.');
    if (comma !== -1 && dot !== -1) raw = comma > dot ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
    else if (comma !== -1) raw = raw.replace(',', '.');
    else if ((raw.match(/\./g) || []).length > 1) raw = raw.replace(/\./g, '');
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : 0;
  }

  function round(n) { return Math.round((Number(n) || 0) * 1000000) / 1000000; }

  function formatNumber(num) {
    const n = numberFrom(num);
    return n.toLocaleString('id-ID', { maximumFractionDigits: 3 });
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[ch]));
  }

  function showToast(message, type) {
    type = type || 'success';
    const toast = document.getElementById('customToast');
    const msg = document.getElementById('toastMessage');
    if (!toast || !msg) return alert(message);
    msg.textContent = message;
    const tone = type === 'success'
      ? 'bg-emerald-950/95 border-emerald-700/80 text-emerald-200'
      : type === 'warning'
        ? 'bg-amber-950/95 border-amber-700/80 text-amber-100'
        : 'bg-rose-950/95 border-rose-700/80 text-rose-200';
    toast.className = 'toast show flex items-center w-full max-w-md p-4 rounded-xl shadow-2xl border backdrop-blur-xl ' + tone;
    clearTimeout(window.__apjToastTimer);
    window.__apjToastTimer = setTimeout(() => toast.classList.remove('show'), 3800);
  }

  function openModal(id) {
    const modal = document.getElementById(id);
    const overlay = modal ? modal.querySelector('.modal-overlay') : null;
    const content = modal ? modal.querySelector('.modal-content') : null;
    if (!modal || !overlay || !content) return;
    modal.classList.remove('hidden');
    void modal.offsetWidth;
    overlay.classList.add('opacity-100');
    overlay.classList.remove('opacity-0');
    content.classList.add('scale-100', 'opacity-100');
    content.classList.remove('scale-95', 'opacity-0');
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    const overlay = modal ? modal.querySelector('.modal-overlay') : null;
    const content = modal ? modal.querySelector('.modal-content') : null;
    if (!modal || !overlay || !content) return;
    overlay.classList.remove('opacity-100');
    overlay.classList.add('opacity-0');
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 230);
  }

  function openOpnameHelpModal(autoOpen) {
    const modal = document.getElementById('opnameHelpModal');
    if (modal && autoOpen) modal.dataset.autoOpen = 'true';
    openModal('opnameHelpModal');
  }

  function closeOpnameHelpModal() {
    sessionStorage.setItem('APJ_OPNAME_HELP_SEEN_V33', 'true');
    closeModal('opnameHelpModal');
  }

  function showLogoutModal() { openModal('logoutModal'); }
  function closeLogoutModal() { closeModal('logoutModal'); }

  async function executeLogout() {
    try {
      if (CORE_API_URL && getToken()) {
        await fetch(CORE_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'logout', sessionToken: getToken(), token: getToken(), appName: 'APJ_INVENTORY' })
        });
      }
    } catch (err) {}
    Object.keys(STORAGE_KEYS).forEach(k => localStorage.removeItem(STORAGE_KEYS[k]));
    ['APJ_SESSION_ACTIVE','APJ_SESSION_TOKEN','APJ_USER_NAME','APJ_USER_LEVEL','APJ_USER_OUTLET','APJ_USER_PERMISSIONS','APJ_MODULE_ACCESS'].forEach(k => localStorage.removeItem(k));
    window.location.href = CONFIG.loginPage || 'index.html';
  }

  function openMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (!sidebar || !backdrop) return;
    sidebar.classList.remove('sidebar-collapsed');
    sidebar.classList.remove('-translate-x-full');
    backdrop.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (!sidebar || !backdrop) return;
    if (window.innerWidth < 1024) sidebar.classList.add('-translate-x-full');
    backdrop.classList.add('hidden');
    document.body.style.overflow = '';
  }

  function initSidebar() {
    document.querySelectorAll('[data-menu-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const group = btn.closest('.nav-group');
        if (!group) return;
        group.classList.toggle('open');
        btn.setAttribute('aria-expanded', group.classList.contains('open') ? 'true' : 'false');
      });
    });

    const collapseBtn = document.querySelector('[data-sidebar-collapse]');
    if (collapseBtn) collapseBtn.addEventListener('click', () => {
      const sidebar = document.getElementById('sidebar');
      if (!sidebar || window.innerWidth < 1024) return;
      const collapsed = !sidebar.classList.contains('sidebar-collapsed');
      sidebar.classList.toggle('sidebar-collapsed', collapsed);
      document.body.classList.toggle('sidebar-collapsed-active', collapsed);
      try { localStorage.setItem(CONFIG.ui?.sidebarCollapsedKey || 'APJ_SIDEBAR_COLLAPSED', collapsed ? '1' : '0'); } catch (err) {}
    });

    document.querySelectorAll('.nav-coming-soon').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        const name = link.getAttribute('data-coming-soon-menu') || link.textContent.trim() || 'Menu ini';
        showToast(`${name} segera hadir.`, 'warning');
      });
    });

    document.querySelectorAll('#sidebar a[href]:not(.nav-coming-soon)').forEach(link => {
      link.addEventListener('click', () => { if (window.innerWidth < 1024) closeMobileSidebar(); });
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth >= 1024) {
        const backdrop = document.getElementById('sidebarBackdrop');
        if (backdrop) backdrop.classList.add('hidden');
        document.body.style.overflow = '';
      }
    });
  }

  function initModalCloseOnEsc() {
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      ['opnameHelpModal','logoutModal'].forEach(id => {
        const modal = document.getElementById(id);
        if (modal && !modal.classList.contains('hidden')) closeModal(id);
      });
      closeMobileSidebar();
    });
  }

  window.handleKategoriChange = handleKategoriChange;
  window.tambahBarisOpname = tambahBarisOpname;
  window.updateBarangOpname = updateBarangOpname;
  window.calcSelisihOpname = calcSelisihOpname;
  window.hapusBarisOpname = hapusBarisOpname;
  window.openOpnameHelpModal = openOpnameHelpModal;
  window.closeOpnameHelpModal = closeOpnameHelpModal;
  window.showLogoutModal = showLogoutModal;
  window.closeLogoutModal = closeLogoutModal;
  window.executeLogout = executeLogout;
  window.openMobileSidebar = openMobileSidebar;
  window.closeMobileSidebar = closeMobileSidebar;
})();
