// routes/coins.js
const express = require('express');
const verifyToken = require('../middleware/auth');
const User = require('../models/user.model');
const CoinTransaction = require('../models/cointransaction.model');
const CoinSupply = require('../models/coinSupply');

const router = express.Router();
const MAX_SUPPLY = 100_000_000;

/** 🧩 Ensure supply doc exists */
async function ensureSupply() {
  await CoinSupply.findByIdAndUpdate(
    'YENKASA_SUPPLY',
    { $setOnInsert: { totalMinted: 0 } },
    { upsert: true }
  );
}

/** 🧾 GET /coins/balance */
router.get('/balance', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('username coinsBalance walletId');
    if (!user) return res.status(404).json({ message: 'User not found' });

    // total minted
    const supply = await CoinSupply.findById('YENKASA_SUPPLY');
    const totalMinted = supply ? supply.totalMinted : 0;

    // total earned and spent
    const earnedTransactions = await CoinTransaction.aggregate([
      { $match: { user: user._id, amount: { $gt: 0 } } },
      { $group: { _id: null, totalEarned: { $sum: '$amount' } } }
    ]);
    const spentTransactions = await CoinTransaction.aggregate([
      { $match: { user: user._id, amount: { $lt: 0 } } },
      { $group: { _id: null, totalSpent: { $sum: '$amount' } } }
    ]);

    res.status(200).json({
      username: user.username,
      walletId: user.walletId,
      balance: user.coinsBalance,
      totalMinted,
      remainingSupply: MAX_SUPPLY - totalMinted,
      totalEarned: earnedTransactions[0]?.totalEarned || 0,
      totalSpent: Math.abs(spentTransactions[0]?.totalSpent || 0)
    });
  } catch (error) {
    console.error('Error fetching balance:', error);
    res.status(500).json({ message: 'Failed to fetch balance', error: error.message });
  }
});

/** 💰 POST /coins/earn */
router.post('/earn', verifyToken, async (req, res) => {
  try {
    const { amount = 10, actionType = 'activity', referenceId } = req.body;
    const amt = Math.abs(Number(amount));
    if (!amt || amt <= 0) return res.status(400).json({ message: 'Invalid amount' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    await ensureSupply();

    const updatedSupply = await CoinSupply.findOneAndUpdate(
      { _id: 'YENKASA_SUPPLY', totalMinted: { $lte: MAX_SUPPLY - amt } },
      { $inc: { totalMinted: amt } },
      { new: true }
    );

    if (!updatedSupply) return res.status(400).json({ message: 'Insufficient total supply to mint new coins' });

    user.coinsBalance += amt;
    await user.save();

    const transaction = await CoinTransaction.create({
      user: user._id,
      type: 'earn',
      amount: amt,
      description: `Earned from ${actionType}`,
      referenceId,
      balanceAfter: user.coinsBalance
    });

    res.status(200).json({
      message: 'Coins earned successfully',
      newBalance: user.coinsBalance,
      transaction,
      totalMinted: updatedSupply.totalMinted,
      remainingSupply: MAX_SUPPLY - updatedSupply.totalMinted
    });
  } catch (error) {
    console.error('Error in /coins/earn:', error);
    res.status(500).json({ message: 'Failed to process earning', error: error.message });
  }
});

/** 🔁 POST /coins/transfer */
router.post('/transfer', verifyToken, async (req, res) => {
  try {
    const { recipientWalletId, amount, description } = req.body;
    const amt = Math.abs(Number(amount));
    if (!recipientWalletId || !amt) return res.status(400).json({ message: 'Missing required fields' });

    const sender = await User.findById(req.user.id);
    const recipient = await User.findOne({ walletId: recipientWalletId });

    if (!recipient) return res.status(404).json({ message: 'Recipient not found' });
    if (recipient._id.equals(sender._id)) return res.status(400).json({ message: 'Cannot transfer to self' });
    if (sender.coinsBalance < amt) return res.status(400).json({ message: 'Insufficient balance' });

    const fromBalanceBefore = sender.coinsBalance;
    const toBalanceBefore = recipient.coinsBalance;

    sender.coinsBalance -= amt;
    recipient.coinsBalance += amt;

    await sender.save();
    await recipient.save();

    const transaction = await CoinTransaction.create([
      {
        user: sender._id,
        type: 'transfer',
        amount: -amt,
        description: description || `Sent to ${recipient.username}`,
        balanceAfter: sender.coinsBalance,
        referenceModel: 'User',
        referenceId: recipient._id
      },
      {
        user: recipient._id,
        type: 'transfer',
        amount: amt,
        description: description || `Received from ${sender.username}`,
        balanceAfter: recipient.coinsBalance,
        referenceModel: 'User',
        referenceId: sender._id
      }
    ]);

    res.status(200).json({
      message: 'Transfer successful',
      senderBalance: sender.coinsBalance,
      recipient: {
        username: recipient.username,
        walletId: recipient.walletId,
        newBalance: recipient.coinsBalance
      },
      transaction
    });
  } catch (error) {
    console.error('Error transferring coins:', error);
    res.status(500).json({ message: 'Transfer failed', error: error.message });
  }
});

/** 🪙 GET /coins/transactions (with pagination) */
router.get('/transactions', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 50, type } = req.query;
    const skip = (page - 1) * limit;

    let query = { user: userId };
    if (type) query.type = type;

    const transactions = await CoinTransaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const totalTransactions = await CoinTransaction.countDocuments(query);

    res.status(200).json({
      transactions,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalTransactions / limit),
        totalTransactions,
        hasMore: skip + transactions.length < totalTransactions
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch transactions', error: error.message });
  }
});

