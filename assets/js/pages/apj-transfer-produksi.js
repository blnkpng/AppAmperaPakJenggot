/* APJ TRANSFER PRODUK V76 - outlet ayam + print order fix */
const APPS_SCRIPT_URL = (window.APJ_CONFIG && (window.APJ_CONFIG.inventoryApiUrl || (window.APJ_CONFIG.apis && window.APJ_CONFIG.apis.inventory))) || "https://script.google.com/macros/s/AKfycbx3sNyaAR5b1MZjpjzuCuyeYuVi-bL0k1Nb1MgI40l5kQmSWfmxXCSfTpBy7sQ-0oQ/exec";
const CORE_APPS_SCRIPT_URL = (window.APJ_CONFIG && (window.APJ_CONFIG.coreApiUrl || (window.APJ_CONFIG.apis && window.APJ_CONFIG.apis.core))) || "";
    let globalProduk = [];
    let globalAllProduk = [];
    let globalOutlets = [];
    let globalPics = [];
    let printTransferGroups = [];
    let printTransferAllGroup = null;
    let printQueueGroups = [];
    let printFilterTimer = null;

    document.addEventListener('DOMContentLoaded', () => {
      if (localStorage.getItem('APJ_SESSION_ACTIVE') !== 'true' || !localStorage.getItem('APJ_SESSION_TOKEN')) { window.location.href = 'index.html'; return; }
      const namaLogin = localStorage.getItem('APJ_USER_NAME') || '-';
      const levelLogin = localStorage.getItem('APJ_USER_LEVEL') || '-';
      document.getElementById('namaPetugas').textContent = namaLogin;
      const displayNama = document.getElementById('displayNama'); if (displayNama) displayNama.textContent = namaLogin;
      const displayLevel = document.getElementById('displayLevel'); if (displayLevel) displayLevel.textContent = levelLogin;
      const displayInisial = document.getElementById('displayInisial'); if (displayInisial) displayInisial.textContent = makeInitial(namaLogin);
      document.getElementById('tanggalInput').value = new Date().toISOString().split('T')[0];
      document.getElementById('printTanggalInput').value = new Date().toISOString().split('T')[0];
      document.querySelectorAll('#sidebar a').forEach(link => link.addEventListener('click', closeMobileSidebar));

      const perms = JSON.parse(localStorage.getItem('APJ_USER_PERMISSIONS') || '{}');
      const level = localStorage.getItem('APJ_USER_LEVEL') || '';
      const isOwner = /owner|super/i.test(level);
      const canAccess = isOwner || perms.transferProduksi === 'Y' || perms.produksi === 'Y';
      if (!canAccess) {
        document.getElementById('accessDeniedBox').classList.remove('hidden');
        document.getElementById('btnSimpan').disabled = true;
        document.getElementById('btnSimpan').classList.add('opacity-50', 'cursor-not-allowed');
        return;
      }

      setTimeout(() => {
        if (sessionStorage.getItem('APJ_TRANSFER_HELP_SEEN_V48') !== 'true') openTransferHelpModal(true);
      }, 450);
      setProductTableLoading('Memuat data halaman transfer...');
      loadInit();
    });



    function makeInitial(name) {
      const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
      if (!parts.length) return 'U';
      if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
      return (parts[0].slice(0, 1) + parts[parts.length - 1].slice(0, 1)).toUpperCase();
    }

    const transferHelpModal = () => document.getElementById('transferHelpModal');
    function openTransferHelpModal(autoOpen = false) {
      const modal = transferHelpModal();
      const overlay = modal ? modal.querySelector('.modal-overlay') : null;
      const content = modal ? modal.querySelector('.modal-content') : null;
      if (!modal || !overlay || !content) return;
      if (!autoOpen) closeMobileSidebar();
      if (autoOpen) modal.dataset.autoOpen = 'true';
      modal.classList.remove('hidden');
      void modal.offsetWidth;
      overlay.classList.add('opacity-100');
      overlay.classList.remove('opacity-0');
      content.classList.add('scale-100', 'opacity-100');
      content.classList.remove('scale-95', 'opacity-0');
    }

    function closeTransferHelpModal() {
      const modal = transferHelpModal();
      const overlay = modal ? modal.querySelector('.modal-overlay') : null;
      const content = modal ? modal.querySelector('.modal-content') : null;
      if (!modal || !overlay || !content) return;
      sessionStorage.setItem('APJ_TRANSFER_HELP_SEEN_V48', 'true');
      overlay.classList.remove('opacity-100');
      overlay.classList.add('opacity-0');
      content.classList.remove('scale-100', 'opacity-100');
      content.classList.add('scale-95', 'opacity-0');
      setTimeout(() => modal.classList.add('hidden'), 250);
    }


    async function loadInit() {
      try {
        const result = await fetchApi({ action: 'getTransferProduksiInit' });
        if (!result.success) throw new Error(result.message || 'Gagal memuat data transfer.');

        globalProduk = [];
      globalAllProduk = [];
        globalOutlets = normalizeOutletOptions(result.outlets || []);
        globalPics = normalizePicOptions(result.pics || []);
        setPicLoadingState('Memuat daftar penanggung jawab...');
        renderDropdowns({ skipPic: true });
        await loadCoreEmployeePics();
        renderDropdowns();
        renderKpi();
        setProductTableMessage('Pilih outlet tujuan. Daftar produk akan dimuat otomatis.');
      } catch (error) {
        const message = getFriendlyError(error);
        setProductTableMessage(message, 'error');
        showToast(message, 'error');
      }
    }

    function setPicLoadingState(message = 'Memuat penanggung jawab...') {
      const picSelect = document.getElementById('picSelect');
      if (!picSelect) return;
      picSelect.disabled = true;
      picSelect.classList.add('is-loading');
      picSelect.innerHTML = `<option value="" selected>${escapeHtml(message)}</option>`;
      picSelect.title = 'Daftar penanggung jawab sedang dimuat.';
    }

    function renderDropdowns(options = {}) {
      const outletSelect = document.getElementById('outletSelect');
      if (outletSelect) {
        const selectedOutlet = outletSelect.value || '';
        outletSelect.innerHTML = '<option value="" disabled selected>-- Pilih Outlet --</option>' + globalOutlets.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
        if (selectedOutlet && globalOutlets.includes(selectedOutlet)) outletSelect.value = selectedOutlet;
      }

      const picSelect = document.getElementById('picSelect');
      if (picSelect && !options.skipPic) {
        const selectedPic = picSelect.value || '';
        picSelect.disabled = false;
        picSelect.classList.remove('is-loading');
        picSelect.innerHTML = buildPicOptions(selectedPic);
        if (selectedPic && Array.from(picSelect.options).some(opt => opt.value === selectedPic)) picSelect.value = selectedPic;
      }

      const printOutletSelect = document.getElementById('printOutletSelect');
      if (printOutletSelect) {
        const selectedPrintOutlet = printOutletSelect.value || '';
        printOutletSelect.innerHTML = '<option value="" disabled selected>-- Pilih Outlet --</option>' + globalOutlets.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
        if (selectedPrintOutlet && globalOutlets.includes(selectedPrintOutlet)) printOutletSelect.value = selectedPrintOutlet;
      }
    }

    function buildPicOptions(selectedValue) {
      const current = getCurrentUserName();
      const list = ensureCurrentPic(globalPics, current);
      const options = ['<option value="" disabled selected>-- Pilih Penanggung Jawab --</option>'];
      list.forEach(pic => {
        const value = typeof pic === 'string' ? pic : (pic.value || pic.nama || pic.label || '');
        const label = typeof pic === 'string' ? pic : (pic.label || pic.nama || pic.value || '');
        if (!value || !label) return;
        const selected = selectedValue && sameText(selectedValue, value) ? ' selected' : '';
        options.push(`<option value="${escapeHtml(value)}"${selected}>${escapeHtml(label)}</option>`);
      });
      return options.join('');
    }

    function normalizeOutletOptions(rows) {
      const seen = {};
      return (rows || [])
        .map(v => String(v || '').trim())
        .filter(Boolean)
        .filter(v => {
          const key = v.toUpperCase();
          if (seen[key]) return false;
          seen[key] = true;
          return true;
        });
    }

    async function loadCoreEmployeePics() {
      const current = getCurrentUserName();
      const fallback = normalizePicOptions(globalPics).concat(current ? [{ value: current, label: current, status: 'AKTIF' }] : []);
      const actions = [
        'getTransferSignatureUsers',
        'getSignatureUsers',
        'getDaftarPenandatangan',
        'getActiveUsers',
        'getKaryawanAktif',
        'getAllUsers',
        'adminGetUsers'
      ];
      let bestRows = [];
      for (const action of actions) {
        try {
          const result = await callCoreApi(action, {
            includeInactive: false,
            forDropdown: true,
            context: 'TRANSFER_PRODUK',
            source: 'transfer-produk',
            aktifOnly: true
          });
          const rows = extractEmployeeRows(result);
          const names = normalizePicOptions(rows);
          if (names.length > bestRows.length) bestRows = names;
          if (result && result.success && names.length > 1) {
            globalPics = ensureCurrentPic(names, current);
            updatePicLoadInfo(names.length, false);
            return;
          }
        } catch (error) {
          // Coba action Core User berikutnya. Jika semua gagal, sistem tetap memakai fallback.
        }
      }
      globalPics = ensureCurrentPic(bestRows.length ? bestRows : fallback, current);
      updatePicLoadInfo(globalPics.length, true);
    }

    async function callCoreApi(action, payload) {
      if (!CORE_APPS_SCRIPT_URL) return null;
      const body = Object.assign({}, payload || {}, {
        action,
        appName: 'APJ_INVENTORY',
        sessionToken: localStorage.getItem('APJ_SESSION_TOKEN') || '',
        token: localStorage.getItem('APJ_SESSION_TOKEN') || '',
        _clientTs: Date.now(),
        _requestId: 'WEB-CORE-' + Date.now() + '-' + Math.random().toString(16).slice(2)
      });
      return requestJsonToUrl(CORE_APPS_SCRIPT_URL, body, { retries: 2, timeoutMs: 16000 });
    }

    async function requestJsonToUrl(url, payload, options = {}) {
      const retries = Math.max(1, Number(options.retries || 2));
      const timeoutMs = Math.max(8000, Number(options.timeoutMs || 16000));
      let lastError = null;
      for (let attempt = 1; attempt <= retries; attempt += 1) {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            redirect: 'follow',
            cache: 'no-store',
            signal: controller ? controller.signal : undefined,
            body: JSON.stringify(payload)
          });
          if (timer) clearTimeout(timer);
          const raw = await response.text();
          return parseApiResponse(raw);
        } catch (error) {
          if (timer) clearTimeout(timer);
          lastError = error;
          if (attempt >= retries || !isRetryableError(error)) break;
          await delay(350 * attempt);
        }
      }
      throw lastError || new Error('Data karyawan belum berhasil dimuat.');
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
        'rows', 'items', 'list'
      ];
      for (const key of keys) {
        if (Array.isArray(obj[key])) return obj[key];
      }
      return [];
    }

    function findBestEmployeeArray(value, depth = 0) {
      if (!value || depth > 3) return [];
      if (Array.isArray(value)) {
        const normalized = normalizePicOptions(value);
        return normalized.length ? value : [];
      }
      if (typeof value !== 'object') return [];
      let best = [];
      Object.keys(value).forEach(key => {
        const candidate = findBestEmployeeArray(value[key], depth + 1);
        if (normalizePicOptions(candidate).length > normalizePicOptions(best).length) best = candidate;
      });
      return best;
    }

    function normalizePicOptions(rows) {
      const seen = {};
      return (rows || [])
        .map(row => {
          if (typeof row === 'string') return { value: row.trim(), label: row.trim(), status: 'AKTIF' };
          // V46: fungsi ini dipanggil ulang terhadap data yang sudah ternormalisasi.
          // Karena itu row.value/row.label wajib ikut dibaca; kalau tidak, 28 karyawan
          // sudah terhitung tetapi saat render dropdown tersaring menjadi hanya user aktif.
          const name = firstText(
            row.value, row.label,
            row.nama, row.NAMA, row['Nama'], row['NAMA KARYAWAN'], row.NAMA_KARYAWAN,
            row.namaKaryawan, row.NAMA_LENGKAP, row['NAMA LENGKAP'], row.namaLengkap,
            row.name, row.NAME, row.fullName, row.FULL_NAME, row.displayName, row.DISPLAY_NAME,
            row.username, row.USERNAME, row.email, row.EMAIL
          );
          const label = firstText(
            row.label, row.value,
            row.nama, row.NAMA, row['Nama'], row['NAMA KARYAWAN'], row.NAMA_KARYAWAN,
            row.namaKaryawan, row.NAMA_LENGKAP, row['NAMA LENGKAP'], row.namaLengkap,
            row.name, row.NAME, row.fullName, row.FULL_NAME, row.displayName, row.DISPLAY_NAME,
            row.username, row.USERNAME, row.email, row.EMAIL
          );
          const status = firstText(row.status, row.STATUS, row.aktif, row.AKTIF, row.IS_ACTIVE, row.isActive, row.statusAktif, row.STATUS_AKTIF, 'AKTIF');
          return { value: name, label: label || name, status };
        })
        .filter(pic => pic.value && isActiveStatus(pic.status))
        .filter(pic => {
          const key = pic.value.toLowerCase();
          if (seen[key]) return false;
          seen[key] = true;
          return true;
        })
        .sort((a, b) => a.label.localeCompare(b.label, 'id'));
    }

    function ensureCurrentPic(list, current) {
      const rows = normalizePicOptions(list || []);
      if (current && !rows.some(p => sameText(p.value, current))) rows.unshift({ value: current, label: current, status: 'AKTIF' });
      return rows;
    }

    function getCurrentUserName() {
      return String(localStorage.getItem('APJ_USER_NAME') || localStorage.getItem('APJ_USER_USERNAME') || '').trim();
    }

    function firstText(...values) {
      for (const value of values) {
        const text = String(value == null ? '' : value).trim();
        if (text) return text;
      }
      return '';
    }

    function isActiveStatus(value) {
      const status = String(value || '').trim().toUpperCase();
      return !status || ['AKTIF', 'ACTIVE', 'Y', 'YA', 'TRUE', '1'].includes(status);
    }

    function sameText(a, b) {
      return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
    }

    function updatePicLoadInfo(total, fallbackOnly) {
      const select = document.getElementById('picSelect');
      if (!select) return;
      select.dataset.totalKaryawan = String(total || 0);
      select.dataset.fallbackOnly = fallbackOnly ? 'true' : 'false';
      select.title = fallbackOnly && total <= 1
        ? 'Daftar karyawan belum lengkap. Perbarui Core User agar semua karyawan tampil.'
        : `Daftar penanggung jawab: ${total || 0} karyawan`;
    }


    function getItemId(item) {
      return String(item?.idProduk || item?.idItem || item?.id || item?.kodeItem || item?.['ID Item'] || item?.['ID Produk'] || '').trim();
    }

    function getItemCategory(item) {
      return String(
        item?.kategori ||
        item?.kategoriProduk ||
        item?.category ||
        item?.jenis ||
        item?.jenisProduk ||
        item?.kategoriItem ||
        item?.kategoriBarang ||
        item?.kategoriStok ||
        item?.namaKategori ||
        item?.namaKategoriProduk ||
        item?.tipeProduk ||
        item?.tipe ||
        item?.kelompok ||
        item?.['Kategori'] ||
        item?.['Kategori Produk'] ||
        item?.['Kategori Item'] ||
        item?.['Nama Kategori'] ||
        ''
      ).trim();
    }

    function inferCategoryFromName(item) {
      const rawCategory = getItemCategory(item);
      if (rawCategory) return rawCategory;
      const sumber = normalizeText(item?.sumber || item?.source || item?.sumberTransfer || '');
      const name = normalizeText(getItemDisplayName(item));
      if (sumber.includes('minuman') || sumber.includes('barangdagang') || sumber.includes('barangdagangan')) return 'Minuman & Barang Dagang';
      if (name.includes('kremes') || name.includes('premix') || name.includes('setengahjadi') || name.includes('siapgoreng')) return 'Bahan Preparasi';
      if (name.includes('airmineral') || name.includes('vit') || name.includes('frestea') || name.includes('tehpucuk') || name.includes('tehbotol') || name.includes('krupuk') || name.includes('kerupuk') || name.includes('minuman')) return 'Minuman & Barang Dagang';
      return 'Produk Jadi';
    }

    function normalizedCategory(item) {
      return normalizeText(inferCategoryFromName(item));
    }

    function isMinumanBarangDagang(item) {
      const cat = normalizedCategory(item);
      return cat.includes('minuman') || cat.includes('barangdagang') || cat.includes('barangdagangan');
    }

    function getCategorySortRank(item) {
      const cat = normalizedCategory(item);
      if (cat.includes('produkjadi') || cat === 'produksi') return 1;
      if (cat.includes('bahanpreparasi') || cat.includes('preparasi') || cat.includes('setengahjadi')) return 2;
      if (cat.includes('minuman') || cat.includes('barangdagang') || cat.includes('barangdagangan')) return 3;
      return 9;
    }

    function getCategorySortLabel(item) {
      const rank = getCategorySortRank(item);
      if (rank === 1) return 'Produk Jadi';
      if (rank === 2) return 'Bahan Preparasi';
      if (rank === 3) return 'Minuman & Barang Dagang';
      return inferCategoryFromName(item) || 'Lainnya';
    }

    function getItemUrutan(item) {
      const raw = item?.urutan ?? item?.urutanProduk ?? item?.order ?? item?.sortOrder ?? item?.['Urutan'] ?? item?.['Urutan Produk'] ?? '';
      const n = Number(String(raw).replace(',', '.'));
      return Number.isFinite(n) && n > 0 ? n : 999999;
    }

    function getOutletAyamCutRule(outlet) {
      // V78: daftar Transfer Produk dikendalikan dari MASTER_PRODUK per outlet.
      // Tidak ada filter hardcode ayam per outlet.
      return '';
    }

    function getAyamPreparasiCut(item) {
      const name = normalizeText(getItemDisplayName(item));
      if (!name.includes('ayam')) return '';
      if (!name.includes('kremes') && !name.includes('premix')) return '';
      if (name.includes('11')) return '11';
      if (name.includes('8')) return '8';
      return '';
    }

    function applyOutletAyamRule(rows, outlet) {
      const rule = getOutletAyamCutRule(outlet);
      if (!rule) return rows || [];
      return (rows || []).filter(item => {
        const cut = getAyamPreparasiCut(item);
        return !cut || cut === rule;
      });
    }

    function getItemDisplayName(item) {
      return String(item?.namaProduk || item?.nama || item?.namaItem || item?.namaHasil || item?.namaBarang || item?.['Nama Produk'] || item?.['Nama Item'] || '').trim();
    }

    function sortTransferItems(rows) {
      return (rows || []).slice().sort((a, b) => {
        const rankA = getCategorySortRank(a);
        const rankB = getCategorySortRank(b);
        if (rankA !== rankB) return rankA - rankB;
        const catA = getCategorySortLabel(a);
        const catB = getCategorySortLabel(b);
        if (catA !== catB) return catA.localeCompare(catB, 'id', { sensitivity: 'base', numeric: true });
        const orderA = getItemUrutan(a);
        const orderB = getItemUrutan(b);
        if (orderA !== orderB) return orderA - orderB;
        return getItemDisplayName(a).localeCompare(getItemDisplayName(b), 'id', { sensitivity: 'base', numeric: true });
      });
    }

    function isMasterProdukRow(item) {
      const source = normalizeText(item?.sumberTransfer || item?.sumber || item?.source || '');
      const idProduk = String(item?.idProduk || item?.['ID Produk'] || '').trim();
      if (idProduk) return true;
      if (!source) return true;
      return source.includes('masterproduk');
    }

    function filterTransferProdukInput(rows, outlet) {
      // V78: daftar Transfer Produk hanya dari MASTER_PRODUK.
      // Minuman & Barang Dagang tetap dikirim melalui Output Stok, sehingga tidak tampil di halaman input transfer.
      return sortTransferItems((rows || []).filter(item => isMasterProdukRow(item) && !isMinumanBarangDagang(item)));
    }

    function enrichRowsWithCategory(targetRows, referenceRows) {
      const categoryByName = {};
      const categoryById = {};
      (referenceRows || []).forEach(row => {
        const name = normalizeText(getItemDisplayName(row));
        const id = normalizeText(getItemId(row));
        const kategori = getItemCategory(row);
        if (id && kategori && !categoryById[id]) categoryById[id] = kategori;
        if (name && kategori && !categoryByName[name]) categoryByName[name] = kategori;
      });
      return (targetRows || []).map(row => {
        const currentCategory = getItemCategory(row);
        if (currentCategory) return row;
        const id = normalizeText(getItemId(row));
        const name = normalizeText(getItemDisplayName(row));
        const kategori = (id && categoryById[id]) || (name && categoryByName[name]) || inferCategoryFromName(row) || '';
        return kategori ? { ...row, kategori } : row;
      });
    }

    function renderKpi() {
      const totalPusat = globalProduk.reduce((sum, p) => sum + getPusatStock(p), 0);
      const outlet = document.getElementById('outletSelect')?.value || '';
      const totalOutlet = outlet ? globalProduk.reduce((sum, p) => sum + getOutletStock(p, outlet), 0) : 0;
      document.getElementById('kpiProduk').textContent = globalProduk.length;
      document.getElementById('kpiQty').textContent = formatNumber(totalPusat);
      document.getElementById('kpiOutletStock').textContent = outlet ? formatNumber(totalOutlet) : '-';
      document.getElementById('kpiStatus').textContent = outlet ? 'Siap Kirim' : 'Pilih Outlet';
    }

    function setProductTableLoading(message = 'Memuat daftar produk...') {
      const tbody = document.getElementById('itemTableBody');
      if (!tbody) return;
      tbody.classList.add('is-loading');
      tbody.innerHTML = `
        <tr class="apj-loading-row">
          <td colspan="7" class="apj-loading-cell">
            <div class="apj-table-loading" role="status" aria-live="polite">
              <div class="apj-table-spinner" aria-hidden="true"></div>
              <div class="apj-table-loading-copy">
                <strong>${escapeHtml(message)}</strong>
                <span>Mohon tunggu, data sedang disiapkan.</span>
              </div>
            </div>
          </td>
        </tr>`;
    }

    function setProductTableMessage(message, tone = 'muted') {
      const tbody = document.getElementById('itemTableBody');
      if (!tbody) return;
      tbody.classList.remove('is-loading');
      const toneClass = tone === 'error'
        ? 'text-rose-400'
        : tone === 'warning'
          ? 'text-amber-300'
          : 'text-slate-500';
      tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center ${toneClass}">${escapeHtml(message)}</td></tr>`;
    }

    async function handleOutletChange() {
      await loadProdukOutlet();
      renderKpi();
      renderProductRows();
      updateRingkasan();
    }

    async function loadProdukOutlet() {
      const outlet = document.getElementById('outletSelect').value;
      const tbody = document.getElementById('itemTableBody');
      globalProduk = [];
      renderKpi();
      updateRingkasan();
      if (!outlet) {
        setProductTableMessage('Pilih outlet tujuan terlebih dahulu.');
        return;
      }

      setProductTableLoading(`Memuat daftar produk untuk outlet ${outlet}...`);
      try {
        const result = await fetchApi({ action: 'getTransferProduksiInit', outlet });
        if (!result.success) throw new Error(result.message || 'Gagal memuat produk outlet.');
        globalAllProduk = sortTransferItems(result.produk || []);
        globalProduk = filterTransferProdukInput(globalAllProduk, outlet);
        if (!globalProduk.length) {
          setProductTableMessage(`Belum ada produk produksi/preparasi yang dapat dikirim ke outlet ${outlet}.`, 'warning');
        }
      } catch (error) {
        const message = getFriendlyError(error);
        setProductTableMessage(message, 'error');
        showToast(message, 'error');
      }
    }

    function renderProductRows() {
      const tbody = document.getElementById('itemTableBody');
      const outlet = document.getElementById('outletSelect').value;
      const keyword = (document.getElementById('searchProduk').value || '').toLowerCase().trim();
      tbody.classList.remove('is-loading');

      if (!outlet) {
        setProductTableMessage('Pilih outlet tujuan terlebih dahulu.');
        return;
      }

      const filtered = globalProduk.filter(p => {
        const text = `${p.nama || ''} ${p.kategori || ''}`.toLowerCase();
        return !keyword || text.includes(keyword);
      });

      if (!filtered.length) {
        setProductTableMessage('Produk tidak ditemukan. Periksa kata pencarian atau pilih outlet lain.');
        return;
      }

      tbody.innerHTML = filtered.map((p) => {
        const idx = globalProduk.indexOf(p);
        const stokPusat = getPusatStock(p);
        const stokOutlet = getOutletStock(p, outlet);
        const disabled = stokPusat <= 0 ? 'disabled' : '';
        const opacity = stokPusat <= 0 ? 'opacity-60' : '';
        return `
          <tr class="border-b border-slate-800/50 bg-slate-950 item-row ${opacity}" data-index="${idx}">
            <td class="p-3" data-label="Nama Produk">
              <div class="font-semibold text-white text-sm">${escapeHtml(p.nama || '-')}</div>
              <div class="text-[11px] text-slate-500">${escapeHtml(p.kategori || 'Produk outlet')}</div>
            </td>
            <td class="p-3 text-center text-sm font-bold text-emerald-400 label-stok-pusat" data-label="Stok Pusat">${escapeHtml(formatNumber(stokPusat))}</td>
            <td class="p-3 text-center text-sm font-bold text-sky-300 label-stok-outlet" data-label="Stok Outlet">${escapeHtml(formatNumber(stokOutlet))}</td>
            <td class="p-3 text-center text-sm font-bold text-violet-300 label-satuan" data-label="Satuan">${escapeHtml(p.satuan || '-')}</td>
            <td class="p-3" data-label="Jumlah Dikirim"><input type="number" step="any" min="0" ${disabled} oninput="updateRowEstimate(this); updateRingkasan();" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white text-center input-jumlah ${stokPusat <= 0 ? 'cursor-not-allowed text-slate-500' : ''}" placeholder="0"></td>
            <td class="p-3 text-center text-sm font-bold text-white label-estimasi" data-label="Estimasi">${escapeHtml(formatNumber(stokOutlet))}</td>
            <td class="p-3" data-label="Catatan"><input type="text" ${disabled} class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white input-catatan" placeholder="Opsional..."></td>
          </tr>`;
      }).join('');
    }

    function updateRowEstimate(inputEl) {
      const row = inputEl.closest('.item-row');
      const outletStock = parseNumber(row.querySelector('.label-stok-outlet').textContent);
      const jumlah = parseNumber(inputEl.value);
      row.querySelector('.label-estimasi').textContent = formatNumber(outletStock + jumlah);
    }

    function updateRingkasan() {
      const rows = collectRows(false);
      const totalQty = rows.reduce((sum, r) => sum + parseNumber(r.qtyTransfer), 0);
      document.getElementById('ringkasanTransfer').textContent = rows.length
        ? `${rows.length} produk diisi, total jumlah kirim ${formatNumber(totalQty)}.`
        : 'Belum ada jumlah kirim. Baris kosong tidak akan disimpan.';
    }

    function collectRows(strict) {
      const rows = [];
      document.querySelectorAll('.item-row').forEach(row => {
        const idx = Number(row.dataset.index);
        const item = globalProduk[idx] || null;
        if (!item) return;
        const jumlah = parseNumber(row.querySelector('.input-jumlah').value);
        if (strict && jumlah < 0) throw new Error(`Jumlah kirim ${item.nama} tidak boleh minus.`);
        if (jumlah > 0) {
          rows.push({
            idProduk: item.id,
            namaProduk: item.nama,
            qtyTransfer: jumlah,
            satuan: item.satuan || '-',
            catatan: row.querySelector('.input-catatan').value.trim() || document.getElementById('catatanUmum').value.trim(),
            stokTersedia: getPusatStock(item)
          });
        }
      });
      return rows;
    }

    function validateStock(rows) {
      rows.forEach(r => {
        if (parseNumber(r.qtyTransfer) > parseNumber(r.stokTersedia)) {
          throw new Error(`Jumlah kirim ${r.namaProduk} melebihi stok pusat. Stok tersedia ${formatNumber(r.stokTersedia)} ${r.satuan}.`);
        }
      });
    }

    async function simpanTransfer() {
      const btn = document.getElementById('btnSimpan');
      try {
        const tanggal = document.getElementById('tanggalInput').value;
        const outlet = document.getElementById('outletSelect').value;
        const pic = document.getElementById('picSelect').value;
        const petugas = localStorage.getItem('APJ_USER_NAME') || '';
        if (!tanggal) throw new Error('Tanggal transfer wajib diisi.');
        if (!outlet) throw new Error('Outlet tujuan wajib dipilih.');
        if (!pic) throw new Error('Penanggung jawab penerima wajib dipilih.');

        const rows = collectRows(true);
        if (!rows.length) throw new Error('Isi minimal 1 jumlah kirim. Baris kosong tidak akan disimpan.');
        validateStock(rows);

        btn.disabled = true;
        btn.textContent = 'Menyimpan transfer...';

        const result = await fetchApi({ action: 'simpanTransferProduksi', tanggal, petugas, outlet, pic, rows });
        if (!result.success) throw new Error(result.message || 'Gagal menyimpan transfer.');
        showToast(result.message || 'Transfer berhasil disimpan.', 'success');
        setTimeout(() => location.reload(), 1800);
      } catch (error) {
        showToast(error.message || 'Data belum valid.', 'error');
        btn.disabled = false;
        btn.textContent = 'Simpan Transfer';
      }
    }


    function dateToDisplay(value) {
      if (!value) return '-';
      const parts = String(value).split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      return value;
    }

    function pad2(value) {
      return String(value).padStart(2, '0');
    }

    function buildSuratJalanNumber(group, mode) {
      if (!group) return '-';
      if (group.txId && group.txId !== 'ALL') return group.txId;
      const d = (group.tanggal || '').replace(/-/g, '');
      const o = (group.outlet || '').replace(/\s+/g, '');
      return `SJ-GAB-${d}-${o}`;
    }

    async function fetchApi(payload) {
      payload = Object.assign({ sessionToken: localStorage.getItem('APJ_SESSION_TOKEN') || '' }, payload || {});
      return requestApiJson(payload, { retries: 3, timeoutMs: 45000 });
    }

    async function requestApiJson(payload, options = {}) {
      const retries = Math.max(1, Number(options.retries || 3));
      const timeoutMs = Math.max(8000, Number(options.timeoutMs || 45000));
      let lastError = null;
      for (let attempt = 1; attempt <= retries; attempt += 1) {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
        try {
          const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            redirect: 'follow',
            cache: 'no-store',
            signal: controller ? controller.signal : undefined,
            body: JSON.stringify(payload)
          });
          if (timer) clearTimeout(timer);
          const raw = await response.text();
          const result = parseApiResponse(raw);
          if (!result || typeof result !== 'object') throw new Error('Response server tidak valid.');
          return result;
        } catch (error) {
          if (timer) clearTimeout(timer);
          lastError = error;
          if (attempt >= retries || !isRetryableError(error)) break;
          await delay(450 * attempt);
        }
      }
      throw lastError || new Error('Server belum merespons.');
    }

    function parseApiResponse(raw) {
      const text = String(raw || '').trim();
      if (!text) throw new Error('Response server kosong.');
      try { return JSON.parse(text); } catch (error) {
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start >= 0 && end > start) {
          try { return JSON.parse(text.slice(start, end + 1)); } catch (inner) {}
        }
        throw new Error('Response server tidak valid.');
      }
    }

    function isRetryableError(error) {
      const msg = String((error && error.message) || error || '').toLowerCase();
      return msg.includes('failed to fetch') || msg.includes('network') || msg.includes('abort') || msg.includes('timeout') || msg.includes('response server') || msg.includes('json');
    }

    function getFriendlyError(error) {
      const msg = String((error && error.message) || error || '').trim();
      if (/abort|timeout|failed to fetch|network|response server/i.test(msg)) return 'Koneksi sistem belum stabil. Silakan coba ulang beberapa detik lagi.';
      return msg || 'Data belum berhasil dimuat.';
    }

    function delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    function openSuratJalanModal() {
      const modal = document.getElementById('suratJalanModal');
      if (!modal) return;
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      document.body.classList.add('apj-surat-modal-open');

      const tanggalPrint = document.getElementById('printTanggalInput');
      const tanggalTransfer = document.getElementById('tanggalInput');
      if (tanggalPrint && tanggalTransfer && tanggalTransfer.value) tanggalPrint.value = tanggalTransfer.value;

      const outletPrint = document.getElementById('printOutletSelect');
      const outletUtama = document.getElementById('outletSelect');
      if (outletPrint && outletUtama && outletUtama.value) outletPrint.value = outletUtama.value;

      handlePrintFilterChange(true);
    }

    function closeSuratJalanModal() {
      const modal = document.getElementById('suratJalanModal');
      if (!modal) return;
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      document.body.classList.remove('apj-surat-modal-open');
    }

    function setPrintLoadStatus(message, type = 'info') {
      const box = document.getElementById('printLoadStatus');
      if (!box) return;
      const color = type === 'success'
        ? 'border-emerald-900/70 bg-emerald-950/30 text-emerald-300'
        : type === 'error'
          ? 'border-rose-900/70 bg-rose-950/30 text-rose-300'
          : 'border-slate-800 bg-slate-950 text-slate-400';
      box.className = `rounded-lg border px-4 py-3 text-xs ${color}`;
      box.textContent = message;
    }

    function setPrintTxSelectLoading(message = 'Memuat dokumen pengiriman...') {
      const sel = document.getElementById('printTxSelect');
      if (!sel) return;
      sel.disabled = true;
      sel.innerHTML = `<option value="">${escapeHtml(message)}</option>`;
    }

    function handlePrintFilterChange(force = false) {
      const tanggal = document.getElementById('printTanggalInput')?.value || '';
      const outlet = document.getElementById('printOutletSelect')?.value || '';
      clearTimeout(printFilterTimer);

      if (!tanggal || !outlet) {
        printTransferGroups = [];
        printTransferAllGroup = null;
        const sel = document.getElementById('printTxSelect');
        if (sel) {
          sel.disabled = false;
          sel.innerHTML = `<option value="">${!tanggal ? 'Pilih tanggal dulu...' : 'Pilih outlet dulu...'}</option>`;
        }
        setPrintLoadStatus('Pilih tanggal dan outlet untuk memuat dokumen.', 'info');
        return;
      }

      setPrintTxSelectLoading();
      setPrintLoadStatus(`Memuat dokumen pengiriman ${outlet} tanggal ${dateToDisplay(tanggal)}...`, 'info');
      printFilterTimer = setTimeout(() => loadTransferPrintDocs(), force ? 0 : 250);
    }

    async function loadTransferPrintDocs() {
      const sel = document.getElementById('printTxSelect');
      try {
        const tanggal = document.getElementById('printTanggalInput').value;
        const outlet = document.getElementById('printOutletSelect').value;
        if (!tanggal) throw new Error('Tanggal print wajib diisi.');
        if (!outlet) throw new Error('Outlet print wajib dipilih.');

        setPrintTxSelectLoading();
        setPrintLoadStatus(`Memuat dokumen pengiriman ${outlet}...`, 'info');

        const result = await fetchApi({ action: 'getTransferPrintData', tanggal, outlet });
        if (!result.success) throw new Error(result.message || 'Gagal memuat data print.');
        printTransferGroups = result.groups || [];
        printTransferAllGroup = result.allGroup || null;
        renderPrintTxOptions();
        setPrintLoadStatus(
          printTransferGroups.length
            ? `Ditemukan ${printTransferGroups.length} dokumen pengiriman untuk ${outlet}. Pilih dokumen, lalu cetak atau tambah outlet.`
            : `Tidak ada dokumen pengiriman tersimpan untuk ${outlet} pada tanggal ${dateToDisplay(tanggal)}.`,
          printTransferGroups.length ? 'success' : 'error'
        );
      } catch (error) {
        printTransferGroups = [];
        printTransferAllGroup = null;
        renderPrintTxOptions('Tidak ada dokumen pengiriman tersimpan');
        setPrintLoadStatus(error.message || 'Data cetak gagal dimuat.', 'error');
      } finally {
        if (sel) sel.disabled = false;
      }
    }

    function renderPrintTxOptions(emptyText = 'Tidak ada dokumen pengiriman tersimpan') {
      const sel = document.getElementById('printTxSelect');
      if (!sel) return;
      sel.disabled = false;
      if (!printTransferGroups.length) {
        sel.innerHTML = `<option value="">${escapeHtml(emptyText)}</option>`;
        return;
      }
      const allOption = (printTransferGroups.length > 1 && printTransferAllGroup)
        ? '<option value="ALL">Gabungan semua transfer tanggal/outlet ini</option>'
        : '';
      sel.innerHTML = allOption + printTransferGroups.map(g => {
        const label = `${g.txId} • ${g.totalItem || (g.rows || []).length} item • ${formatNumber(g.totalQty || 0)} jumlah • Penerima ${g.pic || '-'}`;
        return `<option value="${escapeHtml(g.txId)}">${escapeHtml(label)}</option>`;
      }).join('');
    }

    function getSelectedPrintGroup() {
      const selected = document.getElementById('printTxSelect').value;
      if (!printTransferGroups.length) throw new Error('Belum ada dokumen pengiriman. Pilih tanggal dan outlet sampai dokumen muncul.');
      if (!selected) throw new Error('Pilih dokumen pengiriman yang akan dicetak.');
      if (selected === 'ALL') {
        if (printTransferAllGroup) return printTransferAllGroup;
        throw new Error('Data gabungan belum tersedia. Pilih tanggal/outlet ulang.');
      }
      const found = printTransferGroups.find(g => g.txId === selected);
      if (!found) throw new Error('Dokumen transfer tidak ditemukan. Pilih tanggal/outlet ulang.');
      return found;
    }

    function makeQueueKey(group) {
      return `${group.tanggal || ''}__${group.outlet || ''}__${group.txId || 'ALL'}`;
    }

    function cloneGroup(group) {
      return JSON.parse(JSON.stringify(group || {}));
    }

    function addSelectedPrintGroupToQueue() {
      try {
        const group = getSelectedPrintGroup();
        const key = makeQueueKey(group);
        if (printQueueGroups.some(g => makeQueueKey(g) === key)) {
          throw new Error('Dokumen/outlet ini sudah ada di daftar cetak.');
        }
        printQueueGroups.push(cloneGroup(group));
        renderPrintQueue();
        setPrintLoadStatus(`${group.outlet || '-'} ditambahkan ke daftar cetak.`, 'success');
      } catch (error) {
        setPrintLoadStatus(error.message || 'Gagal menambah outlet.', 'error');
        showToast(error.message || 'Gagal menambah outlet.', 'error');
      }
    }

    function removePrintQueue(index) {
      printQueueGroups.splice(index, 1);
      renderPrintQueue();
    }

    function clearPrintQueue() {
      printQueueGroups = [];
      renderPrintQueue();
      setPrintLoadStatus('Daftar cetak dikosongkan.', 'info');
    }

    function renderPrintQueue() {
      const box = document.getElementById('printQueueList');
      if (!box) return;
      if (!printQueueGroups.length) {
        box.innerHTML = 'Belum ada outlet ditambahkan. Jika langsung mencetak tanpa tambah outlet, sistem mencetak dokumen yang sedang dipilih.';
        return;
      }
      box.innerHTML = printQueueGroups.map((g, i) => `
        <div class="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
          <div class="min-w-0">
            <div class="font-bold text-white truncate">${escapeHtml(g.outlet || '-')} • ${escapeHtml(g.txId || 'Gabungan')}</div>
            <div class="text-xs text-slate-400">${escapeHtml(dateToDisplay(g.tanggal))} • ${escapeHtml(formatNumber(g.totalQty || 0))} jumlah • Penerima ${escapeHtml(g.pic || '-')}</div>
          </div>
          <button type="button" onclick="removePrintQueue(${i})" class="shrink-0 rounded-md border border-rose-900/60 bg-rose-950/30 px-2 py-1 text-xs font-bold text-rose-300 hover:bg-rose-900/40">Hapus</button>
        </div>
      `).join('');
    }

    function setDynamicPrintPage(mode) {
      let style = document.getElementById('dynamicPrintPageStyle');
      if (!style) {
        style = document.createElement('style');
        style.id = 'dynamicPrintPageStyle';
        document.head.appendChild(style);
      }
      const isThermal = mode === '58' || mode === '80';
      style.textContent = isThermal
        ? '@media print { @page { size: 58mm auto; margin: 2mm; } }'
        : '@media print { @page { size: A4 portrait; margin: 2.54cm; } }';
    }

    function buildA4SuratJalanVars(rowCount) {
      const count = Math.max(1, parseInt(rowCount || 0, 10));
      const totalTableRows = count + 1; // header + produk
      const availableTableMm = 162;
      const rowH = Math.max(3.0, Math.min(6.15, availableTableMm / totalTableRows));
      const headH = Math.max(4.0, Math.min(6.3, rowH + 0.35));
      let font = 7.65;
      if (count > 34) font = 7.35;
      if (count > 42) font = 6.85;
      if (count > 52) font = 6.35;
      if (count > 64) font = 5.9;
      const headFont = Math.max(5.85, font - 0.35);
      const nameFont = Math.min(7.9, font + 0.1);
      return `--sj-row-h:${rowH.toFixed(2)}mm;--sj-head-h:${headH.toFixed(2)}mm;--sj-a4-font:${font.toFixed(2)}pt;--sj-a4-head-font:${headFont.toFixed(2)}pt;--sj-a4-name-font:${nameFont.toFixed(2)}pt;`;
    }

    function buildSuratJalanPage(group, mode) {
      const rows = sortTransferItems(applyOutletAyamRule(group.rows || [], group.outlet));
      if (!rows.length) throw new Error(`Dokumen ${group.txId || group.outlet || ''} tidak memiliki baris produk.`);
      const is58 = mode === '58' || mode === '80';
      const now = new Date();
      const baseA4Rows = (group.a4Rows && group.a4Rows.length) ? group.a4Rows : rows.map(r => ({
        namaProduk: r.namaProduk || r.nama,
        kategori: getItemCategory(r),
        satuan: r.satuan,
        stokAkhir: 0,
        tambahProduk: r.qtyTransfer,
        totalProduk: r.qtyTransfer,
        produkTerjual: '',
        produkAkhir: ''
      }));
      const printReferenceRows = [].concat(rows || [], globalAllProduk || [], globalProduk || []);
      const a4Rows = sortTransferItems(
        applyOutletAyamRule(
          enrichRowsWithCategory(baseA4Rows, printReferenceRows).map(r => ({ ...r, kategori: getItemCategory(r) || inferCategoryFromName(r) })),
          group.outlet
        )
      );

      const head = is58
        ? '<th style="width:18px;">No</th><th>Detail Produk</th>'
        : '<th>No</th><th>Nama Produk</th><th>Stok<br>Akhir</th><th>Tambah<br>Produk</th><th>Total<br>Produk</th><th>Produk<br>Terjual</th><th>Produk<br>Akhir</th>';

      const body = (is58 ? rows : a4Rows).map((r, i) => is58 ? `
        <tr>
          <td>${i + 1}</td>
          <td style="text-align:left;">
            <div class="sj-item-name">${escapeHtml(r.namaProduk || '-')}</div>
            <div class="sj-item-detail">Jumlah: <b>${escapeHtml(formatNumber(r.qtyTransfer))}</b> ${escapeHtml(r.satuan || '')}</div>
          </td>
        </tr>
      ` : `
        <tr>
          <td>${i + 1}</td>
          <td class="sj-name-cell">${escapeHtml(r.namaProduk || '-')}</td>
          <td>${escapeHtml(formatNumber(r.stokAkhir || 0))}</td>
          <td>${escapeHtml(formatNumber(r.tambahProduk || 0))}</td>
          <td>${escapeHtml(formatNumber(r.totalProduk || 0))}</td>
          <td></td>
          <td></td>
        </tr>
      `).join('');

      const a4Vars = is58 ? '' : buildA4SuratJalanVars(a4Rows.length);
      return `
        <section class="sj-page" style="${a4Vars}">
          <div class="sj-kop">
            <div class="sj-title">AMPERA PAK JENGGOT</div>
            <div class="sj-subtitle">SURAT JALAN TRANSFER PRODUK OUTLET</div>
          </div>
          <div class="sj-meta">
            <div>No. Surat Jalan <b>${escapeHtml(buildSuratJalanNumber(group, mode))}</b></div>
            <div>Tanggal <b>${escapeHtml(dateToDisplay(group.tanggal))}</b></div>
            <div>Outlet Tujuan <b>${escapeHtml(group.outlet || '-')}</b></div>
            <div>Penerima <b>${escapeHtml(group.pic || '-')}</b></div>
            <div>Petugas Kirim <b>${escapeHtml(group.petugas || '-')}</b></div>
            <div>Dicetak <b>${escapeHtml(now.toLocaleString('id-ID'))}</b></div>
          </div>
          <div class="sj-table-zone">
            <table class="sj-table">
              <thead><tr>${head}</tr></thead>
              <tbody>${body}</tbody>
            </table>
          </div>
          <div class="sj-note">Catatan: ${escapeHtml(group.catatan || '-')}</div>
          <div class="sj-a4-spacer"></div>
          <div class="sj-sign">
            <div class="sj-sign-box"><div>Mengetahui</div><div class="sj-sign-name">Supervisor</div></div>
            <div class="sj-sign-box"><div>Pengirim</div><div class="sj-sign-name">${escapeHtml(group.petugas || 'Petugas')}</div></div>
            <div class="sj-sign-box"><div>Penerima</div><div class="sj-sign-name">${escapeHtml(group.pic || 'Penerima')}</div></div>
          </div>
        </section>
      `;
    }

    function getCleanPrintStyles(mode) {
      const is58 = mode === '58' || mode === '80';
      if (is58) {
        return `
          @page { size: 58mm auto; margin: 2mm; }
          * { box-sizing: border-box; }
          html, body { margin:0; padding:0; background:#fff !important; color:#000 !important; }
          body { width:54mm; max-width:54mm; font-family: Arial, sans-serif; font-size:8.2px; line-height:1.16; }
          .sj-page { width:54mm; max-width:54mm; page-break-inside:avoid; break-inside:avoid; background:#fff !important; box-shadow:none !important; }
          .sj-page + .sj-page { page-break-before: always; }
          .sj-kop { text-align:center; border-bottom:1px dashed #000; padding-bottom:3px; margin-bottom:4px; }
          .sj-title { font-size:11px; font-weight:800; letter-spacing:.1px; }
          .sj-subtitle { font-size:8px; font-weight:800; }
          .sj-meta { display:block; font-size:7.2px; margin:4px 0; }
          .sj-meta div { border-bottom:none; padding:.5px 0; display:flex; justify-content:space-between; gap:4px; }
          .sj-meta b { margin-left:4px; text-align:right; }
          .sj-table { width:100%; border-collapse:collapse; font-size:7.4px; }
          .sj-table th,.sj-table td { border:1px solid #000; padding:1.5px 1px; color:#000 !important; page-break-inside:avoid; break-inside:avoid; }
          .sj-table th { background:#fff !important; text-align:center; font-weight:800; }
          .sj-table td { text-align:center; vertical-align:top; }
          .sj-item-name { font-weight:800; font-size:7.6px; }
          .sj-item-detail { margin-top:1px; font-size:7.2px; }
          .sj-note { font-size:7.2px; border-top:1px dashed #000; margin-top:4px; padding-top:3px; }
          .sj-a4-spacer { display:none; }
          .sj-sign { display:block; margin-top:6px; font-size:7.2px; page-break-inside:avoid; }
          .sj-sign-box { width:100%; margin-top:4px; text-align:left; }
          .sj-sign-box:first-child { display:none; }
          .sj-sign-box > div:first-child { display:inline-block; min-width:38px; }
          .sj-sign-name { display:inline-block; margin-top:0; border-top:1px dotted #000; padding-top:1px; min-width:34mm; text-align:center; font-weight:700; }
        `;
      }
      return `
        @page { size: A4 portrait; margin: 2.54cm; }
        * { box-sizing: border-box; }
        html, body { margin:0; padding:0; background:#fff !important; color:#000 !important; }
        body { font-family:'Times New Roman', serif; }
        #printAreaTransfer { display:block; width:100%; color:#000 !important; background:#fff !important; box-shadow:none !important; }
        .sj-page { width:100%; max-width:100%; min-height:auto; margin:0; padding:0; background:#fff !important; box-shadow:none !important; display:flex; flex-direction:column; page-break-after:always; break-after:page; }
        .sj-page:last-child { page-break-after:auto; break-after:auto; }
        .sj-kop { text-align:center; border-bottom:2px solid #000; padding-bottom:4px; margin-bottom:6px; }
        .sj-title { font-size:17.5pt; font-weight:bold; letter-spacing:.45px; }
        .sj-subtitle { font-size:9.8pt; font-weight:bold; margin-top:1px; }
        .sj-meta { display:grid; grid-template-columns:1fr 1fr; gap:1.2px 10px; font-size:8.2pt; margin:5px 0 7px; }
        .sj-meta div { display:flex; justify-content:space-between; border-bottom:1px dotted #888; padding:1px 0; }
        .sj-meta b { margin-left:8px; text-align:right; }
        .sj-table-zone { margin-top:1.5mm; }
        .sj-table { width:100%; border-collapse:collapse; table-layout:fixed; font-size:var(--sj-a4-font, 6.9pt); }
        .sj-table th,.sj-table td { border:1px solid #000; color:#000 !important; padding:.35mm .45mm; line-height:1.04; height:var(--sj-row-h, 4.9mm); vertical-align:middle; background:#fff !important; }
        .sj-table th { text-align:center; font-weight:bold; font-size:var(--sj-a4-head-font, 6.5pt); height:var(--sj-head-h, 5.3mm); }
        .sj-table td { text-align:center; }
        .sj-table .sj-name-cell { text-align:left; font-weight:600; padding-left:4px; font-size:var(--sj-a4-name-font, 7pt); }
        .sj-table th:nth-child(1), .sj-table td:nth-child(1) { width:8mm; }
        .sj-table th:nth-child(2), .sj-table td:nth-child(2) { width:auto; }
        .sj-table th:nth-child(3), .sj-table td:nth-child(3) { width:15mm; }
        .sj-table th:nth-child(4), .sj-table td:nth-child(4) { width:17mm; }
        .sj-table th:nth-child(5), .sj-table td:nth-child(5) { width:17mm; }
        .sj-table th:nth-child(6), .sj-table td:nth-child(6) { width:17mm; }
        .sj-table th:nth-child(7), .sj-table td:nth-child(7) { width:17mm; }
        .sj-note { font-size:7.2pt; margin-top:2.3mm; }
        .sj-a4-spacer { display:none !important; }
        .sj-sign { display:flex; justify-content:space-between; gap:10px; margin-top:8mm; page-break-inside:avoid; }
        .sj-sign-box { width:33.333%; text-align:center; font-size:7.4pt; }
        .sj-sign-name { margin-top:14mm; border-top:1px solid #000; padding-top:2px; font-weight:bold; }
      `;
    }

    function printCleanDocument(pagesHtml, mode) {
      const iframe = document.createElement('iframe');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.opacity = '0';
      document.body.appendChild(iframe);
      const win = iframe.contentWindow;
      const doc = win.document;
      doc.open();
      doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>Surat Jalan Transfer Produk</title><style>${getCleanPrintStyles(mode)}</style></head><body><div id="printAreaTransfer">${pagesHtml}</div></body></html>`);
      doc.close();
      setTimeout(() => {
        win.focus();
        win.print();
        setTimeout(() => iframe.remove(), 1000);
      }, 180);
    }

    function printSavedSuratJalan(mode) {
      try {
        const groups = printQueueGroups.length ? printQueueGroups : [getSelectedPrintGroup()];
        const is58 = mode === '58' || mode === '80';
        setDynamicPrintPage(is58 ? '58' : 'a4');
        const pagesHtml = groups.map(g => buildSuratJalanPage(g, mode)).join('');
        const printArea = document.getElementById('printAreaTransfer');
        if (printArea) printArea.innerHTML = pagesHtml;
        printCleanDocument(pagesHtml, is58 ? '58' : 'a4');
      } catch (error) {
        setPrintLoadStatus(error.message || 'Data surat jalan belum valid.', 'error');
        showToast(error.message || 'Data surat jalan belum valid.', 'error');
      }
    }

    function printSuratJalan() {
      printSavedSuratJalan('a4');
    }

    function getPusatStock(item) {
      return parseNumber(item.stokPusat ?? item.stokTersedia ?? 0);
    }

    function getOutletStock(item, outlet) {
      if (!item || !outlet) return 0;
      const stocks = item.outletStocks || {};
      if (Object.prototype.hasOwnProperty.call(stocks, outlet)) return parseNumber(stocks[outlet]);
      const target = normalizeText(outlet);
      const found = Object.keys(stocks).find(k => normalizeText(k) === target);
      return found ? parseNumber(stocks[found]) : 0;
    }

    function showToast(message, type = 'success') {
      const toast = document.getElementById('customToast');
      if (!toast) return;
      const kind = type === 'error' ? 'error' : type === 'warning' ? 'warning' : type === 'info' ? 'info' : 'success';
      const messageEl = document.getElementById('toastMessage');
      if (messageEl) messageEl.textContent = message || '-';

      const titleEl = toast.querySelector('.font-extrabold');
      if (titleEl) titleEl.textContent = kind === 'error' ? 'Perlu Dicek' : kind === 'warning' ? 'Perhatian' : 'Notifikasi';
      const iconEl = toast.querySelector('.w-9.h-9');
      if (iconEl) iconEl.textContent = kind === 'success' ? '✓' : kind === 'error' ? '!' : kind === 'warning' ? '!' : 'i';

      toast.className = 'toast show apj-page-toast apj-toast-' + kind + ' flex items-center w-full max-w-md p-4 rounded-xl shadow-2xl border backdrop-blur-xl';
      window.clearTimeout(window.__apjPageToastTimer);
      window.__apjPageToastTimer = window.setTimeout(() => toast.classList.remove('show'), 3600);
    }

    function parseNumber(value) {
      if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
      const raw = String(value ?? '').trim().replace(/\s/g, '');
      if (!raw) return 0;
      const commaIndex = raw.lastIndexOf(',');
      const dotIndex = raw.lastIndexOf('.');
      let cleaned = raw;
      if (commaIndex !== -1 && dotIndex !== -1) {
        cleaned = commaIndex > dotIndex ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
      } else if (commaIndex !== -1) {
        cleaned = raw.replace(',', '.');
      } else if ((raw.match(/\./g) || []).length > 1) {
        cleaned = raw.replace(/\./g, '');
      }
      const n = parseFloat(cleaned);
      return Number.isFinite(n) ? n : 0;
    }

    function formatNumber(value) {
      const n = parseNumber(value);
      return Number.isInteger(n) ? String(n) : String(n).replace('.', ',');
    }

    function normalizeText(value) {
      return String(value ?? '').toLowerCase().trim().replace(/\s+/g, '');
    }

    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
    }

    const apjLogoutModal = document.getElementById('logoutModal');
    const apjLogoutOverlay = apjLogoutModal ? apjLogoutModal.querySelector('.modal-overlay') : null;
    const apjLogoutContent = apjLogoutModal ? apjLogoutModal.querySelector('.modal-content') : null;

    function showLogoutModal() {
      if (!apjLogoutModal || !apjLogoutOverlay || !apjLogoutContent) return;
      apjLogoutModal.classList.remove('hidden');
      void apjLogoutModal.offsetWidth;
      apjLogoutOverlay.classList.add('opacity-100');
      apjLogoutOverlay.classList.remove('opacity-0');
      apjLogoutContent.classList.add('scale-100', 'opacity-100');
      apjLogoutContent.classList.remove('scale-95', 'opacity-0');
    }

    function closeLogoutModal() {
      if (!apjLogoutModal || !apjLogoutOverlay || !apjLogoutContent) return;
      apjLogoutOverlay.classList.remove('opacity-100');
      apjLogoutOverlay.classList.add('opacity-0');
      apjLogoutContent.classList.remove('scale-100', 'opacity-100');
      apjLogoutContent.classList.add('scale-95', 'opacity-0');
      setTimeout(() => apjLogoutModal.classList.add('hidden'), 300);
    }

    function executeLogout() {
      localStorage.removeItem('APJ_SESSION_ACTIVE');
      localStorage.removeItem('APJ_SESSION_TOKEN');
      localStorage.removeItem('APJ_USER_NAME');
      localStorage.removeItem('APJ_USER_LEVEL');
      localStorage.removeItem('APJ_USER_OUTLET');
      localStorage.removeItem('APJ_USER_PERMISSIONS');
      window.location.href = 'index.html';
    }

    function openMobileSidebar() {
      const sidebar = document.getElementById('sidebar');
      const backdrop = document.getElementById('sidebarBackdrop');
      if (!sidebar || !backdrop) return;
      sidebar.classList.remove('-translate-x-full');
      backdrop.classList.remove('hidden');
    }

    function closeMobileSidebar() {
      const sidebar = document.getElementById('sidebar');
      const backdrop = document.getElementById('sidebarBackdrop');
      if (!sidebar || !backdrop) return;
      sidebar.classList.add('-translate-x-full');
      backdrop.classList.add('hidden');
    }

    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { closeMobileSidebar(); closeTransferHelpModal(); } });
    window.addEventListener('resize', () => { if (window.innerWidth >= 1024) closeMobileSidebar(); });

/* Extracted from transfer-produksi.html inline script 2 */
// APJ Theme Sidebar Helpers - disamakan dengan Input/Output terbaru.
    function setupAdminMenu(levelValue) {
      const level = String(levelValue || localStorage.getItem('APJ_USER_LEVEL') || '').trim().toLowerCase();
      const show = level === 'owner' || level === 'superadmin' || level === 'super admin' || level === 'supervisor';
      document.querySelectorAll('[data-admin-menu]').forEach(el => el.classList.toggle('hidden', !show));
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

    document.addEventListener('DOMContentLoaded', () => {
      applySidebarState();
      setupAdminMenu(localStorage.getItem('APJ_USER_LEVEL'));
      const userName = localStorage.getItem('APJ_USER_NAME') || '-';
      const userLevel = localStorage.getItem('APJ_USER_LEVEL') || '-';
      const displayNama = document.getElementById('displayNama');
      const displayLevel = document.getElementById('displayLevel');
      const displayInisial = document.getElementById('displayInisial');
      if (displayNama) displayNama.textContent = userName;
      if (displayLevel) displayLevel.textContent = userLevel;
      if (displayInisial) displayInisial.textContent = (userName || 'U').charAt(0).toUpperCase();
    });

    window.addEventListener('resize', applySidebarState);


/* APP-APJ V1.8 - grouped sidebar handlers for transfer-produksi */
(function(){
  'use strict';
  const GROUP_KEY = 'APJ_DASHBOARD_MENU_GROUPS';
  function safeParseJSON(text){ try { return JSON.parse(text || '{}') || {}; } catch(e){ return {}; } }
  function setGroup(group, isOpen){
    if (!group) return;
    group.classList.toggle('open', !!isOpen);
    const button = group.querySelector('.nav-group-toggle');
    if (button) button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  }
  function toggleGroup(key){
    const group = document.querySelector('#dashboardSidebarMenu [data-menu-group="' + key + '"]');
    if (!group) return;
    const next = !group.classList.contains('open');
    setGroup(group, next);
    const saved = safeParseJSON(localStorage.getItem(GROUP_KEY));
    saved[key] = next;
    localStorage.setItem(GROUP_KEY, JSON.stringify(saved));
  }
  function initGroups(){
    const groups = document.querySelectorAll('#dashboardSidebarMenu [data-menu-group]');
    if (!groups.length) return;
    const saved = safeParseJSON(localStorage.getItem(GROUP_KEY));
    groups.forEach(function(group){
      const key = group.getAttribute('data-menu-group');
      const shouldOpen = typeof saved[key] === 'boolean' ? saved[key] : group.classList.contains('open');
      setGroup(group, shouldOpen);
    });
  }

  function ensureTransferMenuActive(){
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    const inv = sidebar.querySelector('[data-menu-group="module-inventory"]');
    const prod = sidebar.querySelector('[data-menu-group="inventory-production"]');
    [inv, prod].forEach(function(group){
      if (!group) return;
      group.classList.add('open');
      const btn = group.querySelector('.nav-group-toggle');
      if (btn) btn.setAttribute('aria-expanded','true');
    });
    sidebar.querySelectorAll('a.nav-item.active').forEach(function(a){ a.classList.remove('active'); });
    const link = sidebar.querySelector('a[href="transfer-produksi.html"]');
    if (link) link.classList.add('active');
  }

  function bindGroupedSidebar(){
    const collapseBtn = document.querySelector('[data-sidebar-collapse]');
    if (collapseBtn && collapseBtn.dataset.transferBound !== 'Y') {
      collapseBtn.dataset.transferBound = 'Y';
      collapseBtn.addEventListener('click', function(event){
        event.preventDefault();
        if (typeof window.toggleSidebarCollapse === 'function') window.toggleSidebarCollapse();
      });
    }
    document.querySelectorAll('#dashboardSidebarMenu [data-menu-toggle]').forEach(function(button){
      if (button.dataset.transferBound === 'Y') return;
      button.dataset.transferBound = 'Y';
      button.addEventListener('click', function(event){
        event.preventDefault();
        event.stopPropagation();
        const sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('sidebar-collapsed')) return;
        toggleGroup(button.getAttribute('data-menu-toggle'));
      });
    });
    document.querySelectorAll('#dashboardSidebarMenu [data-locked-menu], #dashboardSidebarMenu .nav-coming-soon').forEach(function(link){
      if (link.dataset.transferBound === 'Y') return;
      link.dataset.transferBound = 'Y';
      link.addEventListener('click', function(event){
        event.preventDefault();
        const name = link.getAttribute('data-coming-soon-menu') || link.getAttribute('data-locked-menu') || 'Menu ini';
        if (typeof showToast === 'function') showToast(name + ' segera hadir.', 'warning');
        else alert(name + ' segera hadir.');
      });
    });
  }
  document.addEventListener('DOMContentLoaded', function(){
    initGroups();
    ensureTransferMenuActive();
    bindGroupedSidebar();
    if (typeof setupAdminMenu === 'function') setupAdminMenu(localStorage.getItem('APJ_USER_LEVEL'));
  });
  window.toggleDashboardMenuGroup = toggleGroup;
})();
