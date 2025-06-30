const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    email: { type: String, unique: true, sparse: true },
    phone: { type: String, unique: true, sparse: true },
    username: { type: String, required: true, unique: true },
    location: { type: String },
    password: { type: String, required: true },
    verified: { type: Boolean, default: false },
    verificationCode: { type: String },
    codeExpiresAt: { type: Date },
    profileImage: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
