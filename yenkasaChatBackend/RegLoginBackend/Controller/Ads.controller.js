const Ad = require('../models/Ad.model');
const AdView = require('../models/AdView.model');
const RewardTx = require('../models/RewardTransaction.model');
const User = require('../models/user.model'); // adjust name

// GET /ads/feed?page=&limit=
exports.getAdsFeed = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page-1)*limit;

    const ads = await Ad.find({ isActive: true }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
    res.json({ success:true, ads });
  } catch(err){ res.status(500).json({ success:false, err: err.message }); }
};

// POST /ads/view/:adId  (called after the ad finishes; include duration + fullyWatched boolean)
exports.recordAdView = async (req, res) => {
  try {
    const userId = req.user.id;
    const { adId } = req.params;
    const { durationMs = 0, fullyWatched = false, deviceInfo = {} } = req.body;

    const ad = await Ad.findById(adId);
    if(!ad) return res.status(404).json({ success:false, message:'Ad not found' });

    const adView = new AdView({ adId, userId, durationMs, fullyWatched, deviceInfo });
    await adView.save();

    // increment impressions
    ad.impressions = (ad.impressions||0) + 1;
    await ad.save();

    return res.json({ success:true, adViewId: adView._id, fullyWatched });
  } catch(err){ console.error(err); res.status(500).json({ success:false }); }
};

// POST /ads/reward/:adId  (idempotent — will only reward once per ad view per user)
exports.rewardAd = async (req, res) => {
  try {
    const userId = req.user.id;
    const { adId } = req.params;
    const { adViewId } = req.body; // recommended (returned from recordAdView)

    // 1) verify ad & adView
    const ad = await Ad.findById(adId);
    if(!ad) return res.status(404).json({ success:false, message:'Ad not found' });

    const adView = await AdView.findById(adViewId);
    if(!adView || String(adView.userId) !== String(userId)) {
      return res.status(400).json({ success:false, message:'Invalid ad view' });
    }

    if(!adView.fullyWatched) return res.status(400).json({ success:false, message:'Ad not fully watched' });

    if(adView.rewarded) {
      return res.status(409).json({ success:false, message:'Already rewarded' });
    }

    // 2) mark rewarded and create transaction atomically
    adView.rewarded = true;
    await adView.save();

    const tx = new RewardTx({
      userId,
      type: "AD_REWARD",
      amount: ad.rewardYKC || 5,
      adId: ad._id,
      meta: { note:'reward for watching ad' }
    });
    await tx.save();

    // credit user's wallet/coins (implement your existing wallet update)
    await User.findByIdAndUpdate(userId, { $inc: { coins: tx.amount } });

    // also increment verification metric adsViewed if desired:
    const AppVerification = require('../models/appVerification.model');
    const av = await AppVerification.findOne({ userId });
    if(av){
      av.currentMetrics.adsViewed = (av.currentMetrics.adsViewed || 0) + 1;
      await av.save();
    }

    return res.json({ success:true, rewarded: true, amount: tx.amount });
  } catch(err){ console.error(err); res.status(500).json({ success:false }); }
};
