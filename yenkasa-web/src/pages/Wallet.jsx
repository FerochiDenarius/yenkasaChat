import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getWalletBalance,
  getWalletHistory,
  getWalletUsername,
  transferCoins,
} from "../api/wallet";
import BottomNav from "../components/feed/BottomNav";
import { formatNumber, formatRelativeTime } from "../utils/format";
import "../styles/wallet.css";

export default function Wallet() {
  const navigate = useNavigate();
  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ toWalletId: "", amount: "", message: "" });
  const [recipient, setRecipient] = useState("");
  const [transferStatus, setTransferStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [activeTab, setActiveTab] = useState("recent");

  useEffect(() => {
    loadWallet();
  }, []);

  useEffect(() => {
    let active = true;
    const walletId = form.toWalletId.trim();
    setRecipient("");
    if (walletId.length < 5) return undefined;

    const timer = window.setTimeout(() => {
      getWalletUsername(walletId)
        .then((data) => {
          if (active) setRecipient(data?.username || "");
        })
        .catch(() => {
          if (active) setRecipient("");
        });
    }, 450);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [form.toWalletId]);

  async function loadWallet() {
    setLoading(true);
    setError("");
    try {
      const [balanceData, historyData] = await Promise.all([
        getWalletBalance(),
        getWalletHistory(),
      ]);
      setBalance(balanceData || null);
      setTransactions(Array.isArray(historyData?.transactions) ? historyData.transactions : []);
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "Wallet could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  async function handleTransfer(event) {
    event.preventDefault();
    setSubmitting(true);
    setTransferStatus("");
    setError("");

    try {
      const response = await transferCoins({
        toWalletId: form.toWalletId.trim(),
        amount: Number(form.amount),
        message: form.message.trim(),
      });
      setTransferStatus(response?.message || "Transfer completed.");
      setForm({ toWalletId: "", amount: "", message: "" });
      await loadWallet();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "Transfer failed.");
    } finally {
      setSubmitting(false);
    }
  }

  const incomingTotal = useMemo(
    () => sumTransactions(transactions, balance?.walletId, "in"),
    [transactions, balance]
  );
  const outgoingTotal = useMemo(
    () => sumTransactions(transactions, balance?.walletId, "out"),
    [transactions, balance]
  );
  const visibleTransactions = activeTab === "recent" ? transactions.slice(0, 20) : transactions;

  return (
    <main className="wallet-page">
      <div className="wallet-shell">
        <header className="wallet-topbar">
          <button className="wallet-back" type="button" onClick={() => navigate(-1)} aria-label="Go back">
            ←
          </button>
          <div>
            <h1>Yenkasa Coin Wallet <span>◆</span></h1>
            <p>Secure • Decentralized • Yours</p>
          </div>
          <button className="wallet-bell" type="button" onClick={() => navigate("/notifications")} aria-label="Notifications">
            ◔
            <i />
          </button>
        </header>

        {error ? <div className="wallet-error">{error}</div> : null}

        <section className="wallet-hero">
          <div className="wallet-coin-mark" aria-hidden="true">
            <img src="/images/yenkasa_web_assets/yenkasa_logo.png" alt="" />
          </div>
          <div>
            <span className="wallet-hero__label">Current Balance <b>◎</b></span>
            <strong>{loading ? "..." : formatBalance(balance?.balance || 0)}</strong>
            <em>YENKASA COINS</em>
            <small>≈ ${estimateUsd(balance?.balance || 0)} USD</small>
          </div>
          <div className="wallet-hero__stats">
            <Metric label="Total Earned" value={`${formatNumber(incomingTotal)} YKC ↑`} />
            <Metric label="Total Spent" value={`${formatNumber(outgoingTotal)} YKC ↓`} />
            <Metric label="Transaction" value={`${formatNumber(transactions.length)} ⌁`} />
          </div>
        </section>

        <section className="wallet-actions">
          <ActionTile icon="↗" title="Send" subtitle="Send Coins" onClick={() => setShowTransfer((value) => !value)} />
          <ActionTile icon="↓" title="Receive" subtitle="Receive Coins" onClick={() => navigator.clipboard?.writeText(balance?.walletId || "")} />
          <ActionTile icon="↔" title="Convert" subtitle="YKC ↔ USD" disabled />
          <ActionTile icon="▦" title="Scan" subtitle="Pay / Receive" disabled />
        </section>

        <section className="wallet-address-card">
          <span>▣</span>
          <div>
            <small>Your Wallet Address</small>
            <strong>{shortWallet(balance?.walletId)}</strong>
          </div>
          {balance?.walletId ? (
            <button type="button" onClick={() => navigator.clipboard?.writeText(balance.walletId)}>
              ⧉
            </button>
          ) : null}
          <a href="#wallet-history">View on Explorer ↗</a>
        </section>

        {showTransfer ? (
          <section className="wallet-transfer">
          <h2>Send YKC</h2>
          <form onSubmit={handleTransfer}>
            <label>
              Wallet ID
              <input
                value={form.toWalletId}
                onChange={(event) => setForm((prev) => ({ ...prev, toWalletId: event.target.value }))}
                placeholder="Recipient wallet ID"
                required
              />
              {recipient ? <span className="wallet-recipient">Recipient: {recipient}</span> : null}
            </label>
            <label>
              Amount
              <input
                type="number"
                min="1"
                value={form.amount}
                onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
                placeholder="0"
                required
              />
            </label>
            <label className="wallet-transfer__full">
              Message
              <input
                value={form.message}
                onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}
                placeholder="Optional note"
              />
            </label>
            <button type="submit" disabled={submitting}>
              {submitting ? "Sending..." : "Send Coins"}
            </button>
          </form>
          {transferStatus ? <div className="wallet-success">{transferStatus}</div> : null}
        </section>
        ) : null}

        <section className="wallet-history" id="wallet-history">
          <div className="wallet-section-title">
            <div className="wallet-tabs">
              <button
                type="button"
                className={activeTab === "recent" ? "is-active" : ""}
                onClick={() => setActiveTab("recent")}
              >
                Recent Transactions
              </button>
              <button
                type="button"
                className={activeTab === "all" ? "is-active" : ""}
                onClick={() => setActiveTab("all")}
              >
                All Transactions
              </button>
            </div>
            <button type="button" onClick={loadWallet}>⌁ Filter</button>
          </div>

          {loading ? <div className="wallet-empty">Loading wallet...</div> : null}
          {!loading && !transactions.length ? (
            <div className="wallet-empty">No wallet activity yet.</div>
          ) : null}
          {visibleTransactions.map((transaction) => (
            <TransactionRow
              key={transaction._id || transaction.transactionId}
              transaction={transaction}
              walletId={balance?.walletId}
            />
          ))}
        </section>
      </div>
      <BottomNav />
    </main>
  );
}

