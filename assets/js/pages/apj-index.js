/* Extracted from index.html inline script 1 */
const APPS_SCRIPT_URL = (window.APJ_CONFIG && (window.APJ_CONFIG.inventoryApiUrl || (window.APJ_CONFIG.apis && window.APJ_CONFIG.apis.inventory))) || "https://script.google.com/macros/s/AKfycbx3sNyaAR5b1MZjpjzuCuyeYuVi-bL0k1Nb1MgI40l5kQmSWfmxXCSfTpBy7sQ-0oQ/exec";

    function showPopup(message, type = 'success') {
      const toast = document.getElementById('customToast');
      const toastMessage = document.getElementById('toastMessage');
      const iconContainer = document.getElementById('toastIconContainer');
      const icon = document.getElementById('toastIcon');

      toastMessage.innerText = message || '-';

      if (type === 'success') {
        toast.className = "toast show flex items-center w-full max-w-md p-4 rounded-xl shadow-2xl border bg-emerald-950/95 border-emerald-700/80 text-emerald-200 backdrop-blur-md";
        iconContainer.className = "inline-flex items-center justify-center flex-shrink-0 w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/20";
        icon.innerHTML = `<path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5Zm3.707 8.207-4 4a1 1 0 0 1-1.414 0l-2-2a1 1 0 0 1 1.414-1.414L9 10.586l3.293-3.293a1 1 0 0 1 1.414 1.414Z"/>`;
      } else {
        toast.className = "toast show flex items-center w-full max-w-md p-4 rounded-xl shadow-2xl border bg-rose-950/95 border-rose-700/80 text-rose-200 backdrop-blur-md";
        iconContainer.className = "inline-flex items-center justify-center flex-shrink-0 w-9 h-9 rounded-xl bg-rose-500/15 text-rose-300 border border-rose-500/20";
        icon.innerHTML = `<path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5Zm3.707 11.793a1 1 0 1 1-1.414 1.414L10 11.414l-2.293 2.293a1 1 0 0 1-1.414-1.414L8.586 10 6.293 7.707a1 1 0 0 1 1.414-1.414L10 8.586l2.293-2.293a1 1 0 0 1 1.414 1.414L11.414 10l2.293 2.293Z"/>`;
      }

      window.clearTimeout(window.__apjToastTimer);
      window.__apjToastTimer = setTimeout(() => toast.classList.remove('show'), 4000);
    }

    function togglePassword(btn) {
      const input = document.getElementById('password');
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.textContent = isPassword ? 'TUTUP' : 'LIHAT';
    }

    function resetButton() {
      const submitBtn = document.getElementById('submitBtn');
      const btnText = document.getElementById('btnText');
      const btnSpinner = document.getElementById('btnSpinner');
      submitBtn.disabled = false;
      btnText.innerText = "Masuk ke Sistem";
      btnSpinner.classList.add('hidden');
    }

    async function handleLogin(event) {
      event.preventDefault();

      const usernameInput = document.getElementById('username').value.trim();
      const passwordInput = document.getElementById('password').value;
      const submitBtn = document.getElementById('submitBtn');
      const btnText = document.getElementById('btnText');
      const btnSpinner = document.getElementById('btnSpinner');

      if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL === "") {
        showPopup("Konfigurasi Error: URL API Apps Script belum diisi.", "error");
        return;
      }

      submitBtn.disabled = true;
      btnText.innerText = "Memverifikasi Kredensial...";
      btnSpinner.classList.remove('hidden');

      try {
        const response = await fetch(APPS_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          redirect: 'follow',
          body: JSON.stringify({
            action: 'login',
            username: usernameInput,
            password: passwordInput
          })
        });

        const result = await response.json();

        if (result.success) {
          showPopup((result.message || 'Login berhasil.') + " Selamat datang, " + result.user.nama, "success");

          localStorage.setItem('APJ_SESSION_ACTIVE', 'true');
          localStorage.setItem('APJ_SESSION_TOKEN', result.sessionToken || result.token || result.authToken || '');
          localStorage.setItem('APJ_USER_NAME', result.user.nama);
          localStorage.setItem('APJ_USER_LEVEL', result.user.level);
          localStorage.setItem('APJ_USER_OUTLET', result.user.outlet || '');
          localStorage.setItem('APJ_USER_PERMISSIONS', JSON.stringify((result.user && result.user.permissions) || {}));

          setTimeout(() => {
            window.location.href = "dashboard.html";
          }, 900);
        } else {
          showPopup(result.message || 'Login gagal. Periksa username dan password.', "error");
          resetButton();
        }
      } catch (error) {
        console.error(error);
        showPopup("Gagal terhubung ke server database. Periksa koneksi internet atau deploy Apps Script.", "error");
        resetButton();
      }
    }
