document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    email: document.getElementById("email").value,
    password: document.getElementById("password").value
  };

  try {
    const response = await fetch(
      "https://www.yenkasa.xyz/triciabales-api/api/users/login",
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
