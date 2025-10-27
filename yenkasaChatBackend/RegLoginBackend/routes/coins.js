// routes/coins.js
const express = require('express');
const verifyToken = require('../middleware/auth');
const User = require('../models/user.model'); // ✅ Correct filename
const CoinTransaction = require('../models/coinTransaction');
const router = express.Router();

// 🪙 Yenkasa global supply (hard cap)
const MAX_SUPPLY = 100_000_000;

// Cached total supply (optional optimization)
let totalMintedCache = 0;

/**
 * Helper: calculate total minted coins in the system
 */
async function getTotalMinted() {
  // Use cache to reduce DB load
  if (totalMintedCache === 0) {
    const result = await User.aggregate([
      { $group: { _id: null, total: { $sum: '$coinsBalance' } } }
    ]);
    totalMintedCache = result[0]?.total || 0;
  }
  return totalMintedCache;
}

/**
 * Helper: update total minted cache when minting
 */
function updateTotalMintedCache(amount) {
  totalMintedCache += amount;
}

/**
 * 🧾 GET /coins/balance
 * Returns the current user's Yenkasa Coins balance
 */
router.get('/balance', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('username coinsBalance walletId');
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.status(200).json({
      username: user.username,
      walletId: user.walletId,
      balance: user.coinsBalance,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch balance', error: error.message });
  }
});

/**
 * 💰 POST /coins/reward
 * Reward coins to a user (controlled mint)
 * body: { userId, amount, description, referenceId }
 */
router.post('/reward', verifyToken, async (req, res) => {
  try {
    const { userId, amount, description, referenceId } = req.body;
    if (!userId || !amount || !description) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const amt = Math.abs(Number(amount));
    if (amt <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    const totalMinted = await getTotalMinted();
    if (totalMinted + amt > MAX_SUPPLY) {
      return res.status(400).json({
        message: `Cannot mint beyond total supply of ${MAX_SUPPLY.toLocaleString()} YKC`,
        totalMinted,
      });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Reward
    user.coinsBalance += amt;
    await user.save();
    updateTotalMintedCache(amt);

    // Log transaction
    const transaction = await CoinTransaction.create({
      user: userId,
      type: 'earn',
      amount: amt,
      description,
      referenceId,
      balanceAfter: user.coinsBalance,
    });

    res.status(200).json({
      message: 'Reward granted successfully',
      newBalance: user.coinsBalance,
      transaction,
      totalMinted: totalMinted + amt,
      supplyRemaining: MAX_SUPPLY - (totalMinted + amt),
    });
  } catch (error) {
    console.error('Error rewarding coins:', error);
    res.status(500).json({ message: 'Error rewarding coins', error: error.message });
  }
});

/**
 * 🔁 POST /coins/transfer
 * Transfer coins from current user to another by walletId
 * body: { recipientWalletId, amount, description? }
 */
router.post('/transfer', verifyToken, async (req, res) => {
  try {
    const { recipientWalletId, amount, description } = req.body;
    const amt = Math.abs(Number(amount));

    if (!recipientWalletId || !amt) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const sender = await User.findById(req.user.id);
    const recipient = await User.findOne({ walletId: recipientWalletId });

    if (!recipient) return res.status(404).json({ message: 'Recipient not found' });
    if (recipient._id.equals(sender._id)) {
      return res.status(400).json({ message: 'Cannot transfer to self' });
    }
    if (sender.coinsBalance < amt) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    // Atomic update
    sender.coinsBalance -= amt;
    recipient.coinsBalance += amt;

    await sender.save();
    await recipient.save();

    // Log both transactions
    await CoinTransaction.create([
      {
        user: sender._id,
        type: 'transfer',
        amount: -amt,
        description: description || `Sent to ${recipient.username}`,
        balanceAfter: sender.coinsBalance,
        referenceModel: 'User',
        referenceId: recipient._id,
      },
      {
        user: recipient._id,
        type: 'transfer',
        amount: amt,
        description: description || `Received from ${sender.username}`,
        balanceAfter: recipient.coinsBalance,
        referenceModel: 'User',
        referenceId: sender._id,
      },
    ]);

    res.status(200).json({
      message: 'Transfer successful',
      senderBalance: sender.coinsBalance,
      recipient: {
        username: recipient.username,
        walletId: recipient.walletId,
        newBalance: recipient.coinsBalance,
      },
    });
  } catch (error) {
    console.error('Error transferring coins:', error);
    res.status(500).json({ message: 'Transfer failed', error: error.message });
  }
});

/**
 * 🪙 GET /coins/transactions
 * View all coin transactions for a user
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
 * Admin-only minting of new coins (adds to total supply)
 * body: { userId, amount, description }
 */
router.post('/mint', verifyToken, async (req, res) => {
  try {
    // Check admin privileges
    const admin = await User.findById(req.user.id);
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied: Admins only' });
    }

    const { userId, amount, description } = req.body;
    if (!userId || !amount) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const amt = Math.abs(Number(amount));
    if (amt <= 0) return res.status(400).json({ message: 'Invalid amount' });

    // Supply cap check
    const totalMinted = await getTotalMinted();
    if (totalMinted + amt > MAX_SUPPLY) {
      return res.status(400).json({
        message: `Cannot mint beyond total supply of ${MAX_SUPPLY.toLocaleString()} YKC`,
        totalMinted,
      });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'Recipient user not found' });

    user.coinsBalance += amt;
    await user.save();
    updateTotalMintedCache(amt);

    const tx = await CoinTransaction.create({
      user: user._id,
      type: 'admin',
      amount: amt,
      description: description || `Admin mint by ${admin.username}`,
      balanceAfter: user.coinsBalance,
      referenceModel: 'Admin',
      referenceId: admin._id,
    });

    res.status(200).json({
      message: `✅ Admin minted ${amt} YKC to ${user.username}`,
      transaction: tx,
      totalMinted: totalMinted + amt,
      remainingSupply: MAX_SUPPLY - (totalMinted + amt),
    });
  } catch (error) {
    console.error('Error minting coins:', error);
    res.status(500).json({ message: 'Error minting coins', error: error.message });
  }
});

module.exports = router;
