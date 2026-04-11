(function () {
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

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "password-toggle-btn";
    toggle.innerHTML = eyeIcon;
    toggle.setAttribute("aria-label", "Show password");
    toggle.setAttribute("aria-pressed", "false");

    toggle.addEventListener("click", () => {
      const isHidden = input.type === "password";
      input.type = isHidden ? "text" : "password";
      toggle.innerHTML = isHidden ? eyeOffIcon : eyeIcon;
      toggle.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
      toggle.setAttribute("aria-pressed", String(isHidden));
      input.focus();
    });

    wrapper.appendChild(toggle);
  }

  function initPasswordToggles() {
    document.querySelectorAll('input[type="password"]').forEach(enhancePasswordField);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPasswordToggles);
  } else {
    initPasswordToggles();
  }
})();
