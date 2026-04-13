document.getElementById("sellerLoginForm").addEventListener("submit", async e => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    const response = await fetch(
      "/triciabales-api/api/users/login",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      }
    );

    

const user = await response.json();

if (!response.ok) {
  if (
    response.status === 403 &&
    user.message &&
    user.message.includes("not verified")
  ) {
    alert(
      user.actionUrl
        ? `${user.message}\n\nA verification email has been sent.\n\nIf you do not receive it, use this link:\n${user.actionUrl}`
        : user.message
    );
    return;
  }

  throw new Error(user.message || user.error || "Login failed");
}

    if (!user.user || !user.token) {
      throw new Error(user.message || "Login failed");
    }

    if (user.user.role !== "SELLER") {
      alert("This login is only for sellers.");
      localStorage.removeItem("currentUser");
      localStorage.removeItem("authToken");
      return;
    }

    localStorage.removeItem("loggedIn");
    localStorage.setItem("currentUser", JSON.stringify(user.user));
    localStorage.setItem("authToken", user.token);
    window.location.href = "/store/seller-dashboard";
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
});

document.getElementById("resendVerificationBtn").addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const resendButton = document.getElementById("resendVerificationBtn");
  const originalText = resendButton.textContent;

  if (!email) {
    alert("Enter your email address first.");
    return;
  }

  try {
    console.info("[Yenkasa Store] Seller resend verification requested", { email });
    resendButton.disabled = true;
    resendButton.textContent = "Sending verification email...";

    const response = await fetch(
      "/triciabales-api/api/users/resend-verification",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email })
      }
    );

    const data = await response.json();
    console.info("[Yenkasa Store] Seller resend verification response", {
      status: response.status,
      ok: response.ok,
      actionUrlReturned: Boolean(data.actionUrl)
    });

    if (!response.ok) {
      throw new Error(data.message || data.error || "Could not resend verification email");
    }

    const message = data.actionUrl
      ? `${data.message}\n\nFallback verification link:\n${data.actionUrl}`
      : data.message;

    alert(message);
  } catch (err) {
    console.error("[Yenkasa Store] Seller resend verification failed", err);
    alert(
      err instanceof TypeError
        ? "Network error. Your browser could not reach yenkasa.xyz. Check your internet/DNS and try again."
        : err.message
    );
  } finally {
    resendButton.disabled = false;
    resendButton.textContent = originalText;
  }
});
