// services/verificationEvaluator.js
const User = require('../models/user.model');
const CoinTransaction = require('../models/coinTransaction');
const CoinSupply = require('../models/coinSupply');
const verificationRules = require('../config/verificationRules');

const MAX_SUPPLY = 100_000_000;

/**
 * Ensure coin supply document exists
 */
async function ensureSupply() {
  await CoinSupply.findByIdAndUpdate(
    'YENKASA_SUPPLY',
    { $setOnInsert: { totalMinted: 0 } },
    { upsert: true }
  );
}

/**
 * Evaluate user stats, handle verification, and issue 300 YKC bonus after 3 weeks
 */
async function evaluateUserVerification(user) {
  const phase = user.verificationPhase || 'promotion';
  const rules = verificationRules[phase];
  const stats = user.activityStats;

  if (!stats) return { verified: false, phase, score: 0 };

  // 🧮 Check all criteria
  const meetsAllRequirements =
    stats.activeWeeks >= rules.minWeeks &&
    stats.adsWatched >= rules.adsWatched &&
    stats.commentsMade >= rules.comments &&
    stats.postsViewed >= rules.postsViewed &&
    stats.likesGiven >= rules.likesGiven &&
    stats.qualityPosts >= rules.qualityPosts;

  // 🧾 Calculate progress score
  let score = 0;
  if (stats.activeWeeks >= rules.minWeeks) score += 20;
  if (stats.adsWatched >= rules.adsWatched) score += 15;
  if (stats.commentsMade >= rules.comments) score += 15;
  if (stats.postsViewed >= rules.postsViewed) score += 20;
  if (stats.likesGiven >= rules.likesGiven) score += 15;
  if (stats.qualityPosts >= rules.qualityPosts) score += 15;
  user.verificationScore = Math.min(score, 100);

  // 🟡 Skip if already verified
  if (user.verified) {
    await user.save();
    return { verified: true, alreadyVerified: true, phase };
  }

  // 🕒 Check if 3 weeks passed since registration
  const threeWeeksInMs = 21 * 24 * 60 * 60 * 1000;
  const accountAge = Date.now() - new Date(user.createdAt).getTime();

  // ✅ Verification success
  if (meetsAllRequirements && accountAge >= threeWeeksInMs) {
    user.verified = true;
    user.verificationBanner = 'verified_badge.png';
    user.verificationDate = new Date();

    // 🪙 Bonus logic (300 YKC one-time)
    const bonusAmount = 300;
    await ensureSupply();

    const updatedSupply = await CoinSupply.findOneAndUpdate(
      { _id: 'YENKASA_SUPPLY', totalMinted: { $lte: MAX_SUPPLY - bonusAmount } },
      { $inc: { totalMinted: bonusAmount } },
      { new: true }
    );

    if (updatedSupply) {
      user.coinsBalance += bonusAmount;
      await CoinTransaction.create({
        user: user._id,
        type: 'bonus',
        amount: bonusAmount,
        description: 'Verification bonus (Phase 1 — 3-week completion)',
        balanceAfter: user.coinsBalance,
      });
    } else {
      console.warn('⚠️ Supply cap reached: could not issue 300 YKC bonus.');
    }

    await user.save();

    return {
      verified: true,
      phase,
      bonusIssued: !!updatedSupply,
      message: 'User verified and 300 YKC bonus granted',
    };
  }

  // ❌ Not yet verified
  await user.save();
  return { verified: false, phase, score };
}

module.exports = evaluateUserVerification;
