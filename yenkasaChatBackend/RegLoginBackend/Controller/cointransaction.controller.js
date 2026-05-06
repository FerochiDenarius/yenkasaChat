const CoinTransaction = require('../models/cointransaction.model');
const User = require('../models/user.model');
const { v4: uuidv4 } = require('uuid'); // For unique transactionId


// 🪙 Transfer coins (walletId ➡ walletId)
exports.createTransaction = async (req, res) => {
  try {
    const { toWalletId, amount, message } = req.body;
    const fromUserId = req.user.id;

    if (!toWalletId || !amount) {
      return res.status(400).json({ error: 'Missing required fields (toWalletId, amount)' });
    }

    const amountNum = Number(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({ error: 'Invalid transaction amount' });
    }

    // 🔍 Find sender and receiver
    const fromUser = await User.findById(fromUserId);
    const toUser = await User.findOne({ walletId: toWalletId });

    if (!fromUser) return res.status(404).json({ error: 'Sender not found' });
    if (!toUser) return res.status(404).json({ error: 'Recipient user not found' });
    if (fromUser.walletId === toWalletId) return res.status(400).json({ error: 'Cannot transfer to your own wallet' });

    const fromBalance = Number(fromUser.coinsBalance ?? 0);
    const toBalance = Number(toUser.coinsBalance ?? 0);

    if (fromBalance < amountNum) return res.status(400).json({ error: 'Insufficient balance' });

    const fromBefore = fromBalance;
    const toBefore = toBalance;

    // 🔄 Update balances
    fromUser.coinsBalance = fromBefore - amountNum;
    toUser.coinsBalance = toBefore + amountNum;

    await fromUser.save();
    await toUser.save();

    // ✅ Generate activityId for this transfer
    const activityId = uuidv4();

    // 🧾 Record transaction
    const transaction = new CoinTransaction({
      transactionId: uuidv4(),
      fromUserId: fromUser._id,
      toUserId: toUser._id,
      fromUsername: fromUser.username,
      toUsername: toUser.username,
      fromWalletId: fromUser.walletId,
      toWalletId: toUser.walletId,
      amount: amountNum,
      type: 'TRANSFER',
      description: message || `Transfer from ${fromUser.username} to ${toUser.username}`,
      fromUserBalanceBefore: fromBefore,
      fromUserBalanceAfter: fromUser.coinsBalance,
      toUserBalanceBefore: toBefore,
      toUserBalanceAfter: toUser.coinsBalance,
      status: 'completed',
      activityId // ✅ Attach activityId
    });

    await transaction.save();

    res.json({
      success: true,
      message: `Transferred ${amountNum} coins to ${toUser.username}`,
      transaction
    });

  } catch (err) {
    console.error('❌ Error creating transaction:', err);
    res.status(500).json({ error: 'Failed to process transaction' });
  }
};


// 📋 Get transaction history for a user (includes usernames + walletIds)
// routes/coin.routes.js (or wherever getUserTransactions is)
// 📋 Get transaction history for a user (with full debug logging)
exports.getUserTransactions = async (req, res) => {
  try {
    const userId = req.user?.id;
    console.log("🔍 [getUserTransactions] Request received for user:", userId);

    if (!userId) {
      console.warn("⚠️ No userId found in request. Check auth middleware.");
      return res.status(401).json({ error: "Unauthorized" });
    }

    // 🔎 Debug: show total transaction count in DB
    const totalCount = await CoinTransaction.countDocuments({});
    console.log("📦 Total transactions in DB:", totalCount);

    // 🔎 Debug: check if any exist for this user (without filter)
    const userCount = await CoinTransaction.countDocuments({
      $or: [{ toUserId: userId }, { fromUserId: userId }],
    });
    console.log(`👤 Transactions linked to user ${userId}:`, userCount);

    // ✅ Filter by activityId (only reward-based)
    const transactions = await CoinTransaction.find({
      $or: [{ toUserId: userId }, { fromUserId: userId }],
      activityId: { $exists: true, $ne: null },
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    console.log("📊 Filtered transactions (activityId != null):", transactions.length);

    // 🔍 Log first few if any
    if (transactions.length > 0) {
      console.log("🧾 Sample transaction:", {
        id: transactions[0]._id,
        type: transactions[0].type,
        amount: transactions[0].amount,
        activityId: transactions[0].activityId,
        toUserId: transactions[0].toUserId,
        fromUserId: transactions[0].fromUserId,
      });
    } else {
      console.warn("⚠️ No transactions found for this user with activityId.");
    }

    res.json({
      success: true,
      count: transactions.length,
      transactions,
    });
  } catch (err) {
    console.error("❌ [getUserTransactions] Failed to fetch transactions:", err);
    res.status(500).json({ error: "Failed to fetch transactions", details: err.message });
  }
};


// 👤 Get username by walletId
exports.getUsernameByWalletId = async (req, res) => {
  try {
    const { walletId } = req.params;
    const user = await User.findOne({ walletId }).select('username walletId');

    if (!user) {
      return res.status(404).json({ error: 'User not found for this walletId' });
    }

    res.json({
      success: true,
      username: user.username,
      walletId: user.walletId
    });
  } catch (err) {
    console.error('❌ Error fetching username by walletId:', err);
    res.status(500).json({ error: 'Failed to fetch username' });
  }
};

// 💰 Get current balance for logged-in user
exports.getBalance = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select('coinsBalance ykcBalance ykcEarnedThisMonth walletId username');
    const totalCoins = Number(user.coinsBalance || 0);

    res.json({
      success: true,
      username: user.username,
      walletId: user.walletId,
      balance: totalCoins,
      totalCoins,
      legacyCoins: totalCoins,
      ykcBalance: Number(user.ykcBalance ?? totalCoins),
      ykcEarnedThisMonth: Number(user.ykcEarnedThisMonth || 0)
    });
  } catch (err) {
    console.error('❌ Error fetching balance:', err);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
};
