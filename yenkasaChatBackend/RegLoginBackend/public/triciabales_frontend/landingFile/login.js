function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  const loadingContainer = document.getElementById("loadingContainer");
  const loadingText = document.getElementById("loadingText");
  const loginBtn = document.getElementById("loginBtn");

  if (!email || !password) {
    alert("Please enter both email and password");
    return;
  }

  // Show loading state
  loadingContainer.style.display = "block";
  loadingText.style.display = "block";
  loginBtn.disabled = true;
  loginBtn.textContent = "Logging in...";

  const data = { email, password };

  fetch("/triciabales-api/api/users/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  })
    .then(async res => {
      const payload = await res.json();

      if (!res.ok) {
        throw new Error(payload.message || payload.error || "Login failed");
      }

      return payload;
    })
    .then(res => {
      if (!res.user || !res.token) {
        throw new Error(res.message || "Login failed");
      }

      if (res.user.role !== "SUPER_ADMIN") {
        throw new Error("This login is only for the platform owner.");
      }

      localStorage.removeItem("loggedIn");
      localStorage.setItem("currentUser", JSON.stringify(res.user));
      localStorage.setItem("authToken", res.token);
      alert("Login successful");
      window.location.href = "/store/super-admin";
    })
    .catch(err => {
      console.error("Fetch error:", err);
      alert(err.message);
    })
    .finally(() => {
      // Reset loading state if login fails
      loadingContainer.style.display = "none";
      loadingText.style.display = "none";
      loginBtn.disabled = false;
      loginBtn.textContent = "Open Super Admin Dashboard";
    });
}

document.getElementById("loginBtn").addEventListener("click", login);
