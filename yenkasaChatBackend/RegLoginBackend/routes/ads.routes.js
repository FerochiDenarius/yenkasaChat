const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const path = require('path');

const adsController = require(
  path.join(__dirname, '..', 'Controller', 'Ads.controller')
);


console.log('ROUTES DIR:', __dirname);
console.log('PARENT DIR CONTENTS:', require('fs').readdirSync('..'));


router.get('/feed', auth, AdsController.getAdsFeed);
router.post('/view/:adId', auth, AdsController.recordAdView);
router.post('/reward/:adId', auth, AdsController.rewardAd);
router.post('/create', auth, AdsController.createAd); // add admin check inside controller
router.post(
  "/reward-click/:adId",
  auth,
  AdsController.rewardAdClick
);



module.exports = router;
