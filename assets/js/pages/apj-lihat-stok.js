
/*
 * APJ LIHAT STOK V105 - Cetak Rekap PIC Direct Core User Fix
 * - Tampilan karyawan dibuat formal tanpa istilah teknis sheet/backend.
 * - Data penandatangan diambil dari backend Inventory yang membaca APJ_CORE_USER.USER secara langsung.
 * - Cetak rekap dibuat bersih, tanggal diperbarui diformat, dan penandatangan memakai daftar karyawan.
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
    rows: [],
    filteredRows: [],
    selectedKategori: '',
    selectedKategoriLabel: 'Semua Kategori',
    lastSync: null,
    signers: []
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
    bindEvents();

    loadSignatureUsers();
    await loadKategoriV3();
    await loadStokData();

    setTimeout(() => {
      if (sessionStorage.getItem('APJ_LIHAT_STOK_HELP_SEEN_V40') !== 'true') openLihatStokHelpModal(true);
    }, 450);
  }

  function bindEvents() {
    const kategori = document.getElementById('kategoriSelect');
    if (kategori) kategori.addEventListener('change', loadStokData);
    const search = document.getElementById('searchInput');
    if (search) search.addEventListener('input', renderTable);
    const btnRefresh = document.getElementById('btnRefresh');
    if (btnRefresh) btnRefresh.addEventListener('click', loadStokData);
    const btnPrint = document.getElementById('btnPrint');
    if (btnPrint) btnPrint.addEventListener('click', openModalPrint);
    const btnProcessPrint = document.getElementById('btnProcessPrint');
    if (btnProcessPrint) btnProcessPrint.addEventListener('click', processPrint);
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

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value == null ? '' : String(value);
  }

  function getToken() {
    return localStorage.getItem(STORAGE_KEYS.token) || localStorage.getItem('APJ_SESSION_TOKEN') || '';
  }

  async function callInventory(action, payload) {
    const body = buildApiPayload(action, payload, 'APJ_INVENTORY');
    return requestApiJson(API_URL, body, { retries: 3, timeoutMs: 45000 });
  }

  async function callCore(action, payload) {
    if (!CORE_API_URL) throw new Error('Daftar karyawan belum tersedia.');
    const body = buildApiPayload(action, payload, 'APJ_INVENTORY');
    return requestApiJson(CORE_API_URL, body, { retries: 2, timeoutMs: 12000 });
  }

  function buildApiPayload(action, payload, appName) {
    return Object.assign({}, payload || {}, {
      action,
      sessionToken: getToken(),
      token: getToken(),
      appName: appName || 'APJ_INVENTORY',
      _clientTs: Date.now(),
      _requestId: 'WEB-' + Date.now() + '-' + Math.random().toString(16).slice(2)
    });
  }

  async function requestApiJson(url, body, options) {
    const retries = Number((options && options.retries) || 3);
    const timeoutMs = Number((options && options.timeoutMs) || 45000);
    let lastError = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
      try {
        const response = await fetch(url, {
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
        if (!response.ok && (!json || json.success !== false)) throw new Error('Server sedang belum siap. Silakan coba lagi.');
        return json;
      } catch (err) {
        if (timer) clearTimeout(timer);
        lastError = err;
        if (!(attempt < retries && isRetryableApiError(err))) break;
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
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try { return JSON.parse(raw.slice(start, end + 1)); }
        catch (secondErr) {}
      }
      throw new Error('Server belum siap mengirim data. Silakan coba lagi.');
    }
  }

  function isRetryableApiError(err) {
    const msg = String((err && err.message) || err || '').toLowerCase();
    return msg.includes('failed to fetch') || msg.includes('network') || msg.includes('abort') || msg.includes('timeout') || msg.includes('json') || msg.includes('belum siap') || msg.includes('server');
  }

  function waitApiRetry(attempt) {
    return new Promise(resolve => setTimeout(resolve, 450 * attempt + Math.floor(Math.random() * 250)));
  }

  function normalizeApiErrorMessage(err) {
    const msg = String((err && err.message) || err || '').trim();
    if (!msg) return 'Sistem sedang sibuk. Silakan coba ulang beberapa detik lagi.';
    if (/abort|timeout|failed to fetch|network/i.test(msg)) return 'Koneksi sistem belum stabil. Silakan coba ulang beberapa detik lagi.';
    return msg;
  }

  async function loadSignatureUsers() {
    const current = currentUserAsSigner();
    STATE.signers = [current];
    fillSignatureSelects([current], false);

    // V105: sumber resmi penanggung jawab/PIC adalah backend Inventory,
    // karena backend sudah membaca langsung APJ_CORE_USER.USER dengan SpreadsheetApp.openById.
    const inventoryActions = [
      'getPicKaryawanList',
      'getInventoryPicList',
      'getAllPicKaryawan',
      'getOutputPicList',
      'getTransferPicList',
      'getKaryawanAktifInventory',
      'getTransferProduksiInit'
    ];

    for (const action of inventoryActions) {
      try {
        const res = await callInventory(action, {
          includeInactive: false,
          aktifOnly: true,
          includeAllUsers: true,
          allowAllUsers: true,
          forDropdown: true,
          forPicDropdown: true,
          context: 'LIHAT_STOK_CETAK_REKAP',
          source: 'lihat-stok'
        });
        const sourceRows = extractSignatureUserRows(res);
        const users = normalizeSignatureUsers(sourceRows);
        if (res && res.success && users.length) {
          STATE.signers = users;
          fillSignatureSelects(STATE.signers, false);
          if (users.length > 1) return;
        }
      } catch (err) {
        // Coba action Inventory berikutnya. Jika semua gagal, tetap gunakan user aktif.
      }
    }

    // Core frontend hanya fallback lama. Jangan dijadikan sumber utama.
    const coreActions = ['getSignatureUsers', 'getDaftarPenandatangan', 'adminGetUsers'];
    for (const action of coreActions) {
      try {
        const res = await callCore(action, { appName: 'APJ_INVENTORY', includeAllUsers: true, allowAllUsers: true, forDropdown: true });
        const sourceRows = extractSignatureUserRows(res);
        const users = normalizeSignatureUsers(sourceRows);
        if (res && res.success && users.length > STATE.signers.length) {
          STATE.signers = users;
          fillSignatureSelects(STATE.signers, false);
          return;
        }
      } catch (err) {
        // lanjut ke action berikutnya.
      }
    }

    STATE.signers = ensureCurrentSigner(STATE.signers && STATE.signers.length ? STATE.signers : [current], current);
    fillSignatureSelects(STATE.signers, false);
  }

  function extractSignatureUserRows(res) {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    const keys = ['pics', 'pic', 'picList', 'daftarPic', 'daftarPIC', 'users', 'user', 'karyawan', 'pegawai', 'staff', 'penandatangan', 'signers', 'signatureUsers', 'employees', 'employee', 'rows', 'items', 'list', 'dataRows', 'records', 'allUsers', 'activeUsers', 'karyawanAktif', 'userList', 'employeeList'];
    for (const key of keys) {
      if (Array.isArray(res[key])) return res[key];
    }
    if (Array.isArray(res.data)) return res.data;
    if (res.data && typeof res.data === 'object') {
      for (const key of keys) {
        if (Array.isArray(res.data[key])) return res.data[key];
      }
    }
    return findBestSignatureArray(res);
  }

  function findBestSignatureArray(value, depth) {
    depth = depth || 0;
    if (!value || depth > 3) return [];
    if (Array.isArray(value)) return normalizeSignatureUsers(value).length ? value : [];
    if (typeof value !== 'object') return [];
    let best = [];
    Object.keys(value).forEach(key => {
      const candidate = findBestSignatureArray(value[key], depth + 1);
      if (normalizeSignatureUsers(candidate).length > normalizeSignatureUsers(best).length) best = candidate;
    });
    return best;
  }

  function currentUserAsSigner() {
    return {
      nama: localStorage.getItem(STORAGE_KEYS.name) || localStorage.getItem('APJ_USER_USERNAME') || 'Pengguna',
      level: localStorage.getItem(STORAGE_KEYS.level) || '',
      outlet: localStorage.getItem(STORAGE_KEYS.outlet) || ''
    };
  }

  function normalizeSignatureUsers(users) {
    const seen = {};
    return (users || []).map(user => {
      if (typeof user === 'string') return { nama: user.trim(), level: '', outlet: '', status: 'AKTIF' };
      const nama = stringFirst(
        user.namaPic, user.NAMA_PIC, user['Nama PIC'], user['NAMA PIC'], user.pic, user.PIC,
        user.penerima, user.PENERIMA, user['Penanggung Jawab'], user['PENANGGUNG JAWAB'], user.penanggungJawab, user.PENANGGUNG_JAWAB,
        user.nama, user.NAMA, user['Nama'], user['Nama Karyawan'], user['NAMA KARYAWAN'], user.NAMA_KARYAWAN,
        user.namaKaryawan, user.NAMA_LENGKAP, user['NAMA LENGKAP'], user.namaLengkap,
        user.name, user.NAME, user.fullName, user.FULL_NAME, user.displayName, user.DISPLAY_NAME,
        user.namaUser, user.NAMA_USER, user['NAMA USER'], user.username, user.USERNAME, user.email, user.EMAIL,
        user.value, user.label
      );
      const level = stringFirst(user.level, user.LEVEL, user.role, user.ROLE, user.jabatan, user.JABATAN);
      const outlet = stringFirst(user.outletUtama, user.OUTLET_UTAMA, user.outlet, user.OUTLET, user.outletAkses, user.OUTLET_AKSES);
      const status = stringFirst(user.status, user.STATUS, user.aktif, user.AKTIF, user.active, user.ACTIVE, user.isActive, user.IS_ACTIVE, user.statusAktif, user.STATUS_AKTIF, 'AKTIF');
      return { nama, level, outlet, status };
    }).filter(user => user.nama && isActiveStatus(user.status)).filter(user => {
      const key = user.nama.toLowerCase();
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    }).sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
  }

  function fillSignatureSelects(users, loading) {
    const current = currentUserAsSigner();
    const list = ensureCurrentSigner(users, current);
    fillSignerSelect('modalSup', list, 'Pilih penanggung jawab', current.nama, loading);
    fillSignerSelect('modalPic1', list, 'Pilih PIC 1', current.nama, loading);
    fillSignerSelect('modalPic2', list, 'Tanpa PIC 2', '', loading, true);
  }

  function ensureCurrentSigner(users, current) {
    const list = Array.isArray(users) ? users.slice() : [];
    if (current && current.nama && !list.some(user => sameText(user.nama, current.nama))) list.unshift(current);
    return list;
  }

  function isSupervisorSigner(user) {
    const level = String((user && user.level) || '').toUpperCase();
    return /OWNER|SUPER|SUPERVISOR|SPV|GUDANG|PRODUKSI/.test(level);
  }

  function fillSignerSelect(id, users, placeholder, selectedName, loading, allowEmpty) {
    const select = document.getElementById(id);
    if (!select) return;
    const previous = select.value;
    if (loading) {
      select.innerHTML = `<option value="">Memuat data karyawan...</option>`;
      select.disabled = true;
      return;
    }
    const options = [];
    options.push(`<option value="">${escapeHtml(placeholder || 'Pilih nama')}</option>`);
    (users || []).forEach(user => {
      const name = stringFirst(user.nama);
      if (!name) return;
      const title = [user.level, user.outlet].filter(Boolean).join(' • ');
      options.push(`<option value="${escapeAttr(name)}" title="${escapeAttr(title)}">${escapeHtml(name)}</option>`);
    });
    select.innerHTML = options.join('');
    select.disabled = false;

    const target = previous || selectedName || '';
    if (target && Array.from(select.options).some(opt => sameText(opt.value, target))) {
      select.value = Array.from(select.options).find(opt => sameText(opt.value, target)).value;
    } else if (!allowEmpty && select.options.length > 1) {
      select.selectedIndex = 1;
    }
  }

  function sameText(a, b) {
    return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  }

  function isActiveStatus(value) {
    const status = String(value || '').trim().toUpperCase();
    return !status || ['AKTIF', 'ACTIVE', 'Y', 'YA', 'TRUE', '1'].includes(status);
  }

  async function loadKategoriV3() {
    const select = document.getElementById('kategoriSelect');
    if (!select) return;
    select.disabled = true;
    try {
      const res = await callInventory('getDashboardData', {});
      if (!res || !res.success) throw new Error((res && res.message) || 'Kategori stok belum bisa dimuat.');
      const rows = Array.isArray(res.kategori) ? res.kategori : [];
      STATE.categories = normalizeCategoryRows(rows);
      select.innerHTML = '<option value="">Semua Kategori</option>' + STATE.categories.map(cat => `<option value="${escapeAttr(cat.nama)}">${escapeHtml(cat.nama)}</option>`).join('');
    } catch (err) {
      select.innerHTML = '<option value="">Semua Kategori</option>';
      showToast(normalizeApiErrorMessage(err), 'error');
    } finally {
      select.disabled = false;
    }
  }

  function normalizeCategoryRows(rows) {
    const seen = {};
    return (rows || []).map(row => {
      const nama = stringFirst(row['Nama Kategori'], row.namaKategori, row.nama, row.Kategori, row.kategori);
      const urutan = numFirst(row.Urutan, row.urutan, 9999);
      const aktif = stringFirst(row.Aktif, row.aktif, 'Y');
      return { nama, urutan, aktif };
    }).filter(cat => cat.nama && isYes(cat.aktif, true)).filter(cat => {
      const key = cat.nama.toLowerCase();
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    }).sort((a, b) => (a.urutan - b.urutan) || a.nama.localeCompare(b.nama, 'id'));
  }

  async function loadStokData() {
    const select = document.getElementById('kategoriSelect');
    const btn = document.getElementById('btnRefresh');
    const kategori = select ? select.value : '';
    STATE.selectedKategori = kategori;
    STATE.selectedKategoriLabel = kategori || 'Semua Kategori';
    setText('cardKategori', STATE.selectedKategoriLabel);
    setInfo('Memuat data stok terbaru. Mohon tunggu sebentar...', 'info');
    setTableLoading('Memuat data stok...');
    if (btn) btn.disabled = true;

    try {
      const res = await callInventory('getStokAkhirReport', kategori ? { kategori } : {});
      if (!res || !res.success) throw new Error((res && res.message) || 'Data stok belum bisa dimuat.');
      STATE.rows = normalizeStockRows(res.data || []);
      STATE.lastSync = new Date();
      renderTable();
      setInfo('Data stok berhasil diperbarui. Gunakan tombol Muat Ulang setelah ada perubahan data.', 'success');
      showToast('Data stok berhasil dimuat.', 'success');
    } catch (err) {
      STATE.rows = [];
      STATE.filteredRows = [];
      updateCards([]);
      setTableEmpty(normalizeApiErrorMessage(err), 'error');
      setInfo('Data stok belum berhasil dimuat. Silakan coba Muat Ulang atau hubungi admin apabila kendala masih terjadi.', 'error');
      showToast(normalizeApiErrorMessage(err), 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function normalizeStockRows(rows) {
    return (rows || []).map(row => {
      const qty = numFirst(row.stokTersedia, row['Stok Akhir'], row.stokAkhir, row.qtyAkhir, 0);
      const nama = stringFirst(row.nama, row.namaItem, row['Nama Item'], row.produksi);
      return {
        id: stringFirst(row.id, row.idItem, row['ID Item'], row.idProduksi),
        nama,
        kategori: stringFirst(row.kategori, row.Kategori, row['Kategori'], row.kategoriStok) || '-',
        satuan: stringFirst(row.satuanStok, row.satuan, row.Satuan, row['Satuan']) || '-',
        qty,
        status: stringFirst(row.status, row.Status) || statusFromQty(qty),
        lastUpdate: stringFirst(row.lastUpdate, row['Last Update'], row.updatedAt)
      };
    }).filter(row => row.nama || row.id).sort((a, b) => a.kategori.localeCompare(b.kategori, 'id') || a.nama.localeCompare(b.nama, 'id'));
  }

  function renderTable() {
    const query = String((document.getElementById('searchInput') || {}).value || '').trim().toLowerCase();
    STATE.filteredRows = STATE.rows.filter(row => {
      if (!query) return true;
      return [row.nama, row.kategori, row.satuan, row.status].some(value => String(value || '').toLowerCase().includes(query));
    });

    updateCards(STATE.filteredRows);

    const tbody = document.getElementById('tbodyStok');
    if (!tbody) return;
    if (!STATE.filteredRows.length) {
      setTableEmpty(STATE.rows.length ? 'Tidak ada data yang cocok dengan pencarian.' : 'Belum ada data stok untuk kategori ini.');
      return;
    }

    tbody.innerHTML = STATE.filteredRows.map((row, index) => {
      const status = buildStatus(row);
      const qtyClass = row.qty <= 0 ? 'text-rose-600 dark:text-rose-300' : 'text-emerald-600 dark:text-emerald-300';
      return `<tr class="stock-row">
        <td class="p-4 text-center text-sm" data-label="No" style="color:var(--muted)">${index + 1}</td>
        <td class="p-4" data-label="Nama Barang"><span class="stock-name">${escapeHtml(row.nama || '-')}</span><span class="stock-sub">Persediaan gudang pusat</span></td>
        <td class="p-4 text-center text-sm font-bold" data-label="Kategori" style="color:var(--muted)">${escapeHtml(row.kategori || '-')}</td>
        <td class="p-4 text-center" data-label="Stok Akhir"><span class="qty-strong ${qtyClass}">${formatNumber(row.qty)}</span></td>
        <td class="p-4 text-center text-sm font-bold" data-label="Satuan" style="color:var(--muted)">${escapeHtml(row.satuan || '-')}</td>
        <td class="p-4 text-center" data-label="Status"><span class="status-pill ${status.cls}">${escapeHtml(status.label)}</span></td>
        <td class="p-4 text-center text-xs" data-label="Diperbarui" style="color:var(--muted)">${escapeHtml(formatDateDisplay(row.lastUpdate) || '-')}</td>
      </tr>`;
    }).join('');

    setText('rowsInfo', `${STATE.filteredRows.length.toLocaleString('id-ID')} data tampil dari ${STATE.rows.length.toLocaleString('id-ID')} item`);
    applyResponsiveTableLabels(document);
  }

  function updateCards(rows) {
    const totalQty = rows.reduce((sum, row) => sum + Number(row.qty || 0), 0);
    const perhatian = rows.filter(row => isAttentionStatus(row)).length;
    setText('cardItem', rows.length.toLocaleString('id-ID'));
    setText('cardQty', totalQty.toLocaleString('id-ID', { maximumFractionDigits: 2 }));
    setText('cardPerhatian', perhatian.toLocaleString('id-ID'));
  }

  function buildStatus(row) {
    const label = stringFirst(row.status, statusFromQty(row.qty));
    const key = label.toLowerCase();
    if (key.includes('habis') || key.includes('minus') || key.includes('kurang') || Number(row.qty || 0) <= 0) return { label: label || 'Habis', cls: 'status-danger' };
    if (key.includes('menipis') || key.includes('minimum') || key.includes('warning')) return { label, cls: 'status-warning' };
    if (key.includes('aman') || key.includes('tersedia') || key.includes('ok')) return { label, cls: 'status-ok' };
    return { label: label || 'Tersedia', cls: 'status-neutral' };
  }

  function isAttentionStatus(row) {
    const status = buildStatus(row);
    return status.cls === 'status-danger' || status.cls === 'status-warning';
  }

  function statusFromQty(qty) {
    return Number(qty || 0) <= 0 ? 'Habis' : 'Tersedia';
  }


  function buildTableLoadingHtml(message) {
    const safeMessage = escapeHtml(message || 'Memuat data...');
    return `<div class="apj-table-loading-simple" role="status" aria-live="polite">
      <span class="apj-table-spinner-simple" aria-hidden="true"></span>
      <span class="apj-table-loading-text"><strong>${safeMessage}</strong><small>Mohon tunggu, data sedang disiapkan.</small></span>
    </div>`;
  }

  function setTableLoading(message) {
    const tbody = document.getElementById('tbodyStok');
    if (tbody) {
      tbody.innerHTML = `<tr class="apj-loading-row-simple"><td class="apj-loading-cell-simple" colspan="7">${buildTableLoadingHtml(message)}</td></tr>`;
    }
    setText('rowsInfo', 'Memuat data...');
  }

  function setTableEmpty(message, type) {
    const tbody = document.getElementById('tbodyStok');
    const color = type === 'error' ? 'color:#e11d48' : 'color:var(--muted)';
    if (tbody) tbody.innerHTML = `<tr><td class="empty-cell p-8 text-center" style="${color}" colspan="7">${escapeHtml(message)}</td></tr>`;
    setText('rowsInfo', '0 data tampil');
  }

  function setInfo(message, type) {
    const box = document.getElementById('infoBox');
    if (!box) return;
    box.innerHTML = message;
    box.classList.remove('info-card-error', 'info-card-success');
    if (type === 'error') box.classList.add('info-card-error');
    if (type === 'success') box.classList.add('info-card-success');
  }

  function openModalPrint() {
    if (!STATE.filteredRows.length) {
      showToast('Muat data stok terlebih dahulu sebelum mencetak rekap.', 'error');
      return;
    }
    if (!STATE.signers.length) fillSignatureSelects([currentUserAsSigner()], false);
    showModal('modalPrint');
  }

  function closeModalPrint() { hideModal('modalPrint'); }

  function processPrint() {
    const sup = String((document.getElementById('modalSup') || {}).value || '').trim();
    const pic1 = String((document.getElementById('modalPic1') || {}).value || '').trim();
    const pic2 = String((document.getElementById('modalPic2') || {}).value || '').trim();
    if (!sup || !pic1) {
      showToast('Penanggung jawab dan PIC 1 wajib dipilih.', 'error');
      return;
    }

    const rows = STATE.filteredRows.length ? STATE.filteredRows : STATE.rows;
    const now = new Date();
    const romanMonths = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    const timeCode = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0') + String(now.getSeconds()).padStart(2, '0');
    const prefix = STATE.selectedKategori ? STATE.selectedKategori.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase() : 'ALL';
    const nomor = `No: APJ-INV/STOK/${prefix}/${romanMonths[now.getMonth()]}/${now.getFullYear()}/${timeCode}`;
    const subTitle = `Rekap Stok ${STATE.selectedKategoriLabel}`;
    const locDate = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    setText('printNomorSurat', nomor);
    setText('printSub', subTitle);
    setText('printKategori', STATE.selectedKategoriLabel);
    setText('printTotalItem', rows.length.toLocaleString('id-ID'));
    setText('printLocDate', locDate);

    const tbody = document.getElementById('printTbody');
    if (tbody) tbody.innerHTML = rows.map((row, idx) => {
      const status = buildStatus(row).label;
      return `<tr><td>${idx + 1}</td><td>${escapeHtml(row.nama || '-')}</td><td>${escapeHtml(row.kategori || '-')}</td><td>${formatNumber(row.qty)}</td><td>${escapeHtml(row.satuan || '-')}</td><td>${escapeHtml(status)}</td><td>${escapeHtml(formatDateDisplay(row.lastUpdate) || '-')}</td></tr>`;
    }).join('');
    const signers = [{ role: 'Supervisor', name: sup }, { role: 'PIC 1', name: pic1 }, { role: 'PIC 2', name: pic2 }].filter(s => s.name);
    const ttd = document.getElementById('printTTD');
    if (ttd) ttd.innerHTML = signers.map(s => `<div class="ttd-box"><p class="role-label">${escapeHtml(s.role)}</p><p class="name-label">(${escapeHtml(s.name)})</p></div>`).join('');

    closeModalPrint();
    printCleanDocument({
      title: 'Rekap Stok APJ',
      nomor,
      subTitle,
      kategori: STATE.selectedKategoriLabel,
      totalItem: rows.length,
      rows,
      signers,
      locDate
    });
  }

  function printCleanDocument(data) {
    const tableRows = (data.rows || []).map((row, idx) => {
      const status = buildStatus(row).label;
      return `<tr>
        <td>${idx + 1}</td>
        <td class="text-left">${escapeHtml(row.nama || '-')}</td>
        <td>${escapeHtml(row.kategori || '-')}</td>
        <td>${formatNumber(row.qty)}</td>
        <td>${escapeHtml(row.satuan || '-')}</td>
        <td>${escapeHtml(status)}</td>
        <td>${escapeHtml(formatDateDisplay(row.lastUpdate) || '-')}</td>
      </tr>`;
    }).join('');
    const signerHtml = (data.signers || []).map(s => `<div class="ttd-box"><p class="role-label">${escapeHtml(s.role)}</p><p class="name-label">(${escapeHtml(s.name)})</p></div>`).join('');
    const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>${escapeHtml(data.title || 'Rekap Stok APJ')}</title>
<style>
  @page { size: A4 portrait; margin: 25.4mm; }
  html, body { margin:0; padding:0; background:#fff; color:#000; font-family:'Times New Roman', Times, serif; font-size:10pt; }
  * { box-sizing:border-box; box-shadow:none!important; text-shadow:none!important; filter:none!important; }
  .kop-surat { text-align:center; border-bottom:3px solid #000; padding-bottom:8px; margin-bottom:10px; }
  .kop-title { font-size:20pt; font-weight:bold; letter-spacing:.02em; }
  .kop-sub { font-size:12pt; font-style:italic; margin-top:2px; }
  .kop-nomor { font-size:9.5pt; margin-top:2px; }
  .print-meta { display:flex; justify-content:space-between; gap:12px; margin:8px 0 10px; font-size:9.5pt; }
  table { width:100%; border-collapse:collapse; table-layout:fixed; }
  th, td { border:1px solid #000; padding:4px 5px; vertical-align:middle; text-align:center; line-height:1.22; }
  th { font-weight:bold; background:#f4f4f4; }
  th:nth-child(1), td:nth-child(1){ width:6%; }
  th:nth-child(2), td:nth-child(2){ width:27%; }
  th:nth-child(3), td:nth-child(3){ width:17%; }
  th:nth-child(4), td:nth-child(4){ width:13%; }
  th:nth-child(5), td:nth-child(5){ width:11%; }
  th:nth-child(6), td:nth-child(6){ width:12%; }
  th:nth-child(7), td:nth-child(7){ width:14%; }
  .text-left { text-align:left; }
  #printFooter { page-break-inside:avoid; margin-top:22px; }
  .print-loc { text-align:center; margin-bottom:14px; }
  .ttd-container { display:flex; justify-content:space-around; gap:12px; width:100%; }
  .ttd-box { width:33%; text-align:center; }
  .role-label { font-weight:bold; text-transform:uppercase; }
  .name-label { font-weight:bold; text-decoration:underline; margin-top:54px; }
</style>
</head>
<body>
  <div class="kop-surat"><div class="kop-title">AMPERA PAK JENGGOT</div><div class="kop-sub">${escapeHtml(data.subTitle)}</div><div class="kop-nomor">${escapeHtml(data.nomor)}</div></div>
  <div class="print-meta"><div>Kategori: <b>${escapeHtml(data.kategori)}</b></div><div>Total Item: <b>${Number(data.totalItem || 0).toLocaleString('id-ID')}</b></div></div>
  <table><thead><tr><th>No</th><th>Nama Barang</th><th>Kategori</th><th>Stok Akhir</th><th>Satuan</th><th>Status</th><th>Diperbarui</th></tr></thead><tbody>${tableRows}</tbody></table>
  <div id="printFooter"><div class="print-loc">Batu, ${escapeHtml(data.locDate)}</div><div class="ttd-container">${signerHtml}</div></div>
</body>
</html>`;

    const frame = document.createElement('iframe');
    frame.setAttribute('title', 'Cetak Rekap Stok');
    frame.setAttribute('aria-hidden', 'true');
    frame.width = '1';
    frame.height = '1';
    frame.style.cssText = [
      'position:fixed!important',
      'left:-100000px!important',
      'top:-100000px!important',
      'width:1px!important',
      'height:1px!important',
      'border:0!important',
      'opacity:0!important',
      'pointer-events:none!important',
      'z-index:-1!important',
      'background:#fff!important'
    ].join(';');
    document.body.appendChild(frame);
    const doc = frame.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
    const removeFrame = () => {
      try { frame.remove(); } catch (err) {}
    };
    try {
      if (frame.contentWindow) frame.contentWindow.addEventListener('afterprint', removeFrame, { once: true });
    } catch (err) {}
    setTimeout(() => {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
      } finally {
        setTimeout(removeFrame, 1500);
        setTimeout(removeFrame, 8000);
      }
    }, 250);
  }

  function showToast(message, type) {
    const toast = document.getElementById('customToast');
    const msg = document.getElementById('toastMessage');
    if (!toast || !msg) return;
    msg.textContent = message;
    toast.className = 'toast show border backdrop-blur-xl p-4 ' + (type === 'error' ? 'toast-error' : type === 'warning' ? 'toast-warning' : 'toast-success');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => toast.classList.remove('show'), 3600);
  }

  function showModal(id) {
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

  function hideModal(id) {
    const modal = document.getElementById(id);
    const overlay = modal ? modal.querySelector('.modal-overlay') : null;
    const content = modal ? modal.querySelector('.modal-content') : null;
    if (!modal || !overlay || !content) return;
    overlay.classList.remove('opacity-100');
    overlay.classList.add('opacity-0');
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 250);
  }

  function openLihatStokHelpModal(autoOpen) {
    if (autoOpen) {
      const modal = document.getElementById('lihatStokHelpModal');
      if (modal) modal.dataset.autoOpen = 'true';
    }
    closeMobileSidebar();
    showModal('lihatStokHelpModal');
  }

  function closeLihatStokHelpModal() {
    sessionStorage.setItem('APJ_LIHAT_STOK_HELP_SEEN_V40', 'true');
    hideModal('lihatStokHelpModal');
  }

  function showLogoutModal() { showModal('logoutModal'); }
  function closeLogoutModal() { hideModal('logoutModal'); }

  function executeLogout() {
    localStorage.removeItem(STORAGE_KEYS.active);
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.name);
    localStorage.removeItem(STORAGE_KEYS.level);
    localStorage.removeItem(STORAGE_KEYS.outlet);
    localStorage.removeItem(STORAGE_KEYS.permissions);
    window.location.href = CONFIG.loginPage || 'index.html';
  }

  function initModalCloseOnEsc() {
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      closeLihatStokHelpModal();
      closeModalPrint();
      closeLogoutModal();
      closeMobileSidebar();
    });
  }

  function initSidebar() {
    applySidebarState();
    initSidebarGroups();
    bindSidebarButtons();
    setupPermissionMenu(localStorage.getItem(STORAGE_KEYS.level));
    window.addEventListener('resize', applySidebarState);
  }

  function applySidebarState() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    if (window.innerWidth < 1024) {
      sidebar.classList.remove('sidebar-collapsed');
      document.body.classList.remove('sidebar-collapsed-active');
      return;
    }
    const collapsed = localStorage.getItem('APJ_SIDEBAR_COLLAPSED') === 'true';
    sidebar.classList.toggle('sidebar-collapsed', collapsed);
    document.body.classList.toggle('sidebar-collapsed-active', collapsed);
  }

  function toggleSidebarCollapse() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar || window.innerWidth < 1024) return;
    const willCollapse = !sidebar.classList.contains('sidebar-collapsed');
    sidebar.classList.toggle('sidebar-collapsed', willCollapse);
    document.body.classList.toggle('sidebar-collapsed-active', willCollapse);
    localStorage.setItem('APJ_SIDEBAR_COLLAPSED', willCollapse ? 'true' : 'false');
  }

  function openMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (!sidebar || !backdrop) return;
    sidebar.classList.remove('sidebar-collapsed');
    sidebar.classList.remove('-translate-x-full');
    backdrop.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
  }

  function closeMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (!sidebar || !backdrop) return;
    if (window.innerWidth < 1024) sidebar.classList.add('-translate-x-full');
    backdrop.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
    if (window.innerWidth >= 1024) applySidebarState();
  }

  function initSidebarGroups() {
    const saved = safeParseJson(localStorage.getItem('APJ_DASHBOARD_MENU_GROUPS'));
    document.querySelectorAll('#dashboardSidebarMenu [data-menu-group]').forEach(group => {
      const key = group.getAttribute('data-menu-group');
      const shouldOpen = typeof saved[key] === 'boolean' ? saved[key] : group.classList.contains('open');
      setSidebarGroup(group, shouldOpen);
    });
  }

  function setSidebarGroup(group, isOpen) {
    if (!group) return;
    group.classList.toggle('open', !!isOpen);
    const button = group.querySelector('.nav-group-toggle');
    if (button) button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  }

  function bindSidebarButtons() {
    const collapseBtn = document.querySelector('[data-sidebar-collapse]');
    if (collapseBtn && collapseBtn.dataset.lihatBound !== 'Y') {
      collapseBtn.dataset.lihatBound = 'Y';
      collapseBtn.addEventListener('click', event => {
        event.preventDefault();
        toggleSidebarCollapse();
      });
    }
    document.querySelectorAll('#dashboardSidebarMenu [data-menu-toggle]').forEach(button => {
      if (button.dataset.lihatBound === 'Y') return;
      button.dataset.lihatBound = 'Y';
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        const sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('sidebar-collapsed')) return;
        const key = button.getAttribute('data-menu-toggle');
        const group = document.querySelector('#dashboardSidebarMenu [data-menu-group="' + key + '"]');
        const next = !(group && group.classList.contains('open'));
        setSidebarGroup(group, next);
        const saved = safeParseJson(localStorage.getItem('APJ_DASHBOARD_MENU_GROUPS'));
        saved[key] = next;
        localStorage.setItem('APJ_DASHBOARD_MENU_GROUPS', JSON.stringify(saved));
      });
    });
    document.querySelectorAll('#dashboardSidebarMenu .nav-coming-soon, #dashboardSidebarMenu [data-locked-menu]').forEach(link => {
      if (link.dataset.lihatBound === 'Y') return;
      link.dataset.lihatBound = 'Y';
      link.addEventListener('click', event => {
        event.preventDefault();
        const name = link.getAttribute('data-coming-soon-menu') || link.getAttribute('data-locked-menu') || 'Menu';
        showToast(name + ' masih dalam tahap penyiapan.', 'warning');
      });
    });
    document.querySelectorAll('#sidebar a:not(.nav-coming-soon)').forEach(link => {
      if (link.dataset.mobileCloseBound === 'Y') return;
      link.dataset.mobileCloseBound = 'Y';
      link.addEventListener('click', closeMobileSidebar);
    });
  }

  function setupPermissionMenu(levelValue) {
    const level = String(levelValue || '').trim().toLowerCase();
    const isAdmin = ['owner', 'superadmin', 'super admin', 'supervisor'].includes(level);
    document.querySelectorAll('[data-admin-menu], #adminMenuLink').forEach(el => el.classList.toggle('hidden', !isAdmin));
  }

  function applyResponsiveTableLabels(root) {
    root = root || document;
    root.querySelectorAll('.table-scroll table').forEach(table => {
      const headers = Array.from(table.querySelectorAll('thead th')).map(th => (th.textContent || '').trim());
      Array.from(table.querySelectorAll('tbody tr')).forEach(row => {
        Array.from(row.children).forEach((cell, idx) => {
          if (!cell || cell.tagName !== 'TD') return;
          if (!cell.getAttribute('data-label')) cell.setAttribute('data-label', headers[idx] || 'Data');
        });
      });
    });
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  }

  function escapeAttr(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }

  function stringFirst() {
    for (let i = 0; i < arguments.length; i++) {
      const value = arguments[i];
      if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
    }
    return '';
  }

  function numFirst() {
    for (let i = 0; i < arguments.length; i++) {
      const n = parseNumber(arguments[i]);
      if (Number.isFinite(n) && !(i < arguments.length - 1 && n === 0 && (arguments[i] === undefined || arguments[i] === null || arguments[i] === ''))) return n;
    }
    return 0;
  }

  function parseNumber(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const raw = String(value == null ? '' : value).trim().replace(/\s/g, '');
    if (!raw) return 0;
    const commaIndex = raw.lastIndexOf(',');
    const dotIndex = raw.lastIndexOf('.');
    let cleaned = raw;
    if (commaIndex !== -1 && dotIndex !== -1) cleaned = commaIndex > dotIndex ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
    else if (commaIndex !== -1) cleaned = raw.replace(',', '.');
    else if ((raw.match(/\./g) || []).length > 1) cleaned = raw.replace(/\./g, '');
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  function formatNumber(value) {
    const n = parseNumber(value);
    return n.toLocaleString('id-ID', { maximumFractionDigits: 2 });
  }

  function formatDateDisplay(value) {
    if (value === undefined || value === null || value === '') return '';
    if (value instanceof Date && !isNaN(value.getTime())) return formatDateObject(value, false);
    const text = String(value).trim();
    if (!text) return '';

    const numericText = text.replace(',', '.');
    if (/^\d{4,6}(\.\d+)?$/.test(numericText)) {
      const serial = Number(numericText);
      if (Number.isFinite(serial) && serial > 20000 && serial < 80000) return formatSheetSerialDate(serial);
    }

    if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
      const date = new Date(text);
      if (!isNaN(date.getTime())) return formatDateObject(date, false);
      const [y, m, d] = text.substring(0, 10).split('-');
      return `${d}/${m}/${y}`;
    }

    const parsed = new Date(text);
    if (!isNaN(parsed.getTime()) && /[A-Za-z]{3}|GMT|T|\d{1,2}:\d{2}/.test(text)) return formatDateObject(parsed, false);
    return text;
  }

  function formatSheetSerialDate(serial) {
    const days = Math.floor(serial);
    const fraction = Math.max(0, serial - days);
    const base = Date.UTC(1899, 11, 30);
    const date = new Date(base + days * 86400000);
    const dd = String(date.getUTCDate()).padStart(2, '0');
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = date.getUTCFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  function formatDateObject(date, includeTime) {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    if (includeTime) {
      const hh = String(date.getHours()).padStart(2, '0');
      const min = String(date.getMinutes()).padStart(2, '0');
      return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
    }
    return `${dd}/${mm}/${yyyy}`;
  }

  function isYes(value, defaultValue) {
    if (value === undefined || value === null || String(value).trim() === '') return !!defaultValue;
    return ['y', 'ya', 'yes', 'true', '1', 'aktif'].includes(String(value).trim().toLowerCase());
  }

  function safeParseJson(text) {
    try { return JSON.parse(text || '{}') || {}; }
    catch (err) { return {}; }
  }

  window.openMobileSidebar = openMobileSidebar;
  window.closeMobileSidebar = closeMobileSidebar;
  window.openLihatStokHelpModal = openLihatStokHelpModal;
  window.closeLihatStokHelpModal = closeLihatStokHelpModal;
  window.showLogoutModal = showLogoutModal;
  window.closeLogoutModal = closeLogoutModal;
  window.executeLogout = executeLogout;
  window.closeModalPrint = closeModalPrint;
})();
