// utils/onesignal.js
const OneSignal = require('onesignal-node');

// Ensure these are set in your .env and loaded correctly by your app
// (e.g., if using dotenv, require('dotenv').config() in your main server.js)
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

let oneSignalClient;

if (ONESIGNAL_APP_ID && ONESIGNAL_REST_API_KEY) {
    oneSignalClient = new OneSignal.Client({
        app: {
            appId: ONESIGNAL_APP_ID,
            appAuthKey: ONESIGNAL_REST_API_KEY,
        },
    });
    console.log('✅ OneSignal Client initialized successfully in utils/onesignal.js.');
} else {
    console.error('❌ CRITICAL: OneSignal App ID or REST API Key is missing in environment variables. Notifications will FAIL.');
    // You might want to throw an error here if notifications are critical to your app's startup
    // throw new Error('OneSignal configuration is missing.');
}

/**
 * Sends a push notification using OneSignal.
 *
 * @param {object} options - The options for sending the notification.
 * @param {string|string[]} options.playerId - A single Player ID string or an array of Player ID strings.
 * @param {string} options.title - The title of the notification.
 * @param {string} options.body - The main content/body of the notification.
 * @param {object} [options.data] - Optional. Additional data to send with the notification (e.g., { "roomId": "123" }).
 * @param {string} [options.android_channel_id] - Optional. For Android 8.0+ notification channels.
 * @param {string} [options.small_icon] - Optional. Name of the small icon resource in your Android app (e.g., 'ic_stat_onesignal_default').
 * @param {string} [options.large_icon] - Optional. URL to a large icon image.
 * @param {string} [options.web_url] - Optional. URL to open when a web push notification is clicked.
 * @param {Array<object>} [options.buttons] - Optional. Action buttons for the notification.
 * @returns {Promise<object>} A promise that resolves with the OneSignal API response body.
 * @throws {Error} If OneSignal client is not initialized or if required parameters are missing or if API call fails.
 */
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
    if (!oneSignalClient) {
        const errorMessage = 'OneSignal client is not initialized. Check server logs for configuration errors.';
        console.error(`[sendPushNotification] ${errorMessage}`);
        throw new Error(errorMessage);
    }

    if (!playerId || !title || !body) {
        const errorMessage = 'Missing required parameters: playerId, title, and body are all required.';
        console.error(`[sendPushNotification] ${errorMessage}`);
        throw new Error(errorMessage);
    }

    const playerIdsToSend = Array.isArray(playerId) ? playerId : [playerId];
    if (playerIdsToSend.length === 0) {
        console.warn('[sendPushNotification] No player IDs provided. Notification not sent.');
        return { message: "No player IDs provided, notification not sent." }; // Or throw an error, depending on desired behavior
    }

    const notification = {
        contents: {
            en: body,
        },
        headings: {
            en: title,
        },
        include_player_ids: playerIdsToSend,
    };

    // Add optional parameters if they are provided
    if (data) notification.data = data;
    if (android_channel_id) notification.android_channel_id = android_channel_id;
    if (small_icon) notification.small_icon = small_icon;
    if (large_icon) notification.large_icon = large_icon;
    if (web_url) notification.web_url = web_url;
    if (buttons && Array.isArray(buttons) && buttons.length > 0) notification.buttons = buttons;

    try {
        console.log(`[sendPushNotification] Attempting to send notification to ${playerIdsToSend.length} player(s). Content:`, JSON.stringify(notification, null, 2));
        const response = await oneSignalClient.createNotification(notification);
        
        // Check OneSignal's response structure carefully
        if (response && response.body && response.statusCode >= 200 && response.statusCode < 300) {
            console.log(`[sendPushNotification] Notification sent successfully. OneSignal Response ID: ${response.body.id}, Recipients: ${response.body.recipients}`);
            return response.body; // Return the body which contains {id, recipients, errors, etc.}
        } else {
            const errorMsg = `Failed to send notification. Status: ${response ? response.statusCode : 'Unknown'}, Body: ${response ? JSON.stringify(response.body) : 'No response body'}`;
            console.error(`[sendPushNotification] ${errorMsg}`);
            throw new Error(`OneSignal API Error: ${errorMsg}`);
        }
    } catch (error) {
        // Catch errors from the API call itself or from the error thrown above
        console.error('[sendPushNotification] Error during OneSignal API call:', error.message);
        if (error.response && error.response.body) {
            console.error('[sendPushNotification] OneSignal Error Body Details:', JSON.stringify(error.response.body, null, 2));
        }
        // Re-throw the error so the caller can handle it if needed
        throw error;
    }
}

module.exports = {
    sendPushNotification,
};
