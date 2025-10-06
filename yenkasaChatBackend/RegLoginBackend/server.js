// ✅ Load environment variables FIRST
require('dotenv').config();

const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const fs = require('fs');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');
const User = require('./models/user.model'); // ✅ Needed for online tracking

const app = express();
console.log("server.js: Starting application setup...");

// ---------------------------------
// 1. Global Middlewares
// ---------------------------------
app.use(helmet());
app.use(compression());
app.use(cors({
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== "test") {
    app.use(morgan("combined"));
}
console.log("server.js: Core middlewares configured.");

// ---------------------------------
// 2. Safe route mounting
// ---------------------------------
function safeMount(routePath, filePath) {
    try {
        app.use(routePath, require(filePath));
        console.log(`✅ Mounted ${filePath} at ${routePath}`);
    } catch (err) {
        console.error(`❌ Failed to mount ${filePath} at ${routePath}: ${err.message}`);
    }
}

console.log("server.js: Mounting API routes...");

// Authentication & User
safeMount('/api/auth', './routes/auth');
safeMount('/api/reset-password', './routes/changepwd.routes.js');
safeMount('/api/verify', './routes/verify');
safeMount('/api/account', './routes/account.routes');
safeMount('/api/users', './routes/user.routes');

// Core Features
safeMount('/api/contacts', './routes/contacts.routes');
safeMount('/api/messages', './routes/messages.routes');
safeMount('/api/chatrooms', './routes/chatroom.routes');

// Notifications / External
safeMount('/api/onesignal', './routes/onesignal');
safeMount('/api/notifications', './routes/notifications.route');
safeMount('/api/profile', './routes/profile');

console.log("✅ Finished mounting API routes.");

// ---------------------------------
// 3. Health check (important for DO)
// ---------------------------------
app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        uptime: process.uptime(),
        env: process.env.NODE_ENV
    });
});

// ---------------------------------
// 4. Special static routes
// ---------------------------------
app.get('/.well-known/assetlinks.json', (req, res) => {
    const filePath = path.join(__dirname, 'public', '.well-known', 'assetlinks.json');
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            return res.status(err.code === 'ENOENT' ? 404 : 500).send(err.message);
        }
        res.setHeader('Content-Type', 'application/json');
        res.status(200).send(data);
    });
});

// Password reset static page
app.use('/reset-password', express.static(path.join(__dirname, 'public/reset-password')));
app.get('/reset-password', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/reset-password', 'index.html'));
});

// ---------------------------------
// 5. Static files + SPA fallback
// ---------------------------------
app.use(express.static(path.join(__dirname, 'public')));
console.log("server.js: Static file serving configured for /public.");

// ---------------------------------
// 6. Error handling (API last)
// ---------------------------------
app.use((req, res, next) => {
    if (req.originalUrl.startsWith("/api/")) {
        return res.status(404).json({ error: "API route not found" });
    }
    next();
});

app.use((err, req, res, next) => {
    console.error("🔥 Server error:", err);
    res.status(500).json({ error: "Internal server error" });
});

// ---------------------------------
// 7. DB + Server + Socket.IO start
// ---------------------------------
console.log("server.js: Connecting to MongoDB...");

mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => {
    console.log('✅ MongoDB connected successfully.');

    // ✅ Create HTTP server and attach Socket.IO
    const server = http.createServer(app);
    const io = new Server(server, {
        cors: { origin: process.env.CLIENT_URL || "*", methods: ["GET", "POST"] }
    });

    io.on('connection', (socket) => {
        const userId = socket.handshake.query.userId;
        if (userId) {
            User.findByIdAndUpdate(userId, { online: true }).catch(console.error);
            console.log(`🟢 User ${userId} is online.`);
        }

        socket.on('disconnect', () => {
            if (userId) {
                User.findByIdAndUpdate(userId, {
                    online: false,
                    lastSeen: new Date()
                }).catch(console.error);
                console.log(`🔴 User ${userId} went offline.`);
            }
        });
    });

    // ✅ Start server (for DigitalOcean)
    const PORT = process.env.PORT || 8080;
    server.listen(PORT, "0.0.0.0", () => {
        console.log(`🚀 Server + Socket.IO running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });

})
.catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
});
