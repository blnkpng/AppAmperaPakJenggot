/* APJ RIWAYAT INVENTORY V109 */
(function(){
  'use strict';
  const CONFIG = window.APJ_CONFIG || {};
  const API_URL = CONFIG.inventoryApiUrl || (CONFIG.apis && CONFIG.apis.inventory) || 'https://script.google.com/macros/s/AKfycbzisWWG4QzlI2_xB9arSGLAx0zn3Rgcu_Jt9tFXpJZTcXohFXwmE0sDTGCxf-i2OL0k/exec';
  const STORAGE = CONFIG.storage || {};
  const K = { active: STORAGE.active || 'APJ_SESSION_ACTIVE', token: STORAGE.token || 'APJ_SESSION_TOKEN', name: STORAGE.name || 'APJ_USER_NAME', level: STORAGE.level || 'APJ_USER_LEVEL', permissions: STORAGE.permissions || 'APJ_USER_PERMISSIONS' };
  const STATE = { rows: [], rawRows: [], loading:false };
  document.addEventListener('DOMContentLoaded', initPage);

  async function initPage(){
    if (localStorage.getItem(K.active) !== 'true' || !getToken()) { window.location.href = CONFIG.loginPage || 'index.html'; return; }
    initUserHeader(); initSidebar(); initEvents(); setDefaultDates(); initModalEsc();
    setTimeout(function(){ if (sessionStorage.getItem('APJ_RIWAYAT_HELP_SEEN_V109') !== 'true') openRiwayatHelpModal(true); }, 450);
    await loadRiwayat();
  }
  function initUserHeader(){ const nama=localStorage.getItem(K.name)||localStorage.getItem('APJ_USER_USERNAME')||'Pengguna'; const level=localStorage.getItem(K.level)||'-'; setText('displayNama',nama); setText('displayLevel',level); setText('displayInisial',makeInitial(nama)); }
  function initEvents(){
    on('btnLoad','click',loadRiwayat); on('btnRefresh','click',loadRiwayat); on('btnReset','click',resetFilters); on('btnExportCsv','click',exportCsv); on('btnPrint','click',printRekap);
    ['arahSelect','lokasiInput'].forEach(id=>{ const el=document.getElementById(id); if(el) el.addEventListener(id==='lokasiInput'?'input':'change', debounce(applyLocalFilter, 160)); });
    ['tanggalDari','tanggalSampai','jenisSelect','keywordInput','limitSelect'].forEach(id=>{ const el=document.getElementById(id); if(el) el.addEventListener(id==='keywordInput'?'keydown':'change', function(e){ if(id!=='keywordInput' || e.key==='Enter') loadRiwayat(); }); });
  }
  function setDefaultDates(){ const today=new Date(); const start=new Date(today.getFullYear(), today.getMonth(), 1); val('tanggalDari', toDateInput(start)); val('tanggalSampai', toDateInput(today)); }
  async function loadRiwayat(){
    const dari=val('tanggalDari'), sampai=val('tanggalSampai');
    if(dari && sampai && dari>sampai){ showToast('Tanggal Dari tidak boleh lebih besar dari Tanggal Sampai.','error'); return; }
    setLoading(true); setTableLoading('Menarik data JURNAL_STOK...');
    try{
      const payload = { tanggalDari:dari, tanggalSampai:sampai, jenis:val('jenisSelect'), keyword:val('keywordInput').trim(), limit:parseInt(val('limitSelect')||1500,10), sessionToken:getToken(), userName:localStorage.getItem(K.name)||'', level:localStorage.getItem(K.level)||'', permissions:safeJson(localStorage.getItem(K.permissions)||'{}',{}) };
      const result = await callInventory('getRiwayatTransaksi', payload);
      if(!isSuccess(result)) throw new Error(result && result.message || 'Gagal memuat riwayat inventory.');
      const data = ensureArray(result.data || (result.result && result.result.data));
      STATE.rawRows = data; applyLocalFilter(false); renderBadges(); showToast('Riwayat inventory dimuat.','success');
    }catch(err){ STATE.rawRows=[]; STATE.rows=[]; renderSummary(); renderBadges(); setEmpty(err.message || 'Koneksi gagal.'); showToast(err.message || 'Koneksi gagal.','error'); }
    finally{ setLoading(false); }
  }
  function applyLocalFilter(show){
    const arah=norm(val('arahSelect')); const lokasi=norm(val('lokasiInput'));
    STATE.rows = STATE.rawRows.filter(function(r){
      if(arah && norm(r.arah)!==arah) return false;
      if(lokasi){ const hay=[r.lokasi,r.outlet,r.kategori,r.tujuan].join(' ').toLowerCase(); if(hay.indexOf(lokasi.toLowerCase())===-1) return false; }
      return true;
    });
    renderSummary(); renderTable(); if(show!==false) showToast('Filter lokal diterapkan.','info',1700);
  }
  function renderSummary(){
    const rows=STATE.rows||[]; const uniqueTx={}, uniquePetugas={}; let masuk=0, keluar=0, adjust=0;
    rows.forEach(r=>{ if(first(r.txId,r.noDokumen,r.refId)) uniqueTx[first(r.txId,r.noDokumen,r.refId)]=true; if(r.petugas) uniquePetugas[r.petugas]=true; masuk+=num(r.qtyMasuk); keluar+=num(r.qtyKeluar); adjust+=num(r.qtyAdjust); });
    setText('cardRows', fmt(rows.length)); setText('cardTx', fmt(Object.keys(uniqueTx).length)); setText('cardMasuk', fmt(masuk)); setText('cardKeluar', fmt(keluar)); setText('cardAdjust', fmt(adjust)); setText('cardPetugas', fmt(Object.keys(uniquePetugas).length));
    setText('tableInfo', fmt(rows.length)+' baris tampil dari '+fmt((STATE.rawRows||[]).length)+' baris hasil API.');
  }
  function renderBadges(){
    const count={Input:0,Output:0,Preparasi:0,Produksi:0,Transfer:0,Opname:0};
    (STATE.rows||[]).forEach(r=>{ const j=jenisOf(r); if(count[j]!==undefined) count[j]++; });
    const el=document.getElementById('jenisBadges'); if(!el) return;
    el.innerHTML=Object.keys(count).map(k=>'<span>'+escapeHtml(k)+': '+fmt(count[k])+'</span>').join('');
  }
  function renderTable(){
    const tbody=document.getElementById('tbodyRiwayat'); if(!tbody) return;
    const rows=STATE.rows||[]; if(!rows.length) return setEmpty('Tidak ada transaksi pada filter ini.');
    tbody.innerHTML = rows.map((r,i)=>{
      const arah=norm(r.arah); const jenis=jenisOf(r); const dok=first(r.txId,r.noDokumen,r.refId,'-'); const id=first(r.idBarang,r.idItem,''); const nama=first(r.namaBarang,r.namaItem,r.nama,'-');
      const lokasi=[first(r.lokasi,''), first(r.outlet,'')].filter(Boolean).join(' / ') || '-';
      return '<tr>'+td(i+1,'center')+td(formatDateTime(first(r.timestamp,r.tanggal,'')))+td('<span class="'+jenisClass(jenis)+'">'+escapeHtml(jenis)+'</span>')+td('<span class="pill '+arahClass(arah)+'">'+escapeHtml(arah||'-')+'</span>')+td('<b>'+escapeHtml(dok)+'</b>')+td('<div class="item-title">'+escapeHtml(nama)+'</div><div class="item-sub">'+escapeHtml(id||'-')+' · '+escapeHtml(first(r.satuan,'-'))+'</div>')+td(escapeHtml(first(r.kategori,'-')))+td('<span class="qty-in">'+fmt(num(r.qtyMasuk)||'')+'</span>','right')+td('<span class="qty-out">'+fmt(num(r.qtyKeluar)||'')+'</span>','right')+td('<span class="qty-adj">'+fmt(num(r.qtyAdjust)||'')+'</span>','right')+td(escapeHtml(lokasi))+td(escapeHtml(first(r.petugas,'-')))+td(escapeHtml(first(r.keterangan,r.detail,r.catatan,'-')))+'</tr>';
    }).join('');
  }
  function setTableLoading(msg){ const t=document.getElementById('tbodyRiwayat'); if(t) t.innerHTML='<tr><td colspan="13" class="empty-cell">'+escapeHtml(msg||'Memuat...')+'</td></tr>'; }
  function setEmpty(msg){ const t=document.getElementById('tbodyRiwayat'); if(t) t.innerHTML='<tr><td colspan="13" class="empty-cell">'+escapeHtml(msg||'Tidak ada data.')+'</td></tr>'; }
  function td(html,align){ return '<td'+(align?' style="text-align:'+align+'"':'')+'>'+html+'</td>'; }
  function resetFilters(){ setDefaultDates(); val('jenisSelect',''); val('arahSelect',''); val('lokasiInput',''); val('keywordInput',''); val('limitSelect','1500'); loadRiwayat(); }
  function exportCsv(){
    const rows=STATE.rows||[]; if(!rows.length){ showToast('Belum ada data untuk diexport.','warning'); return; }
    const headers=['No','Timestamp','Tanggal','Jenis','Modul','Arah','No Dokumen','ID Item','Nama Item','Kategori','Qty Masuk','Qty Keluar','Qty Adjust','Satuan','Lokasi','Outlet','Petugas','Keterangan','Ref ID','Batch'];
    const body=rows.map((r,i)=>[i+1,first(r.timestamp,''),first(r.tanggal,''),jenisOf(r),first(r.modul,''),first(r.arah,''),first(r.txId,''),first(r.idBarang,''),first(r.namaBarang,''),first(r.kategori,''),num(r.qtyMasuk),num(r.qtyKeluar),num(r.qtyAdjust),first(r.satuan,''),first(r.lokasi,''),first(r.outlet,''),first(r.petugas,''),first(r.keterangan,''),first(r.refId,''),first(r.batchId,'')]);
    const csv=[headers].concat(body).map(row=>row.map(csvCell).join(',')).join('\n');
    const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='riwayat-inventory-'+toDateInput(new Date())+'.csv'; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove();},800); showToast('CSV riwayat dibuat.','success');
  }
  function printRekap(){
    const rows=STATE.rows||[]; if(!rows.length){ showToast('Belum ada data untuk dicetak.','warning'); return; }
    const periode=(val('tanggalDari')||'-')+' s/d '+(val('tanggalSampai')||'-');
    const table=rows.slice(0,800).map((r,i)=>'<tr><td>'+ (i+1) +'</td><td>'+escapeHtml(formatDateTime(first(r.timestamp,r.tanggal,'')))+'</td><td>'+escapeHtml(jenisOf(r))+'</td><td>'+escapeHtml(first(r.arah,''))+'</td><td>'+escapeHtml(first(r.txId,''))+'</td><td>'+escapeHtml(first(r.namaBarang,''))+'</td><td class="num">'+fmt(num(r.qtyMasuk))+'</td><td class="num">'+fmt(num(r.qtyKeluar))+'</td><td class="num">'+fmt(num(r.qtyAdjust))+'</td><td>'+escapeHtml(first(r.petugas,''))+'</td></tr>').join('');
    const html='<!DOCTYPE html><html><head><title>Riwayat Inventory</title><style>@page{size:A4 landscape;margin:12mm}body{font-family:Arial,sans-serif;color:#111;font-size:10px}h1{font-size:18px;margin:0}p{margin:3px 0 10px;color:#444}.meta{display:flex;justify-content:space-between;margin:8px 0 12px}.box{border:1px solid #111;padding:8px;border-radius:6px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #999;padding:4px;vertical-align:top}th{background:#eee}.num{text-align:right}.small{font-size:9px;color:#555}</style></head><body><h1>AMPERA PAK JENGGOT - RIWAYAT INVENTORY</h1><p>Periode: '+escapeHtml(periode)+' · Dicetak: '+escapeHtml(new Date().toLocaleString('id-ID'))+'</p><div class="meta"><div class="box">Total Baris: <b>'+fmt(rows.length)+'</b></div><div class="box">Qty Masuk: <b>'+document.getElementById('cardMasuk').textContent+'</b></div><div class="box">Qty Keluar: <b>'+document.getElementById('cardKeluar').textContent+'</b></div><div class="box">Adjust: <b>'+document.getElementById('cardAdjust').textContent+'</b></div></div><table><thead><tr><th>No</th><th>Waktu</th><th>Jenis</th><th>Arah</th><th>Dokumen</th><th>Item</th><th>Masuk</th><th>Keluar</th><th>Adjust</th><th>Petugas</th></tr></thead><tbody>'+table+'</tbody></table><p class="small">Catatan: maksimal 800 baris pertama dicetak agar halaman tetap aman. Gunakan Export CSV untuk arsip penuh.</p><script>window.onload=function(){setTimeout(function(){window.print();},300)}<\/script></body></html>';
    const w=window.open('','_blank','width=1200,height=800'); if(!w){ showToast('Popup print diblokir browser.','error'); return; } w.document.open(); w.document.write(html); w.document.close();
  }
  async function callInventory(action,payload){ const res=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},redirect:'follow',body:JSON.stringify(Object.assign({},payload||{},{action:action}))}); const txt=await res.text(); try{return JSON.parse(txt)}catch(e){throw new Error('Respons API bukan JSON valid: '+txt.slice(0,180));} }
  function setLoading(v){ STATE.loading=!!v; const b=document.getElementById('btnLoad'); if(b){b.disabled=!!v; b.textContent=v?'Memuat...':'Muat Riwayat';} ['btnRefresh','btnExportCsv','btnPrint'].forEach(id=>{const el=document.getElementById(id); if(el) el.disabled=!!v;}); }
  function jenisOf(r){ const j=String(first(r.jenis,r.modul,'')).toLowerCase(); if(j.includes('input')) return 'Input'; if(j.includes('preparasi')) return 'Preparasi'; if(j.includes('produksi')) return 'Produksi'; if(j.includes('transfer')) return 'Transfer'; if(j.includes('opname')) return 'Opname'; if(j.includes('output')) return 'Output'; return first(r.jenis,'Output'); }
  function jenisClass(j){ return 'font-black jenis-'+String(j||'').toLowerCase().replace(/\s+/g,'-'); } function arahClass(a){ a=norm(a); return a==='IN'?'in':(a==='OUT'?'out':(a==='ADJ'?'adj':'')); }
  function openMobileSidebar(){ const s=document.getElementById('sidebar'), b=document.getElementById('sidebarBackdrop'); if(s) s.classList.remove('-translate-x-full'); if(b) b.classList.remove('hidden'); }
  function closeMobileSidebar(){ const s=document.getElementById('sidebar'), b=document.getElementById('sidebarBackdrop'); if(s) s.classList.add('-translate-x-full'); if(b) b.classList.add('hidden'); }
  function initSidebar(){ document.querySelectorAll('#dashboardSidebarMenu [data-menu-toggle]').forEach(btn=>btn.addEventListener('click',function(){ const group=btn.closest('.nav-group'); const isOpen=group && group.classList.contains('open'); if(group){ group.classList.toggle('open',!isOpen); btn.setAttribute('aria-expanded',String(!isOpen)); }})); document.querySelectorAll('#sidebar a').forEach(a=>a.addEventListener('click',closeMobileSidebar)); }
  function showLogoutModal(){ showModal('logoutModal'); } function closeLogoutModal(){ hideModal('logoutModal'); } function executeLogout(){ localStorage.clear(); window.location.href=CONFIG.loginPage||'index.html'; }
  function openRiwayatHelpModal(auto){ if(auto) sessionStorage.setItem('APJ_RIWAYAT_HELP_SEEN_V109','true'); showModal('riwayatHelpModal'); } function closeRiwayatHelpModal(){ hideModal('riwayatHelpModal'); }
  function showModal(id){ const m=document.getElementById(id); if(!m) return; m.classList.remove('hidden'); setTimeout(()=>{m.querySelectorAll('.modal-overlay').forEach(e=>e.classList.remove('opacity-0')); m.querySelectorAll('.modal-content').forEach(e=>{e.classList.remove('opacity-0','scale-95'); e.classList.add('opacity-100','scale-100');});},10); }
  function hideModal(id){ const m=document.getElementById(id); if(!m) return; m.querySelectorAll('.modal-overlay').forEach(e=>e.classList.add('opacity-0')); m.querySelectorAll('.modal-content').forEach(e=>{e.classList.add('opacity-0','scale-95'); e.classList.remove('opacity-100','scale-100');}); setTimeout(()=>m.classList.add('hidden'),160); }
  function initModalEsc(){ document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ closeRiwayatHelpModal(); closeLogoutModal(); }}); }
  function showToast(message,type,duration){ const toast=document.getElementById('customToast'); const msg=document.getElementById('toastMessage'); if(!toast||!msg) return; msg.textContent=message||'-'; toast.classList.remove('show','success','error','warning','info'); toast.classList.add('show',type||'info'); clearTimeout(window.__toastTimer); window.__toastTimer=setTimeout(()=>toast.classList.remove('show'),duration||3600); }
  function isSuccess(r){ return !!(r && (r.success===true || r.status==='success' || r.ok===true || r.data)); } function ensureArray(v){ return Array.isArray(v)?v:(v&&Array.isArray(v.rows)?v.rows:[]); } function safeJson(s,f){ try{return JSON.parse(s)}catch(e){return f} } function getToken(){ return localStorage.getItem(K.token)||''; } function norm(v){ return String(v||'').trim().toUpperCase(); } function first(){ for(let i=0;i<arguments.length;i++){ const v=arguments[i]; if(v===0) return 0; if(v!==null && typeof v!=='undefined' && String(v).trim()!=='') return v; } return ''; } function num(v){ const n=parseFloat(String(v||0).replace(/,/g,'.')); return isFinite(n)?n:0; } function fmt(v){ if(v===''||v===null||typeof v==='undefined') return ''; const n=num(v); return new Intl.NumberFormat('id-ID',{maximumFractionDigits:2}).format(n); } function val(id,v){ const el=document.getElementById(id); if(!el) return ''; if(arguments.length>1){ el.value=v; return v; } return el.value||''; } function setText(id,t){ const el=document.getElementById(id); if(el) el.textContent=t; } function on(id,evt,fn){ const el=document.getElementById(id); if(el) el.addEventListener(evt,fn); } function makeInitial(n){ return String(n||'AP').split(/\s+/).filter(Boolean).slice(0,2).map(s=>s[0].toUpperCase()).join('')||'AP'; } function toDateInput(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); } function formatDateTime(v){ if(!v) return '-'; const d=new Date(v); if(!isNaN(d.getTime())) return d.toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); return String(v); } function escapeHtml(s){ return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); } function csvCell(v){ return '"'+String(v==null?'':v).replace(/"/g,'""')+'"'; } function debounce(fn,ms){ let t; return function(){ clearTimeout(t); const args=arguments; t=setTimeout(()=>fn.apply(null,args),ms||160); }; }
  window.openMobileSidebar=openMobileSidebar; window.closeMobileSidebar=closeMobileSidebar; window.showLogoutModal=showLogoutModal; window.closeLogoutModal=closeLogoutModal; window.executeLogout=executeLogout; window.openRiwayatHelpModal=openRiwayatHelpModal; window.closeRiwayatHelpModal=closeRiwayatHelpModal;
})();
