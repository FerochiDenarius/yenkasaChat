// File: ./server.js

// ✅ Load environment variables FIRST
require('dotenv').config();

const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
// const fs = require('fs'); // Only if used elsewhere

const app = express();
app.use(express.json()); // Good, keep this high up

// --- MOUNT OTHER ROUTES FIRST (auth, contacts, etc.) ---
try {
    const oneSignalRoutes = require('./routes/onesignal'); // Assuming this should be here
    app.use('/api/onesignal', oneSignalRoutes);
    console.log('✅ Mounted /api/onesignal');

    const authRoutes = require('./routes/auth');
    app.use('/api/auth', authRoutes);
    console.log('✅ Mounted /api/auth');

    const contactRoutes = require('./routes/contacts.routes');
    app.use('/api/contacts', contactRoutes);
    console.log('✅ Mounted /api/contacts');

    const messageRoutes = require('./routes/messages.routes');
    app.use('/api/messages', messageRoutes);
    console.log('✅ Mounted /api/messages');

    const chatroomRoutes = require('./routes/chatroom.routes');
    app.use('/api/chatrooms', chatroomRoutes);
    console.log('✅ Mounted /api/chatrooms');

    const verifyRoutes = require('./routes/verify');
    app.use('/api/verify', verifyRoutes);
    console.log('✅ Mounted /api/verify');

    const userRoutes = require('./routes/user.routes');
    app.use('/api/users', userRoutes);
    console.log('✅ Mounted /api/users');

    const notificationRoutes = require('./routes/notifications.route');
    app.use('/api/notifications', notificationRoutes);
    console.log('✅ Mounted /api/notifications');

    const refreshTokenRoute = require('./routes/refresh-token');
    app.use('/api/refresh-token', refreshTokenRoute);
    console.log('✅ Mounted /api/refresh-token');

} catch (err) {
    console.error(`❌ Failed to load one or more primary route modules: ${err.message}`);
    console.error(err.stack); // Log stack for more detail
    // Depending on severity, you might want to process.exit(1) if a critical route fails
}
// --- END MOUNTING OTHER ROUTES ---


// --- TEMPORARY EXTREME DEBUG HANDLER FOR /api/forgot-password ---
// This handler is placed here so it has a chance to catch /api/forgot-password
// BEFORE the original (now commented out) dedicated route for it.
app.all('/api/forgot-password', (req, res, next) => {
    console.log(`--- [EXTREME DEBUG ${new Date().toISOString()}] --- Request received at /api/forgot-password ---`);
    console.log(`--- [EXTREME DEBUG] Method: ${req.method}`);
    console.log(`--- [EXTREME DEBUG] Path: ${req.path}`);
    console.log(`--- [EXTREME DEBUG] Headers: ${JSON.stringify(req.headers, null, 2)}`);
    console.log(`--- [EXTREME DEBUG] Body: ${JSON.stringify(req.body, null, 2)}`);

    if (req.method === 'POST') {
        console.log(`--- [EXTREME DEBUG] This IS a POST request. Sending custom success response. ---`);
        res.status(200).json({
            message: "EXTREME DEBUG: POST request to /api/forgot-password successfully caught directly in server.js!",
            timestamp: new Date().toISOString(),
            receivedBody: req.body
        });
    } else {
        console.log(`--- [EXTREME DEBUG] This is NOT a POST request (it's ${req.method}). Sending method not allowed. ---`);
        res.status(405).json({
            message: `EXTREME DEBUG: Method ${req.method} not allowed for /api/forgot-password. Only POST is handled by this debug handler.`,
            timestamp: new Date().toISOString()
        });
    }
    // DO NOT call next() here, we are handling the response.
});
console.log(`--- [SERVER STARTUP DEBUG ${new Date().toISOString()}] --- Registered EXTREME DEBUG handler for ALL methods at /api/forgot-password ---`);
// --- END TEMPORARY EXTREME DEBUG HANDLER ---


// --- ORIGINAL DEDICATED FORGOT PASSWORD ROUTE (COMMENTED OUT FOR DEBUGGING) ---
/*
try {
    const forgotPasswordDedicatedRoutes = require('./routes/forgotPassword.routes.js'); 
    app.use('/api/forgot-password', forgotPasswordDedicatedRoutes);
    console.log(`--- [SERVER STARTUP DEBUG ${new Date().toISOString()}] --- Successfully mounted forgotPasswordDedicatedRoutes at /api/forgot-password ---`);
} catch (routeError) {
    console.error(`--- [SERVER STARTUP DEBUG ${new Date().toISOString()}] --- CRITICAL ERROR mounting forgotPasswordDedicatedRoutes: ${routeError.message} ---`);
    console.error(routeError.stack);
}
*/
// --- END ORIGINAL DEDICATED FORGOT PASSWORD ROUTE ---


console.log("✅ All route module loading attempts and debug handler setup completed.");


// ✅ Dev-only test/debug routes
if (process.env.NODE_ENV === 'development') {
    app.get('/cloudinary-test', (req, res) => {
        res.json({
            name: process.env.CLOUDINARY_CLOUD_NAME,
            key: process.env.CLOUDINARY_API_KEY,
            secret: process.env.CLOUDINARY_API_SECRET ? '✅ present' : '❌ missing',
        });
    });

    app.get('/api/auth/ping', (req, res) => {
        res.json({ message: '✅ Auth route is working!' });
    });
} else {
    console.log('🔐 Test routes disabled in production');
}

// ✅ MongoDB connection and server start
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => {
    console.log('✅ MongoDB connected');

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
    });
})
.catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
});
