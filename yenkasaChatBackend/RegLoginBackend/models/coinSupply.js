// models/coinSupply.js
const mongoose = require('mongoose');

const coinSupplySchema = new mongoose.Schema({
  // single document to represent system supply; we'll use a fixed _id for easy lookup
  _id: { type: String, default: 'YENKASA_SUPPLY' },
  totalMinted: { type: Number, default: 0 }, // total coins issued to user balances
}, { timestamps: true });

module.exports = mongoose.model('CoinSupply', coinSupplySchema);
