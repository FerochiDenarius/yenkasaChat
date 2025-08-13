// ✅ Load environment variables FIRST
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
// Safe route mounting helper
// ---------------------------------
function safeMount(routePath, filePath) {
    try {
        app.use(routePath, require(filePath));
        console.log(`✅ Mounted ${filePath} at ${routePath}`);
    } catch (err) {
        console.error(`❌ Failed to mount ${filePath} at ${routePath}: ${err.message}`);
        if (err.requireStack) {
            console.error("Require stack for module loading error:", err.requireStack);
        }
        console.error("Full error stack for module loading:", err.stack);
    }
}

// ---------------------------------
// 2. Mount API routes FIRST
// ---------------------------------
console.log("server.js: Mounting API routes...");

// Authentication & User
safeMount('/api/auth', './routes/auth');
safeMount('/api/reset-password', './routes/resetPassword');
safeMount('/api/forgot-password', './routes/forgotPassword.routes');
safeMount('/api/verify', './routes/verify');
safeMount('/api/account', './routes/account.routes'); 
safeMount('/api/users', './routes/user.routes');
safeMount('/api/refresh-token', './routes/refresh-token');

// Core Features
safeMount('/api/contacts', './routes/contacts.routes');
safeMount('/api/messages', './routes/messages.routes');
safeMount('/api/chatrooms', './routes/chatroom.routes');

// Notifications / External
safeMount('/api/onesignal', './routes/onesignal');
safeMount('/api/notifications', './routes/notifications.route');

// ✅ New Profile Routes
safeMount('/api/profile', './routes/userProfileRoutes');

console.log("✅ Finished attempting to mount all API routes.");

// ---------------------------------
// 3. Special static asset routes
// ---------------------------------
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
app.use((req, res) => {
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
