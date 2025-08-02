const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/user.model');
const { sendPasswordResetEmail } = require('../controller/forgotPassword.controller');



// ✅ Sanitize helper
const sanitize = (val) =>
  typeof val === 'string' ? val.trim().substring(0, 255) : val;

if (!process.env.JWT_SECRET || !process.env.REFRESH_TOKEN_SECRET) {
  throw new Error('❌ JWT_SECRET or REFRESH_TOKEN_SECRET is not set in environment.');
}

const ACCESS_EXPIRES_IN = '15m';
const REFRESH_EXPIRES_IN = '7d';

// ✅ REGISTER
router.post('/register', async (req, res) => {
  let { email, phoneNumber, username, location, password } = req.body;

  try {
    email = email ? sanitize(email.toLowerCase()) : null;
    phoneNumber = phoneNumber ? sanitize(phoneNumber) : null;
    username = sanitize(username.toLowerCase());
    location = sanitize(location);
    password = sanitize(password);

    if (!username || !location || !password || (!email && !phoneNumber)) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const existingUser = await User.findOne({
      $or: [
        ...(email ? [{ email }] : []),
        ...(phoneNumber ? [{ phoneNumber }] : []),
        { username },
      ],
    });

    if (existingUser) {
      return res.status(409).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      username,
      location,
      password: hashedPassword,
      ...(email && { email }),
      ...(phoneNumber && { phoneNumber }),
    });

    await newUser.save();

    // The /register response. Ensure Android side matches this if it consumes it.
    // This part is NOT what's causing the login token error, but good to be aware of its structure.
    res.status(201).json({
      _id: newUser._id,
      email: newUser.email,
      phoneNumber: newUser.phoneNumber,
      username: newUser.username,
      location: newUser.location,
      verified: newUser.verified,
    });

  } catch (err) {
    console.error('❌ Register error:', err.message);
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Duplicate entry detected (e.g., email or username already exists)' });
    }
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// ✅ LOGIN with Access + Refresh Token
router.post('/login', async (req, res) => {
  const { identifier, password } = req.body;

  try {
    if (!identifier || !password) {
      console.log('Login attempt failed: Missing identifier or password.');
      return res.status(400).json({ message: 'Missing credentials' });
    }

    const identifierLower = identifier.toLowerCase();
    console.log(`Login attempt for identifier: ${identifier} (searching as: ${identifierLower} or ${identifier} for phone)`);

  
    const user = await User.findOne({
      $or: [
        { email: identifierLower },
        { phoneNumber: identifier },
        { username: identifierLower },
      ],
    }).select('+refreshToken'); // Assuming refreshToken might be select:false in your User model

    if (!user) {
      console.log(`Login failed: User not found for identifier: ${identifier}`);
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log(`Login failed: Password mismatch for user: ${user.username || identifier}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    console.log(`Login successful for user: ${user.username}`);

    // Create tokens
    const accessTokenValue = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { // Renamed to accessTokenValue for clarity before remapping
      expiresIn: ACCESS_EXPIRES_IN,
    });
    const refreshTokenValue = jwt.sign({ userId: user._id }, process.env.REFRESH_TOKEN_SECRET, { // Renamed for clarity
      expiresIn: REFRESH_EXPIRES_IN,
    });

    // Store refreshToken in DB
    if (user.refreshToken !== undefined) { // Check if the field exists on the model
        user.refreshToken = refreshTokenValue;
        try {
            await user.save();
            console.log(`Refresh token saved for user: ${user.username}`);
        } catch (saveError) {
            console.error(`❌ Error saving refresh token for user ${user.username}:`, saveError.message);
            // Consider if this error should prevent login or just be logged
        }
    } else {
        console.warn(`User model for ${user.username} does not seem to have a refreshToken field. Refresh token not saved to DB.`);
    }


    
    const responsePayload = {
      user: {
        _id: user._id,                 // Android AuthUser expects "_id"
        email: user.email,
        phone: user.phoneNumber,       // MODIFIED: Send phone number under the key "phone" for Android's AuthUser
        username: user.username,
        location: user.location,
        verified: user.verified,
        playerId: user.playerId || null // ADDED: Send playerId if it exists (or null), for Android's AuthUser
      },
      token: accessTokenValue,         // MODIFIED: Send access token under the key "token" for Android's LoginResponse
      // refreshToken: refreshTokenValue // OMITTED from response body, as "unchangeable" Android LoginResponse doesn't expect it here.
                                       // It IS saved in the DB for the /token/refresh endpoint.
    };
    // CRITICAL LOG: Deploy with this and check Render logs after a login attempt.
    console.log('✅ Sending MODIFIED login success response payload TO MATCH ANDROID:', JSON.stringify(responsePayload, null, 2));
    //  ****************************************************************************************

    res.json(responsePayload);

  } catch (err) {
    console.error('❌ Login error (main catch block):', err.message);
    console.error(err.stack); // Log full stack
    res.status(500).json({ message: 'Server error during login' });
  }
});

router.post('/forgot-password', sendPasswordResetEmail);

// ✅ Refresh Token Endpoint
router.post('/token/refresh', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ message: 'Refresh token required' });
  }

  try {
    const payload = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    
    // Ensure User model has refreshToken field and it might be select:false
    const user = await User.findById(payload.userId).select('+refreshToken');

    if (!user || user.refreshToken !== refreshToken) {
      console.warn(`Refresh token mismatch or user not found for refresh. User ID: ${payload.userId}. Token provided: ${refreshToken}. Token in DB: ${user ? user.refreshToken : 'N/A'}`);
      return res.status(403).json({ message: 'Invalid refresh token (token mismatch or user not found)' });
    }

    const newAccessToken = jwt.sign({ userId: payload.userId }, process.env.JWT_SECRET, {
      expiresIn: ACCESS_EXPIRES_IN,
    });

    // This response is fine, but ensure Android side expects "accessToken" for this specific call
    res.json({ accessToken: newAccessToken }); 

  } catch (err) {
    console.error('❌ Token refresh error:', err.message);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Refresh token expired' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid refresh token (malformed or signature issue)' });
    }
    res.status(500).json({ message: 'Server error during token refresh' });
  }
});

// ✅ Debug route
router.get('/ping', (req, res) => {
  res.json({ message: '✅ Auth route is working!' });
});

module.exports = router;
