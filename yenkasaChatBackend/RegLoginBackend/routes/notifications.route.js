const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');

// 🔥 TEST route to send FCM notification manually
router.post('/test-notification', async (req, res) => {
  const { fcmToken, title, body, chatId } = req.body;

  if (!fcmToken) return res.status(400).json({ error: 'Missing fcmToken' });

  const fcmPayload = {
    token: fcmToken,
    data: {
      chatId: chatId || 'test-chat-id',
      senderId: 'test-user-id',
      senderName: title || 'Test Sender',
      text: body || 'Test message from Postman',
      type: 'text',
      title: title || 'YenkasaChat',
      body: body || 'Hello from Postman!'
    }
  };

  try {
    const response = await admin.messaging().send(fcmPayload);
    console.log('📤 Test FCM sent:', response);
    res.json({ success: true, response });
  } catch (err) {
    console.error('❌ FCM Test Failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
