require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const app = express();

console.log("server.js: Starting application setup...");

// Middleware to parse JSON bodies
app.use(express.json());
console.log("server.js: express.json middleware configured.");

// Serve static files for reset password HTML and other public assets
// It's generally good to define static routes before dynamic API routes if there's no overlap
// or if specific static paths need to take precedence.
app.use('/reset-password', express.static(path.join(__dirname, 'public/reset-password')));
app.use(express.static(path.join(__dirname, 'public')));
console.log("server.js: Static file serving configured for /public and /public/reset-password.");

// Deep link redirection to app
app.get('/reset-password/:token', (req, res) => {
  const { token } = req.params;
  console.log(`server.js: Redirecting for reset password token: ${token}`);
  res.redirect(`yenkasachat://reset-password/${token}`);
});

// Mount API routes
console.log("server.js: Attempting to mount all API routes...");
try {
    // Authentication and User Management
    console.log("server.js: Attempting to load routes/auth.js for /api/auth");
    app.use('/api/auth', require('./routes/auth'));
    console.log("✅ server.js: Successfully loaded and mounted routes/auth.js");

    console.log("server.js: Attempting to load routes/resetPassword.js for /api/reset-password");
    app.use('/api/reset-password', require('./routes/resetPassword'));
    console.log("✅ server.js: Successfully loaded and mounted routes/resetPassword.js");

    console.log("server.js: Attempting to load routes/forgotPassword.routes.js for /api/forgot-password");
    app.use('/api/forgot-password', require('./routes/forgotPassword.routes'));
    console.log("✅ server.js: Successfully loaded and mounted routes/forgotPassword.routes.js");

    console.log("server.js: Attempting to load routes/verify.js for /api/verify");
    app.use('/api/verify', require('./routes/verify'));
    console.log("✅ server.js: Successfully loaded and mounted routes/verify.js");
    
    console.log("server.js: Attempting to load routes/user.routes.js for /api/users");
    app.use('/api/users', require('./routes/user.routes'));
    console.log("✅ server.js: Successfully loaded and mounted routes/user.routes.js");

    console.log("server.js: Attempting to load routes/refresh-token.js for /api/refresh-token");
    app.use('/api/refresh-token', require('./routes/refresh-token')); // Make sure this file exists
    console.log("✅ server.js: Successfully loaded and mounted routes/refresh-token.js");

    // Core App Features
    console.log("server.js: Attempting to load routes/contacts.routes.js for /api/contacts");
    app.use('/api/contacts', require('./routes/contacts.routes'));
    console.log("✅ server.js: Successfully loaded and mounted routes/contacts.routes.js");

    console.log("server.js: Attempting to load routes/messages.routes.js for /api/messages");
    app.use('/api/messages', require('./routes/messages.routes'));
    console.log("✅ server.js: Successfully loaded and mounted routes/messages.routes.js");

    console.log("server.js: Attempting to load routes/chatroom.routes.js for /api/chatrooms");
    app.use('/api/chatrooms', require('./routes/chatroom.routes'));
    console.log("✅ server.js: Successfully loaded and mounted routes/chatroom.routes.js");

    // Notifications and External Services
    console.log("server.js: Attempting to load routes/onesignal.js for /api/onesignal");
    app.use('/api/onesignal', require('./routes/onesignal'));
    console.log("✅ server.js: Successfully loaded and mounted routes/onesignal.js");
    
    console.log("server.js: Attempting to load routes/notifications.route.js for /api/notifications");
    app.use('/api/notifications', require('./routes/notifications.route'));
    console.log("✅ server.js: Successfully loaded and mounted routes/notifications.route.js");

    console.log('✅✅✅ server.js: All specified API route modules processed for mounting.');
} catch (err) {
    console.error(`❌❌❌ server.js: Failed to load one or more route modules during mounting: ${err.message}`);
    if (err.requireStack) {
        console.error("Require stack for module loading error:", err.requireStack);
    }
    console.error("Full error stack for module loading:", err.stack);
    // Depending on the severity, you might want to process.exit(1) here if a critical route fails
}

// Test routes for development (these will only be active if NODE_ENV is 'development')
if (process.env.NODE_ENV === 'development') {
    console.log("server.js: Development mode detected. Configuring test routes.");
    app.get('/cloudinary-test', (req, res) => {
        console.log("server.js: /cloudinary-test route hit.");
        res.json({
            name: process.env.CLOUDINARY_CLOUD_NAME,
            key: process.env.CLOUDINARY_API_KEY,
            secret: process.env.CLOUDINARY_API_SECRET ? '✅ present' : '❌ missing',
        });
    });

    // Note: The /api/auth/ping is defined within routes/auth.js, so this duplicate here isn't strictly necessary
    // if routes/auth.js is loaded correctly. However, it can serve as an independent check.
    // If you keep it, ensure it doesn't conflict or cause confusion.
    // For now, I'll keep it as it was in your original file for minimal changes to this specific block.
    app.get('/api/auth/ping-server-level', (req, res) => { // Renamed slightly to avoid confusion with the one in auth.js
        console.log("server.js: /api/auth/ping-server-level route hit.");
        res.json({ message: '✅ Server-level auth ping route is working!' });
    });
    console.log("server.js: Development test routes configured.");
} else {
    console.log("server.js: Not in development mode. Skipping development test routes.");
}

// Connect MongoDB
console.log("server.js: Attempting to connect to MongoDB...");
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true, // These options are generally good, though some are default in newer Mongoose
    useUnifiedTopology: true,
    // consider adding connectTimeoutMS: 10000, // 10 seconds
    // serverSelectionTimeoutMS: 10000 // if you have issues with initial connection
})
.then(() => {
    console.log('✅✅✅ server.js: MongoDB connected successfully.');
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🚀🚀🚀 Server running on port ${PORT} 🚀🚀🚀`);
    });
})
.catch((err) => {
    console.error('❌❌❌ server.js: MongoDB connection error:', err.message);
    console.error("Full MongoDB connection error stack:", err.stack); // Log the full stack for more details
    process.exit(1); // Exit if DB connection fails, as app is likely unusable
});
