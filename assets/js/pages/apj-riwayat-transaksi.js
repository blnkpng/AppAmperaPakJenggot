/* Extracted from riwayat-inventory.html inline script 1 */
const APPS_SCRIPT_URL = (window.APJ_CONFIG && (window.APJ_CONFIG.inventoryApiUrl || (window.APJ_CONFIG.apis && window.APJ_CONFIG.apis.inventory))) || "https://script.google.com/macros/s/AKfycbx3sNyaAR5b1MZjpjzuCuyeYuVi-bL0k1Nb1MgI40l5kQmSWfmxXCSfTpBy7sQ-0oQ/exec";
    let currentRows = [];

    document.addEventListener('DOMContentLoaded', () => {
      if (localStorage.getItem('APJ_SESSION_ACTIVE') !== 'true' || !localStorage.getItem('APJ_SESSION_TOKEN')) { window.location.href = 'index.html'; return; }
      document.getElementById('namaPetugas').textContent = localStorage.getItem('APJ_USER_NAME') || '-';
      document.querySelectorAll('#sidebar a').forEach(link => link.addEventListener('click', closeMobileSidebar));
      setDefaultDates();
      loadRiwayat();
    });

    function setDefaultDates() {
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      document.getElementById('tanggalDari').value = toDateInput(start);
      document.getElementById('tanggalSampai').value = toDateInput(today);
    }

    function toDateInput(date) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    async function loadRiwayat() {
      const btn = document.getElementById('btnLoad');
      const tbody = document.getElementById('tbodyRiwayat');
      const tanggalDari = document.getElementById('tanggalDari').value;
      const tanggalSampai = document.getElementById('tanggalSampai').value;
      if (tanggalDari && tanggalSampai && tanggalDari > tanggalSampai) {
        showToast('Tanggal Dari tidak boleh lebih besar dari Tanggal Sampai.', 'error');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Memuat...';
      tbody.innerHTML = '<tr><td colspan="11" class="p-8 text-center text-slate-500 animate-pulse">Menarik riwayat transaksi dari database...</td></tr>';

      try {
        const response = await fetch(APPS_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          redirect: 'follow',
          body: JSON.stringify({
            action: 'getRiwayatTransaksi',
            sessionToken: localStorage.getItem('APJ_SESSION_TOKEN') || '',
            userName: localStorage.getItem('APJ_USER_NAME') || '',
            level: localStorage.getItem('APJ_USER_LEVEL') || '',
            permissions: safeParseJSON(localStorage.getItem('APJ_USER_PERMISSIONS') || '{}'),
            tanggalDari,
            tanggalSampai,
            jenis: document.getElementById('jenisSelect').value,
            keyword: document.getElementById('keywordInput').value.trim(),
            limit: 1500
          })
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.message || 'Gagal memuat riwayat.');
        currentRows = result.data || [];
        renderSummary(result.summary || {}, result);
        renderTable();
        showToast('Riwayat transaksi berhasil dimuat.', 'success');
      } catch (error) {
        currentRows = [];
        renderSummary({}, {});
        tbody.innerHTML = `<tr><td colspan="11" class="p-8 text-center text-rose-500">${escapeHtml(error.message || 'Koneksi gagal.')}</td></tr>`;
        showToast(error.message || 'Koneksi gagal.', 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Muat';
      }
    }

    function buildRiwayatSummary(rows) {
      const uniqueTx = {};
      const uniquePetugas = {};
      const byJenis = {};
      let totalQty = 0;
      (rows || []).forEach(r => {
        if (r.txId) uniqueTx[r.txId] = true;
        if (r.petugas) uniquePetugas[r.petugas] = true;
        const jenis = r.jenis || '-';
        byJenis[jenis] = (byJenis[jenis] || 0) + 1;
        totalQty += parseNumber(getRiwayatQty(r));
      });
      return {
        totalRows: (rows || []).length,
        uniqueTransaksi: Object.keys(uniqueTx).length,
        totalPetugas: Object.keys(uniquePetugas).length,
        totalQty,
        byJenis
      };
    }

    function renderSummary(summary, result) {
      const hasSummary = summary && Object.keys(summary).length;
      if (!hasSummary) summary = buildRiwayatSummary(currentRows);
      document.getElementById('cardRows').textContent = formatNumber(summary.totalRows || 0);
      document.getElementById('cardTx').textContent = formatNumber(summary.uniqueTransaksi || 0);
      document.getElementById('cardPetugas').textContent = formatNumber(summary.totalPetugas || 0);
      document.getElementById('cardQty').textContent = formatNumber(summary.totalQty || 0);
      document.getElementById('cardMode').textContent = result.userOnly ? 'Data petugas login' : 'Semua petugas';

      const by = summary.byJenis || {};
      const items = ['Input','Output','Produksi','Transfer','Opname'];
      document.getElementById('jenisBadges').innerHTML = items.map(j => `<span class="inline-flex items-center rounded-full border ${badgeBorder(j)} px-3 py-1 text-xs font-semibold ${badgeText(j)}">${j}: ${formatNumber(by[j] || 0)}</span>`).join('');

      const limited = result.totalBeforeLimit && result.totalBeforeLimit > (summary.totalRows || 0)
        ? ` Ditampilkan ${formatNumber(summary.totalRows || 0)} dari ${formatNumber(result.totalBeforeLimit)} baris karena limit.`
        : '';
      document.getElementById('tableInfo').textContent = `${formatNumber(summary.totalRows || 0)} baris riwayat tampil.${limited}`;
    }

    function firstRiwayatValue() {
      for (let i = 0; i < arguments.length; i++) {
        const value = arguments[i];
        if (value === null || typeof value === 'undefined') continue;
        const text = String(value).trim();
        if (!text || text === '-' || text.toLowerCase() === 'null' || text.toLowerCase() === 'undefined') continue;
        return value;
      }
      return '';
    }

    function getRiwayatIdBarang(r) {
      return firstRiwayatValue(r.idBarang, r.id_barang, r.IDBarang, r.id, r.ID, r.kodeBarang, r.kode, r.idProduk, r.idProduksi);
    }

    function getRiwayatNamaBarang(r) {
      return firstRiwayatValue(r.namaBarang, r.nama_barang, r.NamaBarang, r.nama, r.namaItem, r.produk, r.produksi, r.namaProduk, r.namaProduksi);
    }

    function getRiwayatQty(r) {
      return firstRiwayatValue(r.qty, r.Qty, r.jumlah, r.qtyMasuk, r.qtyKeluar, r.qtyTransfer, r.selisih, 0);
    }

    function getRiwayatSatuan(r) {
      return firstRiwayatValue(r.satuan, r.satuanStok, r.satuanProduk, r.satuanProduksi, r.unit);
    }

    function getRiwayatKategoriTujuan(r) {
      const isTransfer = String(r.jenis || '').toLowerCase().includes('transfer');
      return isTransfer
        ? firstRiwayatValue(r.outlet, r.tujuan, r.kategori)
        : firstRiwayatValue(r.kategori, r.tujuan, r.outlet);
    }

    function renderTable() {
      const tbody = document.getElementById('tbodyRiwayat');
      if (!currentRows.length) {
        tbody.innerHTML = '<tr><td colspan="11" class="p-8 text-center text-slate-500">Tidak ada transaksi pada filter ini.</td></tr>';
        return;
      }

      tbody.innerHTML = currentRows.map((r, idx) => {
        const detail = buildDetail(r);
        const idBarang = getRiwayatIdBarang(r);
        const namaBarang = getRiwayatNamaBarang(r);
        const kategoriTujuan = getRiwayatKategoriTujuan(r);
        const qty = getRiwayatQty(r);
        const satuan = getRiwayatSatuan(r);
        return `
          <tr class="border-b border-slate-800/60 bg-slate-950 hover:bg-slate-900 transition-colors">
            <td class="p-4 text-center text-sm text-slate-500">${idx + 1}</td>
            <td class="p-4 text-center"><span class="inline-flex items-center justify-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${badgeClass(r.jenis)}">${escapeHtml(r.jenis || '-')}</span></td>
            <td class="p-4 text-center text-sm text-slate-300">${escapeHtml(formatDateDisplay(r.tanggal))}</td>
            <td class="p-4 text-sm font-semibold text-sky-300">${escapeHtml(r.txId || '-')}</td>
            <td class="p-4 text-sm text-slate-300">${escapeHtml(r.petugas || '-')}</td>
            <td class="p-4 text-sm text-slate-300">${escapeHtml(kategoriTujuan || '-')}</td>
            <td class="p-4 text-sm text-slate-400">${escapeHtml(idBarang || '-')}</td>
            <td class="p-4 text-sm font-semibold text-white">${escapeHtml(namaBarang || '-')}</td>
            <td class="p-4 text-center text-sm font-bold ${qtyTone(r)}">${escapeHtml(formatNumber(qty))}</td>
            <td class="p-4 text-center text-sm text-slate-400">${escapeHtml(satuan || '-')}</td>
            <td class="p-4 text-sm text-slate-400">${escapeHtml(detail)}</td>
          </tr>`;
      }).join('');
    }

    function buildDetail(r) {
      const parts = [];
      if (r.detail) parts.push(r.detail);
      if (r.outlet && !String(r.jenis || '').toLowerCase().includes('transfer')) parts.push('Outlet: ' + r.outlet);
      if (r.pic) parts.push('PIC: ' + r.pic);
      if (r.catatan) parts.push('Catatan: ' + r.catatan);
      return parts.join(' • ') || '-';
    }

    function qtyTone(r) {
      const j = String(r.jenis || '').toLowerCase();
      const qty = parseNumber(getRiwayatQty(r));
      if (j.includes('opname')) return qty < 0 ? 'text-rose-400' : (qty > 0 ? 'text-emerald-400' : 'text-slate-400');
      if (j.includes('output') || j.includes('transfer')) return 'text-rose-400';
      if (j.includes('input') || j.includes('produksi')) return 'text-emerald-400';
      return 'text-slate-300';
    }

    function badgeClass(jenis) {
      const j = String(jenis || '').toLowerCase();
      if (j.includes('input')) return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
      if (j.includes('output')) return 'bg-rose-500/10 text-rose-300 border-rose-500/20';
      if (j.includes('produksi')) return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
      if (j.includes('transfer')) return 'bg-violet-500/10 text-violet-300 border-violet-500/20';
      if (j.includes('opname')) return 'bg-sky-500/10 text-sky-300 border-sky-500/20';
      return 'bg-slate-500/10 text-slate-300 border-slate-500/20';
    }
    function badgeText(jenis) { return badgeClass(jenis).split(' ').filter(c => c.startsWith('text-')).join(' '); }
    function badgeBorder(jenis) { return badgeClass(jenis).split(' ').filter(c => c.startsWith('border-')).join(' '); }

    function formatDateDisplay(value) {
      if (!value) return '-';
      const text = String(value);
      if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        const [y,m,d] = text.split('-');
        return `${d}/${m}/${y}`;
      }
      return text;
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
      return n.toLocaleString('id-ID', { maximumFractionDigits: 2 });
    }
    function showToast(message, type = 'success') {
      const toast = document.getElementById('customToast');
      document.getElementById('toastMessage').textContent = message;
      toast.className = type === 'success'
        ? 'toast show flex items-center w-full max-w-md p-4 rounded-lg shadow-xl border bg-emerald-950/90 border-emerald-800 text-emerald-400 backdrop-blur-md'
        : 'toast show flex items-center w-full max-w-md p-4 rounded-lg shadow-xl border bg-rose-950/90 border-rose-800 text-rose-400 backdrop-blur-md';
      setTimeout(() => toast.classList.remove('show'), 4000);
    }
    function safeParseJSON(text) { try { return JSON.parse(text); } catch (e) { return {}; } }
    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>'"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[ch]));
    }
    function openMobileSidebar() {
      document.getElementById('sidebar').classList.remove('-translate-x-full');
      document.getElementById('sidebarBackdrop').classList.remove('hidden');
    }
    function closeMobileSidebar() {
      document.getElementById('sidebar').classList.add('-translate-x-full');
      document.getElementById('sidebarBackdrop').classList.add('hidden');
    }
    function showLogoutModal() {
      const modal = document.getElementById('logoutModal');
      const overlay = modal.querySelector('.modal-overlay');
      const content = modal.querySelector('.modal-content');
      modal.classList.remove('hidden');
      void modal.offsetWidth;
      overlay.classList.remove('opacity-0'); overlay.classList.add('opacity-100');
      content.classList.remove('scale-95', 'opacity-0'); content.classList.add('scale-100', 'opacity-100');
    }
    function closeLogoutModal() {
      const modal = document.getElementById('logoutModal');
      const overlay = modal.querySelector('.modal-overlay');
      const content = modal.querySelector('.modal-content');
      overlay.classList.remove('opacity-100'); overlay.classList.add('opacity-0');
      content.classList.remove('scale-100', 'opacity-100'); content.classList.add('scale-95', 'opacity-0');
      setTimeout(() => modal.classList.add('hidden'), 250);
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

/* Extracted from riwayat-inventory.html inline script 2 */
// APJ v14.6 - auto label tabel agar mobile tampil sebagai kartu, bukan scroll samping.
    (function(){
      function headersFor(table){
        return Array.from(table.querySelectorAll('thead th')).map(function(th){ return (th.textContent || '').trim(); });
      }
      function labelTable(table){
        var headers = headersFor(table);
        if (!headers.length) return;
        Array.from(table.querySelectorAll('tbody tr')).forEach(function(row){
          Array.from(row.children).forEach(function(cell, idx){
            if (!cell || cell.tagName !== 'TD') return;
            if (!cell.getAttribute('data-label')) cell.setAttribute('data-label', headers[idx] || 'Data');
          });
        });
      }
      function applyResponsiveTableLabels(root){
        root = root || document;
        root.querySelectorAll('.table-scroll table').forEach(labelTable);
      }
      window.applyResponsiveTableLabels = applyResponsiveTableLabels;
      document.addEventListener('DOMContentLoaded', function(){
        applyResponsiveTableLabels(document);
        var obs = new MutationObserver(function(){ applyResponsiveTableLabels(document); });
        obs.observe(document.body, { childList:true, subtree:true });
      });
    })();

/* Extracted from riwayat-inventory.html inline script 3 */
(function showAdminMenuForAuthorizedRoles() {
      const adminMenuLink = document.getElementById('adminMenuLink');
      if (!adminMenuLink) return;

      const level = String(localStorage.getItem('APJ_USER_LEVEL') || '').trim().toLowerCase();
      const allowedLevels = ['owner', 'superadmin', 'super admin', 'supervisor'];

      if (allowedLevels.includes(level)) {
        adminMenuLink.classList.remove('hidden');
      }
    })();

/* Extracted from riwayat-inventory.html inline script 4 */
function setupTopbarIdentityRiwayat() {
    const userName = localStorage.getItem('APJ_USER_NAME') || '-';
    const userLevel = localStorage.getItem('APJ_USER_LEVEL') || '-';
    const displayNama = document.getElementById('displayNama');
    const displayLevel = document.getElementById('displayLevel');
    const displayInisial = document.getElementById('displayInisial');
    if (displayNama) displayNama.textContent = userName;
    if (displayLevel) displayLevel.textContent = userLevel;
    if (displayInisial) displayInisial.textContent = (userName || 'U').charAt(0).toUpperCase();
  }

  function applySidebarState() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    const collapsed = localStorage.getItem('APJ_SIDEBAR_COLLAPSED') === 'true';
    sidebar.classList.toggle('sidebar-collapsed', collapsed);
    document.body.classList.toggle('sidebar-collapsed-active', collapsed);
  }

  function toggleSidebarCollapse() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    const collapsed = !sidebar.classList.contains('sidebar-collapsed');
    localStorage.setItem('APJ_SIDEBAR_COLLAPSED', collapsed ? 'true' : 'false');
    applySidebarState();
  }

  const riwayatHelpModal = () => document.getElementById('riwayatHelpModal');
  function openRiwayatHelpModal(autoOpen = false) {
    const modal = riwayatHelpModal();
    const overlay = modal ? modal.querySelector('.modal-overlay') : null;
    const content = modal ? modal.querySelector('.modal-content') : null;
    if (!modal || !overlay || !content) return;
    if (autoOpen) modal.dataset.autoOpen = 'true';
    modal.classList.remove('hidden');
    void modal.offsetWidth;
    overlay.classList.add('opacity-100');
    overlay.classList.remove('opacity-0');
    content.classList.add('scale-100', 'opacity-100');
    content.classList.remove('scale-95', 'opacity-0');
  }

  function closeRiwayatHelpModal() {
    const modal = riwayatHelpModal();
    const overlay = modal ? modal.querySelector('.modal-overlay') : null;
    const content = modal ? modal.querySelector('.modal-content') : null;
    if (!modal || !overlay || !content) return;
    sessionStorage.setItem('APJ_RIWAYAT_HELP_SEEN', 'true');
    overlay.classList.remove('opacity-100');
    overlay.classList.add('opacity-0');
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 250);
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupTopbarIdentityRiwayat();
    applySidebarState();
    setTimeout(() => {
      if (sessionStorage.getItem('APJ_RIWAYAT_HELP_SEEN') !== 'true') openRiwayatHelpModal(true);
    }, 450);
  });


