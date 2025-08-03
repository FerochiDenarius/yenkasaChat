// utils/onesignal.js
const axios = require('axios');

// Ensure these are set in your .env and loaded correctly by your app
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

const ONESIGNAL_API_BASE_URL = 'https://onesignal.com/api/v1';

if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    console.error('❌ CRITICAL: OneSignal App ID or REST API Key is missing in environment variables. Notifications will FAIL.');
    // Consider throwing an error if notifications are critical
    // throw new Error('OneSignal configuration is missing.');
}

/**
 * Sends a push notification using OneSignal REST API with Axios.
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
 * @returns {Promise<object>} A promise that resolves with the OneSignal API response data.
 * @throws {Error} If configuration is missing, required parameters are missing, or API call fails.
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
    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
        const errorMessage = 'OneSignal configuration is missing. Cannot send notification.';
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
        return { message: "No player IDs provided, notification not sent." };
    }

    // Construct the payload according to OneSignal REST API documentation
    const payload = {
        app_id: ONESIGNAL_APP_ID,
        include_player_ids: playerIdsToSend,
        headings: { en: title },
        contents: { en: body },
        // Add other parameters as needed, ensure names match API docs
        ...(data && { data: data }),
        ...(android_channel_id && { android_channel_id: android_channel_id }),
        ...(small_icon && { small_icon: small_icon }),
        ...(large_icon && { large_icon: large_icon }),
        ...(web_url && { web_url: web_url }),
        ...(buttons && Array.isArray(buttons) && buttons.length > 0 && { buttons: buttons }),
    };

    const headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}` // Note: For REST API Key
        // If using User Auth Key, it would be 'Authorization': 'Bearer YOUR_USER_AUTH_KEY'
        // but typically for server-to-server, REST API Key is used. Double check OneSignal docs for this.
    };

    try {
        console.log(`[sendPushNotification] Attempting to send notification via Axios to ${playerIdsToSend.length} player(s). Endpoint: ${ONESIGNAL_API_BASE_URL}/notifications, Payload:`, JSON.stringify(payload, null, 2));
        
        const response = await axios.post(
            `${ONESIGNAL_API_BASE_URL}/notifications`,
            payload,
            { headers: headers }
        );

        // Axios typically throws an error for non-2xx responses,
        // but it's good to double check the response data structure.
        if (response.data && (response.status >= 200 && response.status < 300)) {
            console.log(`[sendPushNotification] Notification sent successfully. OneSignal Response ID: ${response.data.id}, Recipients: ${response.data.recipients}`);
            return response.data; // The 'data' field in an axios response contains the response body
        } else {
            // This case might be less common if axios's default behavior of throwing for non-2xx is active
            const errorMsg = `Failed to send notification. Status: ${response.status}, Data: ${JSON.stringify(response.data)}`;
            console.error(`[sendPushNotification] ${errorMsg}`);
            throw new Error(`OneSignal API Error: ${errorMsg}`);
        }

    } catch (error) {
        console.error('[sendPushNotification] Error during OneSignal API call with Axios:', error.message);
        if (error.response) {
            // Axios error object often has a 'response' property containing details from the server
            console.error(`[sendPushNotification] OneSignal Error Status: ${error.response.status}`);
            console.error('[sendPushNotification] OneSignal Error Data:', JSON.stringify(error.response.data, null, 2));
            throw new Error(`OneSignal API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        } else if (error.request) {
            // The request was made but no response was received
            console.error('[sendPushNotification] OneSignal Error: No response received from server.', error.request);
            throw new Error('OneSignal API Error: No response received from server.');
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error('[sendPushNotification] OneSignal Error: Error setting up request.', error.message);
            throw new Error(`OneSignal API Error: ${error.message}`);
        }
    }
}

module.exports = {
    sendPushNotification,
};

