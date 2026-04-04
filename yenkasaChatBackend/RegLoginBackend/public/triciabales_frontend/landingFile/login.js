function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    alert("Please enter both email and password");
    return;
  }

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
  });
}

document.getElementById("loginBtn").addEventListener("click", login);