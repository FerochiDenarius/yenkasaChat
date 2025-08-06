require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const fs = require('fs'); // Added for checking file existence
const app = express();

console.log("server.js: Starting application setup...");

// Middleware to parse JSON bodies
app.use(express.json());
console.log("server.js: express.json middleware configured.");


// ***** START EXPLICIT ROUTE FOR ASSETLINKS.JSON (FOR DEBUGGING) *****
app.get('/.well-known/assetlinks.json', (req, res) => {
    const filePath = path.join(__dirname, 'public', '.well-known', 'assetlinks.json');
    console.log(`DEBUG: Explicit route for /.well-known/assetlinks.json hit.`);
    console.log(`DEBUG: Attempting to serve file from: ${filePath}`);

    if (fs.existsSync(filePath)) {
        console.log(`DEBUG: File found at ${filePath}. Sending file...`);
        res.sendFile(filePath, (err) => {
            if (err) {
                console.error(`DEBUG: Error sending file ${filePath}:`, err);
                if (!res.headersSent) {
                    res.status(500).send('Error serving the assetlinks.json file.');
                }
            } else {
                console.log(`DEBUG: Successfully sent ${filePath}`);
            }
        });
    } else {
        console.error(`DEBUG: File NOT found at ${filePath}. Sending 404.`);
        if (!res.headersSent) {
            res.status(404).send('assetlinks.json not found on server at the expected path (from explicit route).');
        }
    }
});
// ***** END EXPLICIT ROUTE FOR ASSETLINKS.JSON (FOR DEBUGGING) *****


// Serve static files for reset password HTML and other public assets
// The explicit route above will handle /.well-known/assetlinks.json first.
// These lines will handle other static files.
app.use('/reset-password', express.static(path.join(__dirname, 'public/reset-password')));
app.use(express.static(path.join(__dirname, 'public'))); // This should still serve other files in public/
console.log("server.js: Static file serving configured for /public and /public/reset-password.");


// Deep link redirection to app (Consider if this is still needed with App Links)
// If App Links are working, the OS should handle opening the app directly.
// This yenkasachat:// custom scheme redirect might be a fallback or for older systems.
app.get('/reset-password/:token', (req, res) => {
  const { token } = req.params;
  console.log(`server.js: HTTP GET /reset-password/${token} - Redirecting to custom scheme yenkasachat://reset-password/${token}`);
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
}

// Test routes for development
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

    app.get('/api/auth/ping-server-level', (req, res) => {
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
    useNewUrlParser: true,
    useUnifiedTopology: true,
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
    console.error("Full MongoDB connection error stack:", err.stack);
    process.exit(1);
});
