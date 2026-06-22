/* APJ LOGIN V18 - page khusus index.html, memakai master API/Auth/Toast/Date */
(function () {
  'use strict';

  const APP_NAME = 'APJ_CENTRAL_INDEX';
  const REDIRECT_PAGE = (window.APJ_CONFIG && window.APJ_CONFIG.defaultRedirect) || 'dashboard.html';
  let currentSessionToken = '';
  let currentProfile = null;

  function $(id) { return document.getElementById(id); }
  function toast(message, type) {
    if (window.APJToast) {
      const method = type === 'error' ? 'error' : type === 'warning' ? 'warning' : type === 'success' ? 'success' : 'info';
      window.APJToast[method](message || '-');
    } else {
      alert(message || '-');
    }
  }

  async function callCore(action, payload) {
    if (!window.APJApi) throw new Error('APJApi belum dimuat. Pastikan assets/js/apj-api.js dipanggil.');
    return window.APJApi.request(action, Object.assign({
      appName: APP_NAME,
      userAgent: navigator.userAgent
    }, payload || {}));
  }

  function setLoading(prefix, isLoading, text) {
    const btn = $(prefix + 'Btn');
    const label = $(prefix + 'BtnText');
    const spinner = $(prefix + 'Spinner');
    if (btn) btn.disabled = !!isLoading;
    if (label && text) label.textContent = text;
    if (spinner) spinner.classList.toggle('apj-hidden', !isLoading);
  }

  function resetLoginButton() {
    const btn = $('submitBtn');
    const text = $('btnText');
    const spinner = $('btnSpinner');
    if (btn) btn.disabled = false;
    if (text) text.textContent = 'Masuk ke APJ Central';
    if (spinner) spinner.classList.add('apj-hidden');
  }

  function switchMode(mode) {
    const isLogin = mode === 'login';
    $('loginForm')?.classList.toggle('apj-hidden', !isLogin);
    $('registerForm')?.classList.toggle('apj-hidden', isLogin);
    $('loginTabBtn')?.classList.toggle('apj-active', isLogin);
    $('registerTabBtn')?.classList.toggle('apj-active', !isLogin);
  }

  function togglePassword(inputId, btn) {
    const input = $(inputId);
    if (!input) return;
    const next = input.type === 'password' ? 'text' : 'password';
    input.type = next;
    if (btn) btn.textContent = next === 'text' ? 'TUTUP' : 'LIHAT';
  }

  function clearSession() {
    currentSessionToken = '';
    currentProfile = null;
    if (window.APJAuth) window.APJAuth.clearSession();
    [
      'APJ_USER_MODULES','APJ_USER_OUTLET_AKSES','APJ_USER_NO_HP','APJ_USER_EMAIL','APJ_USER_TANGGAL_LAHIR'
    ].forEach(function (key) { localStorage.removeItem(key); });
  }

  function saveSession(token, user, modules, rawResult) {
    const result = Object.assign({}, rawResult || {}, {
      sessionToken: token || (rawResult && rawResult.sessionToken) || '',
      user: user || (rawResult && rawResult.user) || {},
      modules: modules || (rawResult && rawResult.modules) || []
    });
    if (window.APJAuth) window.APJAuth.saveSession(result);

    const profile = result.user || {};
    const listModules = result.modules || [];
    // Kompatibilitas dengan file inventori lama yang masih membaca key lama.
    localStorage.setItem('APJ_SESSION_ACTIVE', 'true');
    localStorage.setItem('APJ_SESSION_TOKEN', result.sessionToken || '');
    localStorage.setItem('APJ_USER_ID', profile.userId || profile.USER_ID || '');
    localStorage.setItem('APJ_USER_USERNAME', profile.username || profile.USERNAME || '');
    localStorage.setItem('APJ_USER_NAME', profile.nama || profile.NAMA || profile.name || '');
    localStorage.setItem('APJ_USER_LEVEL', profile.level || profile.LEVEL || '');
    localStorage.setItem('APJ_USER_OUTLET', profile.outlet || profile.outletUtama || profile.OUTLET_UTAMA || '');
    localStorage.setItem('APJ_USER_OUTLET_AKSES', profile.outletAkses || profile.OUTLET_AKSES || '');
    localStorage.setItem('APJ_USER_NO_HP', profile.noHp || profile.NO_HP || '');
    localStorage.setItem('APJ_USER_EMAIL', profile.email || profile.EMAIL || '');
    localStorage.setItem('APJ_USER_TANGGAL_LAHIR', profile.tanggalLahir || profile.TANGGAL_LAHIR || '');
    localStorage.setItem('APJ_USER_PERMISSIONS', JSON.stringify(profile.permissions || result.permissions || {}));
    localStorage.setItem('APJ_MODULE_ACCESS', JSON.stringify(listModules));
    localStorage.setItem('APJ_USER_MODULES', JSON.stringify(listModules));
    localStorage.setItem('APJ_USER_DATA', JSON.stringify(profile));
  }

  function needsProfileCompletion(profile) {
    return !String((profile && (profile.noHp || profile.NO_HP)) || '').trim()
      || !String((profile && (profile.email || profile.EMAIL)) || '').trim()
      || !String((profile && (profile.tanggalLahir || profile.TANGGAL_LAHIR)) || '').trim();
  }

  function setupDates() {
    if (!window.APJDate) return;
    ['regBirth', 'profileBirth', 'forgotBirth'].forEach(function (prefix) {
      window.APJDate.initDateGroup(prefix, { minYear: 1950, maxYear: new Date().getFullYear() });
    });
  }

  function getBirth(prefix) {
    return window.APJDate ? window.APJDate.getDate(prefix) : '';
  }

  function setBirth(prefix, value) {
    if (window.APJDate) window.APJDate.setDate(prefix, value || '');
  }

  function openModal(id) { $(id)?.classList.add('apj-show'); }
  function closeModal(id) { $(id)?.classList.remove('apj-show'); }

  function setupMobileIntro() {
    const modal = $('mobileIntroModal');
    if (!modal) return;
    if (window.innerWidth <= 980 && sessionStorage.getItem('APJ_MOBILE_INTRO_CLOSED') !== 'Y') {
      modal.classList.add('apj-show');
    }
  }

  function closeMobileIntro() {
    sessionStorage.setItem('APJ_MOBILE_INTRO_CLOSED', 'Y');
    closeModal('mobileIntroModal');
  }

  async function validateExistingSession() {
    const token = localStorage.getItem('APJ_SESSION_TOKEN') || '';
    if (!token || localStorage.getItem('APJ_SESSION_ACTIVE') !== 'true') return;
    try {
      const result = await callCore('getMyProfile', { sessionToken: token });
      if (!result.success) throw new Error(result.message || 'Session tidak valid');
      const profile = result.user || {};
      if (!profile.username || needsProfileCompletion(profile)) {
        clearSession();
        return;
      }
      window.location.href = REDIRECT_PAGE;
    } catch (error) {
      clearSession();
    }
  }

  function setOutletOptions(select, options) {
    if (!select) return;
    select.innerHTML = '<option value="">Pilih outlet</option>';
    (options || []).forEach(function (item) {
      const opt = document.createElement('option');
      opt.value = String(item.value || '').toUpperCase();
      opt.textContent = item.label || item.value || '';
      select.appendChild(opt);
    });
  }

  async function loadOutletsForRegister() {
    const select = $('regOutlet');
    const fallback = ['LAHOR','SENISONO','PUJON','NGUJUNG','POKOPEK'].map(function (v) { return { value: v, label: v }; });
    try {
      const result = await callCore('getOutlets', {});
      const outlets = (result.outlets || []).filter(function (o) {
        return String(o.kodeOutlet || o.KODE_OUTLET || '').toUpperCase() !== 'ALL'
          && String(o.status || o.STATUS || 'AKTIF').toUpperCase() === 'AKTIF';
      }).map(function (o) {
        const kode = o.kodeOutlet || o.KODE_OUTLET || '';
        return { value: kode, label: o.namaOutlet || o.NAMA_OUTLET || kode };
      });
      setOutletOptions(select, outlets.length ? outlets : fallback);
    } catch (error) {
      setOutletOptions(select, fallback);
    }
  }

  function fillProfileModal(profile) {
    const username = String((profile && profile.username) || '').trim();
    const nama = String((profile && profile.nama) || '').trim();
    const account = $('profileAccountName');
    const accountBox = $('profileAccountLabel');
    if (account && accountBox && username) {
      account.textContent = nama ? nama + ' (' + username + ')' : username;
      accountBox.classList.remove('apj-hidden');
    } else if (accountBox) {
      accountBox.classList.add('apj-hidden');
    }
    if ($('profileNoHp')) $('profileNoHp').value = (profile && profile.noHp) || '';
    if ($('profileEmail')) $('profileEmail').value = (profile && profile.email) || '';
    setBirth('profileBirth', (profile && profile.tanggalLahir) || '');
  }

  async function handleLogin(event) {
    event.preventDefault();
    const username = $('username')?.value.trim() || '';
    const password = $('password')?.value || '';
    const submitBtn = $('submitBtn');
    const btnText = $('btnText');
    const spinner = $('btnSpinner');
    if (submitBtn) submitBtn.disabled = true;
    if (btnText) btnText.textContent = 'Memverifikasi akun pusat...';
    if (spinner) spinner.classList.remove('apj-hidden');

    try {
      const result = await callCore('login', { username: username, password: password });
      if (!result.success) {
        toast(result.message || 'Login gagal. Periksa username dan password.', 'error');
        resetLoginButton();
        return;
      }
      currentSessionToken = result.sessionToken || result.token || '';
      let profile = result.user || {};
      let modules = result.modules || [];

      if (!currentSessionToken || !profile.username) {
        toast('Login berhasil dari server, tapi data session belum lengkap. Deploy ulang API Login Pusat lalu coba lagi.', 'error');
        clearSession();
        resetLoginButton();
        return;
      }

      try {
        const fresh = await callCore('getMyProfile', { sessionToken: currentSessionToken });
        if (fresh.success) {
          profile = fresh.user || profile;
          modules = fresh.modules || modules;
        }
      } catch (_) {}

      currentProfile = profile;
      saveSession(currentSessionToken, profile, modules, result);
      toast('Login berhasil. Selamat datang, ' + (profile.nama || username) + (result.migratedToHash ? '. Password sudah diamankan menjadi HASH.' : '.'), 'success');

      if (needsProfileCompletion(profile)) {
        fillProfileModal(profile);
        window.setTimeout(function () { openModal('profileModal'); }, 450);
        resetLoginButton();
        return;
      }

      window.setTimeout(function () { window.location.href = REDIRECT_PAGE; }, 800);
    } catch (error) {
      console.error(error);
      toast('Gagal terhubung ke API Login Pusat. Periksa koneksi atau deployment Apps Script.', 'error');
      resetLoginButton();
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    const username = $('regUsername')?.value.trim().toLowerCase() || '';
    const nama = $('regNama')?.value.trim() || '';
    const password = $('regPassword')?.value || '';
    const outletUtama = $('regOutlet')?.value || '';
    const noHp = $('regNoHp')?.value.trim() || '';
    const email = $('regEmail')?.value.trim() || '';
    const tanggalLahir = getBirth('regBirth');

    if (/\s/.test(username)) return toast('Username tidak boleh memakai spasi.', 'error');
    if (!tanggalLahir) return toast('Tanggal lahir wajib dipilih lengkap.', 'error');

    setLoading('register', true, 'Mengirim pendaftaran...');
    try {
      const result = await callCore('registerUser', {
        username: username,
        nama: nama,
        password: password,
        level: 'KARYAWAN',
        outletUtama: outletUtama,
        outletAkses: outletUtama,
        noHp: noHp,
        email: email,
        tanggalLahir: tanggalLahir
      });
      if (!result.success) {
        toast(result.message || 'Pendaftaran gagal.', 'error');
        setLoading('register', false, 'Kirim Pendaftaran');
        return;
      }
      toast('Pendaftaran terkirim. Tunggu Owner/Admin mengaktifkan akun.', 'success');
      $('registerForm')?.reset();
      setBirth('regBirth', '');
      if ($('username')) $('username').value = username;
      switchMode('login');
      setLoading('register', false, 'Kirim Pendaftaran');
    } catch (error) {
      console.error(error);
      toast('Gagal mengirim pendaftaran ke server.', 'error');
      setLoading('register', false, 'Kirim Pendaftaran');
    }
  }

  async function handleProfileSubmit(event) {
    event.preventDefault();
    if (!currentSessionToken || !currentProfile || !currentProfile.username) {
      closeModal('profileModal');
      clearSession();
      toast('Silakan login dulu sebelum melengkapi profil.', 'error');
      resetLoginButton();
      return;
    }
    const noHp = $('profileNoHp')?.value.trim() || '';
    const email = $('profileEmail')?.value.trim() || '';
    const tanggalLahir = getBirth('profileBirth');
    if (!tanggalLahir) return toast('Tanggal lahir wajib dipilih lengkap.', 'error');

    setLoading('profile', true, 'Menyimpan profil...');
    try {
      const result = await callCore('updateMyProfile', { sessionToken: currentSessionToken, noHp: noHp, email: email, tanggalLahir: tanggalLahir });
      if (!result.success) {
        toast(result.message || 'Profil gagal disimpan.', 'error');
        setLoading('profile', false, 'Simpan & Lanjut');
        return;
      }
      const profile = result.user || Object.assign({}, currentProfile, { noHp: noHp, email: email, tanggalLahir: tanggalLahir });
      currentProfile = profile;
      saveSession(currentSessionToken, profile, JSON.parse(localStorage.getItem('APJ_MODULE_ACCESS') || localStorage.getItem('APJ_USER_MODULES') || '[]'), result);
      closeModal('profileModal');
      toast('Profil berhasil dilengkapi. Mengalihkan ke dashboard...', 'success');
      window.setTimeout(function () { window.location.href = REDIRECT_PAGE; }, 800);
    } catch (error) {
      console.error(error);
      toast('Gagal menyimpan profil.', 'error');
      setLoading('profile', false, 'Simpan & Lanjut');
    }
  }

  function openForgotModal() {
    openModal('forgotModal');
    $('forgotUsernameForm')?.classList.remove('apj-hidden');
    $('forgotResetForm')?.classList.add('apj-hidden');
    if ($('forgotUsername')) $('forgotUsername').value = $('username')?.value.trim() || '';
    if ($('forgotVerifiedUsername')) $('forgotVerifiedUsername').value = '';
    if ($('forgotNoHp')) $('forgotNoHp').value = '';
    if ($('forgotNewPassword')) $('forgotNewPassword').value = '';
    if ($('forgotConfirmPassword')) $('forgotConfirmPassword').value = '';
    setBirth('forgotBirth', '');
    window.setTimeout(function () { $('forgotUsername')?.focus(); }, 80);
  }

  function closeForgotModal() {
    closeModal('forgotModal');
    setLoading('forgotCheck', false, 'Lanjut');
    setLoading('forgotReset', false, 'Simpan Password Baru');
  }

  function backToForgotUsername() {
    $('forgotUsernameForm')?.classList.remove('apj-hidden');
    $('forgotResetForm')?.classList.add('apj-hidden');
    setLoading('forgotCheck', false, 'Lanjut');
    setLoading('forgotReset', false, 'Simpan Password Baru');
  }

  async function handleForgotUsername(event) {
    event.preventDefault();
    const username = $('forgotUsername')?.value.trim().toLowerCase() || '';
    if (!username) return toast('Username wajib diisi.', 'error');
    setLoading('forgotCheck', true, 'Mengecek username...');
    try {
      const result = await callCore('forgotPasswordCheckUsername', { username: username });
      if (!result.success) {
        toast(result.message || 'Username belum bisa reset mandiri.', 'error');
        setLoading('forgotCheck', false, 'Lanjut');
        return;
      }
      if ($('forgotVerifiedUsername')) $('forgotVerifiedUsername').value = username;
      if ($('forgotAccountLabel')) $('forgotAccountLabel').textContent = 'Akun ditemukan: ' + (result.nama || username) + ' (' + username + '). Isi data verifikasi lalu buat password baru.';
      $('forgotUsernameForm')?.classList.add('apj-hidden');
      $('forgotResetForm')?.classList.remove('apj-hidden');
      setLoading('forgotCheck', false, 'Lanjut');
      window.setTimeout(function () { $('forgotNoHp')?.focus(); }, 80);
    } catch (error) {
      console.error(error);
      toast('Gagal mengecek username ke server.', 'error');
      setLoading('forgotCheck', false, 'Lanjut');
    }
  }

  async function handleForgotReset(event) {
    event.preventDefault();
    const username = $('forgotVerifiedUsername')?.value.trim().toLowerCase() || '';
    const noHp = $('forgotNoHp')?.value.trim() || '';
    const tanggalLahir = getBirth('forgotBirth');
    const newPassword = $('forgotNewPassword')?.value || '';
    const confirmPassword = $('forgotConfirmPassword')?.value || '';

    if (!username) {
      toast('Silakan cek username dulu.', 'error');
      backToForgotUsername();
      return;
    }
    if (!tanggalLahir) return toast('Tanggal lahir wajib dipilih lengkap.', 'error');
    if (newPassword.length < 6) return toast('Password baru minimal 6 karakter.', 'error');
    if (newPassword !== confirmPassword) return toast('Konfirmasi password belum sama.', 'error');

    setLoading('forgotReset', true, 'Menyimpan password...');
    try {
      const result = await callCore('resetPasswordWithVerification', { username: username, noHp: noHp, tanggalLahir: tanggalLahir, newPassword: newPassword });
      if (!result.success) {
        toast(result.message || 'Reset password gagal.', 'error');
        setLoading('forgotReset', false, 'Simpan Password Baru');
        return;
      }
      toast('Password berhasil diperbarui. Silakan login.', 'success');
      if ($('username')) $('username').value = username;
      if ($('password')) $('password').value = '';
      closeForgotModal();
      switchMode('login');
    } catch (error) {
      console.error(error);
      toast('Gagal reset password ke server.', 'error');
      setLoading('forgotReset', false, 'Simpan Password Baru');
    }
  }

  function init() {
    setupDates();
    setupMobileIntro();
    loadOutletsForRegister();
    validateExistingSession();

    $('mobileIntroClose')?.addEventListener('click', closeMobileIntro);
    $('loginTabBtn')?.addEventListener('click', function () { switchMode('login'); });
    $('registerTabBtn')?.addEventListener('click', function () { switchMode('register'); });
    $('loginForm')?.addEventListener('submit', handleLogin);
    $('registerForm')?.addEventListener('submit', handleRegister);
    $('profileForm')?.addEventListener('submit', handleProfileSubmit);
    $('forgotOpenBtn')?.addEventListener('click', openForgotModal);
    $('forgotCloseBtn')?.addEventListener('click', closeForgotModal);
    $('forgotBackBtn')?.addEventListener('click', backToForgotUsername);
    $('forgotUsernameForm')?.addEventListener('submit', handleForgotUsername);
    $('forgotResetForm')?.addEventListener('submit', handleForgotReset);

    document.querySelectorAll('[data-toggle-password]').forEach(function (btn) {
      btn.addEventListener('click', function () { togglePassword(btn.getAttribute('data-toggle-password'), btn); });
    });
  }

  window.APJLogin = {
    init: init,
    switchMode: switchMode,
    openForgotModal: openForgotModal,
    closeForgotModal: closeForgotModal,
    clearSession: clearSession
  };

  document.addEventListener('DOMContentLoaded', init);
})();
