/* Extracted from admin.html inline script 1 */
const APPS_SCRIPT_URL = (window.APJ_CONFIG && (window.APJ_CONFIG.inventoryApiUrl || (window.APJ_CONFIG.apis && window.APJ_CONFIG.apis.inventory))) || "https://script.google.com/macros/s/AKfycbx3sNyaAR5b1MZjpjzuCuyeYuVi-bL0k1Nb1MgI40l5kQmSWfmxXCSfTpBy7sQ-0oQ/exec";
    let adminData = null;
    let adminUserList = [];
    let userPage = 1;
    const USERS_PER_PAGE = 10;

    document.addEventListener('DOMContentLoaded', () => {
      if (localStorage.getItem('APJ_SESSION_ACTIVE') !== 'true' || !localStorage.getItem('APJ_SESSION_TOKEN')) {
        window.location.href = 'index.html';
        return;
      }

      const userName = localStorage.getItem('APJ_USER_NAME') || 'Pengguna';
      const userLevel = localStorage.getItem('APJ_USER_LEVEL') || '';
      document.getElementById('displayNama').textContent = userName;
      document.getElementById('displayLevel').textContent = userLevel || 'ADMIN';

      if (!isAdminLevel(userLevel)) {
        showToast('Halaman admin hanya untuk Owner/SuperAdmin/Supervisor.', 'error');
        setTimeout(() => window.location.href = 'dashboard.html', 1200);
        return;
      }

      loadAdminData();
      document.querySelectorAll('#sidebar a').forEach(link => link.addEventListener('click', closeMobileSidebar));
      document.addEventListener('click', handleAdminUserTableClick);
    });

    async function api(action, payload = {}) {
      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        redirect: 'follow',
        body: JSON.stringify({
          action,
          sessionToken: localStorage.getItem('APJ_SESSION_TOKEN') || '',
          ...payload
        })
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.message || 'Request gagal.');
      return result;
    }

    async function loadAdminData() {
      document.getElementById('loadingState').classList.remove('hidden');
      document.getElementById('adminContent').classList.add('hidden');
      try {
        adminData = await api('getAdminData');
        renderUsers(adminData.users || []);
        renderPermissions(adminData.permissionColumns || [], adminData.permissionRows || []);
        renderAudit(adminData.auditLogs || []);
        renderMasterSummary(adminData.masterSummary || []);
        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('adminContent').classList.remove('hidden');
      } catch (error) {
        document.getElementById('loadingState').innerHTML = `<div class="text-rose-400 font-semibold mb-1">Admin gagal dimuat.</div><div class="text-xs text-slate-500">${escapeHtml(error.message)}</div>`;
        showToast(error.message, 'error');
      }
    }

    function renderUsers(users) {
      adminUserList = Array.isArray(users) ? users : [];
      const maxPage = Math.max(1, Math.ceil(adminUserList.length / USERS_PER_PAGE));
      if (userPage > maxPage) userPage = maxPage;
      if (userPage < 1) userPage = 1;
      document.getElementById('userCount').textContent = `${adminUserList.length} user`;
      renderUsersPage();
    }

    function renderUsersPage() {
      const tbody = document.getElementById('usersBody');
      const total = adminUserList.length;
      const maxPage = Math.max(1, Math.ceil(total / USERS_PER_PAGE));
      const start = (userPage - 1) * USERS_PER_PAGE;
      const pageRows = adminUserList.slice(start, start + USERS_PER_PAGE);

      document.getElementById('userPageInfo').textContent = `Halaman ${userPage}/${maxPage}`;
      document.getElementById('userPageText').textContent = total
        ? `Menampilkan ${start + 1}-${Math.min(start + USERS_PER_PAGE, total)} dari ${total} user.`
        : 'Menampilkan 0 user.';
      document.getElementById('btnUserPrev').disabled = userPage <= 1;
      document.getElementById('btnUserNext').disabled = userPage >= maxPage;

      tbody.innerHTML = pageRows.length ? pageRows.map(user => `
        <tr class="text-sm">
          <td class="font-semibold text-white"><span class="cell-ellipsis" title="${escapeAttr(user.username)}">${escapeHtml(user.username)}</span></td>
          <td class="text-slate-300"><span class="cell-ellipsis" title="${escapeAttr(user.nama || '-')}">${escapeHtml(user.nama || '-')}</span></td>
          <td class="text-slate-300"><span class="cell-ellipsis" title="${escapeAttr(user.level || '-')}">${escapeHtml(user.level || '-')}</span></td>
          <td class="text-slate-300"><span class="cell-ellipsis" title="${escapeAttr(user.outlet || '-')}">${escapeHtml(user.outlet || '-')}</span></td>
          <td>${passwordBadge(user.passwordMode)}</td>
          <td class="text-right">
            <button type="button" data-edit-user="${escapeAttr(user.username)}" title="Edit user" aria-label="Edit user" class="edit-user-button border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-200 hover:bg-violet-500/20 transition">Edit</button>
          </td>
        </tr>
      `).join('') : `<tr><td colspan="6" class="py-8 text-center text-slate-500">Belum ada user.</td></tr>`;
    }

    function changeUserPage(delta) {
      const maxPage = Math.max(1, Math.ceil(adminUserList.length / USERS_PER_PAGE));
      userPage = Math.min(maxPage, Math.max(1, userPage + delta));
      renderUsersPage();
    }

    function renderPermissions(columns, rows) {
      document.getElementById('permissionHead').innerHTML = `
        <tr>
          <th class="py-3 pr-3">Role</th>
          ${columns.map(col => `<th class="py-3 px-2 text-center">${escapeHtml(col.label)}</th>`).join('')}
          <th class="py-3 pl-3 text-right">Aksi</th>
        </tr>
      `;

      document.getElementById('permissionBody').innerHTML = rows.length ? rows.map((row, index) => `
        <tr id="perm-row-${index}" class="text-sm">
          <td class="py-3 pr-3 font-semibold text-white whitespace-nowrap">${escapeHtml(row.role)}${row.locked ? '<span class="ml-2 text-[10px] text-slate-500">LOCK</span>' : ''}</td>
          ${columns.map(col => renderPermissionSelect(row, col)).join('')}
          <td class="py-3 pl-3 text-right">
            <button type="button" onclick="savePermissionsByIndex(${index})" ${row.locked ? 'disabled' : ''} class="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-200 hover:bg-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition">Simpan</button>
          </td>
        </tr>
      `).join('') : `<tr><td colspan="${columns.length + 2}" class="py-8 text-center text-slate-500">Belum ada role permission.</td></tr>`;
    }

    function renderPermissionSelect(row, col) {
      const value = (row.permissions && row.permissions[col.key]) || 'N';
      return `
        <td class="py-3 px-2 text-center">
          <select data-key="${escapeAttr(col.key)}" ${row.locked ? 'disabled' : ''} class="w-16 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-center text-xs font-semibold text-white focus:border-blue-500 focus:outline-none disabled:opacity-40">
            <option value="Y" ${value === 'Y' ? 'selected' : ''}>Y</option>
            <option value="N" ${value !== 'Y' ? 'selected' : ''}>N</option>
          </select>
        </td>
      `;
    }

    function renderAudit(logs) {
      const allLogs = Array.isArray(logs) ? logs : [];
      const visibleLogs = allLogs.slice(0, 5);
      const info = document.getElementById('auditInfo');
      if (info) info.textContent = `${Math.min(visibleLogs.length, 5)} dari ${allLogs.length} log`;
      document.getElementById('auditBody').innerHTML = visibleLogs.length ? visibleLogs.map(log => `
        <tr class="text-sm">
          <td class="py-3 pr-3 text-slate-400 whitespace-nowrap">${escapeHtml(log.timestamp || '-')}</td>
          <td class="py-3 px-3 text-slate-300">${escapeHtml(log.action || '-')}</td>
          <td class="py-3 px-3">${statusBadge(log.status)}</td>
          <td class="py-3 px-3 text-slate-300">${escapeHtml(log.user || '-')}</td>
          <td class="py-3 pl-3 text-slate-400">${escapeHtml(log.message || '-')}</td>
        </tr>
      `).join('') : `<tr><td colspan="5" class="py-8 text-center text-slate-500">Belum ada audit log.</td></tr>`;
    }

    function renderMasterSummary(items) {
      const allItems = Array.isArray(items) ? items : [];
      const visibleItems = allItems.slice(0, 5);
      const info = document.getElementById('masterInfo');
      if (info) info.textContent = `${Math.min(visibleItems.length, 5)} dari ${allItems.length} sheet`;
      document.getElementById('masterSummary').innerHTML = visibleItems.length ? visibleItems.map(item => `
        <div class="rounded-lg border ${item.exists ? 'border-slate-800 bg-slate-900' : 'border-rose-500/20 bg-rose-500/10'} p-3">
          <div class="flex items-center justify-between gap-3">
            <p class="text-xs font-bold text-white truncate">${escapeHtml(item.name)}</p>
            <span class="text-[10px] font-bold ${item.exists ? 'text-emerald-300' : 'text-rose-300'}">${item.exists ? 'ADA' : 'HILANG'}</span>
          </div>
          <p class="mt-2 text-xs text-slate-500">${escapeHtml(String(item.rows || 0))} baris data, ${escapeHtml(String(item.columns || 0))} kolom</p>
        </div>
      `).join('') : '<div class="rounded-lg border border-slate-800 bg-slate-900 p-3 text-xs text-slate-500">Belum ada data master sheet.</div>';
    }

    function handleAdminUserTableClick(event) {
      const button = event.target && event.target.closest ? event.target.closest('[data-edit-user]') : null;
      if (!button) return;
      event.preventDefault();
      const username = button.getAttribute('data-edit-user') || '';
      openUserEditModal(username);
    }

    function uniqueCleanValues(list) {
      const seen = new Set();
      const result = [];
      (list || []).forEach(value => {
        const text = String(value ?? '').trim();
        if (!text) return;
        const key = text.toUpperCase();
        if (seen.has(key)) return;
        seen.add(key);
        result.push(text);
      });
      return result;
    }

    function setSelectOptions(selectId, values, selectedValue) {
      const select = document.getElementById(selectId);
      if (!select) return;
      const selected = String(selectedValue ?? '').trim();
      const options = uniqueCleanValues([selected, ...(values || [])]);
      select.innerHTML = options.map(value => `<option value="${escapeAttr(value)}">${escapeHtml(value)}</option>`).join('');
      select.value = selected || (options[0] || '');
    }

    function populateUserEditDropdowns(user) {
      const levelValues = uniqueCleanValues([
        user && user.level,
        ...(adminUserList || []).map(item => item.level),
        ...((adminData && adminData.permissionRows) || []).map(row => row.role),
        'OWNER', 'SUPERVISOR', 'GUDANG', 'PRODUKSI', 'KEMASAN', 'KASIR', 'SUPERADMIN'
      ]);
      const outletValues = uniqueCleanValues([
        user && user.outlet,
        ...(adminUserList || []).map(item => item.outlet),
        'ALL', 'LAHOR', 'SENISONO', 'PUJON', 'NGUJUNG', 'POKOPEK'
      ]);
      setSelectOptions('editLevel', levelValues, user && user.level);
      setSelectOptions('editOutlet', outletValues, user && user.outlet);
    }

    function openUserCreateModal() {
      document.getElementById('editMode').value = 'create';
      document.getElementById('editOriginalUsername').value = '';
      document.getElementById('editUsername').value = '';
      document.getElementById('editNama').value = '';
      populateUserEditDropdowns({ level: 'KASIR', outlet: 'ALL' });
      const passwordInput = document.getElementById('editPassword');
      passwordInput.value = '';
      passwordInput.required = true;
      passwordInput.placeholder = 'Wajib diisi untuk user baru';
      document.getElementById('editPasswordLabel').innerHTML = 'Password Baru <span class="normal-case tracking-normal text-amber-300">(wajib)</span>';
      document.getElementById('userEditTitle').textContent = 'Tambah User Sistem';
      document.getElementById('userEditDesc').textContent = 'Buat user baru tanpa input manual dari sheet. Password akan langsung disimpan sebagai hash.';
      document.getElementById('userEditHint').textContent = 'User baru akan ditambahkan ke sheet USER.';
      document.getElementById('btnSaveUserEdit').textContent = 'Tambah User';

      const modal = document.getElementById('userEditModal');
      if (!modal) {
        showToast('Popup tambah user belum tersedia di halaman.', 'error');
        return;
      }
      const overlay = modal.querySelector('.modal-overlay');
      const content = modal.querySelector('.modal-content');
      if (!overlay || !content) {
        showToast('Komponen popup tambah user belum lengkap.', 'error');
        return;
      }
      modal.classList.remove('hidden');
      void modal.offsetWidth;
      overlay.classList.remove('opacity-0'); overlay.classList.add('opacity-100');
      content.classList.remove('scale-95', 'opacity-0'); content.classList.add('scale-100', 'opacity-100');
      setTimeout(() => document.getElementById('editUsername')?.focus(), 100);
    }

    function openUserEditModal(username) {
      const user = adminUserList.find(item => String(item.username) === String(username));
      if (!user) {
        showToast('Data user tidak ditemukan.', 'error');
        return;
      }
      document.getElementById('editMode').value = 'edit';
      document.getElementById('editOriginalUsername').value = user.username || '';
      document.getElementById('editUsername').value = user.username || '';
      document.getElementById('editNama').value = user.nama || '';
      populateUserEditDropdowns(user);
      const passwordInput = document.getElementById('editPassword');
      passwordInput.value = '';
      passwordInput.required = false;
      passwordInput.placeholder = 'Kosongkan jika tidak ingin ganti password';
      document.getElementById('editPasswordLabel').innerHTML = 'Password Baru <span class="normal-case tracking-normal text-slate-500">(opsional)</span>';
      document.getElementById('userEditTitle').textContent = 'Edit User Sistem';
      document.getElementById('userEditDesc').textContent = 'Ubah username, nama, level, outlet, dan password. Level dan outlet dipilih dari dropdown supaya tidak salah ketik.';
      document.getElementById('userEditHint').textContent = `User aktif: ${user.username || '-'}`;
      document.getElementById('btnSaveUserEdit').textContent = 'Simpan User';

      const modal = document.getElementById('userEditModal');
      if (!modal) {
        showToast('Popup edit user belum tersedia di halaman.', 'error');
        return;
      }
      const overlay = modal.querySelector('.modal-overlay');
      const content = modal.querySelector('.modal-content');
      if (!overlay || !content) {
        showToast('Komponen popup edit user belum lengkap.', 'error');
        return;
      }
      modal.classList.remove('hidden');
      void modal.offsetWidth;
      overlay.classList.remove('opacity-0'); overlay.classList.add('opacity-100');
      content.classList.remove('scale-95', 'opacity-0'); content.classList.add('scale-100', 'opacity-100');
      setTimeout(() => document.getElementById('editUsername')?.focus(), 100);
    }

    function closeUserEditModal() {
      const modal = document.getElementById('userEditModal');
      if (!modal) return;
      const overlay = modal.querySelector('.modal-overlay');
      const content = modal.querySelector('.modal-content');
      overlay.classList.remove('opacity-100'); overlay.classList.add('opacity-0');
      content.classList.remove('scale-100', 'opacity-100'); content.classList.add('scale-95', 'opacity-0');
      setTimeout(() => modal.classList.add('hidden'), 250);
    }

    async function saveUserEdit(event) {
      event.preventDefault();
      const mode = document.getElementById('editMode').value || 'edit';
      const originalUsername = document.getElementById('editOriginalUsername').value.trim();
      const username = document.getElementById('editUsername').value.trim();
      const nama = document.getElementById('editNama').value.trim();
      const level = document.getElementById('editLevel').value.trim();
      const outlet = document.getElementById('editOutlet').value.trim();
      const newPassword = document.getElementById('editPassword').value;
      if (!username) {
        showToast('Username wajib diisi.', 'error');
        return;
      }
      if (mode !== 'create' && !originalUsername) {
        showToast('Username lama tidak terbaca.', 'error');
        return;
      }
      if (mode === 'create' && !newPassword) {
        showToast('Password wajib diisi untuk user baru.', 'error');
        return;
      }
      if (newPassword && newPassword.length < 4) {
        showToast('Password baru minimal 4 karakter.', 'error');
        return;
      }

      const button = document.getElementById('btnSaveUserEdit');
      button.disabled = true;
      try {
        const action = mode === 'create' ? 'adminAddUser' : 'adminUpdateUser';
        const payload = mode === 'create'
          ? { username, nama, level, outlet, newPassword }
          : { originalUsername, username, nama, level, outlet, newPassword };
        const result = await api(action, payload);
        showToast(result.message || (mode === 'create' ? 'User baru berhasil ditambahkan.' : 'Data user berhasil diperbarui.'), 'success');
        closeUserEditModal();
        await loadAdminData();
      } catch (error) {
        const fallback = mode === 'create'
          ? 'Gagal menambah user. Pastikan Code.gs sudah mendukung adminAddUser.'
          : 'Gagal memperbarui user. Pastikan Code.gs sudah mendukung adminUpdateUser.';
        showToast(error.message || fallback, 'error');
      } finally {
        button.disabled = false;
      }
    }

    async function savePermissionsByIndex(index) {
      const row = adminData && adminData.permissionRows ? adminData.permissionRows[index] : null;
      if (!row || row.locked) return;
      const tr = document.getElementById(`perm-row-${index}`);
      const permissions = {};
      tr.querySelectorAll('select[data-key]').forEach(select => {
        permissions[select.dataset.key] = select.value;
      });

      try {
        const result = await api('adminSavePermissions', { role: row.role, permissions });
        showToast(result.message || 'Permission berhasil disimpan.', 'success');
        await loadAdminData();
      } catch (error) {
        showToast(error.message, 'error');
      }
    }


    function passwordBadge(mode) {
      const m = String(mode || '').toUpperCase();
      if (m === 'HASH') return '<span class="rounded-full border border-emerald-500/20 bg-emerald-500/10 password-badge px-2 py-1 text-[11px] font-bold text-emerald-300">HASH</span>';
      if (m === 'PLAIN') return '<span class="rounded-full border border-amber-500/20 bg-amber-500/10 password-badge px-2 py-1 text-[11px] font-bold text-amber-300">PLAIN</span>';
      return '<span class="rounded-full border border-rose-500/20 bg-rose-500/10 password-badge px-2 py-1 text-[11px] font-bold text-rose-300">KOSONG</span>';
    }

    function statusBadge(status) {
      const s = String(status || '').toUpperCase();
      const cls = s === 'SUCCESS'
        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
        : 'border-rose-500/20 bg-rose-500/10 text-rose-300';
      return `<span class="rounded-full border ${cls} password-badge px-2 py-1 text-[11px] font-bold">${escapeHtml(s || '-')}</span>`;
    }

    function showToast(message, type = 'success') {
      const toast = document.getElementById('customToast');
      document.getElementById('toastMessage').textContent = message;
      toast.className = type === 'success'
        ? 'toast show flex items-center w-full max-w-md p-4 rounded-lg shadow-xl border bg-emerald-950/90 border-emerald-800 text-emerald-400 backdrop-blur-md'
        : 'toast show flex items-center w-full max-w-md p-4 rounded-lg shadow-xl border bg-rose-950/90 border-rose-800 text-rose-400 backdrop-blur-md';
      setTimeout(() => toast.classList.remove('show'), 4000);
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
      document.body.classList.add('overflow-hidden');
    }

    function closeMobileSidebar() {
      const sidebar = document.getElementById('sidebar');
      const backdrop = document.getElementById('sidebarBackdrop');
      if (!sidebar || !backdrop) return;
      sidebar.classList.add('-translate-x-full');
      backdrop.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
    }

    document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMobileSidebar(); });
    window.addEventListener('resize', () => { if (window.innerWidth >= 1024) closeMobileSidebar(); });

    function isAdminLevel(level) {
      const lv = String(level || '').toLowerCase().trim();
      return lv === 'owner' || lv === 'superadmin' || lv === 'super admin' || lv === 'supervisor';
    }

    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>'"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[ch]));
    }

    function escapeAttr(value) {
      return escapeHtml(value).replace(/"/g, '&quot;');
    }

    function jsString(value) {
      return JSON.stringify(String(value ?? ''));
    }


    function setupTopbarIdentityAdmin() {
      const userName = localStorage.getItem('APJ_USER_NAME') || 'Pengguna';
      const userLevel = localStorage.getItem('APJ_USER_LEVEL') || 'ADMIN';
      const displayNama = document.getElementById('displayNama');
      const displayLevel = document.getElementById('displayLevel');
      const displayInisial = document.getElementById('displayInisial');
      if (displayNama) displayNama.textContent = userName;
      if (displayLevel) displayLevel.textContent = userLevel || 'ADMIN';
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

    const adminHelpModal = () => document.getElementById('adminHelpModal');
    function openAdminHelpModal(autoOpen = false) {
      const modal = adminHelpModal();
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

    function closeAdminHelpModal() {
      const modal = adminHelpModal();
      const overlay = modal ? modal.querySelector('.modal-overlay') : null;
      const content = modal ? modal.querySelector('.modal-content') : null;
      if (!modal || !overlay || !content) return;
      sessionStorage.setItem('APJ_ADMIN_HELP_SEEN', 'true');
      overlay.classList.remove('opacity-100');
      overlay.classList.add('opacity-0');
      content.classList.remove('scale-100', 'opacity-100');
      content.classList.add('scale-95', 'opacity-0');
      setTimeout(() => modal.classList.add('hidden'), 250);
    }

    function showLogoutModal() {
      const modal = document.getElementById('logoutModal');
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

    function closeLogoutModal() {
      const modal = document.getElementById('logoutModal');
      const overlay = modal ? modal.querySelector('.modal-overlay') : null;
      const content = modal ? modal.querySelector('.modal-content') : null;
      if (!modal || !overlay || !content) return;
      overlay.classList.remove('opacity-100');
      overlay.classList.add('opacity-0');
      content.classList.remove('scale-100', 'opacity-100');
      content.classList.add('scale-95', 'opacity-0');
      setTimeout(() => modal.classList.add('hidden'), 250);
    }

    (function setupResponsiveTableLabels(){
      function headersFor(table){ return Array.from(table.querySelectorAll('thead th')).map(th => (th.textContent || '').trim()); }
      function labelTable(table){
        const headers = headersFor(table);
        if (!headers.length) return;
        Array.from(table.querySelectorAll('tbody tr')).forEach(row => {
          Array.from(row.children).forEach((cell, idx) => {
            if (!cell || cell.tagName !== 'TD') return;
            if (!cell.getAttribute('data-label')) cell.setAttribute('data-label', headers[idx] || 'Data');
          });
        });
      }
      function apply(root){ (root || document).querySelectorAll('.table-scroll table').forEach(labelTable); }
      window.applyResponsiveTableLabels = apply;
      document.addEventListener('DOMContentLoaded', () => {
        apply(document);
        const obs = new MutationObserver(() => apply(document));
        obs.observe(document.body, { childList:true, subtree:true });
      });
    })();

    document.addEventListener('DOMContentLoaded', () => {
      setupTopbarIdentityAdmin();
      applySidebarState();
      setTimeout(() => {
        if (sessionStorage.getItem('APJ_ADMIN_HELP_SEEN') !== 'true') openAdminHelpModal(true);
      }, 450);
    });
