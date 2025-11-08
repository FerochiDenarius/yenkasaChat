const CoinTransaction = require('../models/cointransaction.model');
const User = require('../models/user.model');

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

    // Find sender and receiver by walletId
    const fromUser = await User.findById(fromUserId);
    const toUser = await User.findOne({ walletId: toWalletId });

    if (!toUser) {
      return res.status(404).json({ error: 'Recipient user not found' });
    }

    if (fromUser.walletId === toWalletId) {
      return res.status(400).json({ error: 'Cannot transfer to your own wallet' });
    }

    if (fromUser.coins < amountNum) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Balances before
    const fromBefore = fromUser.coins;
    const toBefore = toUser.coins;

    // Update balances
    fromUser.coins -= amountNum;
    toUser.coins += amountNum;

    await fromUser.save();
    await toUser.save();

    // Record transaction
    const transaction = new CoinTransaction({
      fromUserId: fromUser._id,
      toUserId: toUser._id,
      amount: amountNum,
      type: 'transfer',
      description: message || 'Transfer between wallets',
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


// 📋 Get transaction history for a user
exports.getUserTransactions = async (req, res) => {
  try {
    const userId = req.user.id;
    const transactions = await CoinTransaction.find({
      $or: [{ toUserId: userId }, { fromUserId: userId }]
    })
      .populate('fromUserId', 'username')
      .populate('toUserId', 'username')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ success: true, transactions });
  } catch (err) {
    console.error('❌ Failed to fetch transactions:', err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
};

// 💰 Get current balance for logged-in user
exports.getBalance = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select('coins');
    res.json({
      success: true,
      balance: user.coins || 0
    });
  } catch (err) {
    console.error('❌ Error fetching balance:', err);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
};
