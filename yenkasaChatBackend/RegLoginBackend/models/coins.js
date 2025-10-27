// routes/coins.js
const express = require('express');
const verifyToken = require('../middleware/auth');
const User = require('../models/user');
const CoinTransaction = require('../models/coinTransaction');
const Post = require('../models/post');
const router = express.Router();

/**
 * 🧾 GET /coins/balance
 * Returns the current user's Yenkasa Coins balance
 */
router.get('/balance', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('username coinsBalance');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json({ balance: user.coinsBalance, username: user.username });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch balance', error: error.message });
  }
});

/**
 * 💰 POST /coins/reward
 * Reward user coins (e.g., for posting, engagement)
 * body: { userId, amount, description, referenceId? }
 */
router.post('/reward', verifyToken, async (req, res) => {
  try {
    const { userId, amount, description, referenceId } = req.body;
    if (!userId || !amount || !description) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.coinsBalance += amount;
    await user.save();

    const transaction = await CoinTransaction.create({
      user: userId,
      amount,
      description,
      referenceId,
      balanceAfter: user.coinsBalance
    });

    res.status(200).json({
      message: 'Reward granted successfully',
      newBalance: user.coinsBalance,
      transaction
    });
  } catch (error) {
    console.error('Error rewarding coins:', error);
    res.status(500).json({ message: 'Error rewarding coins', error: error.message });
  }
});

/**
 * 🪙 GET /coins/transactions
 * View all coin transactions for a user
 */
router.get('/transactions', verifyToken, async (req, res) => {
  try {
    const transactions = await CoinTransaction.find({ user: req.user.id })
      .sort({ createdAt: -1 });
    res.status(200).json(transactions);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch transactions', error: error.message });
  }
});

module.exports = router;
