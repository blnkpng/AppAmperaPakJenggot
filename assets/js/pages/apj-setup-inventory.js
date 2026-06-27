/*
 * APJ SETUP INVENTORY V107
 * CRUD master data: Kategori, Item, Resep Produksi, Resep Preparasi.
 */
(function(){
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
  const UNIT_OPTIONS = ['Kg','Gram','Pcs','Porsi','Pack','Box','Liter','Ml','Botol','Bungkus','Ikat','Lembar','Butir','Ekor','Loyang','Panci','Paket'];
  const YES_NO = [{value:'Y', label:'Ya / Aktif'}, {value:'N', label:'Tidak / Nonaktif'}];

  const STATE = {
    activeTab: 'kategori',
    loading: false,
    search: '',
    filterKategori: '',
    filterAktif: '',
    kategori: [],
    items: [],
    produk: [],
    resep: [],
    resepDetail: [],
    resepPreparasi: [],
    outlets: [],
    pics: [],
    editing: null,
    deletedRecipeDetails: []
  };

  document.addEventListener('DOMContentLoaded', initPage);

  async function initPage(){
    if (localStorage.getItem(STORAGE_KEYS.active) !== 'true' || !getToken()) {
      window.location.href = CONFIG.loginPage || 'index.html';
      return;
    }
    initUserHeader();
    initSidebar();
    initEvents();
    initModalCloseOnEsc();
    await loadSetupData();
    setTimeout(function(){ if (sessionStorage.getItem('APJ_SETUP_HELP_SEEN_V107') !== 'true') openSetupHelpModal(true); }, 450);
  }

  function initUserHeader(){
    const nama = localStorage.getItem(STORAGE_KEYS.name) || localStorage.getItem('APJ_USER_USERNAME') || 'Pengguna';
    const level = localStorage.getItem(STORAGE_KEYS.level) || '-';
    setText('displayNama', nama);
    setText('displayLevel', level);
    setText('displayInisial', makeInitial(nama));
  }

  function initEvents(){
    document.querySelectorAll('.setup-tab').forEach(btn => btn.addEventListener('click', function(){ setActiveTab(btn.dataset.tab || 'kategori'); }));
    const search = document.getElementById('setupSearch');
    if (search) search.addEventListener('input', debounce(function(){ STATE.search = search.value || ''; renderActiveTab(); }, 180));
    const filterKategori = document.getElementById('filterKategori');
    if (filterKategori) filterKategori.addEventListener('change', function(){ STATE.filterKategori = filterKategori.value || ''; renderActiveTab(); });
    const filterAktif = document.getElementById('filterAktif');
    if (filterAktif) filterAktif.addEventListener('change', function(){ STATE.filterAktif = filterAktif.value || ''; renderActiveTab(); });
    const btnRefresh = document.getElementById('btnRefreshSetup');
    if (btnRefresh) btnRefresh.addEventListener('click', loadSetupData);
    const btnOpenAdd = document.getElementById('btnOpenAdd');
    if (btnOpenAdd) btnOpenAdd.addEventListener('click', function(){ openForm(STATE.activeTab); });
    const btnTambahTab = document.getElementById('btnTambahTab');
    if (btnTambahTab) btnTambahTab.addEventListener('click', function(){ openForm(STATE.activeTab); });
  }

  async function loadSetupData(){
    setLoading(true);
    try {
      const result = await callInventory('getSetupInventoryData', { includeAll: true });
      if (!isSuccess(result)) throw new Error(result && result.message || 'Gagal memuat setup inventory.');
      const data = result.data || result || {};
      STATE.kategori = ensureArray(data.kategori);
      STATE.items = ensureArray(data.items || data.item);
      STATE.produk = ensureArray(data.produk);
      STATE.resep = ensureArray(data.resep);
      STATE.resepDetail = ensureArray(data.resepDetail || data.details);
      STATE.resepPreparasi = ensureArray(data.resepPreparasi || data.preparasi || data.prep);
      STATE.outlets = ensureArray(data.outlets);
      STATE.pics = ensureArray(data.pics);
      renderAll();
      showToast('Data setup inventory dimuat.', 'success');
    } catch (err) {
      showToast(err.message || 'Gagal memuat data setup.', 'error');
      renderError(err.message || 'Gagal memuat data.');
    } finally {
      setLoading(false);
    }
  }

  function renderAll(){
    setText('countKategori', countActive(STATE.kategori));
    setText('countItem', countActive(STATE.items));
    setText('countResep', countActive(STATE.resep));
    setText('countPrep', getPreparasiGroups().filter(isActive).length);
    fillKategoriFilter();
    renderActiveTab();
  }

  function fillKategoriFilter(){
    const select = document.getElementById('filterKategori');
    if (!select) return;
    const current = select.value || '';
    const opts = ['<option value="">Semua kategori</option>'].concat(STATE.kategori.filter(isActive).map(k => '<option value="'+escapeAttr(field(k,'Nama Kategori'))+'">'+escapeHtml(field(k,'Nama Kategori'))+'</option>'));
    select.innerHTML = opts.join('');
    select.value = current;
  }

  function setActiveTab(tab){
    STATE.activeTab = tab || 'kategori';
    document.querySelectorAll('.setup-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === STATE.activeTab));
    STATE.search = document.getElementById('setupSearch') ? document.getElementById('setupSearch').value || '' : '';
    renderActiveTab();
  }

  function renderActiveTab(){
    const tab = STATE.activeTab;
    const titleMap = {
      kategori: ['Kategori', 'Master Kategori', '+ Tambah Kategori'],
      item: ['Item', 'Master Item', '+ Tambah Item'],
      resep: ['Resep Produksi', 'Master Resep Produksi', '+ Tambah Resep'],
      preparasi: ['Resep Preparasi', 'Master Resep Preparasi', '+ Tambah Preparasi']
    };
    const meta = titleMap[tab] || titleMap.kategori;
    setText('tableEyebrow', meta[0]);
    setText('tableTitle', meta[1]);
    setText('btnTambahTab', meta[2]);
    const filterRow = document.getElementById('setupFilterRow');
    if (filterRow) filterRow.style.display = tab === 'item' ? 'flex' : 'none';
    if (tab === 'kategori') renderKategoriTable();
    else if (tab === 'item') renderItemTable();
    else if (tab === 'resep') renderResepTable();
    else renderPreparasiTable();
  }

  function renderKategoriTable(){
    setTableHead(['ID','Nama Kategori','Tipe Stok','Prefix','Status','Keterangan','Aksi']);
    const rows = filterSearch(STATE.kategori, ['ID Kategori','Nama Kategori','Tipe Stok','Prefix','Keterangan']);
    if (!rows.length) return setEmptyTable('Belum ada kategori yang cocok.');
    setTableBody(rows.map(r => {
      const id = field(r,'ID Kategori') || '';
      return '<tr>'+
        '<td><span class="pill no">'+escapeHtml(id || '-')+'</span></td>'+
        '<td><div class="cell-title">'+escapeHtml(field(r,'Nama Kategori'))+'</div><div class="cell-sub">Urutan: '+escapeHtml(field(r,'Urutan') || '-')+'</div></td>'+
        '<td>'+escapeHtml(field(r,'Tipe Stok') || '-')+'</td>'+
        '<td>'+escapeHtml(field(r,'Prefix') || '-')+'</td>'+
        '<td>'+statusPill(r)+'</td>'+
        '<td>'+escapeHtml(field(r,'Keterangan') || '-')+'</td>'+
        actionCell('kategori', id)+
      '</tr>';
    }).join(''));
  }

  function renderItemTable(){
    setTableHead(['ID','Nama Item','Kategori','Satuan','Hak Pakai','Status','Aksi']);
    let rows = filterSearch(STATE.items, ['ID Item','Kode Lama','Nama Item','Kategori','Tipe Item','Keterangan']);
    if (STATE.filterKategori) rows = rows.filter(r => norm(field(r,'Kategori')) === norm(STATE.filterKategori));
    if (STATE.filterAktif) rows = rows.filter(r => (isActive(r) ? 'Y' : 'N') === STATE.filterAktif);
    if (!rows.length) return setEmptyTable('Belum ada item yang cocok.');
    setTableBody(rows.map(r => {
      const id = itemId(r);
      return '<tr>'+
        '<td><span class="pill no">'+escapeHtml(id || '-')+'</span><div class="cell-sub">'+escapeHtml(field(r,'Kode Lama') || '')+'</div></td>'+
        '<td><div class="cell-title">'+escapeHtml(field(r,'Nama Item'))+'</div><div class="cell-sub">'+escapeHtml(field(r,'Tipe Item') || 'NORMAL')+'</div></td>'+
        '<td>'+escapeHtml(field(r,'Kategori') || '-')+'</td>'+
        '<td><div class="cell-title">'+escapeHtml(field(r,'Satuan Stok') || '-')+'</div><div class="cell-sub">Beli: '+escapeHtml(field(r,'Satuan Beli') || '-')+' · Produksi: '+escapeHtml(field(r,'Satuan Produksi') || '-')+'</div></td>'+
        '<td>'+flagList(r)+'</td>'+
        '<td>'+statusPill(r)+'</td>'+
        actionCell('item', id)+
      '</tr>';
    }).join(''));
  }

  function renderResepTable(){
    setTableHead(['ID','Hasil Produksi','Qty Hasil','Bahan','Status','Catatan','Aksi']);
    const rows = filterSearch(STATE.resep, ['ID Resep','Kode Lama','ID Item Hasil','Catatan','Versi']);
    if (!rows.length) return setEmptyTable('Belum ada resep produksi yang cocok.');
    setTableBody(rows.map(r => {
      const id = field(r,'ID Resep') || field(r,'Kode Lama') || '';
      const details = getRecipeDetails(id);
      const hasil = findItemName(field(r,'ID Item Hasil'));
      const detailText = details.length ? details.map(d => escapeHtml(findItemName(field(d,'ID Bahan')))+' <b>'+escapeHtml(formatNumber(field(d,'Qty Bahan')))+'</b>').join('<br>') : '<span class="text-slate-500">Belum ada bahan.</span>';
      return '<tr>'+
        '<td><span class="pill no">'+escapeHtml(id || '-')+'</span><div class="cell-sub">'+escapeHtml(field(r,'Kode Lama') || '')+'</div></td>'+
        '<td><div class="cell-title">'+escapeHtml(hasil || field(r,'ID Item Hasil') || '-')+'</div><div class="cell-sub">ID hasil: '+escapeHtml(field(r,'ID Item Hasil') || '-')+' · '+escapeHtml(field(r,'Versi') || 'v1')+'</div></td>'+
        '<td>'+escapeHtml(formatNumber(field(r,'Qty Hasil Standar') || 1))+'</td>'+
        '<td>'+detailText+'</td>'+
        '<td>'+statusPill(r)+'</td>'+
        '<td>'+escapeHtml(field(r,'Catatan') || '-')+'</td>'+
        actionCell('resep', id)+
      '</tr>';
    }).join(''));
  }

  function renderPreparasiTable(){
    setTableHead(['ID','Hasil Preparasi','Bahan Dipakai','Yield','Status','Aksi']);
    let rows = getPreparasiGroups();
    rows = filterSearch(rows, ['ID Resep Preparasi','ID Item Hasil','ID Bahan','Catatan','_search']);
    if (!rows.length) return setEmptyTable('Belum ada resep preparasi yang cocok.');
    setTableBody(rows.map(r => {
      const id = field(r,'ID Resep Preparasi') || '';
      const details = getPreparasiDetails(id);
      const bahanText = details.length ? details.map((d, idx) => '<div class="prep-bahan-line"><b>'+escapeHtml(idx + 1)+'. '+escapeHtml(findItemName(field(d,'ID Bahan')) || field(d,'ID Bahan') || '-')+'</b><span>'+escapeHtml(formatNumber(field(d,'Qty Bahan') || 0))+(field(d,'Catatan') ? ' · '+escapeHtml(field(d,'Catatan')) : '')+'</span></div>').join('') : '<span class="text-slate-500">Belum ada bahan.</span>';
      return '<tr>'+
        '<td><span class="pill no">'+escapeHtml(id || '-')+'</span></td>'+
        '<td><div class="cell-title">'+escapeHtml(findItemName(field(r,'ID Item Hasil')) || field(r,'ID Item Hasil') || '-')+'</div><div class="cell-sub">Qty hasil: '+escapeHtml(formatNumber(field(r,'Qty Hasil') || 1))+'</div></td>'+
        '<td>'+bahanText+'</td>'+
        '<td><span class="pill warn">'+escapeHtml(formatNumber(field(r,'Yield %') || 100))+'%</span></td>'+
        '<td>'+statusPill(r)+'</td>'+
        actionCell('preparasi', id)+
      '</tr>';
    }).join(''));
  }

  function actionCell(type, id){
    const safe = escapeAttr(id || '');
    return '<td><div class="setup-actions">'+
      '<button class="action-btn" type="button" onclick="APJSetupInventory.edit(\''+type+'\',\''+safe+'\')">Edit</button>'+
      '<button class="action-btn danger" type="button" onclick="APJSetupInventory.remove(\''+type+'\',\''+safe+'\')">Hapus</button>'+
      '</div></td>';
  }

  function openForm(type, id){
    STATE.editing = { type: type || STATE.activeTab, id: id || '' };
    STATE.deletedRecipeDetails = [];
    const modal = document.getElementById('setupFormModal');
    const form = document.getElementById('setupForm');
    if (!modal || !form) return;
    if (STATE.editing.type === 'kategori') renderKategoriForm(form, findKategori(id));
    else if (STATE.editing.type === 'item') renderItemForm(form, findItem(id));
    else if (STATE.editing.type === 'resep') renderResepForm(form, findResep(id));
    else renderPreparasiForm(form, findPreparasi(id));
    openModal('setupFormModal');
  }

  function renderKategoriForm(form, data){
    data = data || {};
    setModalText(field(data,'ID Kategori') ? 'Edit Kategori' : 'Tambah Kategori', 'Kategori', 'Kelompok stok yang dipakai di semua modul.');
    form.innerHTML = '<div class="form-grid">'+
      hiddenInput('idKategori', field(data,'ID Kategori'))+
      fieldHtml('Nama Kategori','namaKategori', field(data,'Nama Kategori'), 'text', 'Contoh: Bahan Utama', true)+
      selectHtml('Tipe Stok','tipeStok', field(data,'Tipe Stok') || 'STOK_GUDANG', ['STOK_GUDANG','PRODUKSI','OUTLET','OPERASIONAL'])+
      fieldHtml('Prefix','prefix', field(data,'Prefix'), 'text', 'Contoh: BUM')+
      fieldHtml('Urutan','urutan', field(data,'Urutan'), 'number', '1')+
      selectObjectHtml('Aktif','aktif', field(data,'Aktif') || 'Y', YES_NO)+
      textareaHtml('Keterangan','keterangan', field(data,'Keterangan'), 'Catatan kategori', 'field-span-2')+
    '</div>'+formFooter('saveKategoriForm');
    form.onsubmit = saveKategoriForm;
  }

  function renderItemForm(form, data){
    data = data || {};
    const isEdit = !!field(data,'ID Item');
    setModalText(isEdit ? 'Edit Item' : 'Tambah Item', 'Item', 'Semua bahan, produk, kemasan, dan barang dagang yang dihitung stoknya.');
    const kategoriOptions = STATE.kategori.filter(isActive).map(k => ({value: field(k,'Nama Kategori'), label: field(k,'Nama Kategori')}));
    const initialKategori = field(data,'Kategori') || (kategoriOptions[0] ? kategoriOptions[0].value : '');
    const urutanValue = field(data,'Urutan') || (!isEdit ? getNextItemUrutan(initialKategori) : '');
    form.innerHTML = '<div class="form-grid three">'+
      hiddenInput('idItem', field(data,'ID Item'))+
      selectObjectHtml('Kategori','kategori', initialKategori, kategoriOptions, true)+
      fieldHtml('Nama Item','namaItem', field(data,'Nama Item'), 'text', 'Contoh: Ayam Goreng', true)+
      fieldHtml('Kode Lama','kodeLama', field(data,'Kode Lama'), 'text', 'Opsional')+
      selectHtml('Satuan Beli','satuanBeli', field(data,'Satuan Beli'), UNIT_OPTIONS)+
      selectHtml('Satuan Stok','satuanStok', field(data,'Satuan Stok'), UNIT_OPTIONS, true)+
      selectHtml('Satuan Produksi','satuanProduksi', field(data,'Satuan Produksi') || field(data,'Satuan Stok'), UNIT_OPTIONS)+
      selectHtml('Tipe Item','tipeItem', field(data,'Tipe Item') || 'NORMAL', ['NORMAL','BAHAN','SETENGAH_JADI','PRODUK_JADI','BARANG_DAGANG','KEMASAN','OPERASIONAL'])+
      fieldHtml('Parent/Konversi Dari','parent', field(data,'Parent/Konversi Dari'), 'text', 'Opsional')+
      fieldHtml('Stok Minimum','stokMinimum', field(data,'Stok Minimum') || 0, 'number', '0')+
      selectObjectHtml('Tampil Input','tampilInput', field(data,'Tampil Input') || 'Y', YES_NO)+
      selectObjectHtml('Bisa Output','bisaOutput', field(data,'Bisa Output') || 'Y', YES_NO)+
      selectObjectHtml('Bisa Preparasi','bisaPreparasi', field(data,'Bisa Preparasi') || 'Y', YES_NO)+
      selectObjectHtml('Bisa Produksi','bisaProduksi', field(data,'Bisa Produksi') || 'Y', YES_NO)+
      selectObjectHtml('Bisa Transfer Produk','bisaTransferProduk', field(data,'Bisa Transfer Produk') || 'N', YES_NO)+
      selectObjectHtml('Aktif','aktif', field(data,'Aktif') || 'Y', YES_NO)+
      fieldHtml('Urutan','urutan', urutanValue, 'number', 'Otomatis', false, 'js-auto-urutan-wrap')+
      textareaHtml('Keterangan','keterangan', field(data,'Keterangan'), 'Catatan item', 'field-span-3')+
    '</div>'+formFooter('saveItemForm');
    form.onsubmit = saveItemForm;
    bindItemUrutanAuto(form, isEdit);
  }

  function renderResepForm(form, data){
    data = data || {};
    const idResep = field(data,'ID Resep') || field(data,'Kode Lama') || '';
    setModalText(idResep ? 'Edit Resep Produksi' : 'Tambah Resep Produksi', 'Resep Produksi', 'Standar bahan untuk membuat produk jadi. Detail bahan bisa lebih dari satu.');
    const itemOptions = STATE.items.filter(isActive).map(i => ({value: itemId(i), label: field(i,'Nama Item')+' — '+itemId(i)}));
    const details = idResep ? getRecipeDetails(idResep) : [];
    form.innerHTML = '<div class="form-grid three">'+
      hiddenInput('idResep', field(data,'ID Resep'))+
      selectObjectHtml('Item Hasil','idItemHasil', field(data,'ID Item Hasil'), itemOptions, true)+
      fieldHtml('Qty Hasil Standar','qtyHasilStandar', field(data,'Qty Hasil Standar') || 1, 'number', '1', true)+
      fieldHtml('Versi','versi', field(data,'Versi') || 'v1', 'text', 'v1')+
      fieldHtml('Kode Lama','kodeLama', field(data,'Kode Lama'), 'text', 'Opsional')+
      selectObjectHtml('Aktif','aktif', field(data,'Aktif') || 'Y', YES_NO)+
      textareaHtml('Catatan','catatan', field(data,'Catatan'), 'Catatan resep', 'field-span-3')+
    '</div><div class="detail-box field-span-3"><div class="detail-head"><div><strong>Detail Bahan Resep</strong><p class="form-help">Tambahkan semua bahan yang dipakai. Nomor baris otomatis mengikuti urutan input.</p></div><button class="btn-ghost px-4 py-2 text-sm" type="button" onclick="APJSetupInventory.addRecipeDetailRow()">+ Tambah Bahan</button></div><div id="recipeDetailRows"></div></div>'+formFooter('saveResepForm');
    form.onsubmit = saveResepForm;
    const holder = document.getElementById('recipeDetailRows');
    if (holder) {
      holder.innerHTML = '';
      (details.length ? details : [{}]).forEach(d => addRecipeDetailRow(d));
    }
  }

  function renderPreparasiForm(form, data){
    data = data || {};
    const idPrep = field(data,'ID Resep Preparasi') || '';
    setModalText(idPrep ? 'Edit Resep Preparasi' : 'Tambah Resep Preparasi', 'Resep Preparasi', 'Standar bahan mentah menjadi bahan siap olah. Satu hasil preparasi bisa memakai lebih dari satu bahan.');
    const itemOptions = STATE.items.filter(isActive).map(i => ({value: itemId(i), label: field(i,'Nama Item')+' — '+itemId(i)}));
    const details = idPrep ? getPreparasiDetails(idPrep) : [];
    form.innerHTML = '<div class="form-grid three">'+
      hiddenInput('idResepPreparasi', idPrep)+
      selectObjectHtml('Item Hasil Preparasi','idItemHasil', field(data,'ID Item Hasil'), itemOptions, true)+
      fieldHtml('Qty Hasil','qtyHasil', field(data,'Qty Hasil') || 1, 'number', '1', true)+
      fieldHtml('Yield %','yield', field(data,'Yield %') || 100, 'number', '100')+
      selectObjectHtml('Aktif','aktif', field(data,'Aktif') || 'Y', YES_NO)+
      textareaHtml('Catatan','catatan', field(data,'Catatan'), 'Catatan preparasi', 'field-span-3')+
    '</div><div class="detail-box field-span-3"><div class="detail-head"><div><strong>Bahan Dipakai</strong><p class="form-help">Tambahkan semua bahan untuk 1 hasil preparasi. Contoh: kentang + bawang + bumbu.</p></div><button class="btn-ghost px-4 py-2 text-sm" type="button" onclick="APJSetupInventory.addPrepBahanRow()">+ Tambah Bahan</button></div><div id="prepBahanRows"></div></div>'+formFooter('savePreparasiForm');
    form.onsubmit = savePreparasiForm;
    const holder = document.getElementById('prepBahanRows');
    if (holder) {
      holder.innerHTML = '';
      (details.length ? details : [{}]).forEach(d => addPrepBahanRow(d));
    }
  }

  function addRecipeDetailRow(data){
    data = data || {};
    const holder = document.getElementById('recipeDetailRows');
    if (!holder) return;
    const itemOptions = STATE.items.filter(isActive).map(i => ({value: itemId(i), label: field(i,'Nama Item')+' — '+itemId(i)}));
    const div = document.createElement('div');
    div.className = 'recipe-row';
    div.dataset.idDetail = field(data,'ID Detail') || '';
    div.innerHTML = '<div class="row-no-badge" data-row-no>1</div>'+
      selectObjectHtml('', 'idBahanDetail', field(data,'ID Bahan'), itemOptions, true, 'Pilih bahan')+
      fieldHtml('', 'qtyBahanDetail', field(data,'Qty Bahan') || 0, 'number', 'Qty bahan', true)+
      fieldHtml('', 'catatanDetail', field(data,'Catatan') || '', 'text', 'Catatan')+
      '<button class="btn-danger px-3 py-2" type="button" onclick="APJSetupInventory.removeRecipeDetailRow(this)">Hapus</button>';
    holder.appendChild(div);
    updateRecipeDetailNumbers();
  }

  function removeRecipeDetailRow(btn){
    const row = btn && btn.closest('.recipe-row');
    if (!row) return;
    const id = row.dataset.idDetail || '';
    if (id) STATE.deletedRecipeDetails.push(id);
    row.remove();
    updateRecipeDetailNumbers();
  }

  function addPrepBahanRow(data){
    data = data || {};
    const holder = document.getElementById('prepBahanRows');
    if (!holder) return;
    const itemOptions = STATE.items.filter(isActive).map(i => ({value: itemId(i), label: field(i,'Nama Item')+' — '+itemId(i)}));
    const div = document.createElement('div');
    div.className = 'recipe-row prep-row';
    div.innerHTML = '<div class="row-no-badge" data-row-no>1</div>'+
      selectObjectHtml('', 'idBahanPrep', field(data,'ID Bahan'), itemOptions, true, 'Pilih bahan')+
      fieldHtml('', 'qtyBahanPrep', field(data,'Qty Bahan') || 0, 'number', 'Qty bahan', true)+
      fieldHtml('', 'catatanBahanPrep', field(data,'Catatan Bahan') || field(data,'Catatan') || '', 'text', 'Catatan bahan')+
      '<button class="btn-danger px-3 py-2" type="button" onclick="APJSetupInventory.removePrepBahanRow(this)">Hapus</button>';
    holder.appendChild(div);
    updatePrepBahanNumbers();
  }

  function removePrepBahanRow(btn){
    const row = btn && btn.closest('.recipe-row');
    if (!row) return;
    row.remove();
    updatePrepBahanNumbers();
  }

  async function saveKategoriForm(e){
    e.preventDefault();
    const f = e.currentTarget;
    await submitMaster('saveKategoriInventory', {
      idKategori: val(f,'idKategori'),
      namaKategori: val(f,'namaKategori'), tipeStok: val(f,'tipeStok'), prefix: val(f,'prefix'), urutan: val(f,'urutan'), aktif: val(f,'aktif'), keterangan: val(f,'keterangan')
    });
  }

  async function saveItemForm(e){
    e.preventDefault();
    const f = e.currentTarget;
    await submitMaster('saveItemInventory', {
      idItem: val(f,'idItem'), kategori: val(f,'kategori'), namaItem: val(f,'namaItem'), kodeLama: val(f,'kodeLama'), satuanBeli: val(f,'satuanBeli'), satuanStok: val(f,'satuanStok'), satuanProduksi: val(f,'satuanProduksi'), tipeItem: val(f,'tipeItem'), parent: val(f,'parent'), stokMinimum: val(f,'stokMinimum'), tampilInput: val(f,'tampilInput'), bisaOutput: val(f,'bisaOutput'), bisaPreparasi: val(f,'bisaPreparasi'), bisaProduksi: val(f,'bisaProduksi'), bisaTransferProduk: val(f,'bisaTransferProduk'), aktif: val(f,'aktif'), urutan: val(f,'urutan'), keterangan: val(f,'keterangan')
    });
  }

  async function saveResepForm(e){
    e.preventDefault();
    const f = e.currentTarget;
    const payload = { idResep: val(f,'idResep'), idItemHasil: val(f,'idItemHasil'), qtyHasilStandar: val(f,'qtyHasilStandar'), versi: val(f,'versi'), kodeLama: val(f,'kodeLama'), aktif: val(f,'aktif'), catatan: val(f,'catatan') };
    if (!payload.idItemHasil) return showToast('Item hasil wajib dipilih.', 'warning');
    if (Number(payload.qtyHasilStandar || 0) <= 0) return showToast('Qty hasil wajib lebih dari 0.', 'warning');
    setFormBusy(true);
    try {
      const res = await callInventory('saveResepInventory', { data: payload });
      if (!isSuccess(res)) throw new Error(res.message || 'Gagal menyimpan resep.');
      const idResep = payload.idResep || (res.data && res.data.id) || res.id || payload.kodeLama;
      const rows = Array.from(document.querySelectorAll('#recipeDetailRows .recipe-row'));
      for (const row of rows) {
        const detail = {
          idDetail: row.dataset.idDetail || '',
          idResep: idResep,
          idBahan: row.querySelector('[name="idBahanDetail"]')?.value || '',
          qtyBahan: row.querySelector('[name="qtyBahanDetail"]')?.value || 0,
          jenisBahan: 'Bahan',
          catatan: row.querySelector('[name="catatanDetail"]')?.value || ''
        };
        if (!detail.idBahan || Number(detail.qtyBahan || 0) <= 0) continue;
        const detailRes = await callInventory('saveResepDetailInventory', { data: detail });
        if (!isSuccess(detailRes)) throw new Error(detailRes.message || 'Gagal menyimpan detail resep.');
      }
      for (const idDetail of STATE.deletedRecipeDetails) {
        await callInventory('deleteResepDetailInventory', { idDetail: idDetail, id: idDetail });
      }
      showToast(res.message || 'Resep produksi tersimpan.', 'success');
      closeSetupFormModal();
      await loadSetupData();
    } catch (err) {
      showToast(err.message || 'Gagal menyimpan resep.', 'error');
    } finally {
      setFormBusy(false);
    }
  }

  async function savePreparasiForm(e){
    e.preventDefault();
    const f = e.currentTarget;
    const bahanList = Array.from(document.querySelectorAll('#prepBahanRows .recipe-row')).map(row => ({
      idBahan: row.querySelector('[name="idBahanPrep"]')?.value || '',
      qtyBahan: row.querySelector('[name="qtyBahanPrep"]')?.value || 0,
      catatan: row.querySelector('[name="catatanBahanPrep"]')?.value || ''
    })).filter(row => row.idBahan && Number(row.qtyBahan || 0) > 0);
    if (!val(f,'idItemHasil')) return showToast('Item hasil preparasi wajib dipilih.', 'warning');
    if (Number(val(f,'qtyHasil') || 0) <= 0) return showToast('Qty hasil wajib lebih dari 0.', 'warning');
    if (!bahanList.length) return showToast('Minimal isi 1 bahan preparasi dengan qty lebih dari 0.', 'warning');
    await submitMaster('saveResepPreparasiInventory', {
      idResepPreparasi: val(f,'idResepPreparasi'), idItemHasil: val(f,'idItemHasil'), qtyHasil: val(f,'qtyHasil'), bahanList: bahanList, details: bahanList, yield: val(f,'yield'), aktif: val(f,'aktif'), catatan: val(f,'catatan')
    });
  }

  async function submitMaster(action, data){
    setFormBusy(true);
    try {
      const res = await callInventory(action, { data: data });
      if (!isSuccess(res)) throw new Error(res.message || 'Gagal menyimpan data.');
      showToast(res.message || 'Data berhasil disimpan.', 'success');
      closeSetupFormModal();
      await loadSetupData();
    } catch (err) {
      showToast(err.message || 'Gagal menyimpan data.', 'error');
    } finally {
      setFormBusy(false);
    }
  }

  async function removeMaster(type, id){
    if (!id) return showToast('ID data tidak ditemukan.', 'warning');
    const label = type === 'kategori' ? 'kategori' : type === 'item' ? 'item' : type === 'resep' ? 'resep produksi' : 'resep preparasi';
    if (!confirm('Nonaktifkan '+label+' ini? Histori transaksi tetap aman.')) return;
    const action = type === 'kategori' ? 'deleteKategoriInventory' : type === 'item' ? 'deleteItemInventory' : type === 'resep' ? 'deleteResepInventory' : 'deleteResepPreparasiInventory';
    try {
      const payload = { id: id };
      if (type === 'kategori') payload.idKategori = id;
      if (type === 'item') payload.idItem = id;
      if (type === 'resep') payload.idResep = id;
      if (type === 'preparasi') payload.idResepPreparasi = id;
      const res = await callInventory(action, payload);
      if (!isSuccess(res)) throw new Error(res.message || 'Gagal menonaktifkan data.');
      showToast(res.message || 'Data dinonaktifkan.', 'success');
      await loadSetupData();
    } catch (err) {
      showToast(err.message || 'Gagal menonaktifkan data.', 'error');
    }
  }

  function labelHtml(label){ return label ? escapeHtml(label) : '&nbsp;'; }
  function fieldHtml(label, name, value, type, placeholder, required, extraClass){
    return '<label class="'+escapeAttr(extraClass || '')+'"><span class="form-label">'+labelHtml(label)+'</span><input class="form-control" name="'+escapeAttr(name)+'" type="'+escapeAttr(type || 'text')+'" value="'+escapeAttr(value || '')+'" placeholder="'+escapeAttr(placeholder || '')+'" '+(required?'required':'')+'></label>';
  }
  function textareaHtml(label, name, value, placeholder, extraClass){
    return '<label class="'+escapeAttr(extraClass || '')+'"><span class="form-label">'+escapeHtml(label)+'</span><textarea class="form-control" name="'+escapeAttr(name)+'" placeholder="'+escapeAttr(placeholder || '')+'">'+escapeHtml(value || '')+'</textarea></label>';
  }
  function hiddenInput(name, value){ return '<input type="hidden" name="'+escapeAttr(name)+'" value="'+escapeAttr(value || '')+'">'; }
  function selectHtml(label, name, value, options, required, placeholder){
    const opts = (placeholder !== undefined ? ['<option value="">'+escapeHtml(placeholder || 'Pilih')+'</option>'] : ['<option value="">Pilih</option>']).concat((options || []).map(o => '<option value="'+escapeAttr(o)+'" '+(norm(o)===norm(value)?'selected':'')+'>'+escapeHtml(o)+'</option>'));
    return '<label><span class="form-label">'+labelHtml(label)+'</span><select class="form-control" name="'+escapeAttr(name)+'" '+(required?'required':'')+'>'+opts.join('')+'</select></label>';
  }
  function selectObjectHtml(label, name, value, options, required, placeholder){
    const opts = ['<option value="">'+escapeHtml(placeholder || 'Pilih')+'</option>'].concat((options || []).map(o => '<option value="'+escapeAttr(o.value)+'" '+(norm(o.value)===norm(value)?'selected':'')+'>'+escapeHtml(o.label || o.value)+'</option>'));
    return '<label><span class="form-label">'+labelHtml(label)+'</span><select class="form-control" name="'+escapeAttr(name)+'" '+(required?'required':'')+'>'+opts.join('')+'</select></label>';
  }
  function formFooter(){
    return '<div class="form-footer"><p class="form-help">Hapus berarti nonaktif, bukan hapus permanen. Ini sengaja agar jurnal lama tidak rusak.</p><div class="flex gap-2"><button class="btn-ghost px-5 py-3" type="button" onclick="closeSetupFormModal()">Batal</button><button id="btnSubmitSetup" class="btn-primary px-5 py-3" type="submit">Simpan</button></div></div>';
  }

  function setModalText(title, eyebrow, desc){ setText('modalTitle', title); setText('modalEyebrow', eyebrow); setText('modalDesc', desc); }
  function setFormBusy(busy){ const btn = document.getElementById('btnSubmitSetup'); if (btn) { btn.disabled = busy; btn.textContent = busy ? 'Menyimpan...' : 'Simpan'; } }
  function setLoading(loading){
    STATE.loading = loading;
    const btn = document.getElementById('btnRefreshSetup');
    if (btn) { btn.disabled = loading; btn.innerHTML = loading ? '<span class="loading-inline">Memuat</span>' : 'Refresh Data'; }
  }
  function setTableHead(cols){ const el = document.getElementById('setupTableHead'); if (el) el.innerHTML = '<tr>'+cols.map(c => '<th>'+escapeHtml(c)+'</th>').join('')+'</tr>'; }
  function setTableBody(html){ const el = document.getElementById('setupTableBody'); if (el) el.innerHTML = html; }
  function setEmptyTable(text){ setTableBody('<tr><td class="empty-state" colspan="8">'+escapeHtml(text)+'</td></tr>'); }
  function renderError(text){ setTableHead(['Status']); setTableBody('<tr><td class="empty-state">'+escapeHtml(text)+'</td></tr>'); }

  function getNextItemUrutan(kategori){
    const key = norm(kategori);
    const nums = STATE.items.filter(r => !key || norm(field(r,'Kategori')) === key).map(r => Number(field(r,'Urutan') || 0)).filter(n => Number.isFinite(n));
    const max = nums.length ? Math.max.apply(null, nums) : 0;
    return String(max + 1);
  }
  function bindItemUrutanAuto(form, isEdit){
    if (!form || isEdit) return;
    const kategori = form.querySelector('[name="kategori"]');
    const urutan = form.querySelector('[name="urutan"]');
    if (!kategori || !urutan) return;
    const setAuto = function(force){ if (force || !urutan.value || Number(urutan.value) <= 0) urutan.value = getNextItemUrutan(kategori.value); };
    kategori.addEventListener('change', function(){ setAuto(true); });
    setAuto(false);
  }
  function updateRecipeDetailNumbers(){ document.querySelectorAll('#recipeDetailRows .recipe-row [data-row-no]').forEach((el, idx) => { el.textContent = String(idx + 1); }); }
  function updatePrepBahanNumbers(){ document.querySelectorAll('#prepBahanRows .recipe-row [data-row-no]').forEach((el, idx) => { el.textContent = String(idx + 1); }); }
  function getPreparasiGroups(){
    const groups = {};
    STATE.resepPreparasi.forEach(r => {
      const id = norm(field(r,'ID Resep Preparasi')) || (norm(field(r,'ID Item Hasil')) + '-' + norm(field(r,'ID Bahan')));
      if (!id) return;
      if (!groups[id]) groups[id] = Object.assign({}, r, { 'ID Resep Preparasi': id, _rows: [], _search: '' });
      groups[id]._rows.push(r);
      groups[id]._search += ' ' + [field(r,'ID Resep Preparasi'), field(r,'ID Item Hasil'), field(r,'ID Bahan'), field(r,'Catatan')].join(' ');
      if (isActive(r)) groups[id]['Aktif'] = field(r,'Aktif') || 'Y';
    });
    return Object.values(groups).map(g => {
      const activeRows = g._rows.filter(isActive);
      const base = activeRows[0] || g._rows[0] || g;
      return Object.assign({}, base, { _rows: g._rows, _search: g._search });
    });
  }
  function getPreparasiDetails(idPrep){
    const key = norm(idPrep);
    return STATE.resepPreparasi.filter(r => norm(field(r,'ID Resep Preparasi')) === key && isActive(r) && field(r,'ID Bahan'));
  }
  function getRecipeDetails(idResep){ const key = norm(idResep); return STATE.resepDetail.filter(d => norm(field(d,'ID Resep')) === key && (field(d,'ID Bahan') || field(d,'ID Detail'))); }
  function findKategori(id){ return STATE.kategori.find(r => norm(field(r,'ID Kategori')) === norm(id)); }
  function findItem(id){ const key = norm(id); return STATE.items.find(r => norm(itemId(r)) === key || norm(field(r,'Kode Lama')) === key); }
  function findResep(id){ const key = norm(id); return STATE.resep.find(r => norm(field(r,'ID Resep')) === key || norm(field(r,'Kode Lama')) === key); }
  function findPreparasi(id){ return getPreparasiGroups().find(r => norm(field(r,'ID Resep Preparasi')) === norm(id)); }
  function findItemName(id){ const item = findItem(id); return item ? field(item,'Nama Item') : ''; }
  function itemId(r){ return field(r,'ID Item') || field(r,'Kode Lama') || ''; }
  function flagList(r){
    const flags = [ ['Input',field(r,'Tampil Input')], ['Output',field(r,'Bisa Output')], ['Prep',field(r,'Bisa Preparasi')], ['Prod',field(r,'Bisa Produksi')], ['Transfer',field(r,'Bisa Transfer Produk')] ];
    return '<div class="flag-list">'+flags.map(f => '<span class="pill '+(isYes(f[1])?'ok':'no')+'">'+escapeHtml(f[0])+'</span>').join('')+'</div>';
  }
  function statusPill(r){ return isActive(r) ? '<span class="pill ok">Aktif</span>' : '<span class="pill no">Nonaktif</span>'; }
  function filterSearch(rows, fields){
    const q = norm(STATE.search).toLowerCase();
    if (!q) return rows.slice();
    return rows.filter(r => fields.some(f => String(field(r,f) || '').toLowerCase().includes(q)));
  }
  function countActive(rows){ return ensureArray(rows).filter(isActive).length; }
  function isActive(r){ const v = field(r,'Aktif'); return v === '' || isYes(v); }
  function isYes(v){ const x = norm(v).toUpperCase(); return !x || ['Y','YA','TRUE','AKTIF','ACTIVE','1'].includes(x); }
  function field(obj, name){ if (!obj) return ''; if (obj[name] != null) return obj[name]; const key = Object.keys(obj).find(k => norm(k).toLowerCase() === norm(name).toLowerCase()); return key ? obj[key] : ''; }
  function val(form, name){ const el = form && form.querySelector('[name="'+cssEscape(name)+'"]'); return el ? el.value : ''; }

  async function callInventory(action, payload){
    const body = Object.assign({}, payload || {}, {
      action: action,
      sessionToken: getToken(), token: getToken(), appName: 'APJ_INVENTORY', sourceApp: 'APJ_INVENTORY', requesterApp: 'APJ_INVENTORY',
      username: localStorage.getItem('APJ_USER_USERNAME') || '', requesterUsername: localStorage.getItem('APJ_USER_USERNAME') || '', requesterName: getPetugas(), nama: getPetugas(),
      level: localStorage.getItem(STORAGE_KEYS.level) || '', role: localStorage.getItem(STORAGE_KEYS.level) || '', userOutlet: localStorage.getItem(STORAGE_KEYS.outlet) || '', _clientTs: Date.now()
    });
    return requestInventoryJson(body, { retries: 3, timeoutMs: 45000 });
  }
  async function requestInventoryJson(body, options){
    const retries = Number(options && options.retries || 3);
    const timeoutMs = Number(options && options.timeoutMs || 45000);
    let lastError = null;
    for (let attempt=1; attempt<=retries; attempt++) {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
      try {
        const response = await fetch(API_URL, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, redirect:'follow', cache:'no-store', body: JSON.stringify(body), signal: controller ? controller.signal : undefined });
        if (timer) clearTimeout(timer);
        const text = await response.text();
        const json = parseInventoryJsonResponse(text);
        if (!response.ok && (!json || json.success !== false)) throw new Error('Server Inventory sedang tidak siap.');
        return json;
      } catch(err) {
        if (timer) clearTimeout(timer);
        lastError = err;
        if (attempt >= retries) break;
        await new Promise(resolve => setTimeout(resolve, 550 * attempt));
      }
    }
    throw new Error(lastError && lastError.message || 'Gagal menghubungi server Inventory.');
  }
  function parseInventoryJsonResponse(text){
    const raw = String(text || '').trim();
    if (!raw) throw new Error('Server belum mengirim data.');
    try { return JSON.parse(raw); }
    catch(e) {
      const start = raw.indexOf('{'); const end = raw.lastIndexOf('}');
      if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
      throw new Error('Respons server bukan JSON.');
    }
  }
  function isSuccess(res){ return res && (res.success === true || res.ok === true || res.status === 'success' || res.data !== undefined); }
  function getToken(){ return localStorage.getItem(STORAGE_KEYS.token) || localStorage.getItem('APJ_SESSION_TOKEN') || ''; }
  function getPetugas(){ return localStorage.getItem(STORAGE_KEYS.name) || localStorage.getItem('APJ_USER_NAME') || localStorage.getItem('APJ_USER_USERNAME') || ''; }

  function makeInitial(name){ const parts = String(name || '').trim().split(/\s+/).filter(Boolean); return parts.length > 1 ? (parts[0][0] + parts[parts.length-1][0]).toUpperCase() : (parts[0] || 'U').slice(0,1).toUpperCase(); }
  function setText(id, value){ const el = document.getElementById(id); if (el) el.textContent = value == null ? '' : String(value); }
  function ensureArray(x){ return Array.isArray(x) ? x : []; }
  function norm(v){ return String(v == null ? '' : v).trim(); }
  function debounce(fn, ms){ let t; return function(){ clearTimeout(t); const args = arguments; t = setTimeout(() => fn.apply(null,args), ms || 150); }; }
  function formatNumber(v){ const n = typeof v === 'number' ? v : parseFloat(String(v || '0').replace(',','.')); return Number.isFinite(n) ? n.toLocaleString('id-ID', { maximumFractionDigits: 3 }) : '0'; }
  function escapeHtml(value){ return String(value == null ? '' : value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[ch])); }
  function escapeAttr(value){ return escapeHtml(value).replace(/`/g,'&#096;'); }
  function cssEscape(value){ return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(value) : String(value).replace(/"/g,'\\"'); }

  function showToast(message, type){
    type = type || 'success';
    const toast = document.getElementById('customToast');
    const msg = document.getElementById('toastMessage');
    if (!toast || !msg) return alert(message);
    msg.textContent = message;
    const tone = type === 'success' ? 'bg-emerald-950/95 border-emerald-700/80 text-emerald-200' : type === 'warning' ? 'bg-amber-950/95 border-amber-700/80 text-amber-100' : 'bg-rose-950/95 border-rose-700/80 text-rose-200';
    toast.className = 'toast show flex items-center w-full max-w-md p-4 rounded-xl shadow-2xl border backdrop-blur-xl ' + tone;
    clearTimeout(window.__apjToastTimer);
    window.__apjToastTimer = setTimeout(() => toast.classList.remove('show'), 3800);
  }
  function openModal(id){ const modal = document.getElementById(id); const overlay = modal ? modal.querySelector('.modal-overlay') : null; const content = modal ? modal.querySelector('.modal-content') : null; if (!modal || !overlay || !content) return; modal.classList.remove('hidden'); void modal.offsetWidth; overlay.classList.add('opacity-100'); overlay.classList.remove('opacity-0'); content.classList.add('scale-100','opacity-100'); content.classList.remove('scale-95','opacity-0'); }
  function closeModal(id){ const modal = document.getElementById(id); const overlay = modal ? modal.querySelector('.modal-overlay') : null; const content = modal ? modal.querySelector('.modal-content') : null; if (!modal || !overlay || !content) return; overlay.classList.remove('opacity-100'); overlay.classList.add('opacity-0'); content.classList.remove('scale-100','opacity-100'); content.classList.add('scale-95','opacity-0'); setTimeout(() => modal.classList.add('hidden'), 230); }
  function openSetupHelpModal(){ openModal('setupHelpModal'); }
  function closeSetupHelpModal(){ sessionStorage.setItem('APJ_SETUP_HELP_SEEN_V107','true'); closeModal('setupHelpModal'); }
  function closeSetupFormModal(){ closeModal('setupFormModal'); }
  function showLogoutModal(){ openModal('logoutModal'); }
  function closeLogoutModal(){ closeModal('logoutModal'); }
  async function executeLogout(){
    try { if (CORE_API_URL && getToken()) await fetch(CORE_API_URL, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify({action:'logout', sessionToken:getToken(), token:getToken(), appName:'APJ_INVENTORY'}) }); } catch(e) {}
    Object.keys(STORAGE_KEYS).forEach(k => localStorage.removeItem(STORAGE_KEYS[k]));
    ['APJ_SESSION_ACTIVE','APJ_SESSION_TOKEN','APJ_USER_NAME','APJ_USER_LEVEL','APJ_USER_OUTLET','APJ_USER_PERMISSIONS','APJ_MODULE_ACCESS'].forEach(k => localStorage.removeItem(k));
    window.location.href = CONFIG.loginPage || 'index.html';
  }
  function openMobileSidebar(){ const sidebar = document.getElementById('sidebar'); const backdrop = document.getElementById('sidebarBackdrop'); if (!sidebar || !backdrop) return; sidebar.classList.remove('sidebar-collapsed'); sidebar.classList.remove('-translate-x-full'); backdrop.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
  function closeMobileSidebar(){ const sidebar = document.getElementById('sidebar'); const backdrop = document.getElementById('sidebarBackdrop'); if (!sidebar || !backdrop) return; if (window.innerWidth < 1024) sidebar.classList.add('-translate-x-full'); backdrop.classList.add('hidden'); document.body.style.overflow = ''; }
  function initSidebar(){
    document.querySelectorAll('[data-menu-toggle]').forEach(btn => btn.addEventListener('click', function(){ const group = btn.closest('.nav-group'); if (!group) return; group.classList.toggle('open'); btn.setAttribute('aria-expanded', group.classList.contains('open') ? 'true' : 'false'); }));
    const collapseBtn = document.querySelector('[data-sidebar-collapse]');
    if (collapseBtn) collapseBtn.addEventListener('click', function(){ const sidebar = document.getElementById('sidebar'); if (!sidebar || window.innerWidth < 1024) return; const collapsed = !sidebar.classList.contains('sidebar-collapsed'); sidebar.classList.toggle('sidebar-collapsed', collapsed); document.body.classList.toggle('sidebar-collapsed-active', collapsed); try { localStorage.setItem(CONFIG.ui?.sidebarCollapsedKey || 'APJ_SIDEBAR_COLLAPSED', collapsed ? '1':'0'); } catch(e) {} });
    document.querySelectorAll('.nav-coming-soon').forEach(link => link.addEventListener('click', function(e){ e.preventDefault(); showToast((link.getAttribute('data-coming-soon-menu') || 'Menu ini') + ' segera hadir.', 'warning'); }));
    document.querySelectorAll('#sidebar a[href]:not(.nav-coming-soon)').forEach(link => link.addEventListener('click', function(){ if (window.innerWidth < 1024) closeMobileSidebar(); }));
    window.addEventListener('resize', function(){ if (window.innerWidth >= 1024) { const backdrop = document.getElementById('sidebarBackdrop'); if (backdrop) backdrop.classList.add('hidden'); document.body.style.overflow = ''; } });
  }
  function initModalCloseOnEsc(){ document.addEventListener('keydown', function(e){ if (e.key !== 'Escape') return; ['setupHelpModal','setupFormModal','logoutModal'].forEach(id => { const modal = document.getElementById(id); if (modal && !modal.classList.contains('hidden')) closeModal(id); }); }); }

  window.APJSetupInventory = { edit: openForm, remove: removeMaster, addRecipeDetailRow: addRecipeDetailRow, removeRecipeDetailRow: removeRecipeDetailRow, addPrepBahanRow: addPrepBahanRow, removePrepBahanRow: removePrepBahanRow };
  window.openSetupHelpModal = openSetupHelpModal;
  window.closeSetupHelpModal = closeSetupHelpModal;
  window.closeSetupFormModal = closeSetupFormModal;
  window.showLogoutModal = showLogoutModal;
  window.closeLogoutModal = closeLogoutModal;
  window.executeLogout = executeLogout;
  window.openMobileSidebar = openMobileSidebar;
  window.closeMobileSidebar = closeMobileSidebar;
})();
