import api from "./client";

export async function getWalletBalance() {
  const { data } = await api.get("/coin-transactions/balance");
  return data;
}

export async function getWalletHistory() {
  const { data } = await api.get("/coin-transactions/history");
  return data;
}

export async function getWalletUsername(walletId) {
  const { data } = await api.get(`/coin-transactions/wallet/${walletId}/username`);
  return data;
}

export async function transferCoins(payload) {
  const { data } = await api.post("/coin-transactions/transfer", payload);
  return data;
}
