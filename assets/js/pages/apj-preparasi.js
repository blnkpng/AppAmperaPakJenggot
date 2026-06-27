/* APJ PREPARASI V100
 * - Halaman preparasi bahan: resep atau manual.
 * - Tidak menampilkan kode teknis item kepada petugas.
 * - Menyimpan ke backend action simpanPreparasi.
 */
(function () {
  'use strict';

  const CONFIG = window.APJ_CONFIG || {};
  const API_URL = CONFIG.inventoryApiUrl || (CONFIG.apis && CONFIG.apis.inventory) || '';
  const STORAGE = CONFIG.storage || {};
  const STORAGE_KEYS = {
    active: STORAGE.active || 'APJ_SESSION_ACTIVE',
    token: STORAGE.token || 'APJ_SESSION_TOKEN',
    name: STORAGE.name || 'APJ_USER_NAME',
    level: STORAGE.level || 'APJ_USER_LEVEL',
    permissions: STORAGE.permissions || 'APJ_USER_PERMISSIONS'
  };

  const STATE = {
    categories: [],
    items: [],
    itemById: {},
    recipes: [],
    bahanRows: [],
    hasilRows: [],
    loading: false
  };

  document.addEventListener('DOMContentLoaded', initPage);

  async function initPage() {
    if (localStorage.getItem(STORAGE_KEYS.active) !== 'true' || !getToken()) {
      window.location.href = CONFIG.loginPage || 'index.html';
      return;
    }

    initUserHeader();
    initSidebar();
    initModalCloseOnEsc();
    setToday();

    const canAccess = hasAccess();
    if (!canAccess) {
      const denied = document.getElementById('accessDeniedBox');
      if (denied) denied.classList.remove('hidden');
      setButtonDisabled(true);
      return;
    }

    setTimeout(() => {
      if (sessionStorage.getItem('APJ_PREPARASI_HELP_SEEN_V100') !== 'true') openPreparasiHelpModal(true);
    }, 450);

    await loadPreparasiData();
  }

  function initUserHeader() {
    const nama = getPetugas() || 'Pengguna';
    const level = localStorage.getItem(STORAGE_KEYS.level) || '-';
    setText('namaPetugas', nama);
    setText('displayNama', nama);
    setText('displayLevel', level);
    setText('displayInisial', makeInitial(nama));
  }

  function initSidebar() {
    document.querySelectorAll('[data-menu-toggle]').forEach(btn => {
      if (btn.dataset.apjSidebarBound === '1') return;
      btn.dataset.apjSidebarBound = '1';
      btn.addEventListener('click', () => {
        const group = btn.closest('.nav-group');
        if (!group) return;
        const isOpen = group.classList.toggle('open');
        btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });
    });

    const collapseBtn = document.querySelector('[data-sidebar-collapse]');
    if (collapseBtn && collapseBtn.dataset.apjSidebarBound !== '1') {
      collapseBtn.dataset.apjSidebarBound = '1';
      collapseBtn.addEventListener('click', () => {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar || window.innerWidth < 1024) return;
        const collapsed = !sidebar.classList.contains('sidebar-collapsed');
        sidebar.classList.toggle('sidebar-collapsed', collapsed);
        document.body.classList.toggle('sidebar-collapsed-active', collapsed);
        try { localStorage.setItem((CONFIG.ui && CONFIG.ui.sidebarCollapsedKey) || 'APJ_SIDEBAR_COLLAPSED', collapsed ? '1' : '0'); } catch (err) {}
      });
    }

    document.querySelectorAll('.nav-coming-soon').forEach(link => {
      if (link.dataset.apjSidebarBound === '1') return;
      link.dataset.apjSidebarBound = '1';
      link.addEventListener('click', e => {
        e.preventDefault();
        const name = link.getAttribute('data-coming-soon-menu') || link.textContent.trim() || 'Menu ini';
        showToast(`${name} segera hadir.`, 'info');
      });
    });

    document.querySelectorAll('#sidebar a[href]:not(.nav-coming-soon)').forEach(link => {
      if (link.dataset.apjLinkBound === '1') return;
      link.dataset.apjLinkBound = '1';
      link.addEventListener('click', event => {
        const href = String(link.getAttribute('href') || '');
        if (link.classList.contains('active') || /(^|\/)preparasi\.html(?:$|[?#])/i.test(href)) {
          event.preventDefault();
          closeMobileSidebar();
          return;
        }
        closeMobileSidebar();
      });
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
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      closePreparasiHelpModal();
      closeLogoutModal();
    });
  }

  function setToday() {
    const input = document.getElementById('tanggalInput');
    if (!input || input.value) return;
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    input.value = d.toISOString().slice(0, 10);
  }

  function hasAccess() {
    const level = localStorage.getItem(STORAGE_KEYS.level) || '';
    if (/owner|super|gudang|dapur|produksi/i.test(level)) return true;
    try {
      const perms = JSON.parse(localStorage.getItem(STORAGE_KEYS.permissions) || '{}');
      return perms.preparasi === 'Y' || perms.produksi === 'Y' || perms.inventory === 'Y';
    } catch (err) {
      return true;
    }
  }

  async function loadPreparasiData() {
    STATE.loading = true;
    setKpiStatus('Memuat Data');
    setTableLoading('bahanTableBody', 'Memuat daftar bahan...');
    setTableLoading('hasilTableBody', 'Memuat daftar hasil...');

    try {
      let loaded = false;
      try {
        const init = await callInventory('getPreparasiInit', {});
        if (init && init.success) {
          applyInitData(init);
          loaded = true;
        }
      } catch (err) {
        // Backend lama belum punya getPreparasiInit. Fallback manual tetap disiapkan.
      }

      if (!loaded) await loadFallbackItems();

      renderRecipeSelect();
      if (STATE.recipes.length) {
        setMode('resep');
        STATE.bahanRows = [];
        STATE.hasilRows = [];
        setTableMessage('bahanTableBody', 'Pilih resep preparasi, lalu cek jumlah bahan yang dipakai.', 4);
        setTableMessage('hasilTableBody', 'Pilih resep preparasi untuk menampilkan hasil.', 4);
      } else {
        setMode('manual');
        addBahanRow(false);
        addHasilRow(false);
        setInfo('Resep belum tersedia di sistem. Gunakan mode manual untuk mencatat proses preparasi.');
      }
      updateKpi();
      setKpiStatus('Siap');
    } catch (error) {
      const message = getFriendlyError(error);
      setTableMessage('bahanTableBody', message, 4, 'error');
      setTableMessage('hasilTableBody', 'Data belum dapat dimuat.', 4, 'error');
      setInfo('Gagal memuat data. Gunakan Muat Ulang halaman atau hubungi admin bila masih terjadi.', 'error');
      showToast(message, 'error');
      setKpiStatus('Gagal Memuat');
    } finally {
      STATE.loading = false;
    }
  }

  function applyInitData(res) {
    const items = res.items || res.barang || (res.data && res.data.items) || [];
    const recipes = res.resep || res.recipes || (res.data && (res.data.resep || res.data.recipes)) || [];
    const categories = res.kategori || res.categories || (res.data && (res.data.kategori || res.data.categories)) || [];
    setItems(items);
    const normalizedRecipes = (recipes || []).map(normalizeRecipe).filter(r => r.id && r.nama);
    STATE.recipes = groupNormalizedRecipes(normalizedRecipes);
    STATE.categories = Array.isArray(categories) ? categories : [];
  }

  async function loadFallbackItems() {
    const dash = await callInventory('getDashboardData', {});
    const cats = normalizeCategories(dash.kategori || (dash.data && dash.data.kategori) || []);
    STATE.categories = cats;
    const all = [];
    for (const cat of cats) {
      try {
        const res = await callInventory('getBarang', { kategori: cat.nama || cat, context: '' });
        const rows = res.data || res.barang || [];
        rows.forEach(x => all.push(x));
      } catch (err) {}
    }
    if (!all.length) {
      const res = await callInventory('getBarang', { context: '' });
      (res.data || res.barang || []).forEach(x => all.push(x));
    }
    setItems(all);
    STATE.recipes = [];
  }

  function setItems(rows) {
    const by = {};
    STATE.items = (rows || []).map(normalizeItem).filter(item => item.id && item.nama).filter(item => {
      if (by[item.id]) return false;
      by[item.id] = item;
      return true;
    }).sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
    STATE.itemById = {};
    STATE.items.forEach(item => { STATE.itemById[item.id] = item; });
  }

  function normalizeCategories(rows) {
    return (rows || []).map(row => ({
      id: row.id || row.idKategori || row['ID Kategori'] || '',
      nama: row.nama || row.namaKategori || row['Nama Kategori'] || row.name || row
    })).filter(x => x.nama);
  }

  function normalizeItem(row) {
    return {
      id: String(row.id || row.idItem || row['ID Item'] || row.kodeLama || row['Kode Lama'] || '').trim(),
      nama: String(row.nama || row.namaItem || row['Nama Item'] || row.namaProduk || row['Nama Produk'] || '').trim(),
      kategori: String(row.kategori || row['Kategori'] || '').trim(),
      satuan: String(row.satuanStok || row.satuanProduksi || row.satuan || row['Satuan Stok'] || row['Satuan Produksi'] || row['Satuan'] || '-').trim(),
      stok: Number(row.stokTersedia ?? row.stokAkhir ?? row['Stok Akhir'] ?? row.stok ?? 0) || 0,
      status: String(row.status || row['Status'] || '').trim()
    };
  }

  function normalizeRecipe(row) {
    const bahanRows = Array.isArray(row.bahan) ? row.bahan : [];
    const hasilId = String(row.idHasil || row.idItemHasil || row['ID Item Hasil'] || row.idItem || '').trim();
    const hasilItem = STATE.itemById[hasilId] || {};
    const bahanId = String(row.idBahan || row['ID Bahan'] || '').trim();
    const bahanItem = STATE.itemById[bahanId] || {};
    const hasil = Array.isArray(row.hasil) ? row.hasil : [{
      idItem: hasilId,
      nama: row.namaHasil || row.hasil || row['Nama Hasil'] || hasilItem.nama || '',
      qty: Number(row.qtyHasil || row['Qty Hasil'] || 1) || 1
    }];
    const bahan = bahanRows.length ? bahanRows : [{
      idItem: bahanId,
      nama: row.namaBahan || row.bahan || row['Nama Bahan'] || bahanItem.nama || '',
      qty: Number(row.qtyBahan || row['Qty Bahan'] || 0) || 0
    }];
    const namaHasil = hasil[0] ? (hasil[0].nama || (STATE.itemById[hasil[0].idItem] || {}).nama || '') : '';
    const namaBahan = bahan[0] ? (bahan[0].nama || (STATE.itemById[bahan[0].idItem] || {}).nama || '') : '';
    return {
      id: String(row.idResep || row.idResepPreparasi || row['ID Resep Preparasi'] || hasilId || '').trim(),
      nama: String(row.namaResep || row.nama || (namaHasil && namaBahan ? `${namaHasil} dari ${namaBahan}` : namaHasil || 'Resep Preparasi')).trim(),
      bahan: bahan.map(b => {
        const idItem = String(b.idItem || b.idBahan || b.id || '').trim();
        const item = STATE.itemById[idItem] || {};
        return { idItem, nama: b.nama || b.namaBahan || item.nama || '', qty: Number(b.qty || b.qtyBahan || b.qtyKeluar || 0) || 0 };
      }).filter(b => b.idItem),
      hasil: hasil.map(h => {
        const idItem = String(h.idItem || h.idHasil || h.id || '').trim();
        const item = STATE.itemById[idItem] || {};
        return { idItem, nama: h.nama || h.namaHasil || item.nama || '', qty: Number(h.qty || h.qtyHasil || h.qtyMasuk || 0) || 0 };
      }).filter(h => h.idItem),
      catatan: row.catatan || row['Catatan'] || ''
    };
  }

  function groupNormalizedRecipes(rows) {
    const grouped = {};
    (rows || []).forEach(recipe => {
      const key = recipe.id || recipe.nama;
      if (!key) return;
      if (!grouped[key]) {
        grouped[key] = { id: recipe.id, nama: recipe.nama, bahan: [], hasil: [], catatan: '', _catatan: [] };
      }
      recipe.bahan.forEach(b => addUniquePrepPart(grouped[key].bahan, b));
      recipe.hasil.forEach(h => addUniquePrepPart(grouped[key].hasil, h));
      if (recipe.catatan && !/migrasi/i.test(String(recipe.catatan))) grouped[key]._catatan.push(recipe.catatan);
    });
    return Object.values(grouped).map(recipe => {
      recipe.nama = buildGroupedRecipeName(recipe);
      recipe.catatan = recipe._catatan[0] || '';
      delete recipe._catatan;
      return recipe;
    }).filter(r => r.bahan.length || r.hasil.length).sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
  }

  function addUniquePrepPart(list, part) {
    const id = part && part.idItem ? String(part.idItem).trim() : '';
    if (!id) return;
    const existing = list.find(x => x.idItem === id);
    if (existing) {
      if ((!existing.qty || existing.qty <= 0) && Number(part.qty) > 0) existing.qty = Number(part.qty) || 0;
      if (!existing.nama && part.nama) existing.nama = part.nama;
      return;
    }
    list.push({ idItem: id, nama: part.nama || (STATE.itemById[id] || {}).nama || '', qty: Number(part.qty || 0) || 0 });
  }

  function buildGroupedRecipeName(recipe) {
    const bahanNames = recipe.bahan.map(b => b.nama || (STATE.itemById[b.idItem] || {}).nama).filter(Boolean);
    const hasilNames = recipe.hasil.map(h => h.nama || (STATE.itemById[h.idItem] || {}).nama).filter(Boolean);
    if (bahanNames.length === 1 && hasilNames.length > 1) return 'Preparasi ' + bahanNames[0];
    if (bahanNames.length === 1 && recipe.nama && / dari /i.test(recipe.nama)) return 'Preparasi ' + bahanNames[0];
    if (recipe.nama) return recipe.nama;
    if (bahanNames.length === 1) return 'Preparasi ' + bahanNames[0];
    return 'Resep Preparasi';
  }

  function renderRecipeSelect() {
    const select = document.getElementById('resepSelect');
    if (!select) return;
    if (!STATE.recipes.length) {
      select.innerHTML = '<option value="">Resep belum tersedia</option>';
      select.disabled = true;
      return;
    }
    select.disabled = false;
    select.innerHTML = '<option value="">-- Pilih Resep Preparasi --</option>' + STATE.recipes.map(r => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.nama)}</option>`).join('');
  }

  function setMode(mode) {
    const modeSelect = document.getElementById('modeSelect');
    if (modeSelect) modeSelect.value = mode;
    handleModeChange();
  }

  function handleModeChange() {
    const mode = getMode();
    const wrap = document.getElementById('resepWrap');
    if (wrap) wrap.classList.toggle('hidden', mode !== 'resep');
    if (mode === 'manual') {
      setInfo('Mode manual digunakan untuk proses khusus. Pilih bahan yang dipakai dan hasil yang masuk sesuai kondisi nyata.');
      if (!STATE.bahanRows.length) addBahanRow(false);
      if (!STATE.hasilRows.length) addHasilRow(false);
      renderRows();
    } else {
      setInfo('Pilih resep untuk mengisi bahan dan hasil. Jumlah standar dari resep tetap bisa disesuaikan sesuai fisik nyata sebelum disimpan.');
      const resepSelect = document.getElementById('resepSelect');
      if (resepSelect && resepSelect.value) handleRecipeChange();
      else {
        STATE.bahanRows = [];
        STATE.hasilRows = [];
        setTableMessage('bahanTableBody', 'Pilih resep preparasi terlebih dahulu.', 4);
        setTableMessage('hasilTableBody', 'Pilih resep preparasi terlebih dahulu.', 4);
      }
    }
    updateKpi();
  }

  function handleRecipeChange() {
    const id = (document.getElementById('resepSelect') || {}).value || '';
    const recipe = STATE.recipes.find(r => r.id === id);
    if (!recipe) {
      STATE.bahanRows = [];
      STATE.hasilRows = [];
      setTableMessage('bahanTableBody', 'Pilih resep preparasi terlebih dahulu.', 4);
      setTableMessage('hasilTableBody', 'Pilih resep preparasi terlebih dahulu.', 4);
      updateKpi();
      return;
    }
    STATE.bahanRows = recipe.bahan.map(b => makeRow(b.idItem, b.qty || '', ''));
    STATE.hasilRows = recipe.hasil.map(h => makeRow(h.idItem, h.qty || '', ''));
    setInfo(recipe.catatan || 'Resep siap digunakan. Periksa jumlah bahan yang dipakai dan hasil yang masuk sebelum menyimpan.');
    renderRows();
    updateKpi();
  }

  function addBahanRow(render = true) {
    STATE.bahanRows.push(makeRow('', '', ''));
    if (render) { renderRows(); updateKpi(); }
  }

  function addHasilRow(render = true) {
    STATE.hasilRows.push(makeRow('', '', ''));
    if (render) { renderRows(); updateKpi(); }
  }

  function makeRow(idItem, qty, catatan) {
    const cleanQty = qty === '' || qty === null || typeof qty === 'undefined' ? '' : Number(qty || 0);
    return { uid: 'ROW-' + Date.now() + '-' + Math.random().toString(16).slice(2), idItem: idItem || '', qty: cleanQty, catatan: catatan || '' };
  }

  function renderRows() {
    renderRowTable('bahanTableBody', STATE.bahanRows, 'bahan');
    renderRowTable('hasilTableBody', STATE.hasilRows, 'hasil');
  }

  function renderRowTable(tbodyId, rows, type) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    if (!rows.length) {
      setTableMessage(tbodyId, type === 'bahan' ? 'Belum ada bahan keluar.' : 'Belum ada hasil masuk.', 4);
      return;
    }
    tbody.innerHTML = rows.map(row => {
      const item = STATE.itemById[row.idItem] || {};
      const select = buildItemSelect(type, row.uid, row.idItem);
      return `<tr class="prep-row">
        <td class="p-4 align-top">${select}<p class="mt-1 text-xs text-slate-500">${escapeHtml(item.kategori || 'Pilih barang')}</p></td>
        <td class="p-4 text-center align-middle"><strong class="text-cyan-300">${formatNumber(item.stok || 0)}</strong><p class="text-xs text-slate-500">${escapeHtml(item.satuan || '-')}</p></td>
        <td class="p-4 text-center align-middle"><input class="prep-qty-input" type="number" min="0" step="0.01" value="${row.qty === '' || row.qty === null || typeof row.qty === 'undefined' ? '' : escapeHtml(row.qty)}" oninput="updatePrepQty('${type}','${row.uid}',this.value)"/></td>
        <td class="p-4 text-center align-middle"><button class="prep-remove-btn" type="button" onclick="removePrepRow('${type}','${row.uid}')">×</button></td>
      </tr>`;
    }).join('');
  }

  function buildItemSelect(type, uid, selected) {
    const placeholder = type === 'bahan' ? '-- Pilih Bahan --' : '-- Pilih Hasil --';
    const options = STATE.items.map(item => `<option value="${escapeHtml(item.id)}" ${item.id === selected ? 'selected' : ''}>${escapeHtml(item.nama)} — ${escapeHtml(item.kategori || '-')}</option>`).join('');
    return `<select class="form-control prep-item-select" onchange="updatePrepItem('${type}','${uid}',this.value)"><option value="">${placeholder}</option>${options}</select>`;
  }

  function updatePrepItem(type, uid, value) {
    const rows = type === 'bahan' ? STATE.bahanRows : STATE.hasilRows;
    const row = rows.find(r => r.uid === uid);
    if (row) row.idItem = value;
    renderRows();
    updateKpi();
  }

  function updatePrepQty(type, uid, value) {
    const rows = type === 'bahan' ? STATE.bahanRows : STATE.hasilRows;
    const row = rows.find(r => r.uid === uid);
    if (row) row.qty = String(value || '').trim() === '' ? '' : (Number(value || 0) || 0);
    updateKpi();
  }

  function removePrepRow(type, uid) {
    if (type === 'bahan') STATE.bahanRows = STATE.bahanRows.filter(r => r.uid !== uid);
    else STATE.hasilRows = STATE.hasilRows.filter(r => r.uid !== uid);
    renderRows();
    updateKpi();
  }

  async function simpanPreparasi() {
    if (STATE.loading) return;
    const tanggal = (document.getElementById('tanggalInput') || {}).value || '';
    const mode = getMode();
    const idResep = (document.getElementById('resepSelect') || {}).value || '';
    const sisa = getSisaData();
    const keteranganProses = buildKeteranganProses(sisa);

    if (!tanggal) return showToast('Tanggal preparasi wajib diisi.', 'error');
    if (mode === 'resep' && STATE.recipes.length && !idResep) return showToast('Pilih resep preparasi terlebih dahulu.', 'error');
    if (sisa.qty > 0 && sisa.kode === 'TIDAK_ADA') return showToast('Pilih keterangan susut/sisa sebelum menyimpan.', 'error');

    const bahan = STATE.bahanRows.filter(r => r.idItem && Number(r.qty) > 0).map(r => ({
      idBahan: r.idItem,
      idItem: r.idItem,
      qtyKeluar: Number(r.qty) || 0,
      qty: Number(r.qty) || 0,
      keterangan: 'Bahan preparasi' + (keteranganProses ? ' | ' + keteranganProses : '')
    }));
    const hasil = STATE.hasilRows.filter(r => r.idItem && Number(r.qty) > 0).map(r => ({
      idHasil: r.idItem,
      idItem: r.idItem,
      qtyMasuk: Number(r.qty) || 0,
      qty: Number(r.qty) || 0,
      keterangan: 'Hasil preparasi' + (keteranganProses ? ' | ' + keteranganProses : '')
    }));

    if (!bahan.length) return showToast('Isi minimal satu bahan keluar.', 'error');
    if (!hasil.length) return showToast('Isi minimal satu hasil masuk.', 'error');

    setButtonDisabled(true, 'Menyimpan...');
    setKpiStatus('Menyimpan');
    try {
      const res = await callInventory('simpanPreparasi', {
        tanggal,
        petugas: getPetugas(),
        mode,
        idResep,
        catatan: keteranganProses,
        keterangan: keteranganProses,
        sisa,
        bahan,
        hasil
      });
      if (!res.success) throw new Error(res.message || 'Preparasi belum berhasil disimpan.');
      showToast(res.message || 'Preparasi berhasil disimpan.', 'success');
      setInfo('Preparasi berhasil disimpan. Stok berubah dari Bahan Keluar dan Hasil Masuk; catatan susut/sisa hanya sebagai keterangan proses.');
      STATE.bahanRows = [];
      STATE.hasilRows = [];
      const resepSelect = document.getElementById('resepSelect');
      if (resepSelect) resepSelect.value = '';
      resetSisaFields();
      renderRows();
      setTableMessage('bahanTableBody', 'Pilih resep atau tambahkan bahan untuk proses berikutnya.', 4);
      setTableMessage('hasilTableBody', 'Pilih resep atau tambahkan hasil untuk proses berikutnya.', 4);
      updateKpi();
      setKpiStatus('Siap');
      // Muat ulang stok setelah simpan.
      await loadPreparasiData();
    } catch (error) {
      const message = getFriendlyError(error);
      showToast(message, 'error');
      setKpiStatus('Gagal Simpan');
    } finally {
      setButtonDisabled(false);
    }
  }

  function updateKpi() {
    setText('kpiResep', STATE.recipes.length);
    const totalBahan = totalQty(STATE.bahanRows);
    const totalHasil = totalQty(STATE.hasilRows);
    setText('kpiBahan', formatNumber(totalBahan));
    setText('kpiHasil', formatNumber(totalHasil));
    updateAutoSisaField(totalBahan, totalHasil);
    const sisa = getSisaData();
    const hasSisaNote = sisa.qty > 0 || sisa.kode !== 'TIDAK_ADA' || !!sisa.tambahan;
    setText('kpiSisa', hasSisaNote ? (sisa.qty > 0 ? `${formatNumber(sisa.qty)} ${sisa.satuan || ''}`.trim() : sisa.label) : '-');
    updateSisaHintByValue(sisa);
    const validBahan = STATE.bahanRows.filter(r => r.idItem && Number(r.qty) > 0).length;
    const validHasil = STATE.hasilRows.filter(r => r.idItem && Number(r.qty) > 0).length;
    const sisaText = hasSisaNote ? ` Catatan susut/sisa: ${sisa.qty > 0 ? formatNumber(sisa.qty) + (sisa.satuan ? ' ' + sisa.satuan : '') + ' - ' : ''}${sisa.label}.` : '';
    setText('ringkasanPreparasi', validBahan || validHasil ? `${validBahan} bahan keluar dan ${validHasil} hasil masuk akan disimpan.${sisaText}` : 'Belum ada bahan atau hasil yang diisi.');
  }

  function updateAutoSisaField(totalBahan, totalHasil) {
    // V100: sisa tidak lagi dihitung otomatis dari total bahan - total hasil.
    // Alasannya, bahan dan hasil bisa beda satuan/beda item/multi bahan.
    // Stok hanya berubah dari tabel Bahan Keluar dan Hasil Masuk; bagian ini murni catatan manual.
    const input = document.getElementById('qtySisaInput');
    if (!input) return;
    if (String(input.value || '').trim() === '') input.value = '';
  }

  function updateSisaHintByValue(sisa) {
    const hint = document.getElementById('sisaHint');
    if (!hint) return;
    if (!sisa || (sisa.qty <= 0 && sisa.kode === 'TIDAK_ADA' && !sisa.tambahan)) {
      hint.textContent = 'Tidak ada catatan susut/sisa. Stok tetap dihitung dari Bahan Keluar dan Hasil Masuk saja.';
      return;
    }
    if (sisa.qty > 0 && sisa.kode === 'TIDAK_ADA') {
      hint.textContent = 'Qty selisih sudah diisi. Pilih keterangan: susut, rusak, hilang, sisa diproses berikutnya, atau lainnya.';
      return;
    }
    hint.textContent = 'Catatan tersimpan sebagai keterangan proses, bukan sebagai transaksi stok tambahan.';
  }


  function handleKeteranganChange() {
    const proses = document.getElementById('keteranganProsesSelect');
    const sisaSelect = document.getElementById('keteranganSisaSelect');
    if (proses && sisaSelect && proses.value && proses.value !== 'NORMAL' && sisaSelect.value === 'TIDAK_ADA') {
      sisaSelect.value = proses.value;
    }
    updateKpi();
  }

  function getSisaData() {
    const qty = Math.abs(Number((document.getElementById('qtySisaInput') || {}).value || 0) || 0);
    const satuan = String((document.getElementById('satuanSisaInput') || {}).value || '').trim();
    const kode = String((document.getElementById('keteranganSisaSelect') || {}).value || 'TIDAK_ADA').trim() || 'TIDAK_ADA';
    const tambahan = String((document.getElementById('keteranganTambahanInput') || {}).value || '').trim();
    return { qty, satuan, kode, label: getSisaLabel(kode), tambahan };
  }

  function getSisaLabel(kode) {
    const labels = {
      TIDAK_ADA: 'Tidak ada sisa',
      SUSUT: 'Susut',
      RUSAK: 'Rusak',
      HILANG: 'Hilang',
      SISA: 'Sisa diproses berikutnya',
      LAINNYA: 'Lainnya'
    };
    return labels[kode] || kode || 'Tidak ada sisa';
  }

  function buildKeteranganProses(sisa) {
    const proses = String((document.getElementById('keteranganProsesSelect') || {}).value || 'NORMAL').trim();
    const prosesLabel = proses === 'NORMAL' ? 'Normal' : getSisaLabel(proses);
    const parts = ['Kondisi proses: ' + prosesLabel];
    if (sisa && sisa.qty !== 0) {
      parts.push('Qty susut/sisa manual: ' + formatNumber(sisa.qty) + (sisa.satuan ? ' ' + sisa.satuan : ''));
      parts.push('Keterangan susut/sisa: ' + sisa.label);
    }
    if (sisa && sisa.tambahan) parts.push('Tambahan: ' + sisa.tambahan);
    return parts.join(' | ');
  }

  function resetSisaFields() {
    const proses = document.getElementById('keteranganProsesSelect');
    const qty = document.getElementById('qtySisaInput');
    const satuan = document.getElementById('satuanSisaInput');
    const sisa = document.getElementById('keteranganSisaSelect');
    const tambahan = document.getElementById('keteranganTambahanInput');
    if (proses) proses.value = 'NORMAL';
    if (qty) qty.value = '0';
    if (satuan) satuan.value = '';
    if (sisa) sisa.value = 'TIDAK_ADA';
    if (tambahan) tambahan.value = '';
    handleKeteranganChange();
  }

  function getMainSatuan() {
    const bahan = STATE.bahanRows.find(r => r.idItem && STATE.itemById[r.idItem]);
    const hasil = STATE.hasilRows.find(r => r.idItem && STATE.itemById[r.idItem]);
    const bahanSatuan = bahan ? (STATE.itemById[bahan.idItem] || {}).satuan : '';
    const hasilSatuan = hasil ? (STATE.itemById[hasil.idItem] || {}).satuan : '';
    return bahanSatuan || hasilSatuan || '';
  }

  function setSisaDefaultUnit() {
    const input = document.getElementById('satuanSisaInput');
    if (!input) return;
    if (!String(input.value || '').trim()) input.value = '';
  }

  function totalQty(rows) {
    return rows.reduce((sum, r) => sum + (Number(r.qty) || 0), 0);
  }

  function getMode() {
    return (document.getElementById('modeSelect') || {}).value || 'resep';
  }

  function setButtonDisabled(disabled, label) {
    const btn = document.getElementById('btnSimpan');
    if (!btn) return;
    btn.disabled = !!disabled;
    btn.textContent = label || 'Simpan Preparasi';
  }

  function setKpiStatus(value) {
    setText('kpiStatus', value);
  }

  function setInfo(message, type) {
    const box = document.getElementById('infoBox');
    if (!box) return;
    box.textContent = message || '';
    box.classList.toggle('is-error', type === 'error');
  }

  function setTableLoading(tbodyId, message) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    tbody.innerHTML = `<tr><td class="p-8 text-center" colspan="4"><div class="apj-table-loading"><span class="apj-table-spinner"></span><div><strong>${escapeHtml(message || 'Memuat data...')}</strong><p>Mohon tunggu, data sedang disiapkan.</p></div></div></td></tr>`;
  }

  function setTableMessage(tbodyId, message, colspan, type) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    const cls = type === 'error' ? 'text-rose-300' : 'text-slate-500';
    tbody.innerHTML = `<tr><td class="p-8 text-center ${cls}" colspan="${colspan || 4}">${escapeHtml(message || '')}</td></tr>`;
  }

  function formatNumber(value) {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return '0';
    return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(n);
  }

  function roundNumber(value) {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return 0;
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  function formatSignedNumber(value) {
    const n = roundNumber(value);
    if (n > 0) return formatNumber(n);
    if (n < 0) return '-' + formatNumber(Math.abs(n));
    return '0';
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
          mode: 'cors',
          cache: 'no-store',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(body),
          signal: controller ? controller.signal : undefined
        });
        const text = await response.text();
        if (!response.ok) throw new Error('Server belum merespons dengan baik.');
        return parseJsonResponse(text);
      } catch (error) {
        lastError = error;
        if (attempt < retries) await sleep(500 * attempt);
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
    throw lastError || new Error('Data belum dapat dimuat.');
  }

  function parseJsonResponse(text) {
    const raw = String(text || '').trim();
    if (!raw) throw new Error('Response server kosong.');
    try { return JSON.parse(raw); } catch (err) {}
    const first = raw.indexOf('{');
    const last = raw.lastIndexOf('}');
    if (first >= 0 && last > first) {
      try { return JSON.parse(raw.slice(first, last + 1)); } catch (err) {}
    }
    throw new Error('Response server tidak valid. Silakan coba beberapa saat lagi.');
  }

  function getFriendlyError(error) {
    const msg = error && error.message ? error.message : String(error || 'Terjadi kendala.');
    if (/abort|timeout|Failed to fetch|NetworkError/i.test(msg)) return 'Koneksi ke server sedang lambat. Silakan coba beberapa saat lagi.';
    if (/Action tidak dikenal|getPreparasiInit/i.test(msg)) return 'Data resep belum tersedia. Mode manual tetap dapat digunakan.';
    return msg;
  }

  function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  }

  function showToast(message, type = 'info') {
    const toast = document.getElementById('customToast');
    const text = document.getElementById('toastMessage');
    if (!toast || !text) { alert(message); return; }
    text.textContent = message;
    toast.classList.remove('success', 'error', 'info', 'show');
    toast.classList.add(type, 'show');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => toast.classList.remove('show'), 3600);
  }

  const preparasiHelpModal = () => document.getElementById('preparasiHelpModal');
  function openPreparasiHelpModal(autoOpen = false) {
    const modal = preparasiHelpModal();
    const overlay = modal ? modal.querySelector('.modal-overlay') : null;
    const content = modal ? modal.querySelector('.modal-content') : null;
    if (!modal || !overlay || !content) return;
    if (!autoOpen) closeMobileSidebar();
    modal.classList.remove('hidden');
    void modal.offsetWidth;
    overlay.classList.add('opacity-100');
    overlay.classList.remove('opacity-0');
    content.classList.add('scale-100', 'opacity-100');
    content.classList.remove('scale-95', 'opacity-0');
  }

  function closePreparasiHelpModal() {
    const modal = preparasiHelpModal();
    const overlay = modal ? modal.querySelector('.modal-overlay') : null;
    const content = modal ? modal.querySelector('.modal-content') : null;
    if (!modal || !overlay || !content) return;
    sessionStorage.setItem('APJ_PREPARASI_HELP_SEEN_V100', 'true');
    overlay.classList.remove('opacity-100');
    overlay.classList.add('opacity-0');
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 250);
  }

  function openMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (sidebar) sidebar.classList.remove('-translate-x-full');
    if (backdrop) backdrop.classList.remove('hidden');
  }

  function closeMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (sidebar) sidebar.classList.add('-translate-x-full');
    if (backdrop) backdrop.classList.add('hidden');
  }

  function showLogoutModal() {
    const modal = document.getElementById('logoutModal');
    if (!modal) return;
    const overlay = modal.querySelector('.modal-overlay');
    const content = modal.querySelector('.modal-content');
    modal.classList.remove('hidden');
    void modal.offsetWidth;
    if (overlay) { overlay.classList.add('opacity-100'); overlay.classList.remove('opacity-0'); }
    if (content) { content.classList.add('scale-100', 'opacity-100'); content.classList.remove('scale-95', 'opacity-0'); }
  }

  function closeLogoutModal() {
    const modal = document.getElementById('logoutModal');
    if (!modal) return;
    const overlay = modal.querySelector('.modal-overlay');
    const content = modal.querySelector('.modal-content');
    if (overlay) { overlay.classList.remove('opacity-100'); overlay.classList.add('opacity-0'); }
    if (content) { content.classList.remove('scale-100', 'opacity-100'); content.classList.add('scale-95', 'opacity-0'); }
    setTimeout(() => modal.classList.add('hidden'), 250);
  }

  function executeLogout() {
    localStorage.removeItem(STORAGE_KEYS.active);
    localStorage.removeItem(STORAGE_KEYS.token);
    window.location.href = CONFIG.loginPage || 'index.html';
  }

  window.handleModeChange = handleModeChange;
  window.handleRecipeChange = handleRecipeChange;
  window.addBahanRow = addBahanRow;
  window.addHasilRow = addHasilRow;
  window.updatePrepItem = updatePrepItem;
  window.updatePrepQty = updatePrepQty;
  window.removePrepRow = removePrepRow;
  window.handleKeteranganChange = handleKeteranganChange;
  window.updateKpi = updateKpi;
  window.simpanPreparasi = simpanPreparasi;
  window.openPreparasiHelpModal = openPreparasiHelpModal;
  window.closePreparasiHelpModal = closePreparasiHelpModal;
  window.openMobileSidebar = openMobileSidebar;
  window.closeMobileSidebar = closeMobileSidebar;
  window.showLogoutModal = showLogoutModal;
  window.closeLogoutModal = closeLogoutModal;
  window.executeLogout = executeLogout;
})();
