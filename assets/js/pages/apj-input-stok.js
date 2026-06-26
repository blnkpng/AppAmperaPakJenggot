/*
 * APJ INPUT STOK V67 - PURE INPUT / V3 BACKEND GUARD / PRINT FIX
 * - Input Stok hanya untuk barang masuk/pembelian/penambahan awal.
 * - Data teknis ID item tetap tersimpan di belakang layar.
 * - Tampilan petugas dibuat formal: pilih nama barang, isi qty beli dan qty stok riil.
 * - Khusus Ayam Potong 8/11: selisih supplier dihitung otomatis dari standar potong.
 * - Tidak ada payload preparasi otomatis. Preparasi diproses di modul Preparasi.
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
    printAllItems: [],
    printAvailableItems: [],
    printSelectedItems: [],
    customLabelItems: [],
    backendInfo: null,
    backendVerified: false
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
    if (btnSimpan) btnSimpan.addEventListener('click', saveInputStok);

    const okBackend = await verifyInventoryV3Backend();
    if (!okBackend) return;
    await loadKategoriV3();

    setTimeout(() => {
      if (sessionStorage.getItem('APJ_INPUT_HELP_SEEN_V33') !== 'true') openInputHelpModal(true);
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



  async function verifyInventoryV3Backend() {
    try {
      const result = await callInventory('ping', {});
      const isV3 = result && result.success && String(result.app || '').toUpperCase() === 'APJ_INVENTORY_V3';
      if (!isV3) {
        disableFormBecauseBackend('Koneksi Inventory belum mengarah ke backend V3. Hubungi admin untuk deploy Code.gs Inventory V3 terbaru.');
        showToast('Backend Inventory belum V3. Data tidak akan disimpan supaya tidak masuk ke sheet lama.', 'error');
        return false;
      }
      STATE.backendInfo = result;
      STATE.backendVerified = true;
      console.info('APJ Inventory V3 backend:', result.spreadsheetName || '-', result.spreadsheetId || '-');
      return true;
    } catch (err) {
      disableFormBecauseBackend('Koneksi Inventory V3 belum valid. Hubungi admin untuk cek URL API dan deploy Apps Script.');
      showToast('Koneksi Inventory V3 belum valid. Data tidak disimpan.', 'error');
      return false;
    }
  }

  function disableFormBecauseBackend(message) {
    setStatus(message);
    setEmptyRow(message);
    ['btnSimpan','btnTambahBaris'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = true;
    });
    const select = document.getElementById('kategoriSelect');
    if (select) {
      select.disabled = true;
      select.innerHTML = '<option selected value="">Backend Inventory V3 belum aktif</option>';
    }
    setText('saveHint', message);
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

      select.innerHTML = '<option disabled selected value="">-- Pilih Kategori --</option>' + STATE.categories.map(cat => {
        return `<option value="${escapeHtml(cat.nama)}">${escapeHtml(cat.nama)}</option>`;
      }).join('');
      select.onchange = handleKategoriChange;
      setStatus('Pilih kategori untuk mulai input.');
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
      prefix: pick(row, ['Prefix', 'prefix']),
      urutan: pick(row, ['Urutan', 'urutan']),
      aktif: String(pick(row, ['Aktif', 'aktif']) || 'Y').toUpperCase(),
      keterangan: pick(row, ['Keterangan', 'keterangan'])
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
      const result = await callInventory('getBarang', { kategori: selectedKategori, context: 'input' });
      if (!result.success) throw new Error(result.message || 'Gagal memuat barang.');

      STATE.items = (Array.isArray(result.data) ? result.data : [])
        .map(normalizeItem)
        .filter(item => item.id && item.nama)
        .sort((a, b) => a.nama.localeCompare(b.nama, 'id'));

      STATE.itemById = {};
      STATE.items.forEach(item => { STATE.itemById[item.id] = item; });

      if (!STATE.items.length) {
        setEmptyRow('Tidak ada barang aktif untuk kategori ini.');
        setStatus('Item kosong.');
        return showToast('Tidak ada barang yang dapat diinput pada kategori ini.', 'warning');
      }

      const legacyItems = STATE.items.filter(item => item.id && !/^ITM-/i.test(item.id));
      if (legacyItems.length) {
        showToast('Data barang belum sesuai versi terbaru. Silakan hubungi admin.', 'warning');
      }

      const tbody = document.getElementById('itemTableBody');
      if (tbody) tbody.innerHTML = '';
      const addBtn = document.getElementById('btnTambahBaris');
      if (addBtn) addBtn.disabled = false;
      setStatus(`${STATE.items.length} barang siap dipilih.`);
      tambahBarisBaru();
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
      kodeLama: String(row.kodeLama || row['Kode Lama'] || '').trim(),
      nama: String(row.nama || row.namaItem || row['Nama Item'] || '').trim(),
      kategori: String(row.kategori || row['Kategori'] || '').trim(),
      satuanBeli: String(row.satuanBeli || row['Satuan Beli'] || row.satuanStok || '-').trim(),
      satuanStok: String(row.satuanStok || row['Satuan Stok'] || row.satuanProduksi || '-').trim(),
      stokTersedia: parseNumber(row.stokTersedia || row.stok || row['Stok Akhir'] || 0),
      status: String(row.status || '').trim()
    };
  }

  function buildBarangOptions() {
    return STATE.items.map(item => {
      return `<option value="${escapeHtml(item.id)}" data-id="${escapeHtml(item.id)}" data-nama="${escapeHtml(item.nama)}" data-satuan-beli="${escapeHtml(item.satuanBeli)}" data-satuan-stok="${escapeHtml(item.satuanStok)}" data-stok="${escapeHtml(formatNumber(item.stokTersedia))}">${escapeHtml(item.nama)}</option>`;
    }).join('');
  }


  function getAyamPotongFactor(item) {
    const name = String(item && item.nama || '').toLowerCase();
    if (!/ayam/.test(name) || !/potong/.test(name)) return 0;
    if (/\b8\b/.test(name) || /potong\s*8/.test(name)) return 8;
    if (/\b11\b/.test(name) || /potong\s*11/.test(name)) return 11;
    return 0;
  }

  function isAyamPotongItem(item) {
    return getAyamPotongFactor(item) > 0;
  }

  function formatSignedNumber(value) {
    const n = roundInputNumber(value);
    if (n > 0) return '+' + formatNumber(n);
    if (n < 0) return '-' + formatNumber(Math.abs(n));
    return '0';
  }

  function roundInputNumber(value) {
    const n = parseNumber(value);
    return Math.round(n * 1000) / 1000;
  }

  function updateSupplierVariance(row) {
    if (!row) return;
    const select = row.querySelector('.select-barang');
    const supplierInput = row.querySelector('.input-supplier-variance');
    const supplierHint = row.querySelector('.supplier-variance-hint');
    const qtyBeliRaw = row.querySelector('.input-qty-masuk')?.value || '';
    const qtyStokRaw = row.querySelector('.input-qty-stok')?.value || '';
    if (!supplierInput) return;

    const item = STATE.itemById[select?.value || ''];
    const factor = getAyamPotongFactor(item);
    if (!factor) {
      supplierInput.value = '';
      supplierInput.placeholder = '-';
      supplierInput.disabled = true;
      supplierInput.dataset.expectedQty = '';
      supplierInput.dataset.supplierVariance = '';
      if (supplierHint) supplierHint.textContent = 'Khusus Ayam Potong 8/11.';
      return;
    }

    supplierInput.disabled = false;
    supplierInput.readOnly = true;
    const qtyBeli = parseNumber(qtyBeliRaw);
    const qtyStok = parseNumber(qtyStokRaw);
    if (!qtyBeliRaw || !qtyStokRaw || qtyBeli <= 0 || qtyStok < 0) {
      supplierInput.value = '';
      supplierInput.placeholder = 'Otomatis';
      supplierInput.dataset.expectedQty = '';
      supplierInput.dataset.supplierVariance = '';
      if (supplierHint) supplierHint.textContent = `Standar ${factor} pcs per 1 kg.`;
      return;
    }

    const expected = roundInputNumber(qtyBeli * factor);
    const variance = roundInputNumber(qtyStok - expected);
    supplierInput.value = formatSignedNumber(variance);
    supplierInput.dataset.expectedQty = String(expected);
    supplierInput.dataset.supplierVariance = String(variance);
    if (supplierHint) {
      supplierHint.textContent = `Standar ${formatNumber(expected)} pcs; selisih ${formatSignedNumber(variance)} pcs.`;
      supplierHint.className = variance < 0
        ? 'mt-1 text-[11px] text-amber-500 supplier-variance-hint'
        : variance > 0
          ? 'mt-1 text-[11px] text-emerald-500 supplier-variance-hint'
          : 'mt-1 text-[11px] text-slate-500 supplier-variance-hint';
    }
  }

  function tambahBarisBaru() {
    if (!STATE.items.length) return showToast('Pilih kategori dulu.', 'warning');
    const tbody = document.getElementById('itemTableBody');
    if (!tbody) return;
    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-800/50 bg-slate-950 item-row hover:bg-slate-900/50 transition-colors';
    tr.dataset.rowUid = 'row-' + Date.now() + '-' + Math.random().toString(16).slice(2);
    tr.innerHTML = `
      <td class="p-3" data-label="Nama Barang">
        <select class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white select-barang focus:border-blue-500 focus:outline-none">
          <option value="" disabled selected>-- Pilih Barang --</option>
          ${buildBarangOptions()}
        </select>
        <p class="mt-1 text-[11px] text-slate-500 item-code-hint">Pilih nama barang sesuai barang yang diterima.</p>
      </td>
      <td class="p-3 text-center text-sm font-bold text-emerald-400 label-stok" data-label="Stok Saat Ini">0</td>
      <td class="p-3" data-label="Qty Masuk"><input type="number" min="0.001" step="any" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white input-qty-masuk text-center focus:border-blue-500 focus:outline-none" placeholder="0"></td>
      <td class="p-3 text-center text-sm font-semibold text-slate-500 label-satuan-beli" data-label="Satuan Beli">-</td>
      <td class="p-3" data-label="Qty Stok/Riil"><input type="number" min="0.001" step="any" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white input-qty-stok text-center focus:border-blue-500 focus:outline-none" placeholder="0"></td>
      <td class="p-3" data-label="Selisih Supplier">
        <input type="text" readonly disabled class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white input-supplier-variance text-center focus:border-amber-500 focus:outline-none" placeholder="-">
        <p class="mt-1 text-[11px] text-slate-500 supplier-variance-hint">Khusus Ayam Potong 8/11.</p>
      </td>
      <td class="p-3 text-center text-sm font-bold text-blue-400 label-satuan-stok" data-label="Satuan Stok">-</td>
      <td class="p-3 text-center" data-label="Aksi"><button type="button" class="text-slate-600 hover:text-rose-500 text-sm font-medium" data-action="delete-row">Hapus</button></td>
    `;
    tbody.appendChild(tr);

    const select = tr.querySelector('.select-barang');
    select.addEventListener('change', function () { updateSatuan(this); updateSupplierVariance(tr); });
    tr.querySelector('.input-qty-masuk')?.addEventListener('input', function () { updateSupplierVariance(tr); });
    tr.querySelector('.input-qty-stok')?.addEventListener('input', function () { updateSupplierVariance(tr); });
    const deleteBtn = tr.querySelector('[data-action="delete-row"]');
    deleteBtn.addEventListener('click', function () { hapusBaris(this); });
  }

  function hapusBaris(btn) {
    const row = btn.closest('tr');
    if (row) row.remove();
    if (!document.querySelectorAll('.item-row').length && STATE.items.length) tambahBarisBaru();
  }

  function updateSatuan(selectElement) {
    const selectedOption = selectElement.options[selectElement.selectedIndex];
    const row = selectElement.closest('tr');
    if (!row || !selectedOption) return;
    row.querySelector('.label-stok').textContent = selectedOption.getAttribute('data-stok') || '0';
    row.querySelector('.label-satuan-beli').textContent = selectedOption.getAttribute('data-satuan-beli') || '-';
    row.querySelector('.label-satuan-stok').textContent = selectedOption.getAttribute('data-satuan-stok') || '-';
    const id = selectedOption.getAttribute('data-id') || selectedOption.value || '';
    const hint = row.querySelector('.item-code-hint');
    if (hint) {
      hint.textContent = 'Pastikan jumlah fisik sudah sesuai sebelum disimpan.';
      hint.className = 'mt-1 text-[11px] text-slate-500 item-code-hint';
    }
    if (id && !/^ITM-/i.test(id)) console.warn('APJ Inventory: ID barang belum memakai format V3.', id);
    updateSupplierVariance(row);
  }

  async function saveInputStok() {
    const tanggal = document.getElementById('tanggalInput')?.value || '';
    const kategoriSelect = document.getElementById('kategoriSelect');
    const kategori = kategoriSelect?.value || '';
    const petugas = getPetugas();

    if (!tanggal || !kategori) return showToast('Tanggal dan kategori wajib diisi.', 'error');

    const selectedIds = new Set();
    const inputRows = [];
    let errorMessage = '';

    document.querySelectorAll('.item-row').forEach(row => {
      if (errorMessage) return;
      const select = row.querySelector('.select-barang');
      const qtyBeliRaw = row.querySelector('.input-qty-masuk')?.value || '';
      const qtyStokRaw = row.querySelector('.input-qty-stok')?.value || '';
      const supplierInput = row.querySelector('.input-supplier-variance');
      const supplierVarianceRaw = supplierInput?.dataset.supplierVariance || '';
      const expectedQtyRaw = supplierInput?.dataset.expectedQty || '';

      if (!select?.value && !qtyBeliRaw && !qtyStokRaw) return;
      if (!select?.value || parseNumber(qtyBeliRaw) <= 0 || parseNumber(qtyStokRaw) <= 0) {
        errorMessage = 'Isi barang, Qty Masuk, dan Qty Stok/Riil dengan benar.';
        return;
      }
      if (selectedIds.has(select.value)) {
        errorMessage = 'Barang tidak boleh dobel dalam satu transaksi input.';
        return;
      }
      selectedIds.add(select.value);

      const item = STATE.itemById[select.value] || normalizeItem({ id: select.value });
      inputRows.push([
        tanggal,
        petugas,
        kategori,
        item.id,
        item.nama,
        qtyBeliRaw,
        item.satuanBeli || row.querySelector('.label-satuan-beli')?.innerText || '-',
        qtyStokRaw,
        item.satuanStok || row.querySelector('.label-satuan-stok')?.innerText || '-',
        supplierVarianceRaw,
        expectedQtyRaw,
        isAyamPotongItem(item) ? 'Selisih supplier ayam' : ''
      ]);
    });

    if (errorMessage) return showToast(errorMessage, 'error');
    if (!inputRows.length) return showToast('Belum ada data valid untuk disimpan.', 'error');

    const btnSimpan = document.getElementById('btnSimpan');
    if (btnSimpan) {
      btnSimpan.disabled = true;
      btnSimpan.innerText = 'Menyimpan transaksi...';
    }
    setText('saveHint', 'Mohon tunggu, transaksi input stok sedang disimpan.');

    try {
      const result = await callInventory('simpanInputStok', { inputRows });
      if (!result.success) throw new Error(result.message || 'Gagal menyimpan input stok.');
      showToast(result.message || 'Input stok berhasil disimpan.', 'success');
      setText('saveHint', `Tersimpan. Dokumen: ${result.noDokumen || '-'} | Batch: ${result.batchId || '-'}`);
      setTimeout(() => location.reload(), 1500);
    } catch (err) {
      showToast(err.message || 'Gagal terhubung ke server.', 'error');
      if (btnSimpan) {
        btnSimpan.disabled = false;
        btnSimpan.innerText = 'Simpan Transaksi Input';
      }
      setText('saveHint', 'Periksa koneksi lalu coba lagi.');
    }
  }

  async function openInputPrintModal() {
    openModal('inputPrintModal');
    const tanggal = document.getElementById('printInputTanggal');
    if (tanggal && !tanggal.value) tanggal.value = document.getElementById('tanggalInput')?.value || todayInputValue();
    STATE.printSelectedItems = [];
    renderInputPrintSelectedList();
    await loadInputPrintOptionsForDate();
  }

  function closeInputPrintModal() { closeModal('inputPrintModal'); }

  async function handleInputPrintTanggalChange() {
    STATE.printSelectedItems = [];
    renderInputPrintSelectedList();
    await loadInputPrintOptionsForDate();
  }

  async function loadInputPrintOptionsForDate() {
    const tanggal = document.getElementById('printInputTanggal')?.value || '';
    const kategoriSelect = document.getElementById('printInputKategori');
    const barangSelect = document.getElementById('printInputBarang');
    const info = document.getElementById('printInputInfo');

    STATE.printAllItems = [];
    STATE.printAvailableItems = [];
    if (kategoriSelect) {
      kategoriSelect.disabled = true;
      kategoriSelect.innerHTML = '<option value="" disabled selected>Memuat kategori...</option>';
    }
    if (barangSelect) {
      barangSelect.disabled = true;
      barangSelect.innerHTML = '<option value="" disabled selected>Memuat barang...</option>';
    }
    setInputPrintButtonsDisabled(true);

    if (!tanggal) {
      renderPrintKategoriOptions();
      if (info) info.textContent = 'Pilih tanggal masuk terlebih dahulu.';
      return;
    }

    try {
      const result = await callInventory('getInputPrintOptions', { tanggal });
      if (!result.success) throw new Error(result.message || 'Gagal memuat daftar print.');

      STATE.printAllItems = (result.data || []).map((item, idx) => {
        const key = String(item.key || item.id || '').trim();
        return {
          uid: `${key || 'item'}__${idx}`,
          key,
          id: item.id || key,
          nama: item.nama || '-',
          kategori: item.kategori || 'Tanpa Kategori',
          satuan: item.satuan || '-',
          qtyMasuk: parseNumber(item.qtyMasuk || 0)
        };
      }).filter(item => item.key || item.id);

      renderPrintKategoriOptions();
      renderInputPrintBarangOptions();
      if (info) {
        info.textContent = STATE.printAllItems.length
          ? `${STATE.printAllItems.length} barang dari transaksi input tersimpan siap dicetak.`
          : 'Belum ada transaksi input tersimpan pada tanggal ini. Simpan transaksi terlebih dahulu, atau gunakan Custom Label untuk cetak manual.';
      }
    } catch (err) {
      renderPrintKategoriOptions();
      if (barangSelect) barangSelect.innerHTML = '<option value="" disabled selected>Gagal memuat barang</option>';
      if (info) info.textContent = 'Gagal mengambil daftar print dari server.';
      showToast(err.message || 'Gagal memuat daftar print.', 'error');
    }
  }

  function getPrintCategories() {
    const map = new Map();

    // Kategori print harus tetap muncul dari master kategori, walaupun belum ada transaksi pada tanggal tersebut.
    // Ini mencegah petugas melihat "Tidak ada kategori" saat tanggal belum punya data tersimpan.
    STATE.categories.forEach(cat => {
      const label = cat.nama || '';
      if (label && !map.has(label)) map.set(label, { label, count: 0 });
    });

    STATE.printAllItems.forEach(item => {
      const label = item.kategori || 'Tanpa Kategori';
      if (!map.has(label)) map.set(label, { label, count: 0 });
      map.get(label).count += 1;
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, 'id'));
  }

  function renderPrintKategoriOptions(selectedLabel) {
    const select = document.getElementById('printInputKategori');
    if (!select) return;
    const cats = getPrintCategories();
    if (!cats.length) {
      select.disabled = true;
      select.innerHTML = '<option value="" disabled selected>Kategori belum tersedia</option>';
      return;
    }
    select.disabled = false;
    select.innerHTML = '<option value="" disabled selected>-- Pilih Kategori --</option>' + cats.map(cat => {
      const note = cat.count > 0 ? ` (${cat.count} data)` : '';
      return `<option value="${escapeHtml(cat.label)}"${selectedLabel === cat.label ? ' selected' : ''}>${escapeHtml(cat.label)}${escapeHtml(note)}</option>`;
    }).join('');
    select.onchange = handleInputPrintKategoriChange;
  }

  function renderInputPrintBarangOptions() {
    const kategori = document.getElementById('printInputKategori')?.value || '';
    const select = document.getElementById('printInputBarang');
    const info = document.getElementById('printInputInfo');
    if (!select) return;

    STATE.printAvailableItems = kategori ? STATE.printAllItems.filter(item => item.kategori === kategori) : [];
    if (!kategori) {
      select.disabled = true;
      select.innerHTML = '<option value="" disabled selected>Pilih kategori dulu</option>';
      setInputPrintButtonsDisabled(true);
      if (info) info.textContent = STATE.printAllItems.length ? 'Pilih kategori barang untuk menampilkan transaksi yang sudah tersimpan.' : 'Belum ada transaksi input tersimpan pada tanggal ini. Simpan transaksi terlebih dahulu, atau gunakan Custom Label untuk cetak manual.';
      return;
    }
    if (!STATE.printAvailableItems.length) {
      select.disabled = true;
      select.innerHTML = '<option value="" disabled selected>Belum ada barang tersimpan pada kategori ini</option>';
      setInputPrintButtonsDisabled(true);
      if (info) info.textContent = `Kategori ${kategori} belum memiliki transaksi input tersimpan pada tanggal ini. Simpan transaksi terlebih dahulu, atau gunakan Custom Label.`;
      return;
    }
    select.disabled = false;
    select.innerHTML = '<option value="" disabled selected>-- Pilih Barang --</option>' + STATE.printAvailableItems.map(item => `<option value="${escapeHtml(item.uid)}">${escapeHtml(item.nama)} • ${escapeHtml(formatNumber(item.qtyMasuk))} ${escapeHtml(item.satuan)}</option>`).join('');
    setInputPrintButtonsDisabled(false);
    if (info) info.textContent = `${STATE.printAvailableItems.length} barang tersimpan pada kategori ${kategori}.`;
  }

  function handleInputPrintKategoriChange() { renderInputPrintBarangOptions(); }

  function setInputPrintButtonsDisabled(disabled) {
    ['btnTambahPrintBarang', 'btnTambahSemuaPrintBarang'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = disabled;
    });
  }

  function addInputPrintBarang() {
    const uid = document.getElementById('printInputBarang')?.value || '';
    if (!uid) return showToast('Pilih nama barang dulu.', 'warning');
    const item = STATE.printAvailableItems.find(x => x.uid === uid) || STATE.printAllItems.find(x => x.uid === uid);
    if (!item) return showToast('Barang tidak ditemukan.', 'error');
    if (STATE.printSelectedItems.some(x => x.uid === uid)) return showToast('Barang ini sudah masuk daftar print.', 'warning');
    STATE.printSelectedItems.push(item);
    renderInputPrintSelectedList();
  }

  function addAllInputPrintBarang() {
    if (!STATE.printAvailableItems.length) return showToast('Tidak ada barang pada kategori ini.', 'warning');
    const custom = STATE.printSelectedItems.filter(item => item.custom);
    STATE.printSelectedItems = custom.concat(STATE.printAvailableItems.slice());
    renderInputPrintSelectedList();
    showToast('Semua barang kategori ini masuk daftar print.', 'success');
  }

  function removeInputPrintBarang(uid) {
    STATE.printSelectedItems = STATE.printSelectedItems.filter(item => item.uid !== uid);
    renderInputPrintSelectedList();
  }

  function clearInputPrintBarang() {
    STATE.printSelectedItems = [];
    renderInputPrintSelectedList();
  }

  function renderInputPrintSelectedList() {
    const wrap = document.getElementById('printInputSelectedList');
    if (!wrap) return;
    if (!STATE.printSelectedItems.length) {
      wrap.innerHTML = '<p class="text-sm text-slate-500 italic">Belum ada barang ditambahkan.</p>';
      return;
    }
    wrap.innerHTML = STATE.printSelectedItems.map((item, idx) => `
      <div class="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
        <div class="min-w-0">
          <p class="text-sm font-semibold text-white truncate">${idx + 1}. ${escapeHtml(item.nama)} ${item.custom ? '<span class="ml-1 text-[10px] rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-blue-200 align-middle">Custom</span>' : ''}</p>
          <p class="text-xs text-slate-500">${escapeHtml(item.kategori || '-')} • Qty: ${escapeHtml(formatNumber(item.qtyMasuk || 0))} ${escapeHtml(item.satuan || '-')}</p>
        </div>
        <button type="button" class="text-xs font-semibold text-rose-400 hover:text-rose-300 shrink-0" data-remove-print="${escapeHtml(item.uid)}">Hapus</button>
      </div>`).join('');

    wrap.querySelectorAll('[data-remove-print]').forEach(btn => {
      btn.addEventListener('click', () => removeInputPrintBarang(btn.getAttribute('data-remove-print')));
    });
  }

  function printInputStok58mm() {
    if (!STATE.printSelectedItems.length) return showToast('Tambahkan barang ke daftar print dulu.', 'warning');
    const tanggal = document.getElementById('printInputTanggal')?.value || todayInputValue();
    const petugas = getPetugas();
    const rows = STATE.printSelectedItems;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Print Input Stok</title><style>
      @page{size:58mm auto;margin:3mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;width:52mm;margin:0;color:#111;font-size:10px}.label{border-bottom:1px dashed #999;padding:4px 0 6px}.brand{text-align:center;font-weight:800;font-size:12px}.sub{text-align:center;font-size:9px;margin-bottom:4px}.row{display:flex;justify-content:space-between;gap:4px;margin-top:2px}.name{font-weight:800;font-size:11px;margin-top:4px}.code{font-size:9px;color:#444}.qty{font-weight:800;font-size:13px;text-align:center;margin:5px 0}.foot{text-align:center;font-size:8px;margin-top:4px;color:#555}</style></head><body>
      ${rows.map(item => `<div class="label"><div class="brand">APJ INPUT STOK</div><div class="sub">${escapeHtml(tanggal)}</div><div class="name">${escapeHtml(item.nama)}</div><div class="code">${escapeHtml(item.kategori || '-')}</div><div class="qty">${escapeHtml(formatNumber(item.qtyMasuk || 0))} ${escapeHtml(item.satuan || '-')}</div><div class="row"><span>Petugas</span><b>${escapeHtml(petugas || '-')}</b></div><div class="foot">APJ Inventory</div></div>`).join('')}
      <script>window.onload=function(){setTimeout(function(){window.print()},250)}<\/script></body></html>`;
    const w = window.open('', '_blank', 'width=420,height=720');
    if (!w) return showToast('Popup print diblokir browser.', 'error');
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  function openCustomInputLabelModal() {
    if (!STATE.categories.length) return showToast('Kategori barang belum tersedia.', 'warning');
    const tanggal = document.getElementById('printInputTanggal')?.value || document.getElementById('tanggalInput')?.value || todayInputValue();
    const petugas = getPetugas();
    const t = document.getElementById('customLabelTanggal');
    const p = document.getElementById('customLabelPetugas');
    if (t) t.value = tanggal;
    if (p) p.value = petugas;
    renderCustomLabelKategoriOptions();
    openModal('customInputLabelModal');
  }

  function closeCustomInputLabelModal() { closeModal('customInputLabelModal'); }

  function renderCustomLabelKategoriOptions() {
    const select = document.getElementById('customLabelKategori');
    if (!select) return;
    const cats = getPrintCategories();
    select.disabled = !cats.length;
    select.innerHTML = cats.length ? '<option value="" disabled selected>-- Pilih Kategori --</option>' + cats.map(cat => `<option value="${escapeHtml(cat.label)}">${escapeHtml(cat.label)}</option>`).join('') : '<option value="" disabled selected>Tidak ada kategori</option>';
    select.onchange = handleCustomLabelKategoriChange;
    renderCustomLabelBarangOptions();
  }

  async function handleCustomLabelKategoriChange() { await renderCustomLabelBarangOptions(); }

  async function renderCustomLabelBarangOptions() {
    const kategori = document.getElementById('customLabelKategori')?.value || '';
    const barang = document.getElementById('customLabelNamaBarang');
    const satuan = document.getElementById('customLabelSatuan');
    if (satuan) satuan.value = '';
    STATE.customLabelItems = [];
    if (!barang) return;
    if (!kategori) {
      barang.disabled = true;
      barang.innerHTML = '<option value="" disabled selected>Pilih kategori dulu</option>';
      return;
    }

    barang.disabled = true;
    barang.innerHTML = '<option value="" disabled selected>Memuat barang...</option>';
    try {
      const result = await callInventory('getBarang', { kategori, context: 'input' });
      if (!result.success) throw new Error(result.message || 'Gagal memuat barang.');
      STATE.customLabelItems = (Array.isArray(result.data) ? result.data : [])
        .map((row, idx) => Object.assign(normalizeItem(row), { uid: 'manual__' + idx + '__' + (row.id || row.idItem || row['ID Item'] || '') }))
        .filter(item => item.id && item.nama)
        .sort((a, b) => a.nama.localeCompare(b.nama, 'id'));

      if (!STATE.customLabelItems.length) {
        barang.disabled = true;
        barang.innerHTML = '<option value="" disabled selected>Tidak ada barang aktif</option>';
        return;
      }
      barang.disabled = false;
      barang.innerHTML = '<option value="" disabled selected>-- Pilih Barang --</option>' + STATE.customLabelItems.map(item => `<option value="${escapeHtml(item.uid)}">${escapeHtml(item.nama)} • ${escapeHtml(item.satuanStok || item.satuanBeli || '-')}</option>`).join('');
      barang.onchange = handleCustomLabelBarangChange;
    } catch (err) {
      barang.disabled = true;
      barang.innerHTML = '<option value="" disabled selected>Gagal memuat barang</option>';
      showToast(err.message || 'Gagal memuat barang custom.', 'error');
    }
  }

  function handleCustomLabelBarangChange() {
    const uid = document.getElementById('customLabelNamaBarang')?.value || '';
    const item = STATE.customLabelItems.find(x => x.uid === uid);
    const satuan = document.getElementById('customLabelSatuan');
    if (satuan) satuan.value = item ? (item.satuanStok || item.satuanBeli || '-') : '';
  }

  function saveCustomInputLabel() {
    const uid = document.getElementById('customLabelNamaBarang')?.value || '';
    const qty = parseNumber(document.getElementById('customLabelQty')?.value || 0);
    const item = STATE.customLabelItems.find(x => x.uid === uid);
    if (!item) return showToast('Pilih barang custom.', 'warning');
    if (qty <= 0) return showToast('Qty custom wajib lebih dari 0.', 'warning');
    const custom = {
      uid: 'custom__' + Date.now() + '__' + item.uid,
      key: item.id,
      id: item.id,
      nama: item.nama,
      kategori: item.kategori || document.getElementById('customLabelKategori')?.value || '-',
      satuan: item.satuanStok || item.satuanBeli || '-',
      qtyMasuk: qty,
      custom: true,
      petugas: getPetugas()
    };
    STATE.printSelectedItems.push(custom);
    renderInputPrintSelectedList();
    closeCustomInputLabelModal();
    showToast('Custom label masuk daftar print.', 'success');
  }


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
      tbody.innerHTML = `<tr class="apj-loading-row-simple"><td colspan="8" class="apj-loading-cell-simple">${buildTableLoadingHtml(text)}</td></tr>`;
    }
    const addBtn = document.getElementById('btnTambahBaris');
    if (addBtn) addBtn.disabled = true;
  }

  function setEmptyRow(text) {
    const tbody = document.getElementById('itemTableBody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-slate-500">${escapeHtml(text)}</td></tr>`;
    const addBtn = document.getElementById('btnTambahBaris');
    if (addBtn) addBtn.disabled = true;
  }

  function setStatus(text) { setText('statusInfo', text); }

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

  function formatNumber(value) {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return '0';
    return Number.isInteger(n) ? String(n) : String(Math.round(n * 1000000) / 1000000).replace('.', ',');
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  }

  function showToast(message, type) {
    type = type || 'success';
    if (window.APJToast && typeof window.APJToast.show === 'function') return window.APJToast.show(message, type);
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

  function openInputHelpModal(autoOpen) {
    const modal = document.getElementById('inputHelpModal');
    if (modal && autoOpen) modal.dataset.autoOpen = 'true';
    openModal('inputHelpModal');
  }

  function closeInputHelpModal() {
    sessionStorage.setItem('APJ_INPUT_HELP_SEEN_V33', 'true');
    closeModal('inputHelpModal');
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
      ['inputHelpModal','logoutModal','inputPrintModal','customInputLabelModal'].forEach(id => {
        const modal = document.getElementById(id);
        if (modal && !modal.classList.contains('hidden')) closeModal(id);
      });
    });
  }

  window.handleKategoriChange = handleKategoriChange;
  window.tambahBarisBaru = tambahBarisBaru;
  window.openInputHelpModal = openInputHelpModal;
  window.closeInputHelpModal = closeInputHelpModal;
  window.showLogoutModal = showLogoutModal;
  window.closeLogoutModal = closeLogoutModal;
  window.executeLogout = executeLogout;
  window.openMobileSidebar = openMobileSidebar;
  window.closeMobileSidebar = closeMobileSidebar;
  window.openInputPrintModal = openInputPrintModal;
  window.closeInputPrintModal = closeInputPrintModal;
  window.handleInputPrintTanggalChange = handleInputPrintTanggalChange;
  window.handleInputPrintKategoriChange = handleInputPrintKategoriChange;
  window.addInputPrintBarang = addInputPrintBarang;
  window.addAllInputPrintBarang = addAllInputPrintBarang;
  window.clearInputPrintBarang = clearInputPrintBarang;
  window.printInputStok58mm = printInputStok58mm;
  window.openCustomInputLabelModal = openCustomInputLabelModal;
  window.closeCustomInputLabelModal = closeCustomInputLabelModal;
  window.handleCustomLabelKategoriChange = handleCustomLabelKategoriChange;
  window.handleCustomLabelBarangChange = handleCustomLabelBarangChange;
  window.saveCustomInputLabel = saveCustomInputLabel;
})();
