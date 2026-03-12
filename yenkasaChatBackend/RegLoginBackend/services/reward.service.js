const CoinTransaction = require('../models/cointransaction.model');
const User = require('../models/user.model');
const Post = require('../models/post.model');
const CoinSupply = require('../models/coinSupply');
const { v4: uuidv4 } = require('uuid');
const { SYSTEM_USER_ID, SYSTEM_USERNAME, SYSTEM_WALLET_ID } = require('../config/system');


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
    ver.metrics.totalLikesReceived += 1;
    ver.metrics.maxLikesOnPost = Math.max(
      ver.metrics.maxLikesOnPost,
      1
    );
    break;

      // ============================
  // REWARD POST APPROVED
  // ============================

    case "REWARD_POST_APPROVED":
  ver.metrics.postsCreated += 1;
  ver.metrics.totalPostCount += 1;
  break;


        // ============================
  // REWARD POST REJECTED
  // ============================


        // ============================
  // REWARD POST VIEW RECEIVED
  // ============================

  case "REWARD_POST_VIEW_RECEIVED":
  ver.metrics.totalViewsReceived += 1;
  break;


  case "REWARD_POST_REJECTED":
  if (!ver.metrics.postsModerated) ver.metrics.postsModerated = 0;
  ver.metrics.postsModerated += 1;
  break;



  // ============================
  // POST VIEWS RECEIVED
  // ============================
  case "REWARD_POST_VIEW_RECEIVED":
    ver.metrics.totalViewsReceived += 1;
    ver.metrics.totalViewsCount += 1; // optional alias
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
