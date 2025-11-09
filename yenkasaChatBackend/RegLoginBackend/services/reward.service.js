// services/reward.service.js
const CoinTransaction = require('../models/cointransaction.model');
const User = require('../models/user.model');
const Post = require('../models/post.model');
const CoinSupply = require('../models/coinSupply');
const { v4: uuidv4 } = require('uuid');

const MAX_SUPPLY = 100_000_000;
const SUPPLY_ID = 'YENKASA_SUPPLY';

/**
 * RewardService.reward
 * - toUserId: ObjectId (required) — who receives coins
 * - amount: Number (required)
 * - opts: {
 *      fromUserId: ObjectId | null,
 *      type: String (enum type from schema) ,
 *      description: String,
 *      relatedPostId: ObjectId | null,
 *      relatedCommentId: ObjectId | null,
 *      activityId: String | null,
 *      skipSupplyCheck: Boolean (for admin/manual adjustments)
 *   }
 *
 * Returns created transaction doc or null if skipped (duplicate or supply)
 */
async function reward(toUserId, amount, opts = {}) {
  try {
    if (!toUserId || !amount || Number(amount) <= 0) {
      console.warn('reward: invalid args', { toUserId, amount });
      return null;
    }

    const {
      fromUserId = null,
      type = 'BONUS',
      description = '',
      relatedPostId = null,
      relatedCommentId = null,
      activityId = null,
      skipSupplyCheck = false
    } = opts;

    // 1) dedupe by activityId (optional)
    if (activityId) {
      const existing = await CoinTransaction.findOne({ activityId });
      if (existing) {
        console.log(`⚠️ reward skipped — activityId already exists: ${activityId}`);
        return null;
      }
    }

    // 2) ensure supply exists
    if (!skipSupplyCheck) {
      await CoinSupply.findByIdAndUpdate(
        SUPPLY_ID,
        { $setOnInsert: { totalMinted: 0 } },
        { upsert: true }
      );

      const supplyUpdate = await CoinSupply.findOneAndUpdate(
        { _id: SUPPLY_ID, totalMinted: { $lte: MAX_SUPPLY - amount } },
        { $inc: { totalMinted: amount } },
        { new: true }
      );

      if (!supplyUpdate) {
        console.warn('⚠️ reward aborted — insufficient supply');
        return null;
      }
    }

    // 3) find recipient and optional sender
    const toUser = await User.findById(toUserId).select('username walletId coinsBalance');
    if (!toUser) {
      console.warn('⚠️ reward aborted — recipient not found', toUserId);
      return null;
    }

    const fromUser = fromUserId ? await User.findById(fromUserId).select('username walletId') : null;

    // 4) compute balances and save recipient
    const toBefore = Number(toUser.coinsBalance || 0);
    toUser.coinsBalance = toBefore + Number(amount);
    await toUser.save();

    // 5) create transaction record
    const tx = await CoinTransaction.create({
      transactionId: uuidv4(),
      fromUserId: fromUser ? fromUser._id : null,
      toUserId: toUser._id,
      fromUsername: fromUser ? fromUser.username : 'System',
      toUsername: toUser.username,
      fromWalletId: fromUser ? fromUser.walletId : null,
      toWalletId: toUser.walletId,
      amount: Number(amount),
      type,
      description: description || `Reward: ${type}`,
      relatedPostId: relatedPostId || null,
      relatedCommentId: relatedCommentId || null,
      activityId: activityId || null,
      toUserBalanceBefore: toBefore,
      toUserBalanceAfter: toUser.coinsBalance,
      status: 'completed',
    });

    console.log(`✅ reward created: ${tx.transactionId} -> ${toUser.username} +${amount} (${type})`);

    return tx;
  } catch (err) {
    console.error('❌ reward error:', err);
    return null;
  }
}

module.exports = {
  reward
};
