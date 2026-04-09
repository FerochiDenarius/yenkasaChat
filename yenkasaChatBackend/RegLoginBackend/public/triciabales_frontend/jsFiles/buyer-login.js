document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    email: document.getElementById("email").value,
    password: document.getElementById("password").value
  };

  try {
    const response = await fetch(
      "/triciabales-api/api/users/login",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json();

    if (!response.ok) {
  if (
    response.status === 403 &&
    data.message &&
    data.message.includes("not verified")
  ) {
    alert(
      data.actionUrl
        ? `${data.message}\n\nA verification email has been sent.\n\nIf you do not receive it, use this link:\n${data.actionUrl}`
        : data.message
    );
    return;
  }

  throw new Error(data.message || data.error || "Login failed");
}

    const user = data.user;
    const token = data.token;

    if (!user || !token) {
      throw new Error(data.message || "Login failed");
    }

    localStorage.removeItem("loggedIn");
    localStorage.setItem("currentUser", JSON.stringify(user));
    localStorage.setItem("authToken", token);

    alert("Login successful!");

    if (user.role === "SUPER_ADMIN") {
      window.location.href = "super-admin.html";
    } else if (user.role === "ADMIN") {
      window.location.href = "admin.html";
    } else if (user.role === "SELLER") {
      window.location.href = "seller-dashboard.html";
    } else {
      window.location.href = "index.html";
    }

  } catch (err) {
    console.error(err);
    alert(err.message);
  }
});

document.getElementById("resendVerificationBtn").addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();

  if (!email) {
    alert("Enter your email address first.");
    return;
  }

  try {
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

    if (!response.ok) {
      throw new Error(data.message || data.error || "Could not resend verification email");
    }

    const message = data.actionUrl
      ? `${data.message}\n\nFallback verification link:\n${data.actionUrl}`
      : data.message;

    alert(message);
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
});
