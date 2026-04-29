import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUserProfile, updateUserProfile } from "../api/profile";
import { confirmEmailVerification, requestEmailVerification } from "../api/verification";
import { getStoredUser, updateStoredUser } from "../utils/storage";
import "../styles/verify-account.css";

const CODE_LENGTH = 6;

export default function VerifyAccount() {
  const navigate = useNavigate();
  const storedUser = useMemo(() => getStoredUser() || {}, []);
  const [email, setEmail] = useState(storedUser?.email || "");
  const [phone, setPhone] = useState(storedUser?.phoneNumber || storedUser?.phone || "");
  const [code, setCode] = useState(Array(CODE_LENGTH).fill(""));
  const [emailVerified, setEmailVerified] = useState(Boolean(storedUser?.emailVerified));
  const [phoneVerified, setPhoneVerified] = useState(Boolean(storedUser?.phoneVerified));
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputsRef = useRef([]);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const user = await getUserProfile();
        if (!active) return;
        setEmail(user?.email || "");
        setPhone(user?.phoneNumber || user?.phone || "");
        setEmailVerified(Boolean(user?.emailVerified));
        setPhoneVerified(Boolean(user?.phoneVerified));
        updateStoredUser(user);
      } catch {
        if (active) setStatus("Using saved account details.");
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timerId = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timerId);
  }, [cooldown]);

  const joinedCode = code.join("");
  const verified = emailVerified;

  async function handleRequestEmailCode() {
    if (!isValidEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }

    setRequesting(true);
    setError("");
    setStatus("Requesting email code...");

    try {
      if (email !== storedUser?.email) {
        const updateResponse = await updateUserProfile({ email });
        updateStoredUser(updateResponse?.user || { email });
      }

      const response = await requestEmailVerification();
      setStatus(response?.message || "Verification code sent.");
      setCooldown(Number(response?.expiresInSeconds || 180));
      setCode(Array(CODE_LENGTH).fill(""));
      inputsRef.current[0]?.focus();
    } catch (requestError) {
      const retry = Number(requestError?.response?.data?.retryAfterSeconds || 0);
      if (retry > 0) setCooldown(retry);
      setError(
        requestError?.response?.data?.message ||
          requestError?.response?.data?.error ||
          "Failed to send email code."
      );
      setStatus("");
    } finally {
      setRequesting(false);
    }
  }

  async function handleConfirmCode(event) {
    event.preventDefault();
    if (joinedCode.length !== CODE_LENGTH) {
      setError("Enter the 6-digit verification code.");
      return;
    }

    setConfirming(true);
    setError("");
    setStatus("Confirming email code...");

    try {
      const response = await confirmEmailVerification(joinedCode);
      setEmailVerified(true);
      updateStoredUser({ email, emailVerified: true });
      setStatus(response?.message || "Email verified successfully.");
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.response?.data?.error ||
          "Invalid or expired code."
      );
      setStatus("");
    } finally {
      setConfirming(false);
    }
  }

  function updateCode(index, value) {
    const nextChar = value.replace(/\D/g, "").slice(-1);
    setCode((prev) => {
      const next = [...prev];
      next[index] = nextChar;
      return next;
    });
    if (nextChar && index < CODE_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  }

  function handleCodeKeyDown(index, event) {
    if (event.key === "Backspace" && !code[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  }

  if (emailVerified) {
    return (
      <main className="verify-account-page verify-account-page--success">
        <section className="verify-success-card">
          <img className="verify-success-logo" src="/images/logo.png" alt="Yenkasa" />
          <div className="verify-confetti" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="verify-success-check">OK</div>
          <h1>Verification Successful!</h1>
          <p>Your account has been verified and is now secure.</p>

          <div className="verify-success-info">
            <img src="/images/verified.png" alt="" />
            <div>
              <strong>Account Verified</strong>
              <span>You can now access all features and enjoy a seamless experience.</span>
            </div>
          </div>

          <button type="button" className="verify-primary-btn" onClick={() => navigate("/")}>
            Go to Dashboard
          </button>
          <button type="button" className="verify-text-btn" onClick={() => navigate("/wallet")}>
            Go to Wallet
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="verify-account-page">
      <div className="verify-account-shell">
        <button
          type="button"
          className="verify-back"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          {"<"}
        </button>

        <header className="verify-account-header">
          <img src="/images/logo.png" alt="Yenkasa" />
          <h1>Verification</h1>
          <p>Secure your account in a few simple steps</p>
        </header>

        <div className="verify-steps" aria-label="Verification steps">
          <Step active done={emailVerified} label="Email Verify" icon="@" />
          <Step active={false} done={phoneVerified} label="Phone Verify" icon="P" />
          <Step active={false} done={verified} label="Confirm Code" icon="#" />
        </div>

        {error ? <div className="verify-alert verify-alert--error">{error}</div> : null}
        {status ? <div className="verify-alert">{status}</div> : null}

        <section className="verify-card">
          <div className="verify-card-title">
            <span>@</span>
            <div>
              <h2>Verify your email</h2>
              <p>We'll send a 6-digit code to your email address</p>
            </div>
          </div>
          <label className="verify-input">
            <span>@</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter your email"
              autoComplete="email"
            />
          </label>
          <button
            type="button"
            className="verify-primary-btn"
            onClick={handleRequestEmailCode}
            disabled={requesting || cooldown > 0}
          >
            {requesting
              ? "Sending..."
              : cooldown > 0
                ? `Resend in ${formatCountdown(cooldown)}`
                : "Send Email Code"}
          </button>
        </section>

        <section className="verify-card verify-card--disabled">
          <div className="verify-card-title">
            <span>P</span>
            <div>
              <h2>Verify your phone</h2>
              <p>SMS verification is not ready yet</p>
            </div>
          </div>
          <div className="verify-phone-grid">
            <div className="verify-country">GH +233</div>
            <label className="verify-input">
              <span>P</span>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Enter your phone number"
                disabled
              />
            </label>
          </div>
          <button type="button" disabled className="verify-primary-btn">
            Send SMS Code
          </button>
        </section>

        <form className="verify-card" onSubmit={handleConfirmCode}>
          <div className="verify-card-title">
            <span>#</span>
            <div>
              <h2>Enter verification code</h2>
              <p>Enter the 6-digit code you received</p>
            </div>
          </div>
          <div className="verify-code-grid">
            {code.map((digit, index) => (
              <input
                key={index}
                ref={(node) => {
                  inputsRef.current[index] = node;
                }}
                inputMode="numeric"
                pattern="[0-9]*"
                value={digit}
                onChange={(event) => updateCode(index, event.target.value)}
                onKeyDown={(event) => handleCodeKeyDown(index, event)}
                aria-label={`Code digit ${index + 1}`}
              />
            ))}
          </div>
          <button
            type="submit"
            disabled={confirming || joinedCode.length !== CODE_LENGTH}
            className="verify-primary-btn"
          >
            {confirming ? "Confirming..." : "Confirm Code"}
          </button>
        </form>

        <footer className="verify-secure-card">
          <img src="/images/verified.png" alt="" />
          <div>
            <strong>Your information is encrypted and secure</strong>
            <span>We take your security seriously</span>
          </div>
        </footer>
      </div>
    </main>
  );
}

function Step({ active, done, label, icon }) {
  return (
    <div className={`verify-step${active ? " is-active" : ""}${done ? " is-done" : ""}`}>
      <span>{done ? "OK" : icon}</span>
      <small>{label}</small>
    </div>
  );
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function formatCountdown(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
