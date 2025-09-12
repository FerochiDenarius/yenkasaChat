// <<<<< ROUTES IS V6 - TOP OF FILE - Sep 12 2025 (Example, will be dynamic) >>>>>
console.log("<<<<< ROUTES IS V6 - TOP OF FILE - ", new Date().toISOString(), ">>>>>");

const express = require('express');
const router = express.Router();

// Attempt to require the controller and log success or failure
let controllerFunctions;
let requireError = null;
try {
    controllerFunctions = require('../Controller/changepwd.controller');
    console.log("<<<<< ROUTES V6 - Successfully required ../Controller/changepwd.controller >>>>>");
} catch (e) {
    requireError = e;
    console.error("<<<<< ROUTES V6 - FAILED to require ../Controller/changepwd.controller:", e.message, ">>>>>");
    // Fallback: define dummy functions so the server doesn't crash immediately if controller is missing
    // but the API calls will fail informatively.
    controllerFunctions = {
        requestPasswordReset: (req, res) => res.status(500).json({ error: "Controller not loaded: requestPasswordReset" }),
        verifyResetToken: (req, res) => res.status(500).json({ error: "Controller not loaded: verifyResetToken" }),
        resetPassword: (req, res) => res.status(500).json({ error: "Controller not loaded: resetPassword" })
    };
}

const {
  requestPasswordReset,
  verifyResetToken,
  resetPassword
} = controllerFunctions;

// This router is mounted at /api/reset-password in server.js

// ✅ Send password reset email
router.post('/request', (req, res, next) => {
    console.log(`<<<<< ROUTES V6 - HIT /request - Timestamp: ${new Date().toISOString()} >>>>>`);
    requestPasswordReset(req, res, next); // Assuming controller might use next
});
console.log("routes/changepwd.routes.js - V6 - Defined POST /request for requestPasswordReset");

// ✅ Verify reset token
router.post('/verify', (req, res, next) => {
    console.log(`<<<<< ROUTES V6 - HIT /verify - Timestamp: ${new Date().toISOString()} >>>>>`);
    verifyResetToken(req, res, next);
});
console.log("routes/changepwd.routes.js - V6 - Defined POST /verify for verifyResetToken");

// ✅ Reset password
router.post('/confirm/:token', (req, res, next) => {
    console.log(`<<<<< ROUTES V6 - HIT /confirm/:token - Timestamp: ${new Date().toISOString()} >>>>>`);
    console.log("<<<<< ROUTES V6 - INSIDE /confirm/:token ROUTE HANDLER - req.params IS: ", JSON.stringify(req.params), ">>>>>");
    console.log("<<<<< ROUTES V6 - INSIDE /confirm/:token ROUTE HANDLER - req.body IS: ", JSON.stringify(req.body), ">>>>>");
    if (typeof resetPassword === 'function') {
        resetPassword(req, res, next); // Call the original controller
    } else {
        console.error("<<<<< ROUTES V6 - resetPassword is not a function (controller issue?) >>>>>");
        res.status(500).json({ error: "Server error: Reset password handler not available." });
    }
});
console.log("routes/changepwd.routes.js - V6 - Defined POST /confirm/:token for resetPassword");

module.exports = router;
console.log("routes/changepwd.routes.js - V6 - Module exported successfully");
