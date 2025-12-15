const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const path = require('path');

const adsController = require(
  path.join(__dirname, '..', 'Controller', 'Ads.controller')
);

router.get('/feed', auth, adsController.getAdsFeed);
router.post('/view/:adId', auth, adsController.recordAdView);
router.post('/reward/:adId', auth, adsController.rewardAd);
router.post('/create', auth, adsController.createAd);
router.post('/reward-click/:adId', auth, adsController.rewardAdClick);

module.exports = router;
