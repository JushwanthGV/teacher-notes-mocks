/**
 * AI Decoder Academy — Login Page Interactive Logic
 * Handles authentication simulation, validation, remember me, modals, and toasts.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const loginForm = document.getElementById('loginForm');
  const emailInput = document.getElementById('emailInput');
  const passwordInput = document.getElementById('passwordInput');
  const togglePasswordBtn = document.getElementById('togglePasswordBtn');
  const eyeOpenIcon = document.getElementById('eyeOpenIcon');
  const eyeSlashIcon = document.getElementById('eyeSlashIcon');
  const rememberMe = document.getElementById('rememberMe');
  const loginBtn = document.getElementById('loginBtn');
  const googleBtn = document.getElementById('googleBtn');
  
  // Feedback Toast
  const toast = document.getElementById('feedbackToast');
  const toastMessage = document.getElementById('toastMessage');
  const toastIcon = document.getElementById('toastIcon');
  let toastTimer = null;

  // Modals
  const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
  const forgotModal = document.getElementById('forgotModal');
  const closeForgotModal = document.getElementById('closeForgotModal');
  const forgotForm = document.getElementById('forgotForm');
  const resetEmailInput = document.getElementById('resetEmailInput');

  const createAccountBtn = document.getElementById('createAccountBtn');
  const registerModal = document.getElementById('registerModal');
  const closeRegisterModal = document.getElementById('closeRegisterModal');
  const registerForm = document.getElementById('registerForm');

  // ==========================================
  // Toast Helper
  // ==========================================
  function showToast(message, type = 'info') {
    if (toastTimer) clearTimeout(toastTimer);
    
    toast.className = 'feedback-toast';
    toast.classList.add(type === 'success' ? 'toast-success' : type === 'error' ? 'toast-error' : 'toast-info');

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
    } else if (type === 'error') {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
    } else {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
    }

    toastIcon.innerHTML = iconSvg;
    toastMessage.textContent = message;
    toast.classList.add('show');

    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 4000);
  }

  // ==========================================
  // Password Visibility Toggle
  // ==========================================
  if (togglePasswordBtn) {
    togglePasswordBtn.addEventListener('click', () => {
      const isPassword = passwordInput.getAttribute('type') === 'password';
      passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
      eyeOpenIcon.style.display = isPassword ? 'none' : 'block';
      eyeSlashIcon.style.display = isPassword ? 'block' : 'none';
      togglePasswordBtn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
    });
  }

  // ==========================================
  // Remember Me Logic (localStorage)
  // ==========================================
  const SAVED_EMAIL_KEY = 'aida_saved_email';
  const savedEmail = localStorage.getItem(SAVED_EMAIL_KEY);
  if (savedEmail) {
    emailInput.value = savedEmail;
    rememberMe.checked = true;
  }

  // ==========================================
  // Form Submission & Validation
  // ==========================================
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    // Validation
    if (!email) {
      showToast('Please enter your email address.', 'error');
      emailInput.focus();
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showToast('Please enter a valid email address.', 'error');
      emailInput.focus();
      return;
    }

    if (!password) {
      showToast('Please enter your password.', 'error');
      passwordInput.focus();
      return;
    }

    if (password.length < 6) {
      showToast('Password must be at least 6 characters.', 'error');
      passwordInput.focus();
      return;
    }

    // Save or clear remembered email
    if (rememberMe.checked) {
      localStorage.setItem(SAVED_EMAIL_KEY, email);
    } else {
      localStorage.removeItem(SAVED_EMAIL_KEY);
    }

    // Trigger loading state
    loginBtn.classList.add('is-loading');
    loginBtn.disabled = true;

    setTimeout(() => {
      loginBtn.classList.remove('is-loading');
      loginBtn.disabled = false;
      
      const isOnboarded = localStorage.getItem('aida_onboarding_completed') === 'true';
      if (isOnboarded) {
        showToast('Welcome back! Loading your dashboard...', 'success');
        setTimeout(() => { window.location.href = 'dark-glass/?start=panes'; }, 800);
      } else {
        const step = localStorage.getItem('aida_onboarding_step');
        if (step === '3') {
          showToast('Resuming AI setup...', 'success');
          setTimeout(() => { window.location.href = 'dark-glass/?start=opening'; }, 800);
        } else {
          showToast('Account verified! Setting up your workspace...', 'success');
          setTimeout(() => { window.location.href = 'onboarding.html'; }, 800);
        }
      }
    }, 1200);
  });

  // ==========================================
  // Google Sign-In Simulation
  // ==========================================
  googleBtn.addEventListener('click', () => {
    googleBtn.style.opacity = '0.7';
    googleBtn.disabled = true;
    showToast('Connecting to Google Identity Services...', 'info');

    setTimeout(() => {
      googleBtn.style.opacity = '1';
      googleBtn.disabled = false;
      
      const isOnboarded = localStorage.getItem('aida_onboarding_completed') === 'true';
      if (isOnboarded) {
        showToast('Authenticated via Google! Loading dashboard...', 'success');
        setTimeout(() => { window.location.href = 'dark-glass/?start=panes'; }, 800);
      } else {
        const step = localStorage.getItem('aida_onboarding_step');
        if (step === '3') {
          showToast('Resuming AI setup...', 'success');
          setTimeout(() => { window.location.href = 'dark-glass/?start=opening'; }, 800);
        } else {
          showToast('Google account linked! Setting up your workspace...', 'success');
          setTimeout(() => { window.location.href = 'onboarding.html'; }, 800);
        }
      }
    }, 1400);
  });

  // ==========================================
  // Forgot Password Modal
  // ==========================================
  forgotPasswordBtn.addEventListener('click', () => {
    forgotModal.classList.add('active');
    if (emailInput.value) {
      resetEmailInput.value = emailInput.value;
    }
    setTimeout(() => resetEmailInput.focus(), 100);
  });

  closeForgotModal.addEventListener('click', () => {
    forgotModal.classList.remove('active');
  });

  forgotModal.addEventListener('click', (e) => {
    if (e.target === forgotModal) forgotModal.classList.remove('active');
  });

  forgotForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = resetEmailInput.value.trim();
    if (!email) {
      showToast('Please enter an email address.', 'error');
      return;
    }
    forgotModal.classList.remove('active');
    showToast(`Password recovery link sent to ${email}`, 'success');
    forgotForm.reset();
  });

  // ==========================================
  // Create Account Modal (New User -> Onboarding)
  // ==========================================
  createAccountBtn.addEventListener('click', () => {
    registerModal.classList.add('active');
    const regName = document.getElementById('regNameInput');
    setTimeout(() => regName.focus(), 100);
  });

  closeRegisterModal.addEventListener('click', () => {
    registerModal.classList.remove('active');
  });

  registerModal.addEventListener('click', (e) => {
    if (e.target === registerModal) registerModal.classList.remove('active');
  });

  registerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const regName = document.getElementById('regNameInput').value.trim();
    const regEmail = document.getElementById('regEmailInput').value.trim();

    registerModal.classList.remove('active');
    showToast('Account created! Welcome to AI Decoder Academy.', 'success');

    // Initialize new user onboarding state
    localStorage.setItem('aida_onboarding_completed', 'false');
    localStorage.setItem('aida_onboarding_step', '1');
    if (regName) {
      localStorage.setItem('aida_teacher_profile', JSON.stringify({ fullName: regName, email: regEmail }));
    }

    setTimeout(() => {
      window.location.href = 'onboarding.html';
    }, 900);
  });

  // Close modals on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      forgotModal.classList.remove('active');
      registerModal.classList.remove('active');
    }
  });
});
