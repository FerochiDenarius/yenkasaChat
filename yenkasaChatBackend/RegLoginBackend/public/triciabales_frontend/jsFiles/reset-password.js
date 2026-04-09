const resetPasswordForm = document.getElementById("resetPasswordForm");
const resetPasswordResult = document.getElementById("resetPasswordResult");
const resetToken = new URLSearchParams(window.location.search).get("token");

resetPasswordForm.addEventListener("submit", async event => {
  event.preventDefault();

  if (!resetToken) {
    resetPasswordResult.innerHTML = '<p style="color:#b42318;">Reset token is missing.</p>';
    return;
  }

  const password = document.getElementById("newPassword").value;

  try {
    const response = await fetch(
      "/triciabales-api/api/users/password-reset/confirm",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          token: resetToken,
          password
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || "Could not reset password");
    }

    resetPasswordResult.innerHTML = `
      <div class="payment-alert">
        <p>${data.message}</p>
        <p style="margin-top:10px;"><a href="buyer-login.html">Go to login</a></p>
      </div>
    `;
    resetPasswordForm.reset();
  } catch (err) {
    resetPasswordResult.innerHTML = `<p style="color:#b42318;">${err.message}</p>`;
  }
});
