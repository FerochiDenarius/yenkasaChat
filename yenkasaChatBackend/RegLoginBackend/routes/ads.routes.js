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
router.post('/view/:adId', auth, adsController.recordAdView);
router.post('/reward/:adId', auth, adsController.rewardAd);
router.post('/create', auth, parseAdUpload, adsController.createAd);
router.post('/', auth, parseAdUpload, adsController.createAd);
router.post('/reward-click/:adId', auth, adsController.rewardAdClick);

module.exports = router;
