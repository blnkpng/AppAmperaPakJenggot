/* APJ Produk Outlet V97 - Print Pesanan Lauk Qty Catatan Fix */
(function(){
  'use strict';

  const CFG = window.APJ_CONFIG || {};
  const API_URL = CFG.inventoryApiUrl || (CFG.apis && CFG.apis.inventory) || '';
  const SESSION_KEY = 'APJ_SESSION_TOKEN';
  const state = {
    rows: [],
    filtered: [],
    outlets: [],
    canSelectOutlet: true,
    currentOutlet: '',
    loading: false,
    gorengSourceIndex: null,
    pesananProducts: [],
    lastPesananNo: '',
    savedPesanan: []
  };

  document.addEventListener('DOMContentLoaded', initProdukOutletPage);

  function initProdukOutletPage(){
    if (localStorage.getItem('APJ_SESSION_ACTIVE') !== 'true' || !localStorage.getItem(SESSION_KEY)) {
      window.location.href = 'index.html';
      return;
    }
    initIdentity();
    bindSidebar();
    setToday();
    loadProdukOutlet();
    const seen = sessionStorage.getItem('APJ_PRODUK_OUTLET_HELP_SEEN_V81');
    if (!seen) setTimeout(() => openProdukHelpModal(true), 550);
  }

  function initIdentity(){
    const name = localStorage.getItem('APJ_USER_NAME') || 'Petugas';
    const level = localStorage.getItem('APJ_USER_LEVEL') || '-';
    const initial = getInitial(name);
    setText('displayNama', name);
    setText('displayLevel', level);
    setText('displayInisial', initial);
    setText('namaPetugas', name);
  }

  function setToday(){
    const el = document.getElementById('tanggalInput');
    if (el && !el.value) el.value = new Date().toISOString().slice(0,10);
  }

  async function callInventory(action, payload, attempt){
    attempt = attempt || 1;
    if (!API_URL) throw new Error('Alamat server Inventory belum tersedia.');
    const body = Object.assign({}, payload || {}, {
      action,
      sessionToken: localStorage.getItem(SESSION_KEY) || '',
      _ts: Date.now()
    });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        cache: 'no-store',
        redirect: 'follow',
        body: JSON.stringify(body),
        signal: controller.signal
      });
      const text = await res.text();
      const json = parseJsonResponse(text);
      if (!json || typeof json !== 'object') throw new Error('Response server tidak valid.');
      return json;
    } catch (err) {
      if (attempt < 3) {
        await delay(650 * attempt);
        return callInventory(action, payload, attempt + 1);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  function parseJsonResponse(text){
    if (!text) return null;
    try { return JSON.parse(text); } catch(e) {}
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try { return JSON.parse(text.slice(start, end + 1)); } catch(e) {}
    }
    return null;
  }

  async function loadProdukOutlet(){
    const tanggal = document.getElementById('tanggalInput')?.value || new Date().toISOString().slice(0,10);
    const outlet = document.getElementById('outletSelect')?.value || state.currentOutlet || '';
    state.loading = true;
    renderLoading('Memuat produk outlet...', 'Mohon tunggu, data sedang disiapkan.');
    setText('lastInfo', 'Memuat data...');
    try {
      const result = await callInventory('getProdukOutletData', {
        tanggal,
        outlet,
        petugas: localStorage.getItem('APJ_USER_NAME') || '',
        level: localStorage.getItem('APJ_USER_LEVEL') || ''
      });
      if (!result.success) throw new Error(result.message || 'Gagal memuat produk outlet.');
      state.rows = sortRows(Array.isArray(result.data) ? result.data.map(normalizeRow) : []);
      state.outlets = Array.isArray(result.allowedOutlets) ? result.allowedOutlets : [];
      state.canSelectOutlet = result.canSelectOutlet !== false;
      state.currentOutlet = result.outlet || outlet || (state.outlets[0] || '');
      renderOutletSelect();
      renderTable();
      setText('kpiOutlet', state.currentOutlet || '-');
      setText('lastInfo', 'Data berhasil diperbarui.');
    } catch (err) {
      state.rows = [];
      state.filtered = [];
      renderError(err.message || 'Gagal memuat data.');
      updateKpis([]);
      showToast(err.message || 'Gagal memuat data produk outlet.', 'error');
      setText('lastInfo', 'Gagal memuat data.');
    } finally {
      state.loading = false;
    }
  }

  function normalizeRow(r){
    return {
      id: r.id || r.idItem || r.idProduk || '',
      idProduk: r.idProduk || '',
      nama: r.nama || r.namaProduk || r['Nama Produk'] || r['Nama Item'] || '-',
      kategori: r.kategori || r.kategoriProduk || r['Kategori'] || '-',
      satuan: r.satuan || r.satuanStok || r['Satuan'] || '-',
      keterangan: r.keterangan || '',
      urutan: numberOf(r.urutan || r['Urutan'] || 999999),
      stokKemarin: numberOf(r.stokKemarin),
      stokMasuk: numberOf(r.stokMasuk),
      stokTerjual: numberOf(r.stokTerjual),
      selisihOpname: numberOf(r.selisihOpname),
      stokSisa: numberOf(r.stokSisa)
    };
  }

  function categoryRank(kategori){
    const k = normalizeKey(kategori);
    if (k.includes('PRODUK_JADI') || k === 'PRODUKSI') return 1;
    if (k.includes('BAHAN_PREPARASI') || k.includes('PREPARASI') || k.includes('SETENGAH_JADI')) return 2;
    if (k.includes('MINUMAN') || k.includes('BARANG_DAGANG')) return 3;
    return 9;
  }

  function sortRows(rows){
    return (rows || []).slice().sort((a,b)=>{
      const ca = categoryRank(a.kategori), cb = categoryRank(b.kategori);
      if (ca !== cb) return ca - cb;
      if ((a.urutan || 999999) !== (b.urutan || 999999)) return (a.urutan || 999999) - (b.urutan || 999999);
      return String(a.nama || '').localeCompare(String(b.nama || ''), 'id');
    });
  }

  function renderOutletSelect(){
    const select = document.getElementById('outletSelect');
    if (!select) return;
    const outlets = state.outlets.length ? state.outlets : [state.currentOutlet || 'LAHOR'];
    select.innerHTML = outlets.map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join('');
    select.value = state.currentOutlet || outlets[0] || '';
    select.disabled = !state.canSelectOutlet;
  }

  function renderLoading(title, subtitle){
    const tbody = document.getElementById('tbodyProduk');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="9"><div class="table-loading"><span class="spinner"></span><div><b>${esc(title)}</b><p>${esc(subtitle || '')}</p></div></div></td></tr>`;
  }

  function renderError(message){
    const tbody = document.getElementById('tbodyProduk');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="9" class="py-10 text-center text-rose-500 font-bold">${esc(message)}</td></tr>`;
    setText('rowsInfo', '0 data tampil');
  }

  function renderTable(){
    const query = (document.getElementById('searchInput')?.value || '').trim().toLowerCase();
    state.filtered = state.rows.filter(r => !query || `${r.nama} ${r.kategori}`.toLowerCase().includes(query));
    updateKpis(state.filtered);
    const tbody = document.getElementById('tbodyProduk');
    if (!tbody) return;
    if (!state.filtered.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="py-10 text-center text-slate-500 font-bold">Tidak ada produk outlet yang cocok.</td></tr>';
      setText('rowsInfo', '0 data tampil');
      return;
    }
    tbody.innerHTML = state.filtered.map((r, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td><div class="produk-name">${esc(r.nama)}</div>${r.keterangan ? `<div class="produk-meta">${esc(cleanKeterangan(r.keterangan))}</div>` : ''}</td>
        <td><span class="kategori-pill">${esc(r.kategori || '-')}</span></td>
        <td class="num">${fmt(r.stokKemarin)}</td>
        <td class="num num-in">${fmt(r.stokMasuk)}</td>
        <td class="num num-out">${fmt(r.stokTerjual)}</td>
        <td class="num num-adj ${r.selisihOpname < 0 ? 'neg' : (r.selisihOpname > 0 ? 'pos' : '')}">${fmt(r.selisihOpname)}</td>
        <td class="num num-end">${fmt(r.stokSisa)}</td>
        <td>${esc(r.satuan || '-')}</td>
      </tr>`).join('');
    setText('rowsInfo', `${state.filtered.length} data tampil dari ${state.rows.length} produk`);
  }

  function cleanKeterangan(text){
    const t = String(text || '').trim();
    if (/migrasi\s+dari/i.test(t)) return '';
    return t;
  }

  function updateKpis(rows){
    rows = rows || [];
    setText('kpiProduk', rows.length);
    setText('kpiMasuk', fmt(rows.reduce((s,r)=>s+numberOf(r.stokMasuk),0)));
    setText('kpiTerjual', fmt(rows.reduce((s,r)=>s+numberOf(r.stokTerjual),0)));
    setText('kpiSisa', fmt(rows.reduce((s,r)=>s+numberOf(r.stokSisa),0)));
  }


  function openPesananModal(){
    const today = new Date().toISOString().slice(0,10);
    const penerima = localStorage.getItem('APJ_USER_NAME') || 'Petugas';
    setValue('pesananPenerima', penerima);
    setValue('pesananNamaPemesan', '');
    setValue('pesananHp', '');
    setValue('pesananTanggalPesanan', '');
    updateTanggalPesananLabel();
    renderPesananOutletSelect();
    state.pesananProducts = state.rows.slice();
    setValue('pesananStatusBayar', 'Belum Bayar');
    setValue('pesananMetodeBayar', 'Tunai');
    setValue('pesananBank', '');
    setValue('pesananJumlahRp', '');
    setValue('pesananJenisPengambilan', 'DIAMBIL');
    setValue('pesananJam', '');
    setValue('pesananAlamat', '');
    setValue('pesananCatatan', '');
    togglePesananBank();
    togglePesananAlamat();
    const wrap = document.getElementById('pesananGroups');
    if (wrap) wrap.innerHTML = '';
    addPesananGroup();
    openModal('modalPesanan');
  }

  function renderPesananOutletSelect(){
    const select = document.getElementById('pesananOutletSelect');
    if (!select) return;
    const outlets = state.outlets.length ? state.outlets : [state.currentOutlet || 'LAHOR'];
    select.innerHTML = outlets.map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join('');
    select.value = state.currentOutlet || outlets[0] || '';
  }

  async function syncPesananProducts(){
    const outlet = document.getElementById('pesananOutletSelect')?.value || state.currentOutlet;
    if (!outlet || normalizeKey(outlet) === normalizeKey(state.currentOutlet)) {
      state.pesananProducts = state.rows.slice();
      refreshPesananProductOptions();
      return;
    }
    const summary = document.getElementById('pesananSummary');
    if (summary) summary.textContent = 'Memuat daftar lauk untuk outlet yang dipilih...';
    try {
      const result = await callInventory('getPesananOutletInit', { outlet, tanggal: document.getElementById('tanggalInput')?.value || '' });
      if (!result.success) throw new Error(result.message || 'Gagal memuat daftar lauk.');
      state.pesananProducts = sortRows(Array.isArray(result.produk) ? result.produk.map(normalizeRow) : []);
      refreshPesananProductOptions();
      updatePesananSummary();
    } catch (err) {
      showToast(err.message || 'Gagal memuat daftar lauk pesanan.', 'error');
      state.pesananProducts = state.rows.slice();
      refreshPesananProductOptions();
      updatePesananSummary();
    }
  }

  function refreshPesananProductOptions(){
    document.querySelectorAll('.pesanan-lauk-select').forEach(select => {
      const current = select.value;
      fillProdukSelect(select);
      if (current) select.value = current;
    });
  }

  function addPesananGroup(){
    const wrap = document.getElementById('pesananGroups');
    if (!wrap) return;
    const groupNo = wrap.querySelectorAll('.pesanan-group').length + 1;
    const div = document.createElement('div');
    div.className = 'pesanan-group';
    div.dataset.group = String(groupNo);
    div.innerHTML = `
      <div class="pesanan-group-head">
        <div><b>Pesanan ${groupNo}</b><span>Isi jenis pesanan, jumlah, dan lauk.</span></div>
        <button class="btn-mini danger" onclick="removePesananGroup(this)" type="button">Hapus</button>
      </div>
      <div class="pesanan-group-grid">
        <div><label class="form-label">Jenis Pesanan</label><select class="form-control pesanan-jenis" onchange="syncKemasanPesanan(this); updatePesananSummary()"><option value="Nasi Box">Nasi Box</option><option value="Nasi Bungkus">Nasi Bungkus</option><option value="Custom">Custom</option></select></div>
        <div><label class="form-label">Qty Pesanan</label><input class="form-control pesanan-qty" type="number" min="0" step="any" placeholder="Jumlah" oninput="updatePesananSummary()" /></div>
        <div><label class="form-label">Kemasan</label><input class="form-control pesanan-kemasan" type="text" value="Box" /></div>
        <div class="pesanan-full"><label class="form-label">Catatan Pesanan</label><input class="form-control pesanan-catatan-grup" type="text" placeholder="Contoh: tanpa pedas / sambal dipisah" oninput="updatePesananSummary()" /></div>
      </div>
      <div class="pesanan-lauk-head"><span>Isi Lauk</span><button class="btn-mini btn-add-lauk" onclick="addLaukRow(this)" type="button">+ Tambah Lauk</button></div>
      <div class="pesanan-lauk-columns"><span>Lauk</span><span>Qty</span><span>Catatan</span><span></span></div>
      <div class="pesanan-lauk-list"></div>`;
    wrap.appendChild(div);
    addLaukRow(div.querySelector('.pesanan-lauk-head button'));
    updatePesananGroupNumbers();
    updatePesananSummary();
  }

  function updatePesananGroupNumbers(){
    document.querySelectorAll('.pesanan-group').forEach((group, idx) => {
      group.dataset.group = String(idx + 1);
      const b = group.querySelector('.pesanan-group-head b');
      if (b) b.textContent = `Pesanan ${idx + 1}`;
    });
  }

  function removePesananGroup(btn){
    const group = btn && btn.closest('.pesanan-group');
    if (!group) return;
    group.remove();
    if (!document.querySelectorAll('.pesanan-group').length) addPesananGroup();
    updatePesananGroupNumbers();
    updatePesananSummary();
  }

  function addLaukRow(btn){
    const group = btn && btn.closest('.pesanan-group');
    if (!group) return;
    const list = group.querySelector('.pesanan-lauk-list');
    const row = document.createElement('div');
    row.className = 'pesanan-lauk-row';
    row.innerHTML = `<select class="form-control pesanan-lauk-select" onchange="updatePesananSummary()"></select><input class="form-control pesanan-lauk-qty" type="number" min="0" step="any" placeholder="Qty" oninput="updatePesananSummary()" /><input class="form-control pesanan-lauk-catatan" type="text" placeholder="Catatan lauk" oninput="updatePesananSummary()" /><button class="btn-mini danger" onclick="removeLaukRow(this)" type="button">Hapus</button>`;
    list.appendChild(row);
    fillProdukSelect(row.querySelector('select'));
    updatePesananSummary();
  }

  function removeLaukRow(btn){
    const row = btn && btn.closest('.pesanan-lauk-row');
    const list = row && row.parentElement;
    if (!row || !list) return;
    row.remove();
    if (!list.querySelector('.pesanan-lauk-row')) addLaukRow(list.closest('.pesanan-group').querySelector('.pesanan-lauk-head button'));
    updatePesananSummary();
  }

  function fillProdukSelect(select){
    if (!select) return;
    const rows = (state.pesananProducts && state.pesananProducts.length ? state.pesananProducts : state.rows).slice();
    select.innerHTML = '<option value="">-- Pilih lauk --</option>' + rows.map(r => `<option value="${esc(r.id)}">${esc(r.nama)}</option>`).join('');
  }

  function syncKemasanPesanan(select){
    const group = select.closest('.pesanan-group');
    const kemasan = group && group.querySelector('.pesanan-kemasan');
    if (!kemasan) return;
    const val = select.value;
    if (val === 'Nasi Box') kemasan.value = 'Box';
    else if (val === 'Nasi Bungkus') kemasan.value = 'Bungkus';
    else if (!kemasan.value || kemasan.value === 'Box' || kemasan.value === 'Bungkus') kemasan.value = 'Custom';
  }

  function togglePesananBank(){
    const metode = document.getElementById('pesananMetodeBayar')?.value || 'Tunai';
    const wrap = document.getElementById('pesananBankWrap');
    if (!wrap) return;
    wrap.classList.toggle('hidden', metode !== 'Transfer');
  }

  function togglePesananAlamat(){
    const jenis = document.getElementById('pesananJenisPengambilan')?.value || 'DIAMBIL';
    const wrap = document.getElementById('pesananAlamatWrap');
    if (!wrap) return;
    wrap.classList.toggle('hidden', jenis !== 'DIANTAR');
  }

  function updateTanggalPesananLabel(){
    const val = document.getElementById('pesananTanggalPesanan')?.value || '';
    setValue('pesananTanggalLabel', formatLongDateId(val));
  }

  function collectPesananPayload(strict){
    const groups = [];
    const produkMap = {};
    (state.pesananProducts.length ? state.pesananProducts : state.rows).forEach(r => { produkMap[String(r.id)] = r; });
    document.querySelectorAll('.pesanan-group').forEach((group, idx) => {
      const jenisPesanan = group.querySelector('.pesanan-jenis')?.value || '';
      const qtyPesananRaw = group.querySelector('.pesanan-qty')?.value || '';
      const kemasan = group.querySelector('.pesanan-kemasan')?.value || '';
      const catatanGrup = group.querySelector('.pesanan-catatan-grup')?.value || '';
      const lauk = [];
      group.querySelectorAll('.pesanan-lauk-row').forEach((row, laukIdx) => {
        const select = row.querySelector('.pesanan-lauk-select');
        const id = select?.value || '';
        const qtyLaukRaw = row.querySelector('.pesanan-lauk-qty')?.value || '';
        const catatanLauk = row.querySelector('.pesanan-lauk-catatan')?.value || '';
        const item = produkMap[String(id)] || {};
        const hasLaukAny = id || qtyLaukRaw || catatanLauk;
        if (!hasLaukAny) return;
        const qtyLauk = numberOf(qtyLaukRaw);
        if (strict) {
          if (!id) throw new Error(`Lauk wajib dipilih pada Pesanan ${idx + 1}, baris lauk ${laukIdx + 1}.`);
          if (qtyLauk <= 0) throw new Error(`Qty lauk wajib lebih dari 0 pada Pesanan ${idx + 1}, baris lauk ${laukIdx + 1}.`);
        }
        lauk.push({ id, nama: item.nama || select?.options[select.selectedIndex]?.text || '', kategori: item.kategori || '', qtyLauk, catatanLauk, urutan: laukIdx + 1 });
      });
      const hasAny = jenisPesanan || qtyPesananRaw || kemasan || catatanGrup || lauk.length;
      if (!hasAny) return;
      const qtyPesanan = numberOf(qtyPesananRaw);
      if (strict) {
        if (!jenisPesanan) throw new Error(`Jenis pesanan wajib diisi pada Pesanan ${idx + 1}.`);
        if (qtyPesanan <= 0) throw new Error(`Qty pesanan wajib lebih dari 0 pada Pesanan ${idx + 1}.`);
        if (!kemasan) throw new Error(`Kemasan wajib diisi pada Pesanan ${idx + 1}.`);
        if (!lauk.length) throw new Error(`Isi lauk wajib dipilih pada Pesanan ${idx + 1}.`);
      }
      groups.push({ noGrup: idx + 1, jenisPesanan, qtyPesanan, kemasan, catatanGrup, lauk });
    });
    const payload = {
      tanggalInput: new Date().toISOString().slice(0,10),
      outlet: document.getElementById('pesananOutletSelect')?.value || state.currentOutlet || '',
      tanggalPesanan: document.getElementById('pesananTanggalPesanan')?.value || '',
      penerima: document.getElementById('pesananPenerima')?.value || localStorage.getItem('APJ_USER_NAME') || '',
      namaPemesan: document.getElementById('pesananNamaPemesan')?.value || '',
      nomorHp: document.getElementById('pesananHp')?.value || '',
      statusPembayaran: document.getElementById('pesananStatusBayar')?.value || 'Belum Bayar',
      metodePembayaran: document.getElementById('pesananMetodeBayar')?.value || 'Tunai',
      bank: document.getElementById('pesananBank')?.value || '',
      jumlahRp: getRupiahNumber(document.getElementById('pesananJumlahRp')?.value || ''),
      jenisPengambilan: document.getElementById('pesananJenisPengambilan')?.value || 'DIAMBIL',
      jam: document.getElementById('pesananJam')?.value || '',
      alamat: document.getElementById('pesananAlamat')?.value || '',
      catatanTambahan: document.getElementById('pesananCatatan')?.value || '',
      statusPesanan: 'Baru',
      groups
    };
    if (strict) {
      if (!payload.outlet) throw new Error('Outlet wajib dipilih.');
      if (!payload.tanggalPesanan) throw new Error('Tanggal pesanan wajib dipilih.');
      if (!payload.namaPemesan.trim()) throw new Error('Nama pemesan wajib diisi.');
      if (!groups.length) throw new Error('Tambahkan minimal 1 pesanan.');
      if (payload.metodePembayaran === 'Transfer' && !payload.bank.trim()) throw new Error('Nama bank wajib diisi untuk pembayaran transfer.');
      if (payload.jenisPengambilan === 'DIANTAR' && !payload.alamat.trim()) throw new Error('Alamat wajib diisi untuk pesanan diantar.');
    }
    return payload;
  }

  function updatePesananSummary(){
    const p = collectPesananPayload(false);
    const totalGroup = p.groups.length;
    const totalQty = p.groups.reduce((s,g)=>s+numberOf(g.qtyPesanan),0);
    const totalLauk = p.groups.reduce((s,g)=>s+(g.lauk ? g.lauk.length : 0),0);
    const totalQtyLauk = p.groups.reduce((s,g)=>s+(g.lauk || []).reduce((x,l)=>x+numberOf(l.qtyLauk),0),0);
    setText('pesananSummary', totalGroup ? `${totalGroup} jenis pesanan. Total qty pesanan: ${fmt(totalQty)}. Isi lauk: ${totalLauk} item / ${fmt(totalQtyLauk)} qty.` : 'Belum ada rincian pesanan.');
  }

  async function savePesananOutlet(printAfter){
    const btn = document.getElementById(printAfter ? 'btnSavePrintPesanan' : 'btnSavePesanan');
    let printWindow = null;
    try {
      const payload = collectPesananPayload(true);
      if (printAfter) printWindow = openPrintWindowShell('Menyiapkan Print Pesanan');
      setButtonLoading(btn, printAfter ? 'Menyimpan...' : 'Menyimpan...');
      const result = await callInventory('simpanPesananOutlet', payload);
      if (!result.success) throw new Error(result.message || 'Gagal menyimpan pesanan.');
      state.lastPesananNo = result.noPesanan || '';
      payload.noPesanan = state.lastPesananNo;
      showToast(result.message || 'Pesanan berhasil disimpan.', 'success');
      if (printAfter) printPesananPayload(payload, state.lastPesananNo || 'DRAFT', printWindow);
      closeModal('modalPesanan');
      updatePesananSummary();
    } catch (err) {
      if (printWindow && !printWindow.closed) { try { printWindow.close(); } catch (_) {} }
      showToast(err.message || 'Gagal menyimpan pesanan.', 'error');
    } finally {
      resetButton(btn, printAfter ? 'Simpan & Cetak' : 'Simpan Pesanan');
    }
  }


  function printPesananOutlet(noPesanan){
    let payload;
    try { payload = collectPesananPayload(true); } catch (err) { showToast(err.message || 'Data pesanan belum valid.', 'error'); return; }
    printPesananPayload(payload, noPesanan || state.lastPesananNo || 'DRAFT');
  }

  function printPesananPayload(payload, noPesanan, printWindow){
    const html = buildPesananPrintHtml(payload, noPesanan || payload.noPesanan || 'DRAFT');
    printHtml58Roll(html, printWindow);
  }

  function buildPesananPrintHtml(payload, noPesanan){
    payload = payload || {};
    const nomor = noPesanan || payload.noPesanan || payload['No Pesanan'] || 'DRAFT';
    const namaPemesan = payload.namaPemesan || payload.pemesan || payload.namaCustomer || payload.customer || payload['Nama Pemesan'] || payload['Nama Pesanan'] || payload['Pemesan'] || document.getElementById('pesananNamaPemesan')?.value || '';
    const nomorHp = payload.nomorHp || payload.noHp || payload.hp || payload['Nomor HP'] || payload['No HP'] || '';
    const now = new Date();
    const rowsHtml = (payload.groups || []).map((g, i) => {
      const laukRows = (g.lauk || []).map(l => {
        const namaLauk = l.nama || l.namaProduk || l.namaLauk || '';
        const qtyLauk = numberOf(l.qtyLauk || l.qty || l.jumlahLauk || l['Qty Lauk']);
        const catatanLauk = l.catatanLauk || l.catatan || l.keterangan || l['Catatan Lauk'] || '';
        return `<tr><td>${esc(namaLauk || '-')}</td><td class="num">${qtyLauk ? esc(fmt(qtyLauk)) : '-'}</td><td>${esc(catatanLauk || '-')}</td></tr>`;
      }).join('');
      return `<div class="order-block">
        <div class="order-title">${i+1}. ${esc(g.jenisPesanan || '-')}</div>
        <div>Qty Pesanan: <b>${esc(fmt(g.qtyPesanan))} ${esc(g.kemasan || '')}</b></div>
        <table class="lauk-table"><thead><tr><th>Lauk</th><th>Qty</th><th>Catatan</th></tr></thead><tbody>${laukRows || '<tr><td>-</td><td class="num">-</td><td>-</td></tr>'}</tbody></table>
        ${g.catatanGrup ? `<div class="note">Catatan Pesanan: ${esc(g.catatanGrup)}</div>` : ''}
      </div>`;
    }).join('');
    const bayar = `${payload.statusPembayaran || '-'} - ${payload.metodePembayaran || '-'}${payload.metodePembayaran === 'Transfer' && payload.bank ? ' ' + payload.bank : ''}`;
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Pesanan Outlet 58mm</title><style>
      @page{size:58mm 297mm;margin:0!important}*{box-sizing:border-box}html,body{margin:0!important;padding:0!important;background:#fff!important;color:#000!important;width:58mm!important;min-width:58mm!important;min-height:30mm!important;height:auto!important;overflow:visible!important}body{font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.30;font-weight:500;-webkit-print-color-adjust:exact;print-color-adjust:exact;text-rendering:geometricPrecision}.wrap{width:56mm;max-width:56mm;margin:0 auto;padding:2mm 1mm 3mm 1mm;break-inside:auto;page-break-inside:auto}.center{text-align:center}.brand{font-size:17px;font-weight:900;text-transform:uppercase;letter-spacing:.1px}.title{font-size:14px;font-weight:800;text-transform:uppercase;margin-top:.9mm}.dash{border-top:1.6px dashed #000;margin:2mm 0}.meta{display:grid;grid-template-columns:19mm 1fr;gap:.7mm 1mm;font-size:14px;line-height:1.25}.meta div:nth-child(odd){font-weight:700}.meta div,.order-block,.note,.footer,td,th{word-break:break-word;overflow-wrap:anywhere}.order-block{border-bottom:1.4px dashed #555;padding:2mm 0;break-inside:avoid;page-break-inside:avoid}.order-title{font-size:14px;font-weight:800}.lauk-table{width:100%;border-collapse:collapse;margin-top:1.3mm;font-size:12.8px;line-height:1.2}.lauk-table th{font-weight:800;text-align:left;border-bottom:1px solid #000;padding:.8mm .5mm}.lauk-table td{vertical-align:top;border-bottom:1px dotted #777;padding:.8mm .5mm}.lauk-table th:nth-child(1),.lauk-table td:nth-child(1){width:25mm}.lauk-table th:nth-child(2),.lauk-table td:nth-child(2){width:9mm;text-align:right;font-weight:700}.lauk-table th:nth-child(3),.lauk-table td:nth-child(3){width:18mm}.note{margin-top:1mm;font-weight:600}.footer{margin-top:2mm;font-size:12px;font-weight:500;text-align:center}b,strong{font-weight:700!important}@media print{@page{size:58mm 297mm;margin:0!important}html,body{width:58mm!important;min-width:58mm!important;height:auto!important;min-height:30mm!important;overflow:visible!important}.wrap{width:56mm!important;max-width:56mm!important}.order-block{break-inside:avoid;page-break-inside:avoid}body:after{content:"";display:block;height:2mm}}
    </style></head><body><div class="wrap">
      <div class="center"><div class="brand">AMPERA PAK JENGGOT</div><div class="title">Form Pesanan Outlet</div></div><div class="dash"></div>
      <div class="meta"><div>No</div><div>: ${esc(nomor)}</div><div>Outlet</div><div>: ${esc(payload.outlet || '-')}</div><div>Tgl Pesanan</div><div>: ${esc(formatLongDateId(payload.tanggalPesanan || ''))}</div><div>Jam</div><div>: ${esc(payload.jam || '-')}</div><div>Penerima</div><div>: ${esc(payload.penerima || '-')}</div><div>Pemesan</div><div>: ${esc(namaPemesan || '-')}</div><div>HP</div><div>: ${esc(nomorHp || '-')}</div></div>
      <div class="dash"></div>${rowsHtml}<div class="dash"></div>
      <div class="meta"><div>Bayar</div><div>: ${esc(bayar)}</div><div>Jumlah</div><div>: Rp ${esc(formatRupiahPlain(payload.jumlahRp || 0))}</div><div>Pesanan</div><div>: ${esc(payload.jenisPengambilan || '-')}</div></div>
      ${payload.jenisPengambilan === 'DIANTAR' ? `<div class="dash"></div><div><b>Alamat:</b><br>${esc(payload.alamat || '-')}</div>` : ''}
      ${payload.catatanTambahan ? `<div class="dash"></div><div><b>Catatan:</b><br>${esc(payload.catatanTambahan)}</div>` : ''}
      <div class="dash"></div><div class="footer">Dicetak : ${esc(now.toLocaleString('id-ID'))}</div>
    </div></body></html>`;
  }

  function openPrintWindowShell(title){
    const win = window.open('', '_blank', 'width=380,height=720,noopener=false');
    if (!win) return null;
    try {
      win.document.open();
      win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title || 'Cetak Pesanan')}</title></head><body style="font-family:Arial,sans-serif;padding:16px">Menyiapkan dokumen cetak...</body></html>`);
      win.document.close();
    } catch (_) {}
    return win;
  }

  function printHtml58Roll(html, printWindow, title){
    // V98: popup cetak nyata untuk Pesanan dan Rekap Produk Outlet 58mm agar tidak terjadi preview bagus tetapi hasil print kosong.
    // Sebagian driver thermal menampilkan pratinjau benar tetapi mencetak kosong jika print dipanggil terlalu cepat
    // atau @page memakai tinggi auto. Karena itu ukuran halaman dibuat eksplisit 58mm x 297mm di buildPesananPrintHtml().
    const win = printWindow && !printWindow.closed ? printWindow : openPrintWindowShell(title || 'Cetak 58mm');
    if (!win) {
      showToast('Popup cetak diblokir browser. Izinkan popup lalu coba cetak lagi.', 'error');
      return;
    }
    try {
      win.document.open();
      win.document.write(html);
      win.document.close();
      let printed = false;
      const runPrint = () => {
        if (printed) return;
        printed = true;
        try {
          win.focus();
          // Paksa browser menghitung layout sebelum dialog print dibuka.
          void win.document.body.offsetHeight;
          win.print();
        } catch (err) {
          printed = false;
          showToast(err.message || 'Gagal membuka dialog cetak.', 'error');
        }
      };
      const waitReady = () => {
        try {
          const bodyText = win.document.body ? String(win.document.body.innerText || win.document.body.textContent || '').trim() : '';
          if (win.document.readyState === 'complete' && bodyText) return setTimeout(runPrint, 450);
        } catch (_) {}
        setTimeout(waitReady, 120);
      };
      setTimeout(waitReady, 120);
      setTimeout(runPrint, 1800);
    } catch (err) {
      showToast(err.message || 'Gagal menyiapkan dokumen cetak.', 'error');
    }
  }


  function openPrintPesananModal(){
    renderPrintPesananOutletSelect();
    const tgl = document.getElementById('printPesananTanggal');
    if (tgl) tgl.value = '';
    const list = document.getElementById('printPesananList');
    if (list) list.innerHTML = '<div class="empty-box">Memuat daftar pesanan...</div>';
    openModal('modalPrintPesanan');
    loadPesananPrintList();
  }

  function renderPrintPesananOutletSelect(){
    const select = document.getElementById('printPesananOutlet');
    if (!select) return;
    const outlets = state.outlets.length ? state.outlets : [state.currentOutlet || 'LAHOR'];
    select.innerHTML = outlets.map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join('');
    select.value = state.currentOutlet || outlets[0] || '';
  }

  async function loadPesananPrintList(){
    const list = document.getElementById('printPesananList');
    if (list) list.innerHTML = '<div class="empty-box">Memuat daftar pesanan...</div>';
    try {
      const payload = { outlet: document.getElementById('printPesananOutlet')?.value || state.currentOutlet || '', tanggalPesanan: document.getElementById('printPesananTanggal')?.value || '', limit: 50 };
      const result = await callInventory('getPesananOutletList', payload);
      if (!result.success) throw new Error(result.message || 'Gagal memuat pesanan.');
      state.savedPesanan = Array.isArray(result.data) ? result.data : [];
      renderPesananPrintList();
    } catch (err) {
      if (list) list.innerHTML = `<div class="empty-box text-rose-500">${esc(err.message || 'Gagal memuat daftar pesanan.')}</div>`;
      showToast(err.message || 'Gagal memuat daftar pesanan.', 'error');
    }
  }

  function renderPesananPrintList(){
    const list = document.getElementById('printPesananList');
    if (!list) return;
    const rows = state.savedPesanan || [];
    if (!rows.length) {
      list.innerHTML = '<div class="empty-box">Belum ada pesanan tersimpan pada filter ini.</div>';
      return;
    }
    list.innerHTML = rows.map((r, i) => `<div class="print-pesanan-card">
      <div>
        <div class="print-pesanan-title">${esc(r.noPesanan || '-')} · ${esc(r.namaPemesan || '-')}</div>
        <div class="print-pesanan-meta">${esc(r.outlet || '-')} · ${esc(formatLongDateId(r.tanggalPesanan || ''))} · ${esc(r.jam || '-')} · ${esc(r.jenisPengambilan || '-')}<br>${esc(r.statusPembayaran || '-')} ${r.jumlahRp ? '· Rp ' + esc(formatRupiahPlain(r.jumlahRp)) : ''}</div>
      </div>
      <button class="btn-print" onclick="printSavedPesanan('${escAttr(r.noPesanan || '')}')" type="button">Cetak 58mm</button>
    </div>`).join('');
  }

  async function printSavedPesanan(noPesanan){
    if (!noPesanan) return showToast('Nomor pesanan tidak valid.', 'error');
    const printWindow = openPrintWindowShell('Memuat Pesanan');
    try {
      const result = await callInventory('getPesananOutletPrintData', { noPesanan });
      if (!result.success) throw new Error(result.message || 'Pesanan tidak ditemukan.');
      printPesananPayload(result.data || {}, noPesanan, printWindow);
    } catch (err) {
      if (printWindow && !printWindow.closed) { try { printWindow.close(); } catch (_) {} }
      showToast(err.message || 'Gagal mencetak pesanan.', 'error');
    }
  }

  function openTerjualModal(){
    if (!state.rows.length) return showToast('Data produk belum dimuat.', 'error');
    const tbody = document.getElementById('tbodyTerjual');
    tbody.innerHTML = state.rows.map((r, idx) => {
      const preparasi = isBahanPreparasi(r);
      return `
      <tr data-index="${idx}" class="${preparasi ? 'row-preparasi' : ''}">
        <td>
          <div class="produk-name">${esc(r.nama)}</div>
          <div class="produk-meta">${esc(r.kategori || '')}</div>
          ${preparasi ? '<div class="prep-note">Siap goreng · proses dahulu</div>' : ''}
        </td>
        <td class="num num-end text-center">${fmt(r.stokSisa)}</td>
        <td>${preparasi ? '<div class="modal-cell-note">Proses dulu</div>' : '<input class="modal-input text-center input-terjual" type="number" min="0" step="any" placeholder="Kosong" oninput="updateTerjualSummary()">'}</td>
        <td class="text-center">${esc(r.satuan || '-')}</td>
        <td>${preparasi ? '<span class="modal-muted">Tidak dijual langsung</span>' : '<input class="modal-input input-catatan" type="text" placeholder="Opsional...">'}</td>
        <td class="text-center">${preparasi ? `<button class="btn-goreng" type="button" onclick="openGorengModal(${idx})">Goreng</button>` : '<span class="modal-muted">-</span>'}</td>
      </tr>`;
    }).join('');
    updateTerjualSummary();
    openModal('modalTerjual');
  }

  function updateTerjualSummary(){
    const rows = collectTerjualRows(false);
    const total = rows.reduce((s,r)=>s+numberOf(r.qtyKeluar),0);
    setText('terjualSummary', rows.length ? `${rows.length} produk akan dicatat. Total jumlah terjual: ${fmt(total)}.` : 'Belum ada jumlah terjual.');
  }

  function collectTerjualRows(strict){
    const rows = [];
    document.querySelectorAll('#tbodyTerjual tr').forEach(tr => {
      const item = state.rows[Number(tr.dataset.index)];
      if (!item) return;
      if (isBahanPreparasi(item)) return;
      const qty = tr.querySelector('.input-terjual')?.value || '';
      if (qty === '' || numberOf(qty) === 0) return;
      if (strict && numberOf(qty) < 0) throw new Error(`Jumlah terjual ${item.nama} tidak boleh minus.`);
      rows.push({ id:item.id, idItem:item.id, nama:item.nama, satuan:item.satuan, qtyKeluar: qty, keterangan: tr.querySelector('.input-catatan')?.value || 'Terjual outlet' });
    });
    return rows;
  }

  async function saveTerjual(){
    const btn = document.getElementById('btnSaveTerjual');
    try {
      const rows = collectTerjualRows(true);
      if (!rows.length) throw new Error('Isi minimal 1 produk terjual.');
      setButtonLoading(btn, 'Menyimpan...');
      const result = await callInventory('simpanProdukOutletKeluar', {
        tanggal: document.getElementById('tanggalInput')?.value || '',
        outlet: document.getElementById('outletSelect')?.value || state.currentOutlet,
        petugas: localStorage.getItem('APJ_USER_NAME') || '',
        rows
      });
      if (!result.success) throw new Error(result.message || 'Gagal menyimpan produk terjual.');
      closeModal('modalTerjual');
      showToast(result.message || 'Produk terjual berhasil disimpan.', 'success');
      await loadProdukOutlet();
    } catch (err) {
      showToast(err.message || 'Data belum valid.', 'error');
    } finally {
      resetButton(btn, 'Simpan Terjual');
    }
  }

  function isBahanPreparasi(row){
    const k = normalizeKey(row && row.kategori);
    return k.includes('BAHAN_PREPARASI') || k.includes('PREPARASI') || k.includes('SETENGAH_JADI');
  }

  function isProdukJadi(row){
    const k = normalizeKey(row && row.kategori);
    return k.includes('PRODUK_JADI') || k === 'PRODUKSI';
  }

  function openGorengModal(index){
    const source = state.rows[Number(index)];
    if (!source) return showToast('Produk belum ditemukan.', 'error');
    if (!isBahanPreparasi(source)) return showToast('Aksi goreng hanya untuk bahan preparasi.', 'warning');
    if (numberOf(source.stokSisa) <= 0) return showToast('Stok bahan preparasi belum tersedia untuk digoreng.', 'error');

    state.gorengSourceIndex = Number(index);
    const targetSelect = document.getElementById('gorengTargetSelect');
    const qtyInput = document.getElementById('gorengQtyInput');
    const catatanInput = document.getElementById('gorengCatatanInput');
    const targets = state.rows.filter(isProdukJadi);
    if (!targets.length) return showToast('Produk jadi belum tersedia di outlet ini.', 'error');

    const inferred = inferGorengTarget(source, targets);
    targetSelect.innerHTML = targets.map((r, i) => `<option value="${esc(r.id)}" ${inferred && inferred.id === r.id ? 'selected' : (!inferred && i === 0 ? 'selected' : '')}>${esc(r.nama)}</option>`).join('');
    if (qtyInput) qtyInput.value = '';
    if (catatanInput) catatanInput.value = `Goreng ${source.nama}`;
    setText('gorengSourceInfo', `${source.nama} | Stok siap goreng: ${fmt(source.stokSisa)} ${source.satuan || ''}`);
    setText('gorengSummary', 'Stok bahan preparasi akan berkurang dan produk siap jual akan bertambah.');
    openModal('modalGorengOutlet');
  }

  function inferGorengTarget(source, targets){
    const src = normalizeKey(source.nama);
    const has11 = /(^|_)11(_|$)/.test(src) || src.includes('POTONG_11');
    const has8 = /(^|_)8(_|$)/.test(src) || src.includes('POTONG_8');
    const ayamTargets = targets.filter(t => normalizeKey(t.nama).includes('AYAM') && normalizeKey(t.nama).includes('GORENG'));
    if (has11) return ayamTargets.find(t => /(^|_)11(_|$)/.test(normalizeKey(t.nama))) || ayamTargets.find(t => normalizeKey(t.nama).includes('AYAM_GORENG_11')) || ayamTargets[0] || targets[0];
    if (has8) return ayamTargets.find(t => /(^|_)8(_|$)/.test(normalizeKey(t.nama))) || ayamTargets.find(t => normalizeKey(t.nama) === 'AYAM_GORENG') || ayamTargets[0] || targets[0];
    if (normalizeKey(source.nama).includes('AYAM')) return ayamTargets[0] || targets[0];
    return targets.find(t => normalizeKey(t.nama).includes(normalizeKey(source.nama).split('_')[0] || '')) || targets[0];
  }

  async function saveGorengOutlet(){
    const btn = document.getElementById('btnSaveGoreng');
    try {
      const source = state.rows[Number(state.gorengSourceIndex)];
      if (!source) throw new Error('Produk bahan preparasi belum dipilih.');
      const idHasil = document.getElementById('gorengTargetSelect')?.value || '';
      const target = state.rows.find(r => String(r.id) === String(idHasil));
      if (!target) throw new Error('Pilih hasil setelah digoreng.');
      const qty = numberOf(document.getElementById('gorengQtyInput')?.value || '');
      if (qty <= 0) throw new Error('Jumlah digoreng wajib lebih dari 0.');
      if (qty > numberOf(source.stokSisa)) throw new Error(`Jumlah digoreng melebihi stok ${source.nama}.`);
      setButtonLoading(btn, 'Menyimpan...');
      const catatan = (document.getElementById('gorengCatatanInput')?.value || '').trim() || `Goreng outlet: ${source.nama} menjadi ${target.nama}`;
      const result = await callInventory('simpanOlahOutlet', {
        tanggal: document.getElementById('tanggalInput')?.value || '',
        outlet: document.getElementById('outletSelect')?.value || state.currentOutlet,
        petugas: localStorage.getItem('APJ_USER_NAME') || '',
        keterangan: catatan,
        rows: [{ idBahan: source.id, namaAsal: source.nama, idHasil: target.id, namaHasil: target.nama, qtyGoreng: qty, keterangan: catatan }]
      });
      if (!result.success) throw new Error(result.message || 'Gagal menyimpan proses goreng outlet.');
      closeModal('modalGorengOutlet');
      closeModal('modalTerjual');
      showToast(result.message || 'Proses goreng berhasil disimpan.', 'success');
      await loadProdukOutlet();
    } catch (err) {
      showToast(err.message || 'Data proses goreng belum valid.', 'error');
    } finally {
      resetButton(btn, 'Simpan Goreng');
    }
  }

  function openOpnameModal(){
    if (!state.rows.length) return showToast('Data produk belum dimuat.', 'error');
    const tbody = document.getElementById('tbodyOpname');
    tbody.innerHTML = state.rows.map((r, idx) => `
      <tr data-index="${idx}">
        <td><div class="produk-name">${esc(r.nama)}</div><div class="produk-meta">${esc(r.kategori || '')}</div></td>
        <td class="num num-end text-center stok-sistem">${fmt(r.stokSisa)}</td>
        <td><input class="modal-input text-center input-fisik" type="number" min="0" step="any" placeholder="Kosong" oninput="updateOpnameRow(this); updateOpnameSummary();"></td>
        <td class="num text-center label-selisih">-</td>
        <td class="text-center">${esc(r.satuan || '-')}</td>
        <td><input class="modal-input input-alasan" type="text" placeholder="Wajib jika selisih..."></td>
      </tr>`).join('');
    updateOpnameSummary();
    openModal('modalOpname');
  }

  function updateOpnameRow(input){
    const tr = input.closest('tr');
    const item = state.rows[Number(tr.dataset.index)];
    const label = tr.querySelector('.label-selisih');
    if (!item || !label) return;
    if (input.value === '') { label.textContent = '-'; label.className = 'num text-center label-selisih'; return; }
    const diff = numberOf(input.value) - numberOf(item.stokSisa);
    label.textContent = fmt(diff);
    label.className = `num text-center label-selisih ${diff < 0 ? 'num-adj neg' : (diff > 0 ? 'num-adj pos' : '')}`;
  }

  function updateOpnameSummary(){
    const rows = collectOpnameRows(false);
    setText('opnameSummary', rows.length ? `${rows.length} produk akan dicatat opname.` : 'Belum ada stok fisik yang diisi.');
  }

  function collectOpnameRows(strict){
    const rows = [];
    document.querySelectorAll('#tbodyOpname tr').forEach(tr => {
      const item = state.rows[Number(tr.dataset.index)];
      if (!item) return;
      const fisikVal = tr.querySelector('.input-fisik')?.value || '';
      if (fisikVal === '') return;
      const fisik = numberOf(fisikVal);
      if (strict && fisik < 0) throw new Error(`Stok fisik ${item.nama} tidak boleh minus.`);
      const selisih = fisik - numberOf(item.stokSisa);
      const alasan = (tr.querySelector('.input-alasan')?.value || '').trim();
      if (strict && Math.abs(selisih) > 0.0001 && !alasan) throw new Error(`Alasan wajib diisi untuk opname ${item.nama}.`);
      rows.push({ id:item.id, idItem:item.id, nama:item.nama, satuan:item.satuan, stokSistem:item.stokSisa, stokFisik:fisikVal, selisih, alasan });
    });
    return rows;
  }

  async function saveOpname(){
    const btn = document.getElementById('btnSaveOpname');
    try {
      const rows = collectOpnameRows(true);
      if (!rows.length) throw new Error('Isi minimal 1 stok fisik.');
      setButtonLoading(btn, 'Menyimpan...');
      const result = await callInventory('simpanProdukOutletOpname', {
        tanggal: document.getElementById('tanggalInput')?.value || '',
        outlet: document.getElementById('outletSelect')?.value || state.currentOutlet,
        petugas: localStorage.getItem('APJ_USER_NAME') || '',
        rows
      });
      if (!result.success) throw new Error(result.message || 'Gagal menyimpan opname outlet.');
      closeModal('modalOpname');
      showToast(result.message || 'Opname outlet berhasil disimpan.', 'success');
      await loadProdukOutlet();
    } catch (err) {
      showToast(err.message || 'Data belum valid.', 'error');
    } finally {
      resetButton(btn, 'Simpan Opname');
    }
  }

  function printProdukOutlet(){
    const outlet = state.currentOutlet || document.getElementById('outletSelect')?.value || '-';
    const tanggal = document.getElementById('tanggalInput')?.value || '';
    const rows = state.filtered.length ? state.filtered : state.rows;
    if (!rows.length) return showToast('Tidak ada data untuk dicetak.', 'error');

    const now = new Date();
    const docNo = `PO-${normalizeKey(outlet).replace(/_/g,'')}-${tanggal.replaceAll('-','')}-${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
    const totalAwal = rows.reduce((s,r)=>s+numberOf(r.stokKemarin),0);
    const totalMasuk = rows.reduce((s,r)=>s+numberOf(r.stokMasuk),0);
    const totalTerjual = rows.reduce((s,r)=>s+numberOf(r.stokTerjual),0);
    const totalAdj = rows.reduce((s,r)=>s+numberOf(r.selisihOpname),0);
    const totalAkhir = rows.reduce((s,r)=>s+numberOf(r.stokSisa),0);

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Rekap Produk Outlet 58mm</title><style>
      @page{size:58mm 297mm;margin:0!important}
      *{box-sizing:border-box}
      html,body{margin:0!important;padding:0!important;background:#fff!important;color:#000!important;width:58mm!important;min-width:58mm!important;min-height:30mm!important;height:auto!important;overflow:visible!important}
      body{font-family:Arial,Helvetica,sans-serif;font-size:12.4px;line-height:1.25;font-weight:500;-webkit-print-color-adjust:exact;print-color-adjust:exact;text-rendering:geometricPrecision}
      .wrap{width:56mm;max-width:56mm;margin:0 auto;padding:2.4mm 1.3mm 4mm 1.3mm;background:#fff;break-inside:auto;page-break-inside:auto}
      .center{text-align:center}.right{text-align:right}.muted{font-size:10.5px;color:#222}.bold{font-weight:700}
      .brand{font-size:16px;font-weight:900;letter-spacing:.02em;margin:0;text-transform:uppercase;line-height:1.08}
      .title{font-size:13.5px;font-weight:900;margin-top:1mm;text-transform:uppercase;line-height:1.1}
      .dash{border-top:1.6px dashed #000;margin:2mm 0}
      .meta{display:grid;grid-template-columns:17mm 1fr;gap:.65mm 1mm;margin-top:1mm;font-size:12px;line-height:1.22}.meta div:nth-child(odd){font-weight:800}.meta div{word-break:break-word;overflow-wrap:anywhere}
      .legend{font-size:11px;font-weight:900;text-transform:uppercase;border-bottom:1.4px solid #000;padding-bottom:1mm;margin-top:1mm}
      .row{border-bottom:1.3px dashed #777;padding:1.7mm 0;break-inside:avoid;page-break-inside:avoid}
      .row-main{display:grid;grid-template-columns:5mm 1fr 12mm;gap:.8mm;align-items:start}
      .no{font-size:11.5px;font-weight:900}.name{font-size:13.6px;font-weight:900;line-height:1.15;word-break:break-word;overflow-wrap:anywhere}.unit{font-size:10.4px;font-weight:600;color:#222;margin-top:.35mm}
      .final{text-align:right;font-size:13px;font-weight:900;white-space:nowrap}.final-label{display:block;font-size:8.6px;font-weight:900;text-transform:uppercase;margin-bottom:.3mm}
      .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:.7mm;margin-top:1.3mm}.stat{border:1.1px solid #999;border-radius:.8mm;padding:.7mm .4mm;text-align:center;min-height:7.7mm}.stat-label{font-size:8.1px;font-weight:900;text-transform:uppercase;line-height:1.05}.stat-val{font-size:11.2px;font-weight:800;margin-top:.4mm;line-height:1.05;white-space:nowrap}
      .total-box{border:1.4px solid #000;border-radius:1mm;padding:1.2mm;margin-top:1.6mm;font-size:11.4px;line-height:1.35}.total-box div{display:flex;justify-content:space-between;gap:1mm}.footer{margin-top:2mm;font-size:10.5px;line-height:1.25}
      @media print{@page{size:58mm 297mm;margin:0!important}html,body{width:58mm!important;min-width:58mm!important;height:auto!important;min-height:30mm!important;overflow:visible!important}.wrap{width:56mm!important;max-width:56mm!important}.row{break-inside:avoid;page-break-inside:avoid}.no-print{display:none!important}body:after{content:"";display:block;height:2mm}}
    </style></head><body><div class="wrap">
      <div class="center"><p class="brand">AMPERA PAK JENGGOT</p><div class="title">Rekap Produk Outlet</div></div>
      <div class="dash"></div>
      <div class="meta">
        <div>No</div><div>: ${esc(docNo)}</div>
        <div>Tanggal</div><div>: ${esc(formatDateId(tanggal))}</div>
        <div>Outlet</div><div>: ${esc(outlet)}</div>
        <div>Petugas</div><div>: ${esc(localStorage.getItem('APJ_USER_NAME') || '-')}</div>
      </div>
      <div class="dash"></div>
      <div class="legend">Daftar Produk</div>
      ${rows.map((r,i)=>`<div class="row">
        <div class="row-main">
          <div class="no">${i+1}</div>
          <div class="name">${esc(r.nama)}<div class="unit">${esc(r.satuan || '-')}</div></div>
          <div class="final"><span class="final-label">Akhir</span>${fmt(r.stokSisa)}</div>
        </div>
        <div class="stats">
          <div class="stat"><div class="stat-label">Awal</div><div class="stat-val">${fmt(r.stokKemarin)}</div></div>
          <div class="stat"><div class="stat-label">Masuk</div><div class="stat-val">${fmt(r.stokMasuk)}</div></div>
          <div class="stat"><div class="stat-label">Jual</div><div class="stat-val">${fmt(r.stokTerjual)}</div></div>
          <div class="stat"><div class="stat-label">Kor</div><div class="stat-val">${fmt(r.selisihOpname)}</div></div>
        </div>
      </div>`).join('')}
      <div class="dash"></div>
      <div class="total-box">
        <div><span>Total Awal</span><b>${fmt(totalAwal)}</b></div>
        <div><span>Total Masuk</span><b>${fmt(totalMasuk)}</b></div>
        <div><span>Total Terjual</span><b>${fmt(totalTerjual)}</b></div>
        <div><span>Total Koreksi</span><b>${fmt(totalAdj)}</b></div>
        <div><span>Total Akhir</span><b>${fmt(totalAkhir)}</b></div>
      </div>
      <div class="dash"></div>
      <div class="footer center">Dicetak : ${esc(now.toLocaleString('id-ID'))}</div>
    </div></body></html>`;
    // V99: layout rekap dibuat besar dan bertingkat agar terbaca di thermal 58mm; tetap memakai popup print dari V98.
    printHtml58Roll(html, null, 'Cetak Rekap Produk Outlet 58mm');
  }

  function openModal(id){
    const modal = document.getElementById(id);
    if (!modal) return;
    const overlay = modal.querySelector('.modal-overlay');
    const content = modal.querySelector('.modal-content');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    void modal.offsetWidth;
    overlay && overlay.classList.remove('opacity-0');
    overlay && overlay.classList.add('opacity-100');
    content && content.classList.remove('opacity-0','scale-95');
    content && content.classList.add('opacity-100','scale-100');
  }

  function closeModal(id){
    const modal = document.getElementById(id);
    if (!modal) return;
    const overlay = modal.querySelector('.modal-overlay');
    const content = modal.querySelector('.modal-content');
    overlay && overlay.classList.add('opacity-0');
    overlay && overlay.classList.remove('opacity-100');
    content && content.classList.add('opacity-0','scale-95');
    content && content.classList.remove('opacity-100','scale-100');
    setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 200);
  }

  function openProdukHelpModal(autoOpen){
    const modal = document.getElementById('produkHelpModal');
    if (!modal) return;
    if (autoOpen) sessionStorage.setItem('APJ_PRODUK_OUTLET_HELP_SEEN_V81','1');
    openModal('produkHelpModal');
  }

  function closeProdukHelpModal(){ closeModal('produkHelpModal'); }

  function showToast(message, type){
    const toast = document.getElementById('customToast');
    const msg = document.getElementById('toastMessage');
    if (!toast || !msg) return alert(message);
    msg.textContent = message || '';
    const isError = type === 'error' || type === 'warning';
    toast.className = `toast show flex items-center w-full max-w-md p-4 rounded-2xl shadow-xl border backdrop-blur-xl ${isError ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`;
    const title = toast.querySelector('p.text-sm.font-extrabold');
    if (title) title.className = `text-sm font-extrabold ${isError ? 'text-rose-900' : 'text-emerald-900'}`;
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => toast.classList.remove('show'), 4200);
  }

  function bindSidebar(){
    document.querySelectorAll('[data-menu-toggle]').forEach(btn => {
      if (btn.dataset.apjSidebarBound === '1') return;
      btn.dataset.apjSidebarBound = '1';
      btn.addEventListener('click', ev => {
        ev.preventDefault();
        ev.stopPropagation();
        const group = btn.closest('.nav-group') || document.querySelector(`[data-menu-group="${btn.getAttribute('data-menu-toggle')}"]`);
        if (!group) return;
        const isOpen = group.classList.toggle('open');
        btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });
    });

    const collapseBtn = document.querySelector('[data-sidebar-collapse]');
    if (collapseBtn && collapseBtn.dataset.apjSidebarBound !== '1') {
      collapseBtn.dataset.apjSidebarBound = '1';
      collapseBtn.addEventListener('click', ev => {
        ev.preventDefault();
        const sidebar = document.getElementById('sidebar');
        if (!sidebar || window.innerWidth < 1024) return;
        const collapsed = !sidebar.classList.contains('sidebar-collapsed');
        sidebar.classList.toggle('sidebar-collapsed', collapsed);
        document.body.classList.toggle('sidebar-collapsed-active', collapsed);
        try { localStorage.setItem('APJ_SIDEBAR_COLLAPSED', collapsed ? '1' : '0'); } catch (err) {}
      });
    }

    document.querySelectorAll('.nav-coming-soon').forEach(link => {
      if (link.dataset.apjSidebarBound === '1') return;
      link.dataset.apjSidebarBound = '1';
      link.addEventListener('click', ev => {
        ev.preventDefault();
        const name = link.getAttribute('data-coming-soon-menu') || link.textContent.trim() || 'Menu ini';
        showToast(`${name} segera hadir.`, 'warning');
      });
    });

    document.querySelectorAll('#sidebar a[href]:not(.nav-coming-soon)').forEach(link => {
      if (link.dataset.apjLinkBound === '1') return;
      link.dataset.apjLinkBound = '1';
      link.addEventListener('click', event => {
        const href = String(link.getAttribute('href') || '');
        if (link.classList.contains('active') || /(^|\/)produk-outlet\.html(?:$|[?#])/i.test(href)) {
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

  function toggleSidebarCollapse(){
    const sidebar = document.getElementById('sidebar');
    if (!sidebar || window.innerWidth < 1024) return;
    const collapsed = !sidebar.classList.contains('sidebar-collapsed');
    sidebar.classList.toggle('sidebar-collapsed', collapsed);
    document.body.classList.toggle('sidebar-collapsed-active', collapsed);
    try { localStorage.setItem('APJ_SIDEBAR_COLLAPSED', collapsed ? '1' : '0'); } catch (err) {}
  }
  function openMobileSidebar(){ document.getElementById('sidebar')?.classList.remove('-translate-x-full'); document.getElementById('sidebarBackdrop')?.classList.remove('hidden'); }
  function closeMobileSidebar(){ document.getElementById('sidebar')?.classList.add('-translate-x-full'); document.getElementById('sidebarBackdrop')?.classList.add('hidden'); }
  function showLogoutModal(){ openModal('logoutModal'); }
  function closeLogoutModal(){ closeModal('logoutModal'); }
  function executeLogout(){ ['APJ_SESSION_ACTIVE','APJ_SESSION_TOKEN','APJ_USER_NAME','APJ_USER_LEVEL','APJ_USER_OUTLET','APJ_USER_DATA','APJ_MODULE_ACCESS','APJ_USER_PERMISSIONS'].forEach(k=>localStorage.removeItem(k)); window.location.href='index.html'; }

  function setButtonLoading(btn, text){ if (!btn) return; btn.dataset.oldText = btn.textContent; btn.disabled = true; btn.textContent = text; }
  function resetButton(btn, text){ if (!btn) return; btn.disabled = false; btn.textContent = text || btn.dataset.oldText || btn.textContent; }
  function setText(id, value){ const el = document.getElementById(id); if (el) el.textContent = value == null ? '' : String(value); }
  function setValue(id, value){ const el = document.getElementById(id); if (el) el.value = value == null ? '' : String(value); }
  function numberOf(v){ if (typeof v === 'number') return Number.isFinite(v) ? v : 0; const raw = String(v ?? '').trim().replace(/\s/g,''); if (!raw) return 0; const comma = raw.lastIndexOf(','); const dot = raw.lastIndexOf('.'); let s = raw; if (comma !== -1 && dot !== -1) s = comma > dot ? raw.replace(/\./g,'').replace(',','.') : raw.replace(/,/g,''); else if (comma !== -1) s = raw.replace(',','.'); else if ((raw.match(/\./g)||[]).length > 1) s = raw.replace(/\./g,''); const n = parseFloat(s); return Number.isFinite(n) ? n : 0; }
  function fmt(v){ return numberOf(v).toLocaleString('id-ID', { maximumFractionDigits: 2 }); }
  function escAttr(v){ return String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/'/g,'&#39;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function esc(v){ return String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function normalizeKey(v){ return String(v || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,''); }
  function formatDateId(value){ const p = String(value || '').split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : (value || '-'); }
  function formatLongDateId(value){ if (!value) return ''; const p = String(value).split('-').map(Number); if (p.length !== 3 || !p[0]) return value || ''; const d = new Date(p[0], p[1]-1, p[2]); return d.toLocaleDateString('id-ID', { weekday:'long', day:'2-digit', month:'long', year:'numeric' }); }
  function getRupiahNumber(v){
    const digits = String(v == null ? '' : v).replace(/[^0-9]/g, '');
    return digits ? Number(digits) : '';
  }
  function formatPesananRupiahInput(el){
    if (!el) return;
    const digits = String(el.value || '').replace(/[^0-9]/g, '');
    el.value = digits ? 'Rp. ' + Number(digits).toLocaleString('id-ID', { maximumFractionDigits: 0 }) : '';
  }
  function formatRupiahPlain(v){ return numberOf(v).toLocaleString('id-ID', { maximumFractionDigits: 0 }); }
  function getInitial(name){ return String(name || 'U').trim().split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase() || 'U'; }
  function delay(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }

  window.loadProdukOutlet = loadProdukOutlet;
  window.renderTable = renderTable;
  window.openPesananModal = openPesananModal;
  window.openPrintPesananModal = openPrintPesananModal;
  window.loadPesananPrintList = loadPesananPrintList;
  window.printSavedPesanan = printSavedPesanan;
  window.addPesananGroup = addPesananGroup;
  window.removePesananGroup = removePesananGroup;
  window.addLaukRow = addLaukRow;
  window.removeLaukRow = removeLaukRow;
  window.syncKemasanPesanan = syncKemasanPesanan;
  window.updatePesananSummary = updatePesananSummary;
  window.togglePesananBank = togglePesananBank;
  window.togglePesananAlamat = togglePesananAlamat;
  window.updateTanggalPesananLabel = updateTanggalPesananLabel;
  window.syncPesananProducts = syncPesananProducts;
  window.savePesananOutlet = savePesananOutlet;
  window.printPesananOutlet = printPesananOutlet;
  window.formatPesananRupiahInput = formatPesananRupiahInput;
  window.openTerjualModal = openTerjualModal;
  window.updateTerjualSummary = updateTerjualSummary;
  window.saveTerjual = saveTerjual;
  window.openGorengModal = openGorengModal;
  window.saveGorengOutlet = saveGorengOutlet;
  window.openOpnameModal = openOpnameModal;
  window.updateOpnameRow = updateOpnameRow;
  window.updateOpnameSummary = updateOpnameSummary;
  window.saveOpname = saveOpname;
  window.printProdukOutlet = printProdukOutlet;
  window.openModal = openModal;
  window.closeModal = closeModal;
  window.openProdukHelpModal = openProdukHelpModal;
  window.closeProdukHelpModal = closeProdukHelpModal;
  window.showToast = showToast;
  window.toggleSidebarCollapse = toggleSidebarCollapse;
  window.openMobileSidebar = openMobileSidebar;
  window.closeMobileSidebar = closeMobileSidebar;
  window.showLogoutModal = showLogoutModal;
  window.closeLogoutModal = closeLogoutModal;
  window.executeLogout = executeLogout;
})();