/** 👀 GET /coins/transactions/:transactionId */
router.get('/transactions/:transactionId', verifyToken, async (req, res) => {
  try {
    const { transactionId } = req.params;
    const userId = req.user.id;

    const transaction = await CoinTransaction.findById(transactionId)
      .lean();

    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });
    if (transaction.user.toString() !== userId) return res.status(403).json({ message: 'Access denied' });

    res.status(200).json(transaction);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch transaction', error: error.message });
  }
});

/** 👑 POST /coins/mint (Admin only) */
router.post('/mint', verifyToken, async (req, res) => {
  try {
    const admin = await User.findById(req.user.id);
    if (!admin || admin.role !== 'admin') return res.status(403).json({ message: 'Admins only' });

    const { userId, amount, description } = req.body;
    const amt = Math.abs(Number(amount));
    if (!userId || !amt) return res.status(400).json({ message: 'Missing or invalid fields' });

    await ensureSupply();

    const updatedSupply = await CoinSupply.findOneAndUpdate(
      { _id: 'YENKASA_SUPPLY', totalMinted: { $lte: MAX_SUPPLY - amt } },
      { $inc: { totalMinted: amt } },
      { new: true }
    );
    if (!updatedSupply) return res.status(400).json({ message: 'Insufficient supply to mint' });

    const recipient = await User.findById(userId);
    if (!recipient) return res.status(404).json({ message: 'Recipient not found' });

    recipient.coinsBalance += amt;
    await recipient.save();

    const tx = await CoinTransaction.create({
      user: recipient._id,
      type: 'admin',
      amount: amt,
      description: description || `Admin mint by ${admin.username}`,
      balanceAfter: recipient.coinsBalance,
      referenceModel: 'Admin',
      referenceId: admin._id
    });

    res.status(200).json({
      message: `✅ Admin minted ${amt} YKC to ${recipient.username}`,
      transaction: tx,
      totalMinted: updatedSupply.totalMinted,
      remainingSupply: MAX_SUPPLY - updatedSupply.totalMinted
    });
  } catch (error) {
    console.error('Error minting coins:', error);
    res.status(500).json({ message: 'Error minting coins', error: error.message });
  }
});

module.exports = router;
