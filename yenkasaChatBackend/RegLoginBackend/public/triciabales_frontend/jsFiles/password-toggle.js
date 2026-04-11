(function () {
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
    toggle.textContent = "Show";
    toggle.setAttribute("aria-label", "Show password");
    toggle.setAttribute("aria-pressed", "false");

    toggle.addEventListener("click", () => {
      const isHidden = input.type === "password";
      input.type = isHidden ? "text" : "password";
      toggle.textContent = isHidden ? "Hide" : "Show";
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
