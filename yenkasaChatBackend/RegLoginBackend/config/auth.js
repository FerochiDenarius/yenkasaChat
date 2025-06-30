const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/user.model');

// ✅ REGISTER
router.post('/register', async (req, res) => {
    const { email, phone, username, location, password } = req.body;

    if (!username || !location || !password || (!email && !phone)) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = new User({
            email,
            phone,
            username,
            location,
            password: hashedPassword
        });

        await user.save();

        res.status(201).json({
            _id: user._id,
            email: user.email,
            phone: user.phone,
            username: user.username,
            location: user.location,
            verified: user.verified
        });
    } catch (err) {
        console.error("Registration error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ✅ LOGIN
router.post('/login', async (req, res) => {
    const { identifier, password } = req.body;

    try {
        const user = await User.findOne({
            $or: [
                { phone: identifier },
                { email: identifier.toLowerCase() },
                { username: identifier }
            ]
        });

        if (!user) return res.status(404).json({ message: 'User not found' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.json({
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
        console.error("Login error:", err.message);
        res.status(500).json({ error: 'Login failed' });
    }
});

module.exports = router;
