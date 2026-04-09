document.getElementById("register-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    name: document.getElementById("name").value,
    email: document.getElementById("email").value,
    phone: document.getElementById("phone").value,
    address: document.getElementById("address").value,
    role: document.getElementById("role").value,
    referralCode: document.getElementById("referralCode").value.trim() || null,
    password: document.getElementById("password").value
  };

  try {
    const response = await fetch(
      "https://www.yenkasa.xyz/triciabales-api/api/users/register",
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
      throw new Error(data.message || data.error || "Registration failed");
    }

    localStorage.removeItem("currentUser");
    localStorage.removeItem("authToken");
    localStorage.removeItem("loggedIn");

    const message = data.actionUrl
      ? `${data.message}\n\nUse this verification link if email delivery is not configured yet:\n${data.actionUrl}`
      : (data.message || "Account created successfully. Please verify your email.");

    alert(message);
    window.location.href = "buyer-login.html";
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
});
