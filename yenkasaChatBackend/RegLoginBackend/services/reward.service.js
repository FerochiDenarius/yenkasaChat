// services/reward.service.js
const CoinTransaction = require('../models/cointransaction.model');
const User = require('../models/user.model');
const Post = require('../models/post.model');
const CoinSupply = require('../models/coinSupply');
const { v4: uuidv4 } = require('uuid');

const MAX_SUPPLY = 100_000_000;
const SUPPLY_ID = 'YENKASA_SUPPLY';

async function reward(toUserId, amount, opts = {}) {
  try {
    console.log('⚙️ [RewardService] Starting reward...', { toUserId, amount, opts });

    if (!toUserId || !amount || Number(amount) <= 0) {
      console.warn('⚠️ reward: invalid args', { toUserId, amount });
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

    // 1️⃣ Dedupe check
    if (activityId) {
      const existing = await CoinTransaction.findOne({ activityId });
      if (existing) {
        console.log(`⚠️ [RewardService] Skipped duplicate reward — activityId: ${activityId}`);
        return null;
      }
    }

    // 2️⃣ Supply check
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
        console.warn('⚠️ [RewardService] Aborted — insufficient supply');
        return null;
      }
      console.log(`💰 [RewardService] Supply OK → ${amount} minted`);
    }

    // 3️⃣ Load users
    const toUser = await User.findById(toUserId).select('username walletId coinsBalance');
    if (!toUser) {
      console.warn('⚠️ [RewardService] Aborted — recipient not found', toUserId);
      return null;
    }
    const fromUser = fromUserId ? await User.findById(fromUserId).select('username walletId') : null;

    // 4️⃣ Apply balance update
    const toBefore = Number(toUser.coinsBalance || 0);
    toUser.coinsBalance = toBefore + Number(amount);
    await toUser.save();
    console.log(`💸 [RewardService] Updated balance for ${toUser.username}: ${toBefore} → ${toUser.coinsBalance}`);

    // 5️⃣ Create transaction record
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

    console.log(`✅ [RewardService] Transaction complete: ${tx.transactionId} | ${type} | +${amount} → ${toUser.username}`);

    return tx;
  } catch (err) {
    console.error('❌ [RewardService] Error:', err);
    return null;
  }
}

module.exports = {
  reward
};
