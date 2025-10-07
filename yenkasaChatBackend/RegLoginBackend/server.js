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

// ✨ 1. Import http and socket.io
const http = require('http');
const { Server } = require("socket.io");

const app = express();
console.log("server.js: Starting application setup...");

// ✨ 2. Create HTTP server and attach Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
    // Configure CORS for Socket.IO to allow your app to connect
    cors: {
        origin: process.env.CLIENT_URL || "*", // Use a more specific URL in production
        methods: ["GET", "POST"]
    }
});

// ---------------------------------
// Middlewares
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

// ✨ 3. Add Socket.IO Connection Logic
// ---------------------------------
const onlineUsers = new Map(); // Use a Map for better performance: { userId -> socketId }

io.on('connection', (socket) => {
    console.log(`💡 Client connected: ${socket.id}`);

    // Event: User comes online
    socket.on('userOnline', (userId) => {
        if (!userId) return;
        console.log(`User ${userId} is online with socket ${socket.id}`);
        onlineUsers.set(userId, socket.id);
        // Broadcast the new list of online user IDs to all clients
        io.emit('getOnlineUsers', Array.from(onlineUsers.keys()));
    });

    // Event: User goes offline or disconnects
    socket.on('disconnect', () => {
        console.log(`🔥 Client disconnected: ${socket.id}`);
        // Find which user this socket belonged to and remove them
        for (let [userId, socketId] of onlineUsers.entries()) {
            if (socketId === socket.id) {
                onlineUsers.delete(userId);
                console.log(`User ${userId} went offline.`);
                break; // Exit loop once found
            }
        }
        // Broadcast the updated list to everyone
        io.emit('getOnlineUsers', Array.from(onlineUsers.keys()));
    });
});


// ---------------------------------
// API Route Mounting (This section is now complete)
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
safeMount('/api/auth', './routes/auth');
safeMount('/api/reset-password', './routes/changepwd.routes.js');
safeMount('/api/verify', './routes/verify');
safeMount('/api/account', './routes/account.routes');
safeMount('/api/users', './routes/user.routes');
safeMount('/api/contacts', './routes/contacts.routes');
safeMount('/api/messages', './routes/messages.routes');
safeMount('/api/chatrooms', './routes/chatroom.routes');
safeMount('/api/onesignal', './routes/onesignal');
safeMount('/api/notifications', './routes/notifications.route');
safeMount('/api/profile', './routes/profile');
console.log("✅ Finished mounting API routes.");

// ---------------------------------
// Health Check (This section is now complete)
// ---------------------------------
app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        uptime: process.uptime(),
        env: process.env.NODE_ENV
    });
});

// ---------------------------------
// Special static routes (This section is now complete)
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

app.use('/reset-password', express.static(path.join(__dirname, 'public/reset-password')));
app.get('/reset-password', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/reset-password', 'index.html'));
});

app.use(express.static(path.join(__dirname, 'public')));
console.log("server.js: Static file serving configured for /public.");

// ---------------------------------
// Error Handling (This section is now complete)
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
// DB Connection + Server Start
// ---------------------------------
console.log("server.js: Connecting to MongoDB...");
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => {
    console.log('✅ MongoDB connected successfully.');

    const PORT = process.env.PORT || 8080;

    // ✨ 4. IMPORTANT: Listen on the 'server' instance, not the 'app'
    server.listen(PORT, "0.0.0.0", () => {
        console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
        console.log(`🔌 Socket.IO is attached and listening.`);
    });
})
.catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
});