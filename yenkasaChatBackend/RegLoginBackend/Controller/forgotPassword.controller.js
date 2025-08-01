const sendPasswordResetEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ message: "Email is required." });
    }

    // TODO: Lookup user, generate token, and send email here.

    console.log(`✅ Password reset requested for email: ${email}`);

    return res.status(200).json({
      message: "If an account with that email exists, a reset link has been sent.",
    });
  } catch (error) {
    console.error("❌ Forgot password error:", error);

    if (!res.headersSent) {
      return res.status(500).json({
        message: "Server error while processing password reset.",
        error: error.message,
      });
    }
  }
};

module.exports = {
  sendPasswordResetEmail,
};