function Metric({ label, value }) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function ActionTile({ icon, title, subtitle, onClick, disabled = false }) {
  return (
    <button type="button" className="wallet-action-tile" onClick={onClick} disabled={disabled}>
      <span>{icon}</span>
      <strong>{title}</strong>
      <small>{subtitle}</small>
    </button>
  );
}

function TransactionRow({ transaction, walletId }) {
  const incoming = transaction.toWalletId === walletId || !transaction.fromWalletId;
  const sign = incoming ? "+" : "-";
  return (
    <article className="wallet-transaction">
      <div className="wallet-transaction__coin">
        <img src="/images/yenkasa_web_assets/yenkasa_logo.png" alt="" />
        <span className={`wallet-transaction__icon${incoming ? " is-in" : " is-out"}`}>
          {iconForTransaction(transaction.type, incoming)}
        </span>
      </div>
      <div>
        <strong>{transaction.description || humanTransactionType(transaction.type)}</strong>
        <span>{transaction.type}</span>
        <small>◷ {formatRelativeTime(transaction.createdAt)}</small>
      </div>
      <div className="wallet-transaction__amount">
        <strong>{sign}{formatNumber(transaction.amount)} YKC</strong>
        <span>Confirmed</span>
      </div>
    </article>
  );
}

function formatBalance(value) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function estimateUsd(value) {
  return (Number(value || 0) * 0.00832).toFixed(2);
}

function shortWallet(walletId = "") {
  if (!walletId) return "Wallet unavailable";
  if (walletId.length <= 14) return walletId;
  return `${walletId.slice(0, 8)}...${walletId.slice(-8)}`;
}

function iconForTransaction(type = "", incoming) {
  if (type.includes("VIEW")) return incoming ? "↓" : "◎";
  if (type.includes("ACCOUNT_AGE")) return "▣";
  if (type.includes("COMMENT")) return "✎";
  if (type.includes("LIKE")) return "♡";
  if (type === "TRANSFER") return incoming ? "↓" : "↗";
  return incoming ? "↓" : "↗";
}

function humanTransactionType(type = "") {
  return type
    .replace(/^REWARD_/, "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function sumTransactions(transactions, walletId, direction) {
  return transactions.reduce((sum, transaction) => {
    const incoming = transaction.toWalletId === walletId || !transaction.fromWalletId;
    if ((direction === "in" && incoming) || (direction === "out" && !incoming)) {
      return sum + Number(transaction.amount || 0);
    }
    return sum;
  }, 0);
}
