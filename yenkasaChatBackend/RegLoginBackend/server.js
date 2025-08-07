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


   // ***** START EXPLICIT ROUTE FOR ASSETLINKS.JSON (MORE DIRECT READ) *****
   app.get('/.well-known/assetlinks.json', (req, res) => {
       const filePath = path.join(__dirname, 'public', '.well-known', 'assetlinks.json');
       console.log(`DEBUG (Direct Read): Explicit route for /.well-known/assetlinks.json hit.`);
       console.log(`DEBUG (Direct Read): Attempting to read file from: ${filePath}`);

       fs.readFile(filePath, 'utf8', (err, data) => {
           if (err) {
               console.error(`DEBUG (Direct Read): Error reading file ${filePath}:`, err);
               if (!res.headersSent) {
                   if (err.code === 'ENOENT') {
                       res.status(404).send('assetlinks.json not found (ENOENT from fs.readFile).');
                   } else if (err.code === 'EACCES') {
                       res.status(403).send('Permission denied reading assetlinks.json (EACCES from fs.readFile).');
                   } else {
                       res.status(500).send('Error reading assetlinks.json file from server.');
                   }
               }
           } else {
               console.log(`DEBUG (Direct Read): Successfully read file ${filePath}. Sending content.`);
               res.setHeader('Content-Type', 'application/json');
               res.status(200).send(data);
           }
       });
   });
   // ***** END EXPLICIT ROUTE FOR ASSETLINKS.JSON (MORE DIRECT READ) *****


// --- START DIAGNOSTIC LOGGING AND ENHANCED STATIC SERVING FOR /reset-password ---
app.use('/reset-password', (req, res, next) => {
    console.log(`SERVER_LOG: Request received for /reset-password path: ${req.originalUrl}`);
    console.log(`SERVER_LOG: Attempting to serve static content from public/reset-password for ${req.path}`);
    next(); 
});

app.use('/reset-password', express.static(path.join(__dirname, 'public/reset-password'), {
    fallthrough: true, 
    index: "index.html" 
}));
// --- END DIAGNOSTIC LOGGING AND ENHANCED STATIC SERVING FOR /reset-password ---


// General static serving (this comes AFTER the more specific /reset-password handling)
app.use(express.static(path.join(__dirname, 'public'))); 
console.log("server.js: Static file serving configured for /public and /public/reset-password.");


// Deep link redirection to app - THIS IS COMMENTED OUT FOR DEBUGGING
/*
app.get('/reset-password/:token', (req, res) => {
  const { token } = req.params;
  console.log(`server.js: HTTP GET /reset-password/${token} - Redirecting to custom scheme yenkasachat://reset-password/${token}`);
  res.redirect(`yenkasachat://reset-password/${token}`);
});
*/

// --- START DIAGNOSTIC FALLBACK ROUTE FOR /reset-password ---
app.get('/reset-password', (req, res) => {
    console.log(`SERVER_LOG: DIAGNOSTIC FALLBACK for /reset-password hit. Static serving of index.html likely failed for ${req.originalUrl}`);
    const indexPath = path.join(__dirname, 'public/reset-password', 'index.html');
    fs.access(indexPath, fs.constants.F_OK, (err) => {
        if (err) {
            console.error(`SERVER_LOG: DIAGNOSTIC - index.html does NOT exist or is not accessible at ${indexPath}. Error details:`, err);
            res.status(404).send(`Reset password page (index.html) not found by diagnostic check. Expected at: ${indexPath}. File system error: ${err.code || 'Unknown error'}`);
        } else {
            console.log(`SERVER_LOG: DIAGNOSTIC - index.html DOES exist at ${indexPath}, but express.static did not serve it. This is unexpected.`);
            res.status(500).send(`Server error: Reset password page (index.html) exists at ${indexPath} but was not served by the primary static handler. Check other logs.`);
        }
    });
});
// --- END DIAGNOSTIC FALLBACK ROUTE FOR /reset-password ---


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
