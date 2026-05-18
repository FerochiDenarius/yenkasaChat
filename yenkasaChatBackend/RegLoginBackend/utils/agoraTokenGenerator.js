const { RtcRole, RtcTokenBuilder } = require('agora-access-token');

const TOKEN_TTL_SECONDS = Number(process.env.AGORA_TOKEN_TTL_SECONDS || 60 * 60 * 4);
const AGORA_MAX_UID = 2147483647;

function assertAgoraConfig() {
  if (!process.env.AGORA_APP_ID || !process.env.AGORA_APP_CERTIFICATE) {
    const error = new Error('Agora credentials are not configured');
    error.status = 503;
    error.code = 'AGORA_CONFIG_MISSING';
    throw error;
  }
}

function agoraUidFromUserId(userId) {
  const hex = userId?.toString?.().slice(-8) || '';
  const parsed = parseInt(hex, 16);
  if (Number.isFinite(parsed) && parsed > 0) {
    const uid = parsed % AGORA_MAX_UID;
    return uid > 0 ? uid : 1;
  }
  const fallback = Array.from(userId?.toString?.() || 'yenkasa')
    .reduce((sum, char) => ((sum * 31) + char.charCodeAt(0)) % AGORA_MAX_UID, 7);
  return fallback > 0 ? fallback : 1;
}

function assertValidAgoraUid(uid, userId) {
  if (!Number.isInteger(uid) || uid <= 0 || uid > AGORA_MAX_UID) {
    const error = new Error('Invalid Agora UID generated for user');
    error.status = 500;
    error.code = 'AGORA_UID_INVALID';
    error.details = { userId: userId?.toString?.(), uid };
    throw error;
  }
}

function generateRtcToken({ channelName, userId, role }) {
  assertAgoraConfig();
  if (!channelName || typeof channelName !== 'string' || channelName.length > 64) {
    const error = new Error('Invalid Agora channel name');
    error.status = 400;
    error.code = 'CHANNEL_INVALID';
    throw error;
  }

  const uid = agoraUidFromUserId(userId);
  assertValidAgoraUid(uid, userId);
  const agoraRole = role === 'broadcaster' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const token = RtcTokenBuilder.buildTokenWithUid(
    process.env.AGORA_APP_ID,
    process.env.AGORA_APP_CERTIFICATE,
    channelName,
    uid,
    agoraRole,
    expiresAt
  );

  return {
    appId: process.env.AGORA_APP_ID,
    token,
    uid,
    role,
    expiresAt,
    expiresIn: TOKEN_TTL_SECONDS
  };
}

module.exports = {
  agoraUidFromUserId,
  generateRtcToken
};
