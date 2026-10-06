/**
 * AI DECODER ACADEMY — Teacher Onboarding Controller
 * Multi-step progression, form validation, custom glass dropdowns, and persistent state.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Persistence Keys
  const KEY_COMPLETED = 'aida_onboarding_completed';
  const KEY_STEP = 'aida_onboarding_step';
  const KEY_PROFILE = 'aida_teacher_profile';

  // 1. Guard against repeating onboarding
  if (localStorage.getItem(KEY_COMPLETED) === 'true') {
    window.location.replace('dark-glass/?start=panes');
    return;
  }

  // State: limited to Step 1 and Step 2 in this page
  let currentStep = parseInt(localStorage.getItem(KEY_STEP) || '1', 10);
  if (isNaN(currentStep) || currentStep < 1 || currentStep > 2) currentStep = 1;

  // Form Elements
  const workspaceInput = document.getElementById('workspaceNameInput');
  const fullNameInput = document.getElementById('fullNameInput');
  const roleInput = document.getElementById('roleInput');
  const phoneInput = document.getElementById('phoneInput');
  const expInput = document.getElementById('expInput');
  const deptInput = document.getElementById('deptInput');
  const bioInput = document.getElementById('bioInput');

  const colWorkspaceName = document.getElementById('colWorkspaceName');
  const colFullName = document.getElementById('colFullName');

  // Role Custom Select Dropdown
  const roleSelectWrapper = document.getElementById('roleSelectWrapper');
  const roleSelectTrigger = document.getElementById('roleSelectTrigger');
  const selectedRoleText = document.getElementById('selectedRoleText');
  const customOptions = document.querySelectorAll('.custom-option');

  // Buttons & Navigation
  const prevStepBtn = document.getElementById('prevStepBtn');
  const nextStepBtn = document.getElementById('nextStepBtn');
  const btnActionText = document.getElementById('btnActionText');

  // ==========================================
  // Load Saved Data if Available
  // ==========================================
  const savedData = localStorage.getItem(KEY_PROFILE);
  if (savedData) {
    try {
      const data = JSON.parse(savedData);
      if (data.workspaceName && workspaceInput) workspaceInput.value = data.workspaceName;
      if (data.fullName && fullNameInput) fullNameInput.value = data.fullName;
      if (data.role && roleInput && selectedRoleText) {
        roleInput.value = data.role;
        selectedRoleText.textContent = data.role;
        customOptions.forEach(opt => {
          opt.classList.toggle('selected', opt.getAttribute('data-value') === data.role);
        });
      }
      if (data.phone && phoneInput) phoneInput.value = data.phone;
      if (data.experience && expInput) expInput.value = data.experience;
      if (data.department && deptInput) deptInput.value = data.department;
      if (data.bio && bioInput) bioInput.value = data.bio;
    } catch (e) {
      console.error('Error loading saved profile data', e);
    }
  }

  // ==========================================
  // Role Custom Select Behavior
  // ==========================================
  if (roleSelectTrigger) {
    roleSelectTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      roleSelectWrapper.classList.toggle('is-open');
    });

    customOptions.forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = opt.getAttribute('data-value');
        roleInput.value = val;
        selectedRoleText.textContent = val;
        customOptions.forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        roleSelectWrapper.classList.remove('is-open');
      });
    });

    document.addEventListener('click', () => {
      roleSelectWrapper.classList.remove('is-open');
    });
  }

  // Clear Validation Errors on Input
  if (workspaceInput) {
    workspaceInput.addEventListener('input', () => {
      colWorkspaceName.classList.remove('has-error');
    });
  }

  if (fullNameInput) {
    fullNameInput.addEventListener('input', () => {
      colFullName.classList.remove('has-error');
    });
  }

  // ==========================================
  // Step Navigation Logic
  // ==========================================
  function updateUI() {
    // 1. Update Panes
    document.querySelectorAll('.step-pane').forEach((pane, idx) => {
      pane.classList.toggle('active', idx + 1 === currentStep);
    });

    // 2. Update Sidebar Items
    document.querySelectorAll('.step-nav-item').forEach((item, idx) => {
      const stepNum = idx + 1;
      item.classList.toggle('is-active', stepNum === currentStep);
      item.classList.toggle('is-completed', stepNum < currentStep);
    });

    // 3. Update Back Button Visibility
    if (prevStepBtn) {
      prevStepBtn.style.visibility = currentStep === 1 ? 'hidden' : 'visible';
    }

    // 4. Update Button Text
    if (btnActionText) {
      btnActionText.textContent = currentStep === 2 ? 'Continue to AI Setup' : 'Continue';
    }

    // Persist current step
    localStorage.setItem(KEY_STEP, currentStep.toString());
  }

  // Sidebar Direct Click Navigation (for visited steps)
  document.querySelectorAll('.step-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const targetStep = parseInt(item.getAttribute('data-step'), 10);
      if (targetStep < currentStep && targetStep >= 1) {
        currentStep = targetStep;
        updateUI();
      }
    });
  });

  // Back Button Click
  if (prevStepBtn) {
    prevStepBtn.addEventListener('click', () => {
      if (currentStep > 1) {
        currentStep--;
        updateUI();
      }
    });
  }

  // Continue Button Click
  if (nextStepBtn) {
    nextStepBtn.addEventListener('click', () => {
      // Step 1 Validation & Progression
      if (currentStep === 1) {
        let valid = true;
        const ws = workspaceInput.value.trim();
        const fn = fullNameInput.value.trim();

        if (!ws) {
          colWorkspaceName.classList.add('has-error');
          workspaceInput.focus();
          valid = false;
        }

        if (!fn) {
          colFullName.classList.add('has-error');
          if (valid) fullNameInput.focus();
          valid = false;
        }

        if (!valid) return;

        // Save Step 1 Data
        const currentData = JSON.parse(localStorage.getItem(KEY_PROFILE) || '{}');
        currentData.workspaceName = ws;
        currentData.fullName = fn;
        currentData.role = roleInput.value;
        currentData.phone = phoneInput.value.trim();
        localStorage.setItem(KEY_PROFILE, JSON.stringify(currentData));

        currentStep = 2;
        updateUI();
        return;
      }

      // Step 2 Progression -> Handoff to AI Onboarding ("Which Board?")
      if (currentStep === 2) {
        const currentData = JSON.parse(localStorage.getItem(KEY_PROFILE) || '{}');
        if (expInput) currentData.experience = expInput.value.trim();
        if (deptInput) currentData.department = deptInput.value.trim();
        if (bioInput) currentData.bio = bioInput.value.trim();

        // Save profile
        localStorage.setItem(KEY_PROFILE, JSON.stringify(currentData));
        // Next step is Step 3 (AI Onboarding)
        localStorage.setItem(KEY_STEP, '3');
        // Onboarding is NOT complete yet
        localStorage.setItem(KEY_COMPLETED, 'false');

        // Disable button to prevent double clicks
        nextStepBtn.disabled = true;

        // Cinematic AI Transition before navigating to "Which board?"
        runAITransition(currentData.fullName || '');
      }
    });
  }

  // ==========================================
  // Cinematic AI Onboarding Transition
  // ==========================================
  function runAITransition(rawName) {
    const topBar = document.querySelector('.onboard-top-bar');
    const mainContainer = document.querySelector('.onboard-main-container');
    const overlay = document.getElementById('aiTransitionOverlay');
    const orbWrap = document.getElementById('transOrbWrap');
    const msgEl = document.getElementById('transMsg');

    const targetUrl = window.location.pathname.includes('/teacher-onboarding')
      ? '../dark-glass/?start=opening'
      : 'dark-glass/?start=opening';

    if (!overlay || !msgEl) {
      window.location.href = targetUrl;
      return;
    }

    const cleanName = rawName.trim();
    const esc = (s) => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const nameHtml = cleanName ? `Nice to meet you, <span class="trans-name-gradient">${esc(cleanName)}</span>.` : 'Nice to meet you.';

    // Check reduced motion
    const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      if (topBar) topBar.classList.add('is-exiting');
      if (mainContainer) mainContainer.classList.add('is-exiting');
      overlay.classList.add('is-active');
      overlay.setAttribute('aria-hidden', 'false');
      msgEl.innerHTML = (cleanName ? `Nice to meet you, ${esc(cleanName)}. ` : 'Nice to meet you. ') + "Let's personalize your teaching workspace.";
      msgEl.className = 'trans-msg is-visible';
      setTimeout(() => {
        window.location.href = targetUrl;
      }, 2000);
      return;
    }

    // Safety fallback timer
    const safetyTimer = setTimeout(() => {
      window.location.href = targetUrl;
    }, 7800);

    // PHASE 1: Step 2 fades away, AI orb and nebula appear
    if (topBar) topBar.classList.add('is-exiting');
    if (mainContainer) mainContainer.classList.add('is-exiting');
    overlay.classList.add('is-active');
    overlay.setAttribute('aria-hidden', 'false');

    // PHASE 2: Conversational sequential messages
    // Message 1: Nice to meet you, [Teacher Name].
    msgEl.innerHTML = nameHtml;
    requestAnimationFrame(() => {
      msgEl.className = 'trans-msg is-visible';
    });

    // Message 2: I've got the basics.
    setTimeout(() => {
      msgEl.className = 'trans-msg is-exiting';
      setTimeout(() => {
        msgEl.textContent = "I've got the basics.";
        msgEl.className = 'trans-msg is-visible';
      }, 260);
    }, 1800);

    // Message 3: Let's personalize your teaching workspace.
    setTimeout(() => {
      msgEl.className = 'trans-msg is-exiting';
      setTimeout(() => {
        msgEl.textContent = "Let's personalize your teaching workspace.";
        msgEl.className = 'trans-msg is-visible';
      }, 260);
    }, 3600);

    // PHASE 3: Orb expands subtly, message fades, smooth handoff to "Which board?"
    setTimeout(() => {
      if (orbWrap) orbWrap.classList.add('is-expanding');
      msgEl.className = 'trans-msg is-exiting';
      overlay.classList.add('is-exiting-page');
    }, 5500);

    // Final navigation to existing AI onboarding
    setTimeout(() => {
      clearTimeout(safetyTimer);
      window.location.href = targetUrl;
    }, 6000);
  }

  // Initialize UI
  updateUI();
});
