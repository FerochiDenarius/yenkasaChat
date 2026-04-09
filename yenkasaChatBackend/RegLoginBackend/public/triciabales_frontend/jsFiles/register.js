function getInputValue(id) {
  const element = document.getElementById(id);
  return element ? element.value : "";
}

document.getElementById("register-form").addEventListener("submit", async (e) => {
  e.preventDefault();

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
