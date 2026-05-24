export function sendWalletNotification(userId: string, balance: number) {
  return {
    userId,
    title: "Wallet updated",
    body: `Your wallet balance is now ${balance}`,
  };
}
