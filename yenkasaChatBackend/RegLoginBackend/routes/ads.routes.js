const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const path = require('path');

const adsController = require(
  path.join(__dirname, '..', 'Controller', 'Ads.controller')
);
const { uploadAdFiles } = require('../utils/upload');

function parseAdUpload(req, res, next) {
  uploadAdFiles()(req, res, (err) => {
    if (err) {
      console.error('❌ Ad upload parse error:', err);
      return res.status(400).json({
        success: false,
        message: err.message || 'Invalid ad upload'
      });
    }
    next();
  });
}

router.get('/feed', auth, adsController.getAdsFeed);
router.get('/pending', auth, adsController.getPendingAds);
router.get('/mine', auth, adsController.getMyAds);
router.post('/view/:adId', auth, adsController.recordAdView);
router.post('/reward/:adId', auth, adsController.rewardAd);
router.post('/track-monetization', auth, adsController.trackMonetizationEvent);

function maybeParseAdUpload(req, res, next) {
  const contentType = req.headers["content-type"] || "";

  // Only use multer for file uploads
  if (!contentType.includes("multipart/form-data")) {
    return next();
  }

  return parseAdUpload(req, res, next);
}

router.post('/create', auth, maybeParseAdUpload, adsController.createAd);
router.post('/', auth, maybeParseAdUpload, adsController.createAd);
router.put('/:adId/approve', auth, adsController.approveAd);
router.put('/:adId/reject', auth, adsController.rejectAd);

router.post('/reward-click/:adId', auth, adsController.rewardAdClick);

module.exports = router;
