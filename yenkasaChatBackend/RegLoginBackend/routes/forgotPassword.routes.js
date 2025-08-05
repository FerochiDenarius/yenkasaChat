const express = require('express');
const router = express.Router();

// Log when this file is loaded/parsed by Node
console.log(`--- [ROUTES FILE DEBUG ${new Date().toISOString()}] --- Loading forgotPassword.routes.js ---`);

const forgotPasswordController = require('../Controller/forgotPassword.controller');

if (!forgotPasswordController || typeof forgotPasswordController.sendPasswordResetEmail !== 'function') {
  console.error(`--- [ROUTES FILE DEBUG ${new Date().toISOString()}] --- CRITICAL ERROR: sendPasswordResetEmail function not found or controller not loaded! ---`);
} else {
  console.log(`--- [ROUTES FILE DEBUG ${new Date().toISOString()}] --- sendPasswordResetEmail controller function loaded successfully. ---`);
  
  
  router.post('/', forgotPasswordController.sendPasswordResetEmail); 
  //           ^^^ THIS IS THE KEY: it means the root of where this router is mounted.

  console.log(`--- [ROUTES FILE DEBUG ${new Date().toISOString()}] --- Registered POST handler for '/' (relative to mount point) in forgotPassword.routes.js ---`);
}
router.get('/test', (req, res) => {
  res.send('Forgot Password Route is alive.');
});

// Optional: Catch-all within this router to see if any request even reaches this router
router.use((req, res, next) => {
    console.log(`--- [ROUTER INSTANCE DEBUG ${new Date().toISOString()}] --- Request reached forgotPasswordRoutes router instance. Method: ${req.method}, Path within router: ${req.path}, Original URL: ${req.originalUrl} ---`);
  
    next();
});

module.exports = router;
