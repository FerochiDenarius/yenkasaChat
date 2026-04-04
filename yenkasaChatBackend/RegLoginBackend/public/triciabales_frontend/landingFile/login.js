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

  fetch("https://www.yenkasa.xyz/triciabales-api/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  })
    .then(async res => {
      const text = await res.text();

      console.log("Raw response:", text);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      return JSON.parse(text);
    })
    .then(res => {
      if (res.success === true) {
        localStorage.setItem("loggedIn", "true");
        alert("Login successful");
        window.location.href = "admin.html";
      } else {
        alert("Invalid email or password");
      }
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
      loginBtn.textContent = "Login";
    });
}

document.getElementById("loginBtn").addEventListener("click", login);