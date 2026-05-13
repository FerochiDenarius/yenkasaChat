const axios = require('axios');

const LEGACY_ONESIGNAL_API_BASE_URL = 'https://onesignal.com/api/v1';
const CURRENT_ONESIGNAL_API_BASE_URL = 'https://api.onesignal.com';
const APP_ID_ENV_NAMES = ['ONESIGNAL_APP_ID'];
const REST_API_KEY_ENV_NAMES = [
    'YenkasaApiKey',
    'ONESIGNAL_REST_API_KEY',
    'ONESIGNAL_API_KEY',
    'ONESIGNAL_KEY',
    'yenkasachatOneSignalKey'
];

function readFirstEnv(names) {
    for (const name of names) {
        const value = process.env[name];
        if (typeof value === 'string' && value.trim()) {
            return { name, value: value.trim() };
        }
    }
    return null;
}

function maskSecret(value) {
    if (!value) return 'missing';
    if (value.length <= 10) return 'set-but-too-short';
    return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function getOneSignalConfig() {
    const appId = readFirstEnv(APP_ID_ENV_NAMES);
    const apiKey = readFirstEnv(REST_API_KEY_ENV_NAMES);

    return {
        appId: appId?.value || '',
        appIdEnvName: appId?.name || null,
        apiKey: apiKey?.value || '',
        apiKeyEnvName: apiKey?.name || null
    };
}

function buildAuthorizationHeader(apiKey) {
    if (!apiKey) return null;
    if (/^(Basic|Key)\s+/i.test(apiKey)) return apiKey;
    if (/^os_v2_/i.test(apiKey)) return `Key ${apiKey}`;
    return `Basic ${apiKey}`;
}

function isCurrentApiKey(apiKey) {
    return /^os_v2_/i.test(apiKey) || /^Key\s+/i.test(apiKey);
}

function getConfigHint(config) {
    const keyName = config.apiKeyEnvName || 'ONESIGNAL_REST_API_KEY';
    const appLabel = config.appId ? ` app ${config.appId}` : ' your OneSignal app';
    return `Check ${keyName} on the server. It must be the OneSignal REST API key for${appLabel}, not the App ID, client key, or a key from another app.`;
}

function createOneSignalError(message, status, response) {
    const error = new Error(message);
    error.isOneSignalError = true;
    if (status) error.status = status;
    if (response) error.response = response;
    return error;
}

async function sendPushNotification({
    playerId,
    targetPlayerIds,
    title,
    body,
    data,
    android_channel_id,
    existing_android_channel_id,
    priority,
    ttl,
    small_icon,
    large_icon,
    web_url,
    buttons,
    collapse_id,
    android_group,
    android_group_message,
    android_sound
}) {
    const config = getOneSignalConfig();
    const authorization = buildAuthorizationHeader(config.apiKey);
    const useCurrentApi = isCurrentApiKey(config.apiKey);

    if (!config.appId || !authorization) {
        throw createOneSignalError(
            `OneSignal configuration is missing. Set ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY. ${getConfigHint(config)}`,
            500
        );
    }

    const targetIds = playerId || targetPlayerIds;

    if (!targetIds || !title || !body) {
        throw new Error('Missing required parameters: playerId or targetPlayerIds, title, and body are required.');
    }

    const playerIdsToSend = (Array.isArray(targetIds) ? targetIds : [targetIds])
        .filter(Boolean)
        .map(id => String(id).trim())
        .filter(Boolean);
    if (playerIdsToSend.length === 0) {
        return { message: "No player IDs provided, notification not sent." };
    }

    const payload = {
        app_id: config.appId,
        ...(useCurrentApi
            ? { include_subscription_ids: playerIdsToSend, target_channel: 'push' }
            : { include_player_ids: playerIdsToSend }),
        headings: { en: title },
        contents: { en: body },
        ...(data && { data }),
        ...(android_channel_id && { android_channel_id }),
        ...(existing_android_channel_id && { existing_android_channel_id }),
        priority: Number.isInteger(priority) ? priority : 10,
        ttl: Number.isInteger(ttl) ? ttl : 604800,
        ...(small_icon && { small_icon }),
        ...(large_icon && { large_icon }),
        ...(web_url && { web_url }),
        ...(buttons && Array.isArray(buttons) && buttons.length > 0 && { buttons }),
        ...(collapse_id && { collapse_id }),
        ...(android_group && { android_group }),
        ...(android_group_message && { android_group_message }),
        ...(android_sound && { android_sound })
    };

    const headers = {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: authorization
    };

    try {
        const response = await axios.post(
            `${useCurrentApi ? CURRENT_ONESIGNAL_API_BASE_URL : LEGACY_ONESIGNAL_API_BASE_URL}/notifications`,
            payload,
            { headers }
        );

        if (response.data && (response.status >= 200 && response.status < 300)) {
            return response.data;
        }

        throw createOneSignalError(`Failed to send notification. Status: ${response.status}`, response.status, response);

    } catch (error) {
        if (error.isOneSignalError) {
            throw error;
        }

        if (error.response) {
            const detail = JSON.stringify(error.response.data);
            const authHint = [401, 403].includes(error.response.status)
                ? ` ${getConfigHint(config)}`
                : '';

            throw createOneSignalError(
                `OneSignal API Error: ${error.response.status} - ${detail}.${authHint}`,
                error.response.status,
                error.response
            );
        }

        if (error.request) {
            throw createOneSignalError('OneSignal API Error: No response received from server.', 502);
        }

        throw createOneSignalError(`OneSignal API Error: ${error.message}`, 500);
    }
}

module.exports = {
    sendPushNotification,
    getOneSignalConfig,
    maskSecret,
};
