const express = require('express');
const bcrypt = require('bcryptjs'); // ✅ You missed this
const jwt = require('jsonwebtoken'); // ✅ Needed for login
const router = express.Router();
const User = require('../models/user.model'); // ✅ You missed this too

// ✅ REGISTER ROUTE
router.post('/register', async (req, res) => {
    console.log("👉 Incoming register request");
    console.log("Request body:", req.body);

    const { email, phone, username, location, password } = req.body;

    if (!username || !location || !password || (!email && !phone)) {
        return res.status(400).json({
            message: 'Missing required fields: username, location, password, and either email or phone.'
        });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = new User({
            email: email || null,
            phone: phone || null,
            username,
            location,
            password: hashedPassword
        });

        await user.save();

        res.status(201).json({
            user: {
                _id: user._id,
                email: user.email,
                phone: user.phone,
                username: user.username,
                location: user.location,
                verified: user.verified
            },
            token: jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' })
        });

    } catch (err) {
        console.error("❌ Registration error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ✅ LOGIN ROUTE
router.post('/login', async (req, res) => {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
        return res.status(400).json({ message: 'Missing identifier or password' });
    }

    try {
        const user = await User.findOne({
            $or: [{ email: identifier }, { phone: identifier }, { username: identifier }]
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.status(200).json({
            user: {
                _id: user._id,
                email: user.email,
                phone: user.phone,
                username: user.username,
                location: user.location,
                verified: user.verified
            },
            token
        });

    } catch (err) {
        console.error("❌ Login error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
