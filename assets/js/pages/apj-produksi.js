/* APJ PRODUKSI V70
 * - Batch Produksi Harian: banyak resep dalam satu proses simpan.
 * - Stok bahan tersinkron sementara sebelum disimpan.
 *   Contoh telur stok 5, dipakai 1 pada produksi pertama, baris berikutnya otomatis membaca sisa 4.
 * - Dropdown tetap menampilkan nama bahan/nama hasil saja.
 * - Menyimpan gabungan bahanRows dan produksiRows ke backend simpanProduksi.
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
    batches: [],
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
      if (sessionStorage.getItem('APJ_PRODUKSI_HELP_SEEN_V70') !== 'true') openProduksiHelpModal(true);
    }, 450);

    await loadProduksiData();
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
        if (link.classList.contains('active') || /(^|\/)produksi\.html(?:$|[?#])/i.test(href)) {
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
      closeProduksiHelpModal();
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
      return perms.produksi === 'Y' || perms.inventory === 'Y';
    } catch (err) {
      return true;
    }
  }

  async function loadProduksiData() {
    STATE.loading = true;
    setKpiStatus('Memuat Data');
    renderBatchLoading('Memuat resep produksi dan stok bahan...');

    try {
      const res = await getProduksiDataFromServer();
      const recipes = extractRecipeRows(res);
      const items = collectItemsFromProductionRecipes(recipes);
      setItems(items);
      STATE.recipes = groupNormalizedRecipes((recipes || []).map(normalizeRecipe).filter(r => r.id && (r.bahan.length || r.hasil.length)));

      if (!STATE.items.length) await loadFallbackItems();

      renderRecipeSelect();
      STATE.batches = [];
      renderBatches();
      setInfo(STATE.recipes.length
        ? 'Pilih resep lalu klik Tambah Produksi. Karyawan bisa menambahkan beberapa produksi harian sebelum menyimpan.'
        : 'Resep produksi belum tersedia. Gunakan Tambah Manual untuk mencatat proses produksi khusus.');
      updateKpi();
      setKpiStatus('Siap');
    } catch (error) {
      try {
        await loadFallbackItems();
        STATE.batches = [];
        renderRecipeSelect();
        renderBatches();
        setInfo('Data resep belum dapat dimuat. Mode manual tetap dapat digunakan.', 'error');
        setKpiStatus('Manual');
      } catch (fallbackError) {
        const message = getFriendlyError(error);
        renderBatchMessage(message, 'error');
        setInfo('Gagal memuat data. Gunakan Muat Ulang halaman atau hubungi admin bila masih terjadi.', 'error');
        showToast(message, 'error');
        setKpiStatus('Gagal Memuat');
      }
    } finally {
      STATE.loading = false;
    }
  }

  async function getProduksiDataFromServer() {
    const actions = ['getBarangProduksi', 'getProduksiInit', 'getResepProduksi'];
    let last = null;
    for (const action of actions) {
      try {
        const res = await callInventory(action, { noCache: true, fresh: true });
        const rows = extractRecipeRows(res);
        if (rows.length) return Object.assign({}, res, { _usedAction: action });
        last = res;
      } catch (err) {
        last = { success: false, message: err && err.message ? err.message : String(err) };
      }
    }
    return last || { success: true, data: [] };
  }

  function extractRecipeRows(res) {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    const data = res.data || res.resep || res.recipes || res.rows || null;
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.resep)) return data.resep;
    if (data && Array.isArray(data.recipes)) return data.recipes;
    if (data && Array.isArray(data.rows)) return data.rows;
    return [];
  }

  function collectItemsFromProductionRecipes(recipes) {
    const map = {};
    function addItem(id, nama, kategori, satuan, stok) {
      id = String(id || '').trim();
      nama = String(nama || '').trim();
      if (!id || !nama) return;
      if (!map[id]) {
        map[id] = { id, nama, kategori: kategori || '', satuan: satuan || '-', stokTersedia: Number(stok || 0) || 0 };
      } else {
        if (!map[id].nama && nama) map[id].nama = nama;
        if (!map[id].kategori && kategori) map[id].kategori = kategori;
        if ((!map[id].satuan || map[id].satuan === '-') && satuan) map[id].satuan = satuan;
        if (!Number(map[id].stokTersedia) && Number(stok)) map[id].stokTersedia = Number(stok) || 0;
      }
    }
    (recipes || []).forEach(r => {
      addItem(
        r.idProduksi || r.idItemHasil || r.idHasil || r.idProdukJadi || r['ID Item Hasil'] || r['ID Hasil'] || r['ID Produk Jadi'] || r['ID Item'] || r.idItem,
        r.produksi || r.namaProduksi || r.namaHasil || r.namaProdukJadi || r['Nama Hasil'] || r['Nama Produk Jadi'] || r['Nama Produk'],
        r.kategoriHasil || r['Kategori Hasil'] || 'Produk Jadi',
        r.satuanProduksi || r.satuanHasil || r.satuan || r['Satuan Hasil'] || '-',
        r.stokTersedia || r.stok || 0
      );
      addItem(
        r.idBahan || r.idItemBahan || r['ID Bahan'] || r['ID Item Bahan'],
        r.bahanBaku || r.namaBahan || r['Nama Bahan'] || r['Bahan'],
        r.kategoriBahan || r['Kategori Bahan'] || 'Bahan Produksi',
        r.satuanBahan || r.satuanStok || r['Satuan Bahan'] || '-',
        r.stokBahan || r.stokTersediaBahan || 0
      );
      (Array.isArray(r.hasil) ? r.hasil : []).forEach(h => {
        addItem(h.idItem || h.idHasil || h.idProduksi || h.id, h.nama || h.namaHasil || h.produksi, h.kategoriHasil || h.kategori || 'Produk Jadi', h.satuanHasil || h.satuanProduksi || h.satuan || '-', h.stokTersedia || h.stok || 0);
      });
      (Array.isArray(r.bahan) ? r.bahan : []).forEach(b => {
        addItem(b.idBahan || b.idItem || b.id, b.bahanBaku || b.namaBahan || b.nama, b.kategoriBahan || b.kategori || 'Bahan Produksi', b.satuanBahan || b.satuanStok || b.satuan || '-', b.stokTersedia || b.stok || 0);
      });
    });
    return Object.values(map);
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
    const idResep = String(row.idResepProduksi || row.idResep || row['ID Resep Produksi'] || row['ID Resep'] || row.id || row.namaResep || row['Nama Resep'] || '').trim();
    const idHasil = String(row.idProduksi || row.idItemHasil || row.idHasil || row.idProdukJadi || row['ID Item Hasil'] || row['ID Hasil'] || row['ID Produk Jadi'] || row['ID Item'] || row.idItem || '').trim();
    const hasilItem = STATE.itemById[idHasil] || {};
    const namaHasil = row.produksi || row.namaProduksi || row.namaHasil || row.namaProdukJadi || row['Nama Hasil'] || row['Nama Produk Jadi'] || row['Nama Produk'] || hasilItem.nama || '';
    const hasil = Array.isArray(row.hasil) && row.hasil.length ? row.hasil : [{
      idItem: idHasil,
      nama: namaHasil,
      qty: row.qtyHasilStandar || row.qtyHasil || row['Qty Hasil Standar'] || row['Qty Hasil'] || ''
    }];

    const bahanRaw = Array.isArray(row.bahan) && row.bahan.length ? row.bahan : [{
      idBahan: row.idBahan || row.idItemBahan || row['ID Bahan'] || row['ID Item Bahan'] || '',
      namaBahan: row.bahanBaku || row.namaBahan || row['Nama Bahan'] || row['Bahan'] || '',
      qtyBahan: row.qtyBahan || row.qtyStandar || row['Qty Bahan'] || row['Qty Bahan Standar'] || ''
    }];
    const bahan = bahanRaw.map(b => {
      const idItem = String(b.idBahan || b.idItem || b.id || b['ID Bahan'] || b['ID Item Bahan'] || '').trim();
      const item = STATE.itemById[idItem] || {};
      return { idItem, nama: b.bahanBaku || b.namaBahan || b.nama || b['Nama Bahan'] || item.nama || '', qty: b.qtyStandar || b.qtyBahan || b.qty || b['Qty Bahan'] || '' };
    }).filter(b => b.idItem || b.nama);

    const firstHasilName = hasil[0] ? (hasil[0].nama || (STATE.itemById[hasil[0].idItem] || {}).nama || '') : '';
    return {
      id: idResep || idHasil || firstHasilName,
      nama: String(row.namaResep || row.nama || row['Nama Resep'] || (firstHasilName ? 'Produksi ' + firstHasilName : 'Resep Produksi')).trim(),
      bahan,
      hasil: hasil.map(h => {
        const idItem = String(h.idItem || h.idHasil || h.idProduksi || h.id || h['ID Item Hasil'] || '').trim();
        const item = STATE.itemById[idItem] || {};
        return { idItem, nama: h.nama || h.namaHasil || h.produksi || h['Nama Hasil'] || item.nama || '', qty: h.qty || h.qtyHasil || h['Qty Hasil'] || '' };
      }).filter(h => h.idItem || h.nama),
      catatan: /migrasi/i.test(String(row.catatan || row['Catatan'] || '')) ? '' : (row.catatan || row['Catatan'] || '')
    };
  }

  function groupNormalizedRecipes(rows) {
    const grouped = {};
    (rows || []).forEach(recipe => {
      const key = recipe.id || recipe.nama;
      if (!key) return;
      if (!grouped[key]) grouped[key] = { id: recipe.id, nama: recipe.nama, bahan: [], hasil: [], catatan: '', _catatan: [] };
      recipe.bahan.forEach(b => addUniqueRecipePart(grouped[key].bahan, b));
      recipe.hasil.forEach(h => addUniqueRecipePart(grouped[key].hasil, h));
      if (recipe.catatan && !/migrasi/i.test(String(recipe.catatan))) grouped[key]._catatan.push(recipe.catatan);
    });
    return Object.values(grouped).map(recipe => {
      recipe.nama = buildGroupedRecipeName(recipe);
      recipe.catatan = recipe._catatan[0] || '';
      delete recipe._catatan;
      return recipe;
    }).filter(r => r.bahan.length || r.hasil.length).sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
  }

  function addUniqueRecipePart(list, part) {
    const id = part && part.idItem ? String(part.idItem).trim() : '';
    if (!id) return;
    const qtyValue = normalizeRecipeQty(part.qty);
    const existing = list.find(x => x.idItem === id);
    if (existing) {
      if (isBlankQty(existing.qty) && !isBlankQty(qtyValue)) existing.qty = qtyValue;
      if (!existing.nama && part.nama) existing.nama = part.nama;
      return;
    }
    list.push({ idItem: id, nama: part.nama || (STATE.itemById[id] || {}).nama || '', qty: qtyValue });
  }

  function normalizeRecipeQty(value) {
    if (value === '' || value === null || typeof value === 'undefined') return '';
    const str = String(value).trim();
    if (!str) return '';
    const n = Number(str.replace(',', '.'));
    return Number.isFinite(n) ? n : '';
  }

  function isBlankQty(value) { return value === '' || value === null || typeof value === 'undefined'; }

  function buildGroupedRecipeName(recipe) {
    const hasilNames = recipe.hasil.map(h => h.nama || (STATE.itemById[h.idItem] || {}).nama).filter(Boolean);
    if (recipe.nama && !/^Produksi\s+Resep/i.test(recipe.nama)) return recipe.nama;
    if (hasilNames.length === 1) return 'Produksi ' + hasilNames[0];
    if (hasilNames.length > 1) return 'Produksi Beberapa Produk';
    return 'Resep Produksi';
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
    select.innerHTML = '<option value="">-- Pilih Resep Produksi --</option>' + STATE.recipes.map(r => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.nama)}</option>`).join('');
  }

  function addSelectedRecipeBatch() {
    const select = document.getElementById('resepSelect');
    const id = select ? select.value : '';
    const recipe = STATE.recipes.find(r => r.id === id);
    if (!recipe) return showToast('Pilih resep produksi terlebih dahulu.', 'error');
    const batch = createBatchFromRecipe(recipe);
    STATE.batches.push(batch);
    if (select) select.value = '';
    renderBatches();
    updateKpi();
    setInfo('Produksi ditambahkan ke daftar. Stok bahan pada daftar berikutnya otomatis mengikuti pemakaian sementara.');
  }

  function createBatchFromRecipe(recipe) {
    return {
      uid: makeUid('BATCH'),
      idResep: recipe.id || '',
      nama: recipe.nama || 'Produksi',
      manual: false,
      collapsed: false,
      bahanRows: recipe.bahan.map(b => makeRow(b.idItem, b.qty, '')),
      hasilRows: recipe.hasil.map(h => makeRow(h.idItem, h.qty, ''))
    };
  }

  function addManualBatch() {
    const batch = {
      uid: makeUid('BATCH'),
      idResep: '',
      nama: 'Produksi Manual',
      manual: true,
      collapsed: false,
      bahanRows: [makeRow('', '', '')],
      hasilRows: [makeRow('', '', '')]
    };
    STATE.batches.push(batch);
    renderBatches();
    updateKpi();
    setInfo('Produksi manual ditambahkan. Pilih bahan dan hasil sesuai kondisi nyata di dapur.');
  }

  function makeRow(idItem, qty, catatan) {
    const cleanQty = qty === '' || qty === null || typeof qty === 'undefined' ? '' : Number(qty || 0);
    return { uid: makeUid('ROW'), idItem: idItem || '', qty: cleanQty, catatan: catatan || '' };
  }

  function makeUid(prefix) { return prefix + '-' + Date.now() + '-' + Math.random().toString(16).slice(2); }

  function renderBatches() {
    const wrap = document.getElementById('batchContainer');
    if (!wrap) return;
    if (!STATE.batches.length) {
      renderBatchMessage('Belum ada produksi dipilih. Pilih resep lalu klik Tambah Produksi, atau gunakan Tambah Manual.');
      updateKpi();
      return;
    }
    wrap.innerHTML = STATE.batches.map((batch, idx) => renderBatchCard(batch, idx)).join('');
    updateVirtualStockDisplays();
  }

  function renderBatchCard(batch, index) {
    const bahanCount = batch.bahanRows.filter(r => r.idItem).length;
    const hasilCount = batch.hasilRows.filter(r => r.idItem).length;
    const collapsed = !!batch.collapsed;
    return `<div class="batch-card" data-batch-uid="${escapeHtml(batch.uid)}">
      <div class="batch-card-head">
        <div class="min-w-0">
          <div class="batch-title-row">
            <span class="batch-number">${index + 1}</span>
            <div class="min-w-0">
              <h3>${escapeHtml(batch.nama || 'Produksi')}</h3>
              <p>${batch.manual ? 'Input manual' : 'Dari resep produksi'} · ${bahanCount} bahan · ${hasilCount} hasil</p>
            </div>
          </div>
        </div>
        <div class="batch-actions">
          <button class="batch-soft-btn" type="button" onclick="toggleBatch('${batch.uid}')">${collapsed ? 'Buka' : 'Tutup'}</button>
          <button class="batch-danger-btn" type="button" onclick="removeBatch('${batch.uid}')">Hapus</button>
        </div>
      </div>
      <div class="batch-card-body ${collapsed ? 'hidden' : ''}">
        <div class="batch-tables-grid">
          <div class="prep-section-card batch-inner-card">
            <div class="prep-section-head compact">
              <div><p class="prep-section-label">Bahan Keluar</p><h3>Bahan yang dipakai</h3></div>
              <button class="btn-slate px-4 py-2 text-sm" onclick="addBatchRow('${batch.uid}','bahan')" type="button">+ Tambah Bahan</button>
            </div>
            <div class="table-shell prep-table-shell"><table class="prep-table produksi-table w-full text-left border-collapse">
              <thead><tr class="thead-row text-xs uppercase tracking-wider"><th class="p-4">Nama Bahan</th><th class="p-4 w-[128px] text-center">Sisa Stok</th><th class="p-4 w-[150px] text-center">Jumlah Keluar</th><th class="p-4 w-[86px] text-center action-col">Aksi</th></tr></thead>
              <tbody>${renderBatchRows(batch, 'bahan')}</tbody>
            </table></div>
          </div>
          <div class="prep-section-card batch-inner-card">
            <div class="prep-section-head compact">
              <div><p class="prep-section-label">Hasil Masuk</p><h3>Produk jadi</h3></div>
              <button class="btn-slate px-4 py-2 text-sm" onclick="addBatchRow('${batch.uid}','hasil')" type="button">+ Tambah Hasil</button>
            </div>
            <div class="table-shell prep-table-shell"><table class="prep-table produksi-table w-full text-left border-collapse">
              <thead><tr class="thead-row text-xs uppercase tracking-wider"><th class="p-4">Nama Hasil</th><th class="p-4 w-[128px] text-center">Stok Setelah</th><th class="p-4 w-[150px] text-center">Jumlah Masuk</th><th class="p-4 w-[86px] text-center action-col">Aksi</th></tr></thead>
              <tbody>${renderBatchRows(batch, 'hasil')}</tbody>
            </table></div>
          </div>
        </div>
      </div>
    </div>`;
  }

  function renderBatchRows(batch, type) {
    const rows = type === 'bahan' ? batch.bahanRows : batch.hasilRows;
    if (!rows.length) {
      return `<tr><td class="p-8 text-center text-slate-500" colspan="4">${type === 'bahan' ? 'Belum ada bahan keluar.' : 'Belum ada hasil masuk.'}</td></tr>`;
    }
    return rows.map(row => {
      const item = STATE.itemById[row.idItem] || {};
      const select = buildItemSelect(type, batch.uid, row.uid, row.idItem);
      const stockValue = row.idItem ? getVirtualStock(row.idItem, type) : null;
      const stockClass = Number(stockValue) < 0 ? 'stock-negative' : '';
      return `<tr class="prep-row">
        <td class="p-4 align-top">${select}</td>
        <td class="p-4 text-center align-middle">
          <strong class="virtual-stock ${stockClass}" data-stock-type="${type}" data-stock-item="${escapeHtml(row.idItem)}">${row.idItem ? formatNumber(stockValue) : '-'}</strong>
          <p class="text-xs text-slate-500">${escapeHtml(item.satuan || '-')}</p>
        </td>
        <td class="p-4 text-center align-middle"><input class="prep-qty-input" type="number" min="0" step="0.01" value="${row.qty === '' || row.qty === null || typeof row.qty === 'undefined' ? '' : escapeHtml(row.qty)}" oninput="updateBatchQty('${batch.uid}','${type}','${row.uid}',this.value)"/></td>
        <td class="p-4 text-center align-middle"><button class="prep-remove-btn" type="button" onclick="removeBatchRow('${batch.uid}','${type}','${row.uid}')">×</button></td>
      </tr>`;
    }).join('');
  }

  function buildItemSelect(type, batchUid, rowUid, selected) {
    const placeholder = type === 'bahan' ? '-- Pilih Bahan --' : '-- Pilih Hasil --';
    const options = STATE.items.map(item => `<option value="${escapeHtml(item.id)}" ${item.id === selected ? 'selected' : ''}>${escapeHtml(item.nama)}</option>`).join('');
    return `<select class="form-control prep-item-select" title="${type === 'bahan' ? 'Pilih nama bahan' : 'Pilih nama hasil'}" onchange="updateBatchItem('${batchUid}','${type}','${rowUid}',this.value)"><option value="">${placeholder}</option>${options}</select>`;
  }

  function renderBatchLoading(message) {
    const wrap = document.getElementById('batchContainer');
    if (!wrap) return;
    wrap.innerHTML = `<div class="batch-empty-card"><div class="table-loading-spinner"></div><p>${escapeHtml(message || 'Memuat data...')}</p><small>Mohon tunggu, data sedang disiapkan.</small></div>`;
  }

  function renderBatchMessage(message, type) {
    const wrap = document.getElementById('batchContainer');
    if (!wrap) return;
    wrap.innerHTML = `<div class="batch-empty-card ${type === 'error' ? 'is-error' : ''}"><p>${escapeHtml(message || '')}</p><small>${type === 'error' ? 'Silakan muat ulang halaman bila masih terjadi.' : 'Daftar produksi akan tampil di sini.'}</small></div>`;
  }

  function getBatch(uid) { return STATE.batches.find(b => b.uid === uid); }
  function getBatchRows(batch, type) { return type === 'bahan' ? batch.bahanRows : batch.hasilRows; }

  function toggleBatch(batchUid) {
    const batch = getBatch(batchUid);
    if (!batch) return;
    batch.collapsed = !batch.collapsed;
    renderBatches();
  }

  function removeBatch(batchUid) {
    STATE.batches = STATE.batches.filter(b => b.uid !== batchUid);
    renderBatches();
    updateKpi();
  }

  function addBatchRow(batchUid, type) {
    const batch = getBatch(batchUid);
    if (!batch) return;
    getBatchRows(batch, type).push(makeRow('', '', ''));
    renderBatches();
    updateKpi();
  }

  function updateBatchItem(batchUid, type, rowUid, value) {
    const batch = getBatch(batchUid);
    if (!batch) return;
    const row = getBatchRows(batch, type).find(r => r.uid === rowUid);
    if (row) row.idItem = value;
    renderBatches();
    updateKpi();
  }

  function updateBatchQty(batchUid, type, rowUid, value) {
    const batch = getBatch(batchUid);
    if (!batch) return;
    const row = getBatchRows(batch, type).find(r => r.uid === rowUid);
    if (row) row.qty = String(value || '').trim() === '' ? '' : (Number(value || 0) || 0);
    updateKpi();
    updateVirtualStockDisplays();
  }

  function removeBatchRow(batchUid, type, rowUid) {
    const batch = getBatch(batchUid);
    if (!batch) return;
    if (type === 'bahan') batch.bahanRows = batch.bahanRows.filter(r => r.uid !== rowUid);
    else batch.hasilRows = batch.hasilRows.filter(r => r.uid !== rowUid);
    renderBatches();
    updateKpi();
  }

  function getItemStock(idItem) { return Number((STATE.itemById[idItem] || {}).stok || 0) || 0; }

  function sumQtyForItem(idItem, type) {
    let total = 0;
    STATE.batches.forEach(batch => {
      const rows = type === 'bahan' ? batch.bahanRows : batch.hasilRows;
      rows.forEach(row => {
        if (row.idItem === idItem) total += Number(row.qty) || 0;
      });
    });
    return roundNumber(total);
  }

  function getVirtualStock(idItem, type) {
    if (!idItem) return '';
    const base = getItemStock(idItem);
    if (type === 'hasil') return roundNumber(base + sumQtyForItem(idItem, 'hasil'));
    return roundNumber(base - sumQtyForItem(idItem, 'bahan'));
  }

  function updateVirtualStockDisplays() {
    document.querySelectorAll('[data-stock-item]').forEach(el => {
      const id = el.getAttribute('data-stock-item') || '';
      const type = el.getAttribute('data-stock-type') || 'bahan';
      if (!id) { el.textContent = '-'; return; }
      const value = getVirtualStock(id, type);
      el.textContent = formatNumber(value);
      el.classList.toggle('stock-negative', Number(value) < 0);
    });
  }

  async function simpanProduksi() {
    if (STATE.loading) return;
    const tanggal = (document.getElementById('tanggalInput') || {}).value || '';
    const keteranganProses = buildKeteranganProses();

    if (!tanggal) return showToast('Tanggal produksi wajib diisi.', 'error');
    if (!STATE.batches.length) return showToast('Tambahkan minimal satu produksi terlebih dahulu.', 'error');

    const bahan = [];
    const hasil = [];
    const batchesPayload = [];

    STATE.batches.forEach((batch, index) => {
      const batchName = batch.nama || ('Produksi ' + (index + 1));
      const batchBahan = batch.bahanRows.filter(r => r.idItem && Number(r.qty) > 0).map(r => ({
        idBahan: r.idItem,
        idItem: r.idItem,
        qtyKeluar: Number(r.qty) || 0,
        qty: Number(r.qty) || 0,
        keterangan: `Bahan produksi | ${batchName}` + (keteranganProses ? ' | ' + keteranganProses : '')
      }));
      const batchHasil = batch.hasilRows.filter(r => r.idItem && Number(r.qty) > 0).map(r => ({
        idProduksi: r.idItem,
        idHasil: r.idItem,
        idItem: r.idItem,
        qtyProduksi: Number(r.qty) || 0,
        qtyMasuk: Number(r.qty) || 0,
        qty: Number(r.qty) || 0,
        keterangan: `Hasil produksi | ${batchName}` + (keteranganProses ? ' | ' + keteranganProses : '')
      }));
      batchBahan.forEach(x => bahan.push(x));
      batchHasil.forEach(x => hasil.push(x));
      batchesPayload.push({
        urutan: index + 1,
        idResep: batch.idResep || '',
        namaResep: batchName,
        bahan: batchBahan,
        hasil: batchHasil
      });
    });

    if (!bahan.length) return showToast('Isi minimal satu bahan yang dipakai.', 'error');
    if (!hasil.length) return showToast('Isi minimal satu produk jadi.', 'error');

    const shortage = getShortageList();
    if (shortage.length) {
      const first = shortage[0];
      return showToast(`Stok ${first.nama} kurang ${formatNumber(first.kurang)} ${first.satuan}. Periksa jumlah bahan sebelum menyimpan.`, 'error');
    }

    setButtonDisabled(true, 'Menyimpan...');
    setKpiStatus('Menyimpan');
    try {
      const res = await callInventory('simpanProduksi', {
        tanggal,
        petugas: getPetugas(),
        mode: 'batch',
        idResep: STATE.batches.map(b => b.idResep).filter(Boolean).join(', '),
        namaBatch: 'Produksi Harian',
        catatan: keteranganProses,
        keterangan: keteranganProses,
        batchProduksi: batchesPayload,
        batches: batchesPayload,
        bahanRows: bahan,
        produksiRows: hasil,
        bahan,
        hasil
      });
      if (!res.success) throw new Error(res.message || 'Produksi belum berhasil disimpan.');
      showToast(res.message || 'Produksi harian berhasil disimpan.', 'success');
      setInfo('Produksi harian berhasil disimpan. Stok bahan berkurang dan produk jadi bertambah.');
      STATE.batches = [];
      resetCatatanFields();
      renderBatches();
      updateKpi();
      setKpiStatus('Siap');
      await loadProduksiData();
    } catch (error) {
      const message = getFriendlyError(error);
      showToast(message, 'error');
      setKpiStatus('Gagal Simpan');
    } finally {
      setButtonDisabled(false);
    }
  }

  function getShortageList() {
    const totals = {};
    STATE.batches.forEach(batch => batch.bahanRows.forEach(row => {
      if (!row.idItem) return;
      totals[row.idItem] = (totals[row.idItem] || 0) + (Number(row.qty) || 0);
    }));
    return Object.keys(totals).map(id => {
      const item = STATE.itemById[id] || {};
      const stok = Number(item.stok || 0) || 0;
      const qty = Number(totals[id] || 0) || 0;
      return { id, nama: item.nama || id, satuan: item.satuan || '', stok, qty, kurang: roundNumber(qty - stok) };
    }).filter(x => x.kurang > 0);
  }

  function updateKpi() {
    setText('kpiResep', STATE.batches.length);
    const totalBahan = totalQty('bahan');
    const totalHasil = totalQty('hasil');
    const catatan = getCatatanData();
    setText('kpiBahan', formatNumber(totalBahan));
    setText('kpiHasil', formatNumber(totalHasil));
    setText('kpiCatatan', catatan.label);
    const validBahan = countValidRows('bahan');
    const validHasil = countValidRows('hasil');
    const shortage = getShortageList();
    const extra = shortage.length ? ` Ada ${shortage.length} bahan yang stoknya kurang.` : '';
    const note = catatan.qty > 0 ? ` Catatan: ${formatNumber(catatan.qty)} tidak layak (${catatan.label}).` : (catatan.kode !== 'NORMAL' ? ` Catatan: ${catatan.label}.` : '');
    setText('ringkasanProduksi', STATE.batches.length ? `${STATE.batches.length} produksi dipilih, ${validBahan} bahan keluar dan ${validHasil} hasil masuk akan disimpan.${extra}${note}` : 'Belum ada produksi yang dipilih.');
    const input = document.getElementById('kondisiLabelInput');
    if (input) input.value = catatan.label;
    const hint = document.getElementById('produksiHint');
    if (hint) hint.textContent = shortage.length ? 'Ada stok bahan yang kurang. Periksa jumlah bahan sebelum menyimpan.' : (catatan.kode === 'NORMAL' ? 'Jika proses normal, kolom catatan bisa dibiarkan kosong.' : 'Kondisi proses akan ikut disimpan sebagai keterangan produksi.');
  }

  function countValidRows(type) {
    let count = 0;
    STATE.batches.forEach(batch => {
      const rows = type === 'bahan' ? batch.bahanRows : batch.hasilRows;
      rows.forEach(row => { if (row.idItem && Number(row.qty) > 0) count += 1; });
    });
    return count;
  }

  function totalQty(type) {
    let total = 0;
    STATE.batches.forEach(batch => {
      const rows = type === 'bahan' ? batch.bahanRows : batch.hasilRows;
      rows.forEach(row => { total += Number(row.qty) || 0; });
    });
    return total;
  }

  function handleKeteranganChange() { updateKpi(); }

  function getCatatanData() {
    const kode = String((document.getElementById('keteranganProsesSelect') || {}).value || 'NORMAL').trim() || 'NORMAL';
    const qty = Number((document.getElementById('qtyTidakLayakInput') || {}).value || 0) || 0;
    const tambahan = String((document.getElementById('keteranganTambahanInput') || {}).value || '').trim();
    return { kode, qty, label: getCatatanLabel(kode), tambahan };
  }

  function getCatatanLabel(kode) {
    const labels = { NORMAL: 'Normal', RUSAK: 'Rusak', GOSONG: 'Gosong', HILANG: 'Hilang', KURANG: 'Hasil kurang', LAINNYA: 'Lainnya' };
    return labels[kode] || kode || 'Normal';
  }

  function buildKeteranganProses() {
    const catatan = getCatatanData();
    const parts = ['Kondisi produksi: ' + catatan.label];
    if (catatan.qty > 0) parts.push('Jumlah tidak layak: ' + formatNumber(catatan.qty));
    if (catatan.tambahan) parts.push('Tambahan: ' + catatan.tambahan);
    return parts.join(' | ');
  }

  function resetCatatanFields() {
    const proses = document.getElementById('keteranganProsesSelect');
    const qty = document.getElementById('qtyTidakLayakInput');
    const tambahan = document.getElementById('keteranganTambahanInput');
    if (proses) proses.value = 'NORMAL';
    if (qty) qty.value = '';
    if (tambahan) tambahan.value = '';
    updateKpi();
  }

  function setButtonDisabled(disabled, label) {
    const btn = document.getElementById('btnSimpan');
    if (!btn) return;
    btn.disabled = !!disabled;
    btn.textContent = label || 'Simpan Produksi Harian';
  }

  function setKpiStatus(value) { setText('kpiStatus', value); }

  function setInfo(message, type) {
    const box = document.getElementById('infoBox');
    if (!box) return;
    box.textContent = message || '';
    box.classList.toggle('error', type === 'error');
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

  function getToken() { return localStorage.getItem(STORAGE_KEYS.token) || localStorage.getItem('APJ_SESSION_TOKEN') || ''; }
  function getPetugas() { return localStorage.getItem(STORAGE_KEYS.name) || localStorage.getItem('APJ_USER_NAME') || localStorage.getItem('APJ_USER_USERNAME') || ''; }

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
    if (/Action tidak dikenal|getBarangProduksi/i.test(msg)) return 'Data resep belum tersedia. Mode manual tetap dapat digunakan.';
    return msg;
  }

  function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  function escapeHtml(value) { return String(value == null ? '' : value).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])); }

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

  const produksiHelpModal = () => document.getElementById('produksiHelpModal');
  function openProduksiHelpModal(autoOpen = false) {
    const modal = produksiHelpModal();
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

  function closeProduksiHelpModal() {
    const modal = produksiHelpModal();
    const overlay = modal ? modal.querySelector('.modal-overlay') : null;
    const content = modal ? modal.querySelector('.modal-content') : null;
    if (!modal || !overlay || !content) return;
    sessionStorage.setItem('APJ_PRODUKSI_HELP_SEEN_V70', 'true');
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

  window.addSelectedRecipeBatch = addSelectedRecipeBatch;
  window.addManualBatch = addManualBatch;
  window.toggleBatch = toggleBatch;
  window.removeBatch = removeBatch;
  window.addBatchRow = addBatchRow;
  window.updateBatchItem = updateBatchItem;
  window.updateBatchQty = updateBatchQty;
  window.removeBatchRow = removeBatchRow;
  window.handleKeteranganChange = handleKeteranganChange;
  window.updateKpi = updateKpi;
  window.simpanProduksi = simpanProduksi;
  window.openProduksiHelpModal = openProduksiHelpModal;
  window.closeProduksiHelpModal = closeProduksiHelpModal;
  window.openMobileSidebar = openMobileSidebar;
  window.closeMobileSidebar = closeMobileSidebar;
  window.showLogoutModal = showLogoutModal;
  window.closeLogoutModal = closeLogoutModal;
  window.executeLogout = executeLogout;
})();
