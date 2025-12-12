const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const AdsController = require('../Controller/ads.controller');

router.get('/feed', auth, AdsController.getAdsFeed);
router.post('/view/:adId', auth, AdsController.recordAdView);
router.post('/reward/:adId', auth, AdsController.rewardAd);
router.post('/create', auth, AdsController.createAd); // add admin check inside controller
router.post("/reward-click/:adId", auth, AdsController.rewardClick);

module.exports = router;
