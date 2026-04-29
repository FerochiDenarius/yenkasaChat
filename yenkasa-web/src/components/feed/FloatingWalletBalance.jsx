import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getWalletBalance } from "../../api/wallet";
import { formatNumber } from "../../utils/format";
import { WALLET_REFRESH_EVENT } from "../../utils/walletEvents";

export default function FloatingWalletBalance() {
  const navigate = useNavigate();
  const [balance, setBalance] = useState(null);
  const [delta, setDelta] = useState(0);
  const [animating, setAnimating] = useState(false);
  const balanceRef = useRef(null);
  const mountedRef = useRef(false);
  const refreshTimerRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    refreshBalance({ silent: true });

    const intervalId = window.setInterval(() => {
      refreshBalance({ silent: false });
    }, 20000);

    function handleRefresh() {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = window.setTimeout(() => {
        refreshBalance({ silent: false, playSound: true });
      }, 450);
    }

    window.addEventListener(WALLET_REFRESH_EVENT, handleRefresh);
    window.addEventListener("focus", handleRefresh);

    return () => {
      mountedRef.current = false;
      window.clearInterval(intervalId);
      window.clearTimeout(refreshTimerRef.current);
      window.removeEventListener(WALLET_REFRESH_EVENT, handleRefresh);
      window.removeEventListener("focus", handleRefresh);
    };
  }, []);

  async function refreshBalance({ silent = false, playSound = false } = {}) {
    try {
      const data = await getWalletBalance();
      const nextBalance = Number(data?.balance ?? data?.coinsBalance ?? 0);
      const previousBalance = balanceRef.current;

      balanceRef.current = nextBalance;
      if (!mountedRef.current) return;

      setBalance(nextBalance);

      if (!silent && previousBalance !== null && nextBalance > previousBalance) {
        const increase = nextBalance - previousBalance;
        setDelta(increase);
        setAnimating(false);
        window.requestAnimationFrame(() => setAnimating(true));
        if (playSound) playCoinDropSound();
        window.setTimeout(() => {
          if (mountedRef.current) setAnimating(false);
        }, 1800);
      }
    } catch {
      if (mountedRef.current && balance === null) setBalance(0);
    }
  }

  return (
    <button
      type="button"
      className={`floating-wallet${animating ? " floating-wallet--gain" : ""}`}
      onClick={() => navigate("/wallet")}
      aria-label="Open wallet"
    >
      <span className="floating-wallet__coin">YKC</span>
      <span className="floating-wallet__body">
        <small>Wallet</small>
        <strong>{balance === null ? "..." : formatNumber(balance)}</strong>
      </span>
      {animating && delta > 0 ? (
        <span className="floating-wallet__delta">+{formatNumber(delta)}</span>
      ) : null}
      {animating ? (
        <span className="floating-wallet__drops" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      ) : null}
    </button>
  );
}

function playCoinDropSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const context = new AudioContext();
    const now = context.currentTime;
    const tones = [880, 1174, 1568];

    tones.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, now + index * 0.07);
      gain.gain.setValueAtTime(0.0001, now + index * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.08, now + index * 0.07 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.07 + 0.16);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now + index * 0.07);
      oscillator.stop(now + index * 0.07 + 0.18);
    });

    window.setTimeout(() => context.close().catch(() => {}), 500);
  } catch {
    // Browsers can block audio until the user has interacted with the page.
  }
}
