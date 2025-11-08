// routes/cointransaction.routes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const coinController = require('../Controller/cointransaction.controller');

// 🪙 Create (reward/transfer/purchase)
router.post('/transfer', auth, coinController.createTransaction);

// 📜 Transaction history
router.get('/history', auth, coinController.getUserTransactions);

// 📛 Get username by walletId
router.get('/wallet/:walletId/username', auth, coinController.getUsernameByWalletId);

// 💰 Current user balance
router.get('/balance', auth, coinController.getBalance);

module.exports = router;
