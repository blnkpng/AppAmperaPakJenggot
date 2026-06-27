
/*
 * APJ OUTPUT STOK V104 - PIC DIRECT CORE USER FIX
 * - Output Stok hanya untuk barang keluar dari gudang.
 * - Produksi dipisahkan ke modul Produksi.
 * - Data teknis ID item tetap dipakai di belakang layar, tidak ditampilkan ke petugas.
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
    itemById: {},
    outlets: [],
    pics: []
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
    if (btnSimpan) btnSimpan.addEventListener('click', saveOutputStok);

    await Promise.all([loadKategoriV3(), loadOutputInit()]);
    await loadInventoryPicList();
    await loadCoreEmployeePics();

    setTimeout(() => {
      if (sessionStorage.getItem('APJ_OUTPUT_HELP_SEEN_V104') !== 'true') openOutputHelpModal(true);
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
      sourceApp: 'APJ_INVENTORY',
      requesterApp: 'APJ_INVENTORY',
      username: localStorage.getItem('APJ_USER_USERNAME') || '',
      requesterUsername: localStorage.getItem('APJ_USER_USERNAME') || '',
      requesterName: getPetugas(),
      nama: getPetugas(),
      level: localStorage.getItem(STORAGE_KEYS.level) || localStorage.getItem('APJ_USER_LEVEL') || '',
      role: localStorage.getItem(STORAGE_KEYS.level) || localStorage.getItem('APJ_USER_LEVEL') || '',
      allowAllUsers: true,
      includeAllUsers: true,
      forPicDropdown: true,
      mode: 'ALL_KARYAWAN',
      userLevel: localStorage.getItem(STORAGE_KEYS.level) || localStorage.getItem('APJ_USER_LEVEL') || '',
      userOutlet: localStorage.getItem(STORAGE_KEYS.outlet) || localStorage.getItem('APJ_USER_OUTLET') || '',
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
      setStatus('Pilih kategori untuk mulai output.');
    } catch (err) {
      select.innerHTML = '<option disabled selected value="">Gagal memuat kategori</option>';
      setStatus('Gagal memuat kategori.');
      showToast(err.message || 'Gagal memuat kategori barang.', 'error');
    }
  }

  async function loadOutputInit() {
    try {
      const result = await callInventory('getOutputInit', {});
      if (result && result.success) {
        STATE.outlets = Array.isArray(result.outlets) ? result.outlets.map(String).filter(Boolean) : [];
        STATE.pics = Array.isArray(result.pics) ? result.pics.map(String).filter(Boolean) : [];
      }
    } catch (err) {
      // Tidak menggagalkan halaman. Outlet/PIC bisa diisi manual bila data belum tersedia.
    }
  }



  async function loadInventoryPicList() {
    const current = getPetugas();
    const actions = ['getOutputPicList', 'getPicKaryawanList', 'getInventoryPicList', 'getAllPicKaryawan', 'getTransferPicList', 'getTransferProduksiInit'];
    let best = normalizePicOptions(STATE.pics || []);
    for (const action of actions) {
      try {
        const result = await callInventory(action, {
          includeInactive: false,
          aktifOnly: true,
          forDropdown: true,
          forPicDropdown: true,
          includeAllUsers: true,
          allowAllUsers: true,
          context: 'OUTPUT_STOK_TRANSFER_OUTLET',
          petugas: current,
          requesterName: current,
          username: localStorage.getItem('APJ_USER_USERNAME') || '',
          requesterUsername: localStorage.getItem('APJ_USER_USERNAME') || ''
        });
        const rows = extractEmployeeRows(result);
        const names = normalizePicOptions(rows);
        if (names.length > best.length) best = names;
        if (result && result.success && names.length > 1) break;
      } catch (err) {}
    }
    STATE.pics = ensureCurrentPic(best, current);
    refreshPicSelectOptions();
    markPicLoadInfo(STATE.pics.length, STATE.pics.length <= 1);
  }

  async function callCore(action, payload) {
    if (!CORE_API_URL) return null;
    const body = Object.assign({}, payload || {}, {
      action,
      sessionToken: getToken(),
      token: getToken(),
      appName: 'APJ_INVENTORY',
      sourceApp: 'APJ_INVENTORY',
      requesterApp: 'APJ_INVENTORY',
      username: localStorage.getItem('APJ_USER_USERNAME') || '',
      requesterUsername: localStorage.getItem('APJ_USER_USERNAME') || '',
      requesterName: getPetugas(),
      nama: getPetugas(),
      level: localStorage.getItem(STORAGE_KEYS.level) || localStorage.getItem('APJ_USER_LEVEL') || '',
      role: localStorage.getItem(STORAGE_KEYS.level) || localStorage.getItem('APJ_USER_LEVEL') || '',
      allowAllUsers: true,
      includeAllUsers: true,
      forPicDropdown: true,
      mode: 'ALL_KARYAWAN',
      userLevel: localStorage.getItem(STORAGE_KEYS.level) || localStorage.getItem('APJ_USER_LEVEL') || '',
      userOutlet: localStorage.getItem(STORAGE_KEYS.outlet) || localStorage.getItem('APJ_USER_OUTLET') || '',
      _clientTs: Date.now(),
      _requestId: 'WEB-CORE-OUTPUT-' + Date.now() + '-' + Math.random().toString(16).slice(2)
    });
    const response = await fetch(CORE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      redirect: 'follow',
      cache: 'no-store',
      body: JSON.stringify(body)
    });
    const text = await response.text();
    return parseCoreJsonResponse(text);
  }

  function parseCoreJsonResponse(text) {
    const raw = String(text || '').trim();
    if (!raw) return null;
    try { return JSON.parse(raw); }
    catch (err) {
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try { return JSON.parse(raw.slice(start, end + 1)); } catch (ignore) {}
      }
      return null;
    }
  }

  async function loadCoreEmployeePics() {
    const current = getPetugas();
    const fallback = ensureCurrentPic(normalizePicOptions(STATE.pics), current);
    const actions = [
      // V102: PIC karyawan dicoba langsung ke Core User dari browser.
      // Backend Inventory tidak lagi proxy ke Core agar tidak kena izin UrlFetchApp.
      'getTransferSignatureUsers',
      'getSignatureUsers',
      'getDaftarPenandatangan',
      'getPicList',
      'getPICList',
      'getPenerimaList',
      'getPenanggungJawabList',
      'getUsersForDropdown',
      'getKaryawanDropdown',
      'getActiveUsers',
      'getKaryawanAktif',
      'getPegawaiAktif',
      'getStaffAktif',
      'getAllKaryawan',
      'getKaryawan',
      'getPegawai',
      'getStaff',
      'listKaryawan',
      'getDaftarKaryawan',
      'getDaftarUser',
      'daftarUser',
      'getEmployees',
      'getEmployeeList',
      'listEmployees',
      'getAllUsers',
      'getUsers',
      'listUsers',
      'getUserList',
      'getUsersList',
      'getDataUser',
      'getUserData',
      'getAdminUsers',
      'adminGetUsers',
      'adminListUsers',
      'getUserAdminData',
      'getAdminData',
      'getAbsensiInit',
      'getAbsensiBootstrap',
      'getBootstrap'
    ];
    let bestRows = [];

    for (const action of actions) {
      try {
        const isInventoryAction = String(action).indexOf('inventory:') === 0;
        const cleanAction = isInventoryAction ? String(action).replace('inventory:', '') : action;
        const payload = {
          includeInactive: false,
          forDropdown: true,
          context: 'OUTPUT_STOK_TRANSFER_OUTLET',
          source: 'output-stok',
          aktifOnly: true,
          petugas: current,
          requesterName: current,
          username: localStorage.getItem('APJ_USER_USERNAME') || '',
          requesterUsername: localStorage.getItem('APJ_USER_USERNAME') || '',
          level: localStorage.getItem(STORAGE_KEYS.level) || localStorage.getItem('APJ_USER_LEVEL') || '',
          role: localStorage.getItem(STORAGE_KEYS.level) || localStorage.getItem('APJ_USER_LEVEL') || '',
          includeAllUsers: true,
          allowAllUsers: true,
          forPicDropdown: true,
          mode: 'ALL_KARYAWAN'
        };
        const result = isInventoryAction ? await callInventory(cleanAction, payload) : await callCore(cleanAction, payload);
        const rows = extractEmployeeRows(result);
        const names = normalizePicOptions(rows);
        if (names.length > bestRows.length) bestRows = names;
        if (result && result.success && names.length > 1) {
          STATE.pics = ensureCurrentPic(names, current);
          refreshPicSelectOptions();
          markPicLoadInfo(STATE.pics.length, false);
          return;
        }
      } catch (err) {
        // Coba action berikutnya. Jika semua gagal, sistem tetap memakai fallback.
      }
    }

    const localRows = extractEmployeeRowsFromLocalStorage();
    const mergedFallback = normalizePicOptions([].concat(bestRows || [], localRows || [], fallback || []));
    STATE.pics = ensureCurrentPic(mergedFallback, current);
    refreshPicSelectOptions();
    markPicLoadInfo(STATE.pics.length, STATE.pics.length <= 1);
  }

  function extractEmployeeRowsFromLocalStorage() {
    const keys = [
      'APJ_ALL_USERS', 'APJ_USERS', 'APJ_KARYAWAN', 'APJ_DAFTAR_KARYAWAN', 'APJ_PIC_LIST',
      'APJ_USER_DATA', 'APJ_BOOTSTRAP', 'APJ_CORE_BOOTSTRAP', 'APJ_ADMIN_DATA', 'APJ_ABSENSI_BOOTSTRAP', 'APJ_EMPLOYEES'
    ];
    let rows = [];
    keys.forEach(key => {
      try {
        const raw = localStorage.getItem(key) || sessionStorage.getItem(key) || '';
        if (!raw) return;
        const parsed = JSON.parse(raw);
        rows = rows.concat(extractEmployeeRows(parsed));
      } catch (err) {}
    });
    return rows;
  }

  function markPicLoadInfo(total, fallbackOnly) {
    document.querySelectorAll('.select-pic').forEach(select => {
      select.dataset.totalKaryawan = String(total || 0);
      select.dataset.fallbackOnly = fallbackOnly ? 'true' : 'false';
      select.title = fallbackOnly
        ? 'Daftar PIC belum lengkap. Cek APJ_CORE_USER sheet USER agar semua karyawan muncul.'
        : `Daftar PIC: ${total || 0} karyawan`;
    });
  }

  function extractEmployeeRows(result) {
    const direct = readEmployeeArray(result);
    if (direct.length) return direct;
    const nested = result && result.data ? readEmployeeArray(result.data) : [];
    if (nested.length) return nested;
    return findBestEmployeeArray(result);
  }

  function readEmployeeArray(obj) {
    if (!obj) return [];
    if (Array.isArray(obj)) return obj;
    const keys = [
      'users', 'user', 'karyawan', 'pegawai', 'staff', 'employees', 'employee',
      'penandatangan', 'signers', 'signatureUsers', 'daftarKaryawan', 'daftarUser',
      'pics', 'pic', 'daftarPic', 'daftarPIC', 'picList', 'penerima', 'penanggungJawab',
      'rows', 'items', 'list', 'dataRows', 'result', 'records', 'allUsers', 'activeUsers', 'usersActive', 'karyawanAktif', 'pegawaiAktif', 'staffAktif', 'employeeList', 'userList'
    ];
    for (const key of keys) {
      if (Array.isArray(obj[key])) return obj[key];
    }
    return [];
  }

  function findBestEmployeeArray(value, depth) {
    depth = depth || 0;
    if (!value || depth > 3) return [];
    if (Array.isArray(value)) return normalizePicOptions(value).length ? value : [];
    if (typeof value !== 'object') return [];
    let best = [];
    Object.keys(value).forEach(key => {
      const candidate = findBestEmployeeArray(value[key], depth + 1);
      if (normalizePicOptions(candidate).length > normalizePicOptions(best).length) best = candidate;
    });
    return best;
  }

  function normalizePicOptions(items) {
    const seen = new Set();
    return (items || [])
      .map(row => {
        if (typeof row === 'string') return { value: row.trim(), label: row.trim(), status: 'AKTIF', outlet: '' };
        const name = firstText(
          row.value, row.label,
          row.namaPic, row.NAMA_PIC, row['Nama PIC'], row['NAMA PIC'], row.pic, row.PIC,
          row.penerima, row.PENERIMA, row['Penanggung Jawab'], row['PENANGGUNG JAWAB'], row.penanggungJawab, row.PENANGGUNG_JAWAB,
          row.nama, row.NAMA, row['Nama'], row['NAMA KARYAWAN'], row.NAMA_KARYAWAN,
          row.namaKaryawan, row.NAMA_LENGKAP, row['NAMA LENGKAP'], row.namaLengkap,
          row.name, row.NAME, row.fullName, row.FULL_NAME, row.displayName, row.DISPLAY_NAME,
          row.Nama_User, row.nama_user, row.namaUser, row.NAMA_USER, row.namaPegawai, row.NAMA_PEGAWAI, row.namaStaff, row.NAMA_STAFF,
          row.username, row.USERNAME, row.email, row.EMAIL
        );
        const label = firstText(
          row.label, row.value,
          row.namaPic, row.NAMA_PIC, row['Nama PIC'], row['NAMA PIC'], row.pic, row.PIC,
          row.penerima, row.PENERIMA, row['Penanggung Jawab'], row['PENANGGUNG JAWAB'], row.penanggungJawab, row.PENANGGUNG_JAWAB,
          row.nama, row.NAMA, row['Nama'], row['NAMA KARYAWAN'], row.NAMA_KARYAWAN,
          row.namaKaryawan, row.NAMA_LENGKAP, row['NAMA LENGKAP'], row.namaLengkap,
          row.name, row.NAME, row.fullName, row.FULL_NAME, row.displayName, row.DISPLAY_NAME,
          row.Nama_User, row.nama_user, row.namaUser, row.NAMA_USER, row.namaPegawai, row.NAMA_PEGAWAI, row.namaStaff, row.NAMA_STAFF,
          row.username, row.USERNAME, row.email, row.EMAIL
        );
        const status = firstText(row.status, row.STATUS, row.aktif, row.AKTIF, row.active, row.ACTIVE, row.IS_ACTIVE, row.isActive, row.statusAktif, row.STATUS_AKTIF, row.statusUser, row.STATUS_USER, 'AKTIF');
        const outlet = firstText(row.outletUtama, row.OUTLET_UTAMA, row.outlet, row.OUTLET, row.outletAkses, row.OUTLET_AKSES);
        return { value: name, label: label || name, status, outlet };
      })
      .filter(pic => pic.value && isActiveStatus(pic.status))
      .filter(pic => {
        const key = String(pic.value || '').trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => String(a.label || '').localeCompare(String(b.label || ''), 'id'));
  }

  function ensureCurrentPic(list, current) {
    const rows = normalizePicOptions(list || []);
    if (current && !rows.some(p => sameText(p.value, current))) rows.unshift({ value: current, label: current, status: 'AKTIF', outlet: '' });
    return rows;
  }

  function uniquePicOptions(items) {
    return normalizePicOptions(items);
  }

  function firstText() {
    for (let i = 0; i < arguments.length; i += 1) {
      const text = String(arguments[i] == null ? '' : arguments[i]).trim();
      if (text) return text;
    }
    return '';
  }

  function sameText(a, b) {
    return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  }

  function isActiveStatus(value) {
    const text = String(value == null ? 'AKTIF' : value).trim().toUpperCase();
    if (!text) return true;
    return !['N', 'NO', 'NONAKTIF', 'NON AKTIF', 'INACTIVE', 'TIDAK AKTIF', 'FALSE', '0', 'DELETED', 'HAPUS'].includes(text);
  }

  function buildPicOptions(selectedValue) {
    const list = STATE.pics.length ? STATE.pics : uniquePicOptions([{ value: getPetugas(), label: getPetugas(), outlet: '' }]);
    const options = [];
    list.forEach(p => {
      const value = typeof p === 'string' ? p : p.value;
      // Tampilan untuk petugas cukup nama PIC saja. Outlet tetap tidak ditampilkan agar dropdown bersih.
      const label = typeof p === 'string' ? p : (p.label || p.value);
      if (!value) return;
      options.push(`<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`);
    });
    return options.join('');
  }

  function ensurePicDatalist() {
    let datalist = document.getElementById('outputPicDatalist');
    if (!datalist) {
      datalist = document.createElement('datalist');
      datalist.id = 'outputPicDatalist';
      document.body.appendChild(datalist);
    }
    datalist.innerHTML = buildPicOptions('');
    return datalist;
  }

  function refreshPicSelectOptions() {
    ensurePicDatalist();
    document.querySelectorAll('.input-pic').forEach(input => {
      const current = input.value || '';
      input.setAttribute('list', 'outputPicDatalist');
      input.placeholder = STATE.pics.length > 1 ? 'Pilih / ketik PIC penerima' : 'Ketik PIC penerima';
      if (current) input.value = current;
    });
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

  function pick(obj, keys) {
    for (const key of keys) {
      if (obj && obj[key] !== undefined && obj[key] !== null && String(obj[key]).trim() !== '') return obj[key];
    }
    return '';
  }

  async function handleKategoriChange() {
    const selectedKategori = document.getElementById('kategoriSelect')?.value || '';
    if (!selectedKategori) return;

    setLoadingRow('Memuat daftar barang...');
    setStatus('Mengambil daftar barang aktif...');

    try {
      const result = await callInventory('getBarang', { kategori: selectedKategori, context: 'output' });
      if (!result.success) throw new Error(result.message || 'Gagal memuat barang.');

      STATE.items = (Array.isArray(result.data) ? result.data : [])
        .map(normalizeItem)
        .filter(item => item.id && item.nama)
        .sort((a, b) => a.nama.localeCompare(b.nama, 'id'));

      STATE.itemById = {};
      STATE.items.forEach(item => { STATE.itemById[item.id] = item; });

      if (!STATE.items.length) {
        setEmptyRow('Tidak ada barang aktif yang dapat dikeluarkan untuk kategori ini.');
        setStatus('Item kosong.');
        return showToast('Tidak ada barang yang dapat di-output pada kategori ini.', 'warning');
      }

      const tbody = document.getElementById('itemTableBody');
      if (tbody) tbody.innerHTML = '';
      const addBtn = document.getElementById('btnTambahBaris');
      if (addBtn) addBtn.disabled = false;
      setStatus(`${STATE.items.length} barang siap dipilih.`);
      tambahBarisOutput();
    } catch (err) {
      setEmptyRow('Gagal memuat data barang.');
      setStatus('Gagal memuat barang.');
      showToast(err.message || 'Koneksi ke server gagal.', 'error');
    }
  }

  function normalizeItem(row) {
    const id = String(row.id || row.idItem || row['ID Item'] || '').trim();
    return {
      id,
      nama: String(row.nama || row.namaItem || row['Nama Item'] || '').trim(),
      kategori: String(row.kategori || row['Kategori'] || '').trim(),
      satuan: String(row.satuanStok || row['Satuan Stok'] || row.satuanProduksi || row.satuan || '-').trim(),
      stokTersedia: parseNumber(row.stokTersedia || row.stok || row['Stok Akhir'] || 0),
      status: String(row.status || '').trim()
    };
  }

  function buildBarangOptions() {
    return STATE.items.map(item => `<option value="${escapeHtml(item.id)}" data-id="${escapeHtml(item.id)}" data-nama="${escapeHtml(item.nama)}" data-satuan="${escapeHtml(item.satuan)}" data-stok="${escapeHtml(formatNumber(item.stokTersedia))}">${escapeHtml(item.nama)}</option>`).join('');
  }

  function buildOutletOptions() {
    const outlet = STATE.outlets.length ? STATE.outlets : ['LAHOR','SENISONO','PUJON','NGUJUNG','POKOPEK'];
    return outlet.map(o => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('');
  }

  function buildPicDatalist() {
    refreshPicSelectOptions();
  }

  function tambahBarisOutput() {
    if (!STATE.items.length) return showToast('Pilih kategori terlebih dahulu.', 'warning');
    buildPicDatalist();
    const tbody = document.getElementById('itemTableBody');
    if (!tbody) return;
    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-800/50 bg-slate-950 item-row output-row hover:bg-slate-900/50 transition-colors';
    tr.dataset.rowUid = 'out-' + Date.now() + '-' + Math.random().toString(16).slice(2);
    tr.innerHTML = `
      <td class="p-2 output-name-cell" data-label="Nama Barang">
        <select class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white select-barang focus:border-rose-500 focus:outline-none">
          <option value="" disabled selected>-- Pilih Barang --</option>
          ${buildBarangOptions()}
        </select>
        <p class="mt-1 text-[11px] text-slate-500 item-code-hint">Pilih nama barang sesuai fisik yang dikeluarkan.</p>
      </td>
      <td class="p-2 text-center text-sm font-bold text-emerald-600 label-stok" data-label="Stok Saat Ini">0</td>
      <td class="p-2" data-label="Qty Keluar"><input type="number" min="0.001" step="any" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white input-qty-keluar text-center focus:border-rose-500 focus:outline-none" placeholder="0"></td>
      <td class="p-2 text-center text-sm font-bold text-rose-500 label-satuan" data-label="Satuan">-</td>
      <td class="p-2 output-purpose-cell" data-label="Tujuan / Catatan">
        <select class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white select-tujuan focus:border-rose-500 focus:outline-none">
          <option value="pemakaian">Pemakaian Pusat</option>
          <option value="transfer">Transfer Outlet</option>
          <option value="rusak">Rusak / Hilang</option>
          <option value="koreksi">Koreksi Keluar</option>
          <option value="lainnya">Lainnya</option>
        </select>
        <input type="text" class="mt-2 w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white input-catatan focus:border-rose-500 focus:outline-none" placeholder="Catatan opsional">
      </td>
      <td class="p-2 output-recipient-cell" data-label="Outlet / PIC">
        <div class="transfer-placeholder text-xs text-slate-500">Wajib diisi jika tujuan Transfer Outlet.</div>
        <div class="transfer-fields">
          <select class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white select-outlet focus:border-rose-500 focus:outline-none" disabled><option value="" selected disabled>Pilih outlet</option>${buildOutletOptions()}</select>
          <input type="text" list="outputPicDatalist" class="mt-2 w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white select-pic input-pic focus:border-rose-500 focus:outline-none" placeholder="Pilih / ketik PIC penerima" disabled>
        </div>
      </td>
      <td class="p-2 text-center output-action-cell" data-label="Aksi"><button type="button" class="text-rose-500 hover:text-rose-600 text-sm font-extrabold" data-action="delete-row">Hapus</button></td>
    `;
    tbody.appendChild(tr);

    tr.querySelector('.select-barang').addEventListener('change', function () { updateBarangInfo(this); });
    tr.querySelector('.select-tujuan').addEventListener('change', function () { updateTujuanState(this); });
    tr.querySelector('[data-action="delete-row"]').addEventListener('click', function () { hapusBaris(this); });
    refreshPicSelectOptions();
    updateTransferColumnVisibility();
  }

  function updateBarangInfo(select) {
    const row = select.closest('tr');
    const item = STATE.itemById[select.value];
    if (!row || !item) return;
    row.querySelector('.label-stok').textContent = formatNumber(item.stokTersedia);
    row.querySelector('.label-satuan').textContent = item.satuan || '-';
    updateRowBusinessHint(row);
  }

  function updateRowBusinessHint(row) {
    if (!row) return;
    const selected = row.querySelector('.select-barang')?.value || '';
    const item = STATE.itemById[selected];
    const tujuan = row.querySelector('.select-tujuan')?.value || '';
    const hint = row.querySelector('.item-code-hint');
    if (!hint) return;
    if (!item) {
      hint.textContent = 'Pilih nama barang sesuai fisik yang dikeluarkan.';
      return;
    }
    const kategori = String(item.kategori || '').toLowerCase();
    if (tujuan === 'transfer' && kategori.includes('minuman')) {
      hint.textContent = 'Barang dagang jual: stok pusat berkurang dan stok outlet bertambah.';
      return;
    }
    if (tujuan === 'transfer') {
      hint.textContent = 'Barang operasional/non-jual: stok pusat berkurang, outlet dicatat sebagai tujuan.';
      return;
    }
    hint.textContent = 'Stok pusat berkurang sesuai qty keluar.';
  }

  function updateTujuanState(select) {
    const row = select.closest('tr');
    if (!row) return;
    const isTransfer = select.value === 'transfer';
    row.classList.toggle('is-transfer', isTransfer);
    const outlet = row.querySelector('.select-outlet');
    const pic = row.querySelector('.input-pic');
    if (outlet) {
      outlet.disabled = !isTransfer;
      if (!isTransfer) outlet.value = '';
    }
    if (pic) {
      pic.disabled = !isTransfer;
      if (!isTransfer) pic.value = '';
    }
    updateRowBusinessHint(row);
    updateTransferColumnVisibility();
  }

  function updateTransferColumnVisibility() {
    const table = document.querySelector('.output-compact-table');
    if (!table) return;
    const hasTransfer = Array.from(document.querySelectorAll('#itemTableBody .select-tujuan')).some(select => select.value === 'transfer');
    table.classList.toggle('has-transfer', hasTransfer);
  }

  function hapusBaris(btn) {
    const row = btn.closest('tr');
    if (!row) return;
    row.remove();
    const tbody = document.getElementById('itemTableBody');
    if (tbody && !tbody.querySelector('tr')) tambahBarisOutput();
    updateTransferColumnVisibility();
  }

  async function saveOutputStok() {
    const tanggal = document.getElementById('tanggalInput')?.value || '';
    const kategori = document.getElementById('kategoriSelect')?.value || '';
    const petugas = getPetugas();
    if (!tanggal) return showToast('Tanggal transaksi wajib diisi.', 'warning');
    if (!kategori) return showToast('Kategori transaksi wajib dipilih.', 'warning');

    const rows = [];
    const errors = [];
    document.querySelectorAll('#itemTableBody tr.output-row').forEach((tr, index) => {
      const no = index + 1;
      const id = tr.querySelector('.select-barang')?.value || '';
      const item = STATE.itemById[id];
      const qty = parseNumber(tr.querySelector('.input-qty-keluar')?.value || 0);
      const tujuanValue = tr.querySelector('.select-tujuan')?.value || 'pemakaian';
      const outlet = tr.querySelector('.select-outlet')?.value || '';
      const pic = String(tr.querySelector('.input-pic')?.value || '').trim();
      const catatan = String(tr.querySelector('.input-catatan')?.value || '').trim();

      if (!id && qty <= 0) return;
      if (!item) return errors.push(`Baris ${no}: pilih nama barang.`);
      if (qty <= 0) return errors.push(`Baris ${no}: qty keluar harus lebih dari 0.`);
      if (qty > item.stokTersedia) return errors.push(`Baris ${no}: qty keluar melebihi stok saat ini.`);
      if (tujuanValue === 'transfer' && !outlet) return errors.push(`Baris ${no}: outlet tujuan wajib dipilih.`);
      if (tujuanValue === 'transfer' && !pic) return errors.push(`Baris ${no}: PIC penerima wajib diisi.`);

      const tujuanLabel = tujuanValue === 'transfer' ? 'Transfer Outlet'
        : tujuanValue === 'rusak' ? 'Rusak / Hilang'
        : tujuanValue === 'koreksi' ? 'Koreksi Keluar'
        : tujuanValue === 'lainnya' ? 'Lainnya'
        : 'Pemakaian Pusat';

      const ketParts = [];
      if (catatan) ketParts.push(catatan);
      if (tujuanValue === 'transfer' && pic) ketParts.push('PIC: ' + pic);

      rows.push([tanggal, petugas, item.kategori || kategori, item.id, item.nama, qty, item.satuan || '-', tujuanLabel, outlet, pic, ketParts.join(' | ')]);
    });

    if (errors.length) return showToast(errors[0], 'warning');
    if (!rows.length) return showToast('Belum ada barang yang valid untuk disimpan.', 'warning');

    const btn = document.getElementById('btnSimpan');
    const oldText = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan...'; }

    try {
      const result = await callInventory('simpanOutputStok', { tanggal, petugas, kategori, data: rows });
      if (!result.success) throw new Error(result.message || 'Gagal menyimpan output stok.');
      showToast(result.message || 'Output stok berhasil disimpan sesuai aturan pusat/outlet.', 'success');
      const tbody = document.getElementById('itemTableBody');
      if (tbody) tbody.innerHTML = '';
      tambahBarisOutput();
      // refresh stok terkini setelah simpan
      if (kategori) await handleKategoriChange();
    } catch (err) {
      showToast(err.message || 'Gagal menyimpan output stok.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = oldText || 'Simpan Transaksi Output'; }
    }
  }

  function setStatus(text) { setText('statusInfo', text); }


  function buildTableLoadingHtml(message) {
    const safeMessage = escapeHtml(message || 'Memuat data...');
    return `<div class="apj-table-loading-simple" role="status" aria-live="polite">
      <span class="apj-table-spinner-simple" aria-hidden="true"></span>
      <span class="apj-table-loading-text"><strong>${safeMessage}</strong><small>Mohon tunggu, data sedang disiapkan.</small></span>
    </div>`;
  }

  function setLoadingRow(text) {
    const tbody = document.getElementById('itemTableBody');
    if (tbody) {
      tbody.innerHTML = `<tr class="apj-loading-row-simple"><td class="apj-loading-cell-simple" colspan="6">${buildTableLoadingHtml(text)}</td></tr>`;
    }
    const addBtn = document.getElementById('btnTambahBaris');
    if (addBtn) addBtn.disabled = true;
  }

  function setEmptyRow(text) {
    const tbody = document.getElementById('itemTableBody');
    if (tbody) tbody.innerHTML = `<tr><td class="p-8 text-center text-slate-500" colspan="6">${escapeHtml(text)}</td></tr>`;
    const addBtn = document.getElementById('btnTambahBaris');
    if (addBtn) addBtn.disabled = true;
  }

  function parseNumber(value) {
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

  function formatNumber(num) {
    const n = Number(num || 0);
    if (!Number.isFinite(n)) return '0';
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

  function openOutputHelpModal(autoOpen) {
    const modal = document.getElementById('outputHelpModal');
    if (modal && autoOpen) modal.dataset.autoOpen = 'true';
    openModal('outputHelpModal');
  }

  function closeOutputHelpModal() {
    sessionStorage.setItem('APJ_OUTPUT_HELP_SEEN_V104', 'true');
    closeModal('outputHelpModal');
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
      ['outputHelpModal','logoutModal'].forEach(id => {
        const modal = document.getElementById(id);
        if (modal && !modal.classList.contains('hidden')) closeModal(id);
      });
    });
  }

  window.handleKategoriChange = handleKategoriChange;
  window.tambahBarisOutput = tambahBarisOutput;
  window.openOutputHelpModal = openOutputHelpModal;
  window.closeOutputHelpModal = closeOutputHelpModal;
  window.showLogoutModal = showLogoutModal;
  window.closeLogoutModal = closeLogoutModal;
  window.executeLogout = executeLogout;
  window.openMobileSidebar = openMobileSidebar;
  window.closeMobileSidebar = closeMobileSidebar;
})();
