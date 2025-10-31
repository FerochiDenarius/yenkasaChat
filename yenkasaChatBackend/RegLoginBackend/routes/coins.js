// routes/coins.js
const express = require('express');
const verifyToken = require('../middleware/auth');
const User = require('../models/user.model');
const CoinTransaction = require('../models/cointransaction.model');
const CoinSupply = require('../models/coinSupply');

const router = express.Router();
const MAX_SUPPLY = 100_000_000;

/**
 * 🧩 Ensure supply doc exists
 */
async function ensureSupply() {
  await CoinSupply.findByIdAndUpdate(
    'YENKASA_SUPPLY',
    { $setOnInsert: { totalMinted: 0 } },
    { upsert: true }
  );
}

/**
 * 🧾 GET /coins/balance
 */
router.get('/balance', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('username coinsBalance walletId');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const supply = await CoinSupply.findById('YENKASA_SUPPLY');
    const totalMinted = supply ? supply.totalMinted : 0;

    res.status(200).json({
      username: user.username,
      walletId: user.walletId,
      balance: user.coinsBalance,
      totalMinted,
      remainingSupply: MAX_SUPPLY - totalMinted
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch balance', error: error.message });
  }
});

/**
 * 💰 POST /coins/earn
 * Immediate reward for user actions (watching ads, viewing posts, etc.)
 * body: { amount?, actionType?, referenceId? }
 */
router.post('/earn', verifyToken, async (req, res) => {
  try {
    const { amount = 10, actionType = 'activity', referenceId } = req.body;
    const amt = Math.abs(Number(amount));
    if (!amt || amt <= 0) return res.status(400).json({ message: 'Invalid amount' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    await ensureSupply();

    // Check supply cap atomically
    const updatedSupply = await CoinSupply.findOneAndUpdate(
      { _id: 'YENKASA_SUPPLY', totalMinted: { $lte: MAX_SUPPLY - amt } },
      { $inc: { totalMinted: amt } },
      { new: true }
    );

    if (!updatedSupply) {
      return res.status(400).json({ message: 'Insufficient total supply to mint new coins' });
    }

    // Reward user
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

/**
 * 🔁 POST /coins/transfer
 */
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

    sender.coinsBalance -= amt;
    recipient.coinsBalance += amt;

    await sender.save();
    await recipient.save();

    await CoinTransaction.create([
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
      }
    });
  } catch (error) {
    console.error('Error transferring coins:', error);
    res.status(500).json({ message: 'Transfer failed', error: error.message });
  }
});

/**
 * 🪙 GET /coins/transactions
 */
router.get('/transactions', verifyToken, async (req, res) => {
  try {
    const transactions = await CoinTransaction.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.status(200).json(transactions);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch transactions', error: error.message });
  }
});

/**
 * 👑 POST /coins/mint
 * Admin-only controlled mint (respects total supply)
 */
router.post('/mint', verifyToken, async (req, res) => {
  try {
    const admin = await User.findById(req.user.id);
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied: Admins only' });
    }

    const { userId, amount, description } = req.body;
    const amt = Math.abs(Number(amount));
    if (!userId || !amt) return res.status(400).json({ message: 'Missing or invalid fields' });

    await ensureSupply();

    const updatedSupply = await CoinSupply.findOneAndUpdate(
      { _id: 'YENKASA_SUPPLY', totalMinted: { $lte: MAX_SUPPLY - amt } },
      { $inc: { totalMinted: amt } },
      { new: true }
    );

    if (!updatedSupply) {
      return res.status(400).json({ message: 'Insufficient supply to mint' });
    }

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
