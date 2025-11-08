const CoinTransaction = require('../models/cointransaction.model');
const User = require('../models/user.model');
const { v4: uuidv4 } = require('uuid'); // For unique transactionId

// 🪙 Transfer coins (walletId ➡ walletId)
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

    if (!fromUser) {
      return res.status(404).json({ error: 'Sender not found' });
    }
    if (!toUser) {
      return res.status(404).json({ error: 'Recipient user not found' });
    }

    if (fromUser.walletId === toWalletId) {
      return res.status(400).json({ error: 'Cannot transfer to your own wallet' });
    }

    // ✅ Ensure balances are valid numbers
    const fromBalance = Number(fromUser.coins ?? fromUser.coinsBalance ?? 0);
    const toBalance = Number(toUser.coins ?? toUser.coinsBalance ?? 0);

    if (isNaN(fromBalance) || isNaN(toBalance)) {
      console.error('❌ Invalid balance values:', {
        fromBalance,
        toBalance,
        fromUserId: fromUser._id,
        toUserId: toUser._id
      });
      return res.status(500).json({ error: 'Invalid balance values detected' });
    }

    if (fromBalance < amountNum) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // 💰 Balances before update
    const fromBefore = fromBalance;
    const toBefore = toBalance;

    // 🔄 Update balances safely
    fromUser.coins = fromBefore - amountNum;
    toUser.coins = toBefore + amountNum;

    await fromUser.save();
    await toUser.save();

    // 🧾 Record transaction with full identification
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
      fromUserBalanceAfter: fromUser.coins,
      toUserBalanceBefore: toBefore,
      toUserBalanceAfter: toUser.coins,
      status: 'completed'
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
exports.getUserTransactions = async (req, res) => {
  try {
    const userId = req.user.id;

    const transactions = await CoinTransaction.find({
      $or: [{ toUserId: userId }, { fromUserId: userId }]
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json({
      success: true,
      transactions
    });
  } catch (err) {
    console.error('❌ Failed to fetch transactions:', err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
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
    const user = await User.findById(userId).select('coinsBalance walletId username');

    res.json({
      success: true,
      username: user.username,
      walletId: user.walletId,
      balance: user.coinsBalance || 0
    });
  } catch (err) {
    console.error('❌ Error fetching balance:', err);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
};

