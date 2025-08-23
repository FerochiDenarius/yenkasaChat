require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const fs = require('fs');

const app = express();
console.log("server.js: Starting application setup...");

// ---------------------------------
// 1. Parse JSON body middleware
// ---------------------------------
app.use(express.json());
console.log("server.js: express.json middleware configured.");

// ---------------------------------
// 2. Mount API routes FIRST
// ---------------------------------
console.log("server.js: Mounting API routes...");

try {
    // Authentication & User
    app.use('/api/auth', require('./routes/auth'));
    app.use('/api/reset-password', require('./routes/resetPassword'));
    app.use('/api/forgot-password', require('./routes/forgotPassword.routes'));
    app.use('/api/verify', require('./routes/verify'));
    app.use('/api/users', require('./routes/user.routes'));
    app.use('/api/refresh-token', require('./routes/refresh-token'));

    // Core Features
    app.use('/api/contacts', require('./routes/contacts.routes'));
    app.use('/api/messages', require('./routes/messages.routes'));
    app.use('/api/chatrooms', require('./routes/chatroom.routes'));

    // Notifications / External
    app.use('/api/onesignal', require('./routes/onesignal'));
    app.use('/api/notifications', require('./routes/notifications.route'));

    console.log("✅ All API routes mounted successfully.");
} catch (err) {
    console.error(`❌ Failed to load one or more route modules: ${err.message}`);
    if (err.requireStack) {
        console.error("Require stack for module loading error:", err.requireStack);
    }
    console.error("Full error stack for module loading:", err.stack);
}

// ---------------------------------
// 3. Special static asset routes
// ---------------------------------

// Direct route for /.well-known/assetlinks.json
app.get('/.well-known/assetlinks.json', (req, res) => {
    const filePath = path.join(__dirname, 'public', '.well-known', 'assetlinks.json');
    console.log(`DEBUG: Request for assetlinks.json at ${filePath}`);

    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error(`Error reading assetlinks.json:`, err);
            if (err.code === 'ENOENT') {
                return res.status(404).send('assetlinks.json not found');
            } else if (err.code === 'EACCES') {
                return res.status(403).send('Permission denied reading assetlinks.json');
            }
            return res.status(500).send('Error reading assetlinks.json');
        }
        res.setHeader('Content-Type', 'application/json');
        res.status(200).send(data);
    });
});

// ---------------------------------
// 4. Password reset static serving
// ---------------------------------
app.use('/reset-password', (req, res, next) => {
    console.log(`SERVER_LOG: Request received for /reset-password: ${req.originalUrl}`);
    next();
});

app.use(
    '/reset-password',
    express.static(path.join(__dirname, 'public/reset-password'), {
        fallthrough: true,
        index: "index.html"
    })
);

// Diagnostic fallback if static fails
app.get('/reset-password', (req, res) => {
    const indexPath = path.join(__dirname, 'public/reset-password', 'index.html');
    fs.access(indexPath, fs.constants.F_OK, (err) => {
        if (err) {
            console.error(`index.html not found for /reset-password:`, err);
            res.status(404).send(`Reset password page not found at ${indexPath}`);
        } else {
            console.error(`index.html exists but wasn't served for /reset-password`);
            res.status(500).send(`Reset password page exists but wasn't served by express.static`);
        }
    });
});

// ---------------------------------
// 5. General static files AFTER APIs
// ---------------------------------
app.use(express.static(path.join(__dirname, 'public')));
console.log("server.js: Static file serving configured for /public.");

// ---------------------------------
// 6. SPA fallback (last route)
// ---------------------------------
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------------------------------
// 7. Dev test routes
// ---------------------------------
if (process.env.NODE_ENV === 'development') {
    app.get('/cloudinary-test', (req, res) => {
        res.json({
            name: process.env.CLOUDINARY_CLOUD_NAME,
            key: process.env.CLOUDINARY_API_KEY,
            secret: process.env.CLOUDINARY_API_SECRET ? '✅ present' : '❌ missing',
        });
    });
    app.get('/api/auth/ping-server-level', (req, res) => {
        res.json({ message: '✅ Server-level auth ping route is working!' });
    });
}

// ---------------------------------
// 8. MongoDB Connection + Server start
// ---------------------------------
console.log("server.js: Attempting to connect to MongoDB...");
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => {
    console.log('✅ MongoDB connected successfully.');
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
    });
})
.catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    console.error("Full MongoDB connection error stack:", err.stack);
    process.exit(1);
});