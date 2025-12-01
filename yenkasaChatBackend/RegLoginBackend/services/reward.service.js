const CoinTransaction = require('../models/cointransaction.model');
const User = require('../models/user.model');
const Post = require('../models/post.model');
const CoinSupply = require('../models/coinSupply');
const { v4: uuidv4 } = require('uuid');

const MAX_SUPPLY = 100_000_000;
const SUPPLY_ID = 'YENKASA_SUPPLY';

async function reward(toUserId, amount, opts = {}) {
  try {
    console.log('⚙️ [Reward] Begin →', { toUserId, amount, opts });

    if (!toUserId || !amount || Number(amount) <= 0) {
      console.warn('⚠️ Invalid reward params', { toUserId, amount });
      return null;
    }

    /* ---------------------------------------------------
     * ALWAYS generate fresh unique activityId
     * --------------------------------------------------- */
    let activityId = opts.activityId && opts.activityId !== "null"
      ? opts.activityId
      : uuidv4();

    /* ---------------------------------------------------
     * Ensure supply bucket exists
     * --------------------------------------------------- */
    await CoinSupply.findByIdAndUpdate(
      SUPPLY_ID,
      { $setOnInsert: { totalMinted: 0 } },
      { upsert: true }
    );

    /* ---------------------------------------------------
     * Mint supply (do NOT reject silently)
     * --------------------------------------------------- */
    const supply = await CoinSupply.findOneAndUpdate(
      { _id: SUPPLY_ID },
      { $inc: { totalMinted: amount } },
      { new: true }
    );

    if (!supply) {
      console.error("❌ FAILED TO UPDATE SUPPLY: supply=null");
      return null;
    }

    /* ---------------------------------------------------
     * Load user
     * --------------------------------------------------- */
    const toUser = await User.findById(toUserId).select('username walletId coinsBalance');
    if (!toUser) {
      console.error("❌ Reward aborted → User not found:", toUserId);
      return null;
    }

    /* ---------------------------------------------------
     * Update balance
     * --------------------------------------------------- */
    const before = Number(toUser.coinsBalance || 0);
    const after = before + Number(amount);

    toUser.coinsBalance = after;
    await toUser.save();

    console.log(`💰 Reward applied → User=${toUser.username} | Before=${before} After=${after}`);

    /* ---------------------------------------------------
     * ALWAYS Save transaction (no dedupe skip)
     * --------------------------------------------------- */
    const tx = await CoinTransaction.create({
      transactionId: uuidv4(),
      activityId,
      type: opts.type || "BONUS",
      amount: Number(amount),
      description: opts.description || `Reward granted (${amount})`,
      toUserId,
      toUsername: toUser.username,
      toWalletId: toUser.walletId,
      fromUserId: opts.fromUserId || null,
      fromUsername: opts.fromUsername || '',
      fromWalletId: opts.fromWalletId || '',
      relatedPostId: opts.relatedPostId || null,
      relatedCommentId: opts.relatedCommentId || null,
      toUserBalanceBefore: before,
      toUserBalanceAfter: after,
      status: 'completed'
    });

    console.log(`✅ Reward Transaction Saved → TXID=${tx.transactionId}`);

    /* ---------------------------------------------------
     * Update verification metrics safely
     * --------------------------------------------------- */
    try {
      const AppVerification = require('../models/appverification.model');
      const ver = await AppVerification.findOne({ userId: toUserId });

      if (ver) {
        switch (tx.type) {
          case "REWARD_COMMENT":
            ver.metrics.totalComments += 1;
            break;
          case "REWARD_COMMENT_LIKE":
            ver.metrics.totalComments += 0.1;
            break;
          case "REWARD_POST_LIKE":
            ver.metrics.maxLikesOnPost = Math.max(ver.metrics.maxLikesOnPost, 1);
            break;
          case "REWARD_DAILY_LOGIN":
            await ver.trackLogin();
            break;
          case "REWARD_VIEWS":
            await ver.trackAdView();
            break;
        }

        await ver.save();
      }
    } catch (err) {
      console.error("⚠️ Metrics update failed:", err.message);
    }

    return tx;

  } catch (err) {
    console.error("❌ [Reward Error]:", err);
    return null;
  }
}

module.exports = { reward };
