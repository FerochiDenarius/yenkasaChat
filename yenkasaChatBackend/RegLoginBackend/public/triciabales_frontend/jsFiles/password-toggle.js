(function () {
  function injectPasswordToggleStyles() {
    if (document.getElementById("passwordToggleStyles")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "passwordToggleStyles";
    style.textContent = `
      .password-field {
        position: relative !important;
        width: 100% !important;
      }

      .password-field input {
        width: 100% !important;
        padding-right: 46px !important;
      }

      .password-field .password-toggle-btn {
        position: absolute !important;
        top: 50% !important;
        right: 12px !important;
        transform: translateY(-50%) !important;
        width: 24px !important;
        height: 24px !important;
        min-width: 24px !important;
        max-width: 24px !important;
        min-height: 0 !important;
        padding: 0 !important;
        margin: 0 !important;
        border: 0 !important;
        border-radius: 0 !important;
        background: transparent !important;
        color: #6b7280 !important;
        box-shadow: none !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        line-height: 1 !important;
        cursor: pointer !important;
        user-select: none !important;
      }

      .password-field .password-toggle-btn:hover,
      .password-field .password-toggle-btn:focus-visible {
        background: transparent !important;
        color: #111827 !important;
        outline: none !important;
        transform: translateY(-50%) !important;
      }

      .password-field .password-toggle-btn svg {
        width: 20px !important;
        height: 20px !important;
        fill: none !important;
        stroke: currentColor !important;
        stroke-linecap: round !important;
        stroke-linejoin: round !important;
        stroke-width: 2 !important;
      }
    `;
    document.head.appendChild(style);
  }

  const eyeIcon = `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M2.1 12s3.5-6.5 9.9-6.5S21.9 12 21.9 12s-3.5 6.5-9.9 6.5S2.1 12 2.1 12Z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </svg>
  `;

  const eyeOffIcon = `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3 3l18 18"></path>
      <path d="M10.6 10.6A2 2 0 0 0 13.4 13.4"></path>
      <path d="M9.1 5.9A9.7 9.7 0 0 1 12 5.5c6.4 0 9.9 6.5 9.9 6.5a17 17 0 0 1-3.1 3.8"></path>
      <path d="M6.5 7.5A17.5 17.5 0 0 0 2.1 12s3.5 6.5 9.9 6.5a9.8 9.8 0 0 0 4.5-1.1"></path>
    </svg>
  `;

  function enhancePasswordField(input) {
    if (!input || input.dataset.passwordToggleReady === "true") {
      return;
    }

    input.dataset.passwordToggleReady = "true";

    const wrapper = document.createElement("div");
    wrapper.className = "password-field";

    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const toggle = document.createElement("span");
    toggle.setAttribute("role", "button");
    toggle.setAttribute("tabindex", "0");
    toggle.className = "password-toggle-btn";
    toggle.innerHTML = eyeIcon;
    toggle.setAttribute("aria-label", "Show password");
    toggle.setAttribute("aria-pressed", "false");

    function togglePasswordVisibility() {
      const isHidden = input.type === "password";
      input.type = isHidden ? "text" : "password";
      toggle.innerHTML = isHidden ? eyeOffIcon : eyeIcon;
      toggle.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
      toggle.setAttribute("aria-pressed", String(isHidden));
      input.focus();
    }

    toggle.addEventListener("click", togglePasswordVisibility);
    toggle.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        togglePasswordVisibility();
      }
    });

    wrapper.appendChild(toggle);
  }

  function initPasswordToggles() {
    injectPasswordToggleStyles();
    document.querySelectorAll('input[type="password"]').forEach(enhancePasswordField);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPasswordToggles);
  } else {
    initPasswordToggles();
  }
})();
