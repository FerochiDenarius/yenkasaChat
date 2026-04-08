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

    localStorage.setItem("currentUser", JSON.stringify(data));

    alert("Login successful!");

    if (data.role === "SUPER_ADMIN") {
      window.location.href = "super-admin.html";
    } else if (data.role === "ADMIN") {
      window.location.href = "admin.html";
    } else if (data.role === "SELLER") {
      window.location.href = "seller-dashboard.html";
    } else {
      window.location.href = "index.html";
    }

  } catch (err) {
    console.error(err);
    alert(err.message);
  }
});
