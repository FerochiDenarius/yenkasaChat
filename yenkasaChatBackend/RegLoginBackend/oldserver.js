// File: ./server.js

// ✅ Load environment variables FIRST
require('dotenv').config();

const express = require('express');
const path = require('path');
const app = express();


const mongoose = require('mongoose');
// const fs = require('fs'); // Only if used elsewhere

app.use('/reset-password', express.static(path.join(__dirname, 'public/reset-password')));

app.use(express.json()); // Good, keep this high up

app.use('/api/reset-password', require('./routes/auth/resetPassword'));

const path = require('path');

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, 'public')));
app.get('/reset-password/:token', (req, res) => {
  const { token } = req.params;
  res.redirect(`yenkasachat://reset-password/${token}`);
});


try {
    const oneSignalRoutes = require('./routes/onesignal');  
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



try {
    const forgotPasswordDedicatedRoutes = require('./routes/forgotPassword.routes.js'); 
    app.use('/api/forgot-password', forgotPasswordDedicatedRoutes);
    console.log(`--- [SERVER STARTUP DEBUG ${new Date().toISOString()}] --- Successfully mounted forgotPasswordDedicatedRoutes at /api/forgot-password ---`);
} catch (routeError) {
    console.error(`--- [SERVER STARTUP DEBUG ${new Date().toISOString()}] --- CRITICAL ERROR mounting forgotPasswordDedicatedRoutes: ${routeError.message} ---`);
    console.error(routeError.stack);
}



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