/* APP-APJ V2.5 - grouped sidebar handlers for riwayat-transaksi */
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
  function bindGroupedSidebar(){
    const collapseBtn = document.querySelector('[data-sidebar-collapse]');
    if (collapseBtn && collapseBtn.dataset.riwayatBound !== 'Y') {
      collapseBtn.dataset.riwayatBound = 'Y';
      collapseBtn.addEventListener('click', function(event){
        event.preventDefault();
        if (typeof window.toggleSidebarCollapse === 'function') window.toggleSidebarCollapse();
      });
    }
    document.querySelectorAll('#dashboardSidebarMenu [data-menu-toggle]').forEach(function(button){
      if (button.dataset.riwayatBound === 'Y') return;
      button.dataset.riwayatBound = 'Y';
      button.addEventListener('click', function(event){
        event.preventDefault();
        event.stopPropagation();
        const sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('sidebar-collapsed')) return;
        toggleGroup(button.getAttribute('data-menu-toggle'));
      });
    });
    document.querySelectorAll('#dashboardSidebarMenu [data-locked-menu]').forEach(function(link){
      if (link.dataset.riwayatBound === 'Y') return;
      link.dataset.riwayatBound = 'Y';
      link.addEventListener('click', function(event){
        event.preventDefault();
        const name = link.getAttribute('data-locked-menu') || 'Menu';
        if (typeof showToast === 'function') showToast(name + ' terkunci untuk akun ini. Hubungi Owner/Admin jika perlu akses.', 'warning');
        else alert(name + ' terkunci untuk akun ini.');
      });
    });
  }
  document.addEventListener('DOMContentLoaded', function(){
    initGroups();
    bindGroupedSidebar();
    if (typeof setupAdminMenu === 'function') setupAdminMenu(localStorage.getItem('APJ_USER_LEVEL'));
  });
  window.toggleDashboardMenuGroup = toggleGroup;
})();
