// controllers/cointransaction.controller.js
const CoinTransaction = require('../models/cointransaction.model');
const User = require('../models/user.model');

// 🪙 Create a coin transaction (reward, transfer, etc.)
exports.createTransaction = async (req, res) => {
  try {
    const { toUserId, fromUserId, amount, type, description, relatedPostId, relatedCommentId } = req.body;

    if (!toUserId || !amount || !type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const amountNum = Number(amount);
    if (isNaN(amountNum) || amountNum === 0) {
      return res.status(400).json({ error: 'Invalid transaction amount' });
    }

    const toUser = await User.findById(toUserId);
    if (!toUser) return res.status(404).json({ error: 'Recipient not found' });

    const fromUser = fromUserId ? await User.findById(fromUserId) : null;

    // Balances before
    const fromBefore = fromUser?.coins || 0;
    const toBefore = toUser.coins || 0;

    // Adjust balances
    if (fromUser) {
      if (fromUser.coins < amountNum) {
        return res.status(400).json({ error: 'Insufficient funds for transfer' });
      }
      fromUser.coins -= amountNum;
      await fromUser.save();
    }

    toUser.coins += amountNum;
    await toUser.save();

    // Create transaction record
    const transaction = new CoinTransaction({
      fromUserId: fromUserId || null,
      toUserId,
      amount: amountNum,
      type,
      description,
      relatedPostId: relatedPostId || null,
      relatedCommentId: relatedCommentId || null,
      fromUserBalanceBefore: fromBefore,
      fromUserBalanceAfter: fromUser ? fromUser.coins : fromBefore,
      toUserBalanceBefore: toBefore,
      toUserBalanceAfter: toUser.coins,
      status: 'completed'
    });

    await transaction.save();

    res.json({
      success: true,
      message: 'Transaction completed successfully',
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
