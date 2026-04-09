const forgotPasswordForm = document.getElementById("forgotPasswordForm");
const forgotPasswordResult = document.getElementById("forgotPasswordResult");

forgotPasswordForm.addEventListener("submit", async event => {
  event.preventDefault();

  const email = document.getElementById("resetEmail").value.trim();

  try {
    const response = await fetch(
      "/triciabales-api/api/users/password-reset/request",
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
      throw new Error(data.message || data.error || "Could not send reset link");
    }

    forgotPasswordResult.innerHTML = `
      <div class="payment-alert">
        <p>${data.message}</p>
        ${data.actionUrl ? `<p style="margin-top:10px;"><a href="${data.actionUrl}">Open reset link</a></p>` : ""}
      </div>
    `;
  } catch (err) {
    forgotPasswordResult.innerHTML = `<p style="color:#b42318;">${err.message}</p>`;
  }
});
