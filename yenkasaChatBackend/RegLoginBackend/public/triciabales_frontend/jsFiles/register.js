function getInputValue(id) {
  const element = document.getElementById(id);
  return element ? element.value : "";
}

document.getElementById("register-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const submitButton = e.target.querySelector('button[type="submit"]');
  const originalText = submitButton ? submitButton.textContent : "";

  const payload = {
    name: getInputValue("name").trim(),
    email: getInputValue("email").trim(),
    phone: getInputValue("phone").trim(),
    address: getInputValue("address").trim(),
    role: getInputValue("role").trim(),
    referralCode: getInputValue("referralCode").trim() || null,
    password: getInputValue("password")
  };

  try {
    console.info("[Yenkasa Store] Registration submitted", {
      email: payload.email,
      role: payload.role
    });

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Creating account...";
    }

    const response = await fetch(
      "/triciabales-api/api/users/register",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json();
    console.info("[Yenkasa Store] Registration response", {
      status: response.status,
      ok: response.ok,
      actionUrlReturned: Boolean(data.actionUrl)
    });

    if (!response.ok) {
      throw new Error(data.message || data.error || "Registration failed");
    }

    localStorage.removeItem("currentUser");
    localStorage.removeItem("authToken");
    localStorage.removeItem("loggedIn");

    const message = data.actionUrl
      ? `${data.message}\n\nUse this verification link if email delivery is not configured yet:\n${data.actionUrl}`
      : (data.message || "Account created successfully. Please verify your email.");

    alert(message);
    window.location.href = "/store/buyer-login";
  } catch (err) {
    console.error("[Yenkasa Store] Registration failed", err);
    alert(
      err instanceof TypeError
        ? "Network error. Your browser could not reach yenkasa.xyz. Check your internet/DNS and try again."
        : err.message
    );
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalText;
    }
  }
});
