require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const app = express();

app.use(express.json());

// Serve reset password HTML
app.use('/reset-password', express.static(path.join(__dirname, 'public/reset-password')));
app.use(express.static(path.join(__dirname, 'public')));

// Deep link redirection to app
app.get('/reset-password/:token', (req, res) => {
  const { token } = req.params;
  res.redirect(`yenkasachat://reset-password/${token}`);
});

// Mount API routes (double check these file paths)
try {
    app.use('/api/reset-password', require('./routes/resetPassword')); // ✅ adjusted
    app.use('/api/forgot-password', require('./routes/forgotPassword.routes')); // ✅ ensure correct name
    app.use('/api/onesignal', require('./routes/onesignal'));
    app.use('/api/auth', require('./routes/auth')); // ✅ this must exist in ./routes/auth.js
    app.use('/api/contacts', require('./routes/contacts.routes'));
    app.use('/api/messages', require('./routes/messages.routes'));
    app.use('/api/chatrooms', require('./routes/chatroom.routes'));
    app.use('/api/verify', require('./routes/verify'));
    app.use('/api/users', require('./routes/user.routes'));
    app.use('/api/notifications', require('./routes/notifications.route'));
    app.use('/api/refresh-token', require('./routes/refresh-token'));

    console.log('✅ All route modules mounted successfully');
} catch (err) {
    console.error(`❌ Failed to load one or more route modules: ${err.message}`);
    console.error(err.stack);
}

// Test routes for development
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
}

// Connect MongoDB
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
