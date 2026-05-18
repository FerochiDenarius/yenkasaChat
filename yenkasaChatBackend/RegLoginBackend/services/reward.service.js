const CoinTransaction = require('../models/cointransaction.model');
const User = require('../models/user.model');
const Post = require('../models/post.model');
const CoinSupply = require('../models/coinSupply');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { SYSTEM_USER_ID, SYSTEM_USERNAME, SYSTEM_WALLET_ID } = require('../config/system');
const { sendNotification } = require('./notification.service');
const {
  GO_LIVE_DATE,
  normalizeRewardAmount,
  startOfMonth,
  getRewardGuard,
  logYkcActivity,
  recordCountryRewardAnalytics,
  resolveRewardCountry,
  getCountryRewardConfig
} = require('./ykcEconomy.service');


const MAX_SUPPLY = 100_000_000;
const SUPPLY_ID = 'YENKASA_SUPPLY';

async function reward(toUserId, amount, opts = {}) {
  try {
    const now = new Date();
    const type = opts.type || "BONUS";
    const normalizedAmount = normalizeRewardAmount(type, amount, now);
    if (!toUserId || !normalizedAmount || Number(normalizedAmount) <= 0) {
      console.warn('⚠️ Invalid reward params', { toUserId, amount: normalizedAmount, type });
      return null;
    }

    if (!mongoose.Types.ObjectId.isValid(toUserId)) {
      console.warn('⚠️ Invalid reward user id', { toUserId, type });
      return null;
    }

    const toUser = await User.findById(toUserId).select('username walletId coinsBalance ykcBalance ykcEarnedThisMonth ykcLastReset country verifiedCountry detectedCountry countryConfidence countryVerificationStatus');
    if (!toUser) {
      console.error("❌ Reward aborted → User not found:", toUserId);
      return null;
    }

    const rewardCountry = resolveRewardCountry(toUser);
    const rewardCap = getCountryRewardConfig(rewardCountry.country).dailyYkcCap;
    console.log('⚙️ [Reward] Begin →', {
      toUserId,
      requestedAmount: amount,
      amount: normalizedAmount,
      type,
      country: rewardCountry.country,
      countrySource: rewardCountry.source,
      dailyCap: rewardCap
    });

    const guard = await getRewardGuard({
      userId: toUserId,
      type,
      amount: normalizedAmount,
      now,
      country: rewardCountry.country,
      dailyCap: rewardCap
    });
    if (!guard.allowed) {
      console.warn('[YKC Reward] blocked', {
        userId: toUserId?.toString(),
        action: type,
        coinsAwarded: 0,
        reason: guard.reason,
        country: rewardCountry.country,
        dailyCap: guard.dailyCap || rewardCap,
        timestamp: now
      });
      await logYkcActivity({
        userId: toUserId,
        action: type,
        coinsAwarded: 0,
        timestamp: now,
        suspicious: true,
        metadata: {
          reason: guard.reason,
          dailyEarned: guard.dailyEarned,
          country: rewardCountry.country,
          countrySource: rewardCountry.source,
          dailyCap: guard.dailyCap || rewardCap
        }
      });
      await recordCountryRewardAnalytics(toUser, 0, {
        type,
        activityId: opts.activityId || null,
        blocked: true,
        reason: guard.reason
      });
      return null;
    }

    /* ---------------------------------------------------
     * ALWAYS generate fresh unique activityId
     * --------------------------------------------------- */
    let activityId = opts.activityId && opts.activityId !== "null"
      ? opts.activityId
      : uuidv4();

    if (opts.activityId && opts.activityId !== "null") {
      const existingTx = await CoinTransaction.findOne({
        toUserId,
        type,
        activityId,
        status: "completed"
      });

      if (existingTx) {
        console.warn("[YKC Reward] duplicate reward blocked", {
          userId: toUserId?.toString(),
          type,
          activityId,
          transactionId: existingTx.transactionId
        });
        await logYkcActivity({
          userId: toUserId,
          action: type,
          coinsAwarded: 0,
          timestamp: now,
          suspicious: true,
          metadata: {
            reason: "duplicate_activity_id",
            activityId,
            transactionId: existingTx.transactionId,
            country: rewardCountry.country,
            countrySource: rewardCountry.source
          }
        });
        await recordCountryRewardAnalytics(toUser, 0, {
          type,
          activityId,
          blocked: true,
          reason: "duplicate_activity_id"
        });
        return existingTx;
      }
    }

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
      { $inc: { totalMinted: normalizedAmount } },
      { new: true }
    );

    if (!supply) {
      console.error("❌ FAILED TO UPDATE SUPPLY: supply=null");
      return null;
    }

    if (now >= GO_LIVE_DATE && (!toUser.ykcLastReset || toUser.ykcLastReset < GO_LIVE_DATE)) {
      toUser.ykcEarnedThisMonth = 0;
      toUser.ykcLastReset = GO_LIVE_DATE;
    }

    const monthStart = startOfMonth(now);
    if (now >= GO_LIVE_DATE && (!toUser.ykcLastReset || toUser.ykcLastReset < monthStart)) {
      toUser.ykcEarnedThisMonth = 0;
      toUser.ykcLastReset = monthStart;
    }

    /* ---------------------------------------------------
     * Update balance
     * --------------------------------------------------- */
    const before = Number(toUser.coinsBalance || 0);
    const after = before + Number(normalizedAmount);

    toUser.coinsBalance = after;
    toUser.ykcBalance = after;
    toUser.ykcEarnedThisMonth = Number(toUser.ykcEarnedThisMonth || 0) + Number(normalizedAmount);
    await toUser.save();

    console.log(`💰 Reward applied → User=${toUser.username} | Before=${before} After=${after}`);

/* ---------------------------------------------------
 * ALWAYS Save transaction (no dedupe skip)
 * --------------------------------------------------- */
const tx = await CoinTransaction.create({
  transactionId: uuidv4(),
  activityId,
  type,
  amount: Number(normalizedAmount),
  description: opts.description || `Reward granted (${normalizedAmount})`,

  // 🌟 SYSTEM USER sends all rewards now
  fromUserId: SYSTEM_USER_ID,
  fromUsername: SYSTEM_USERNAME,
  fromWalletId: SYSTEM_WALLET_ID,

  // Recipient
  toUserId,
  toUsername: toUser.username,
  toWalletId: toUser.walletId,

  relatedPostId: opts.relatedPostId || null,
  relatedCommentId: opts.relatedCommentId || null,
  toUserBalanceBefore: before,
  toUserBalanceAfter: after,
  status: 'completed'
});


    console.log(`✅ Reward Transaction Saved → TXID=${tx.transactionId}`);
    await logYkcActivity({
      userId: toUserId,
      action: tx.type,
      coinsAwarded: Number(normalizedAmount),
      timestamp: now,
      postId: opts.relatedPostId || null,
      metadata: {
        transactionId: tx.transactionId,
        activityId,
        dailyEarnedBefore: guard.dailyEarned || 0,
        country: rewardCountry.country,
        countrySource: rewardCountry.source,
        dailyCap: rewardCap
      }
    });

    await recordCountryRewardAnalytics(toUser, Number(normalizedAmount), {
      type,
      activityId,
      transactionId: tx.transactionId,
      country: rewardCountry.country,
      countrySource: rewardCountry.source
    });

    try {
      const rewardMessage = opts.description
        ? `${opts.description}. +${Number(normalizedAmount)} YKC added to your wallet.`
        : `You earned +${Number(normalizedAmount)} YKC.`;

      await sendNotification({
        type: "reward",
        senderId: SYSTEM_USER_ID,
        receiverId: toUserId,
        activityId: tx.transactionId,
        targetType: "wallet",
        targetId: tx.transactionId,
        message: rewardMessage,
        push: true,
        pushTitle: "Reward earned",
        pushBody: rewardMessage,
        pushData: {
          transactionId: tx.transactionId,
          rewardType: tx.type,
          amount: Number(normalizedAmount)
        }
      });
    } catch (notifyErr) {
      console.error("⚠️ Reward notification failed:", notifyErr.message);
    }

    /* ---------------------------------------------------
     * Update verification metrics safely
     * --------------------------------------------------- */
    try {
   // --------------------------------------
// 🔧 UPDATE VERIFICATION METRICS
// --------------------------------------
/* ---------------------------------------------------
 * Update verification metrics safely
 * --------------------------------------------------- */

  const AppVerification = require('../models/appverification.model');
  const ver = await AppVerification.findOne({ userId: toUserId });

  if (ver) {
   switch (tx.type) {

  // ============================
  // USER ACTIONS – Comments MADE
  // ============================
  case "REWARD_COMMENT":
    ver.metrics.totalComments += 1;       // user-made comments
    ver.metrics.totalCommentsMade += 1;   // matches backend alias
    break;

  case "REWARD_REPLY":
    ver.metrics.totalComments += 1;
    ver.metrics.totalRepliesReceived += 1;  // reply RECEIVED under user's post
    break;

  // ============================
  // COMMENT LIKES RECEIVED
  // ============================
  case "REWARD_COMMENT_LIKE":
    ver.metrics.commentLikesReceived += 1;
    break;

  // ============================
  // POST LIKES RECEIVED
  // ============================
  case "REWARD_POST_LIKE":
    // This reward is paid to the user who liked a post. The post owner's
    // received-like metrics are updated from the post aggregate source.
    break;

      // ============================
  // REWARD POST APPROVED
  // ============================

    case "REWARD_POST_APPROVED":
  // Post totals are derived from actual Post documents during verification sync.
  break;


        // ============================
  // REWARD POST REJECTED
  // ============================


        // ============================
  // REWARD POST VIEW RECEIVED
  // ============================

  case "REWARD_POST_REJECTED":
  if (!ver.metrics.postsModerated) ver.metrics.postsModerated = 0;
  ver.metrics.postsModerated += 1;
  break;



  // ============================
  // POST VIEWS RECEIVED
  // ============================
  case "REWARD_POST_VIEW_RECEIVED":
  case "REWARD_POST_SINGLE_VIEW_RECEIVED":
    ver.metrics.totalViewsReceived += 1;
    ver.metrics.totalViewsCount += 1; // optional alias
    break;

  case "REWARD_POST_LIKE_RECEIVED":
    ver.metrics.totalLikesReceived = (ver.metrics.totalLikesReceived || 0) + 1;
    break;

  case "REWARD_POST_COMMENT_RECEIVED":
    ver.metrics.totalCommentsReceived = (ver.metrics.totalCommentsReceived || 0) + 1;
    break;

  // viewer views a post – no metric impact
  case "REWARD_POST_VIEW":
    break;

  // ============================
  // AD VIEWS
  // ============================
  case "REWARD_VIEWS":
    ver.metrics.adsViewed += 1;
    break;

  // ============================
  // MILESTONES (popular posts)
  // ============================
  case "REWARD_MILESTONE":
    ver.metrics.highEngagementPosts = 
      (ver.metrics.highEngagementPosts || 0) + 1;
    break;

  // ============================
  // FOLLOWER GROWTH
  // ============================
  case "REWARD_FOLLOW":
    // This reward is paid to the follower. Followers received belongs to
    // the target user and is handled by REWARD_FOLLOW_RECEIVED.
    break;

  case "REWARD_FOLLOW_RECEIVED":
    ver.metrics.totalFollowers += 1;
    break;

  // ============================
  // POSTS CREATED
  // ============================
  case "REWARD_POST":
    ver.metrics.postsCreated += 1;
    ver.metrics.totalPostCount += 1; 
    break;

  // ============================
  // COMMUNITY CREATION
  // ============================
  case "REWARD_CREATE_COMMUNITY":
    if (!ver.metrics.totalCommunitiesCreated)
       ver.metrics.totalCommunitiesCreated = 0;

    ver.metrics.totalCommunitiesCreated += 1;
    break;

  // ============================
  // DAILY LOGIN
  // ============================
  case "REWARD_DAILY_LOGIN":
    await ver.trackLogin();
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
