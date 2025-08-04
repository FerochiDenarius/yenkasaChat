// utils/onesignal.js
const axios = require('axios');

// Load correct env vars
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_API_KEY = process.env.yenkasachatOneSignalKey; // ✅ Changed here

const ONESIGNAL_API_BASE_URL = 'https://onesignal.com/api/v1';

if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    console.error('❌ CRITICAL: OneSignal App ID or REST API Key is missing in environment variables. Notifications will FAIL.');
}

async function sendPushNotification({
    playerId,
    title,
    body,
    data,
    android_channel_id,
    small_icon,
    large_icon,
    web_url,
    buttons
}) {
    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
        throw new Error('OneSignal configuration is missing. Cannot send notification.');
    }

    if (!playerId || !title || !body) {
        throw new Error('Missing required parameters: playerId, title, and body are all required.');
    }

    const playerIdsToSend = Array.isArray(playerId) ? playerId : [playerId];
    if (playerIdsToSend.length === 0) {
        return { message: "No player IDs provided, notification not sent." };
    }

    const payload = {
        app_id: ONESIGNAL_APP_ID,
        include_player_ids: playerIdsToSend,
        headings: { en: title },
        contents: { en: body },
        ...(data && { data }),
        ...(android_channel_id && { android_channel_id }),
        ...(small_icon && { small_icon }),
        ...(large_icon && { large_icon }),
        ...(web_url && { web_url }),
        ...(buttons && Array.isArray(buttons) && buttons.length > 0 && { buttons })
    };

    const headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}` // ✅ Uses updated variable
    };

    try {
        const response = await axios.post(
            `${ONESIGNAL_API_BASE_URL}/notifications`,
            payload,
            { headers }
        );

        if (response.data && (response.status >= 200 && response.status < 300)) {
            return response.data;
        } else {
            throw new Error(`Failed to send notification. Status: ${response.status}`);
        }

    } catch (error) {
        if (error.response) {
            throw new Error(`OneSignal API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        } else if (error.request) {
            throw new Error('OneSignal API Error: No response received from server.');
        } else {
            throw new Error(`OneSignal API Error: ${error.message}`);
        }
    }
}

module.exports = {
    sendPushNotification,
};
