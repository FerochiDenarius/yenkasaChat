// routes/coin.routes.js
const express = require('express');
const router = express.Router();
const User = require('../models/user.model');
const CoinTransaction = require('../models/cointransaction.model');
const authMiddleware = require('../middleware/auth');

// ✅ Get coin balance
router.get('/balance', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await User.findById(userId)
      .select('coinsBalance walletId username');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Calculate total earned and spent
    const earnedTransactions = await CoinTransaction.aggregate([
      {
        $match: {
          toUserId: user._id,
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          totalEarned: { $sum: '$amount' }
        }
      }
    ]);
    
    const spentTransactions = await CoinTransaction.aggregate([
      {
        $match: {
          fromUserId: user._id,
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          totalSpent: { $sum: '$amount' }
        }
      }
    ]);
    
    const totalEarned = earnedTransactions[0]?.totalEarned || 0;
    const totalSpent = spentTransactions[0]?.totalSpent || 0;
    
    res.json({
      balance: user.coinsBalance,
      totalEarned,
      totalSpent,
      walletId: user.walletId,
      username: user.username
    });
  } catch (err) {
    console.error('❌ Failed to fetch coin balance:', err);
    res.status(500).json({ error: 'Failed to fetch coin balance' });
  }
});

// ✅ Transfer coins to another user
router.post('/transfer', authMiddleware, async (req, res) => {
  try {
    const fromUserId = req.user.id;
    const { toUsername, amount, message } = req.body;
    
    if (!toUsername || !amount) {
      return res.status(400).json({ error: 'Recipient username and amount are required' });
    }
    
    if (amount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }
    
    const fromUser = await User.findById(fromUserId);
    const toUser = await User.findOne({ username: toUsername });
    
    if (!toUser) {
      return res.status(404).json({ error: 'Recipient user not found' });
    }
    
    if (fromUserId === toUser._id.toString()) {
      return res.status(400).json({ error: 'Cannot transfer coins to yourself' });
    }
    
    if (fromUser.coinsBalance < amount) {
      return res.status(400).json({ 
        error: 'Insufficient coins',
        balance: fromUser.coinsBalance,
        required: amount
      });
    }
    
    // Perform transfer
    const fromBalanceBefore = fromUser.coinsBalance;
    const toBalanceBefore = toUser.coinsBalance;
    
    fromUser.coinsBalance -= amount;
    toUser.coinsBalance += amount;
    
    await fromUser.save();
    await toUser.save();
    
    // Record transaction
    const transaction = await CoinTransaction.create({
      fromUserId,
      toUserId: toUser._id,
      amount,
      type: 'TRANSFER',
      description: message || `Transfer from ${fromUser.username} to ${toUser.username}`,
      status: 'completed',
      fromUserBalanceBefore,
      fromUserBalanceAfter: fromUser.coinsBalance,
      toUserBalanceBefore,
      toUserBalanceAfter: toUser.coinsBalance
    });
    
    res.json({
      success: true,
      message: `Successfully transferred ${amount} coins to ${toUser.username}`,
      transaction: {
        transactionId: transaction._id,
        amount,
        from: fromUser.username,
        to: toUser.username,
        newBalance: fromUser.coinsBalance
      }
    });
  } catch (err) {
    console.error('❌ Failed to transfer coins:', err);
    res.status(500).json({ error: 'Failed to transfer coins' });
  }
});

// ✅ Get transaction history
router.get('/transactions', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 50, type } = req.query;
    const skip = (page - 1) * limit;
    
    let query = {
      $or: [
        { fromUserId: userId },
        { toUserId: userId }
      ]
    };
    
    if (type) {
      query.type = type;
    }
    
    const transactions = await CoinTransaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('fromUserId', 'username profileImage')
      .populate('toUserId', 'username profileImage')
      .populate('relatedPostId', 'text')
      .lean();
    
    const totalTransactions = await CoinTransaction.countDocuments(query);
    
    // Format transactions for response
    const formattedTransactions = transactions.map(tx => ({
      ...tx,
      direction: tx.toUserId._id.toString() === userId ? 'incoming' : 'outgoing',
      otherParty: tx.toUserId._id.toString() === userId 
        ? (tx.fromUserId || { username: 'System', profileImage: '' })
        : tx.toUserId
    }));
    
    res.json({
      transactions: formattedTransactions,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalTransactions / limit),
        totalTransactions,
        hasMore: skip + transactions.length < totalTransactions
      }
    });
  } catch (err) {
    console.error('❌ Failed to fetch transactions:', err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// ✅ Get transaction details
router.get('/transactions/:transactionId', authMiddleware, async (req, res) => {
  try {
    const { transactionId } = req.params;
    const userId = req.user.id;
    
    const transaction = await CoinTransaction.findById(transactionId)
      .populate('fromUserId', 'username profileImage')
      .populate('toUserId', 'username profileImage')
      .populate('relatedPostId', 'text imageUrl')
      .populate('relatedCommentId', 'text')
      .lean();
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    // Check if user is part of this transaction
    const isFromUser = transaction.fromUserId?._id.toString() === userId;
    const isToUser = transaction.toUserId._id.toString() === userId;
    
    if (!isFromUser && !isToUser) {
      return res.status(403).json({ error: 'You do not have access to this transaction' });
    }
    
    res.json({
      transaction,
      direction: isToUser ? 'incoming' : 'outgoing'
    });
  } catch (err) {
    console.error('❌ Failed to fetch transaction:', err);
    res.status(500).json({ error: 'Failed to fetch transaction' });
  }
});

module.exports = router;