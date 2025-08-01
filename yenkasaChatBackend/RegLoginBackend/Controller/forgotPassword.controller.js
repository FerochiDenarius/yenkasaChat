
const sendPasswordResetEmail = async (req, res) => {
  
  console.log('--- [CONTROLLER DEBUG] Entered sendPasswordResetEmail ---');
  
  
  console.log('--- [CONTROLLER DEBUG] Request Body:', JSON.stringify(req.body, null, 2));

  try {
    
    console.log('--- [CONTROLLER DEBUG] Attempting to send 200 OK response ---');
    
 
    if (res.headersSent) {
      console.log('--- [CONTROLLER DEBUG] Headers already sent, cannot send response. ---');
      return;
    }
    
    return res.status(200).json({ 
      message: "DEBUG: Forgot password controller reached and processed successfully (simplified version)!",
      receivedEmail: req.body.email || "No email found in body" 
    });

  } catch (error) {
    
    console.error('--- [CONTROLLER DEBUG] UNEXPECTED ERROR in simplified sendPasswordResetEmail:', error.message);
    console.error('--- [CONTROLLER DEBUG] Error Stack:', error.stack);

    
    if (!res.headersSent) {
      return res.status(500).json({ 
        message: 'DEBUG: Server error occurred in simplified forgot password controller.', 
        error: error.message 
      });
    }
  }
};

module.exports = {
  sendPasswordResetEmail
  
};
