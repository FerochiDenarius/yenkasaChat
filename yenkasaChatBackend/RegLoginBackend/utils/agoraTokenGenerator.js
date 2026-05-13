const { RtcRole, RtcTokenBuilder } = require('agora-access-token');

const TOKEN_TTL_SECONDS = Number(process.env.AGORA_TOKEN_TTL_SECONDS || 60 * 60 * 4);

function assertAgoraConfig() {
  if (!process.env.AGORA_APP_ID || !process.env.AGORA_APP_CERTIFICATE) {
    const error = new Error('Agora credentials are not configured');
    error.status = 503;
    throw error;
  }
}

function agoraUidFromUserId(userId) {
  const hex = userId?.toString?.().slice(-8) || '';
  const uid = parseInt(hex, 16);
  if (Number.isFinite(uid) && uid > 0) return uid;
  return Math.floor(Math.random() * 2147483000) + 1;
}

function generateRtcToken({ channelName, userId, role }) {
  assertAgoraConfig();

  const uid = agoraUidFromUserId(userId);
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
    expiresAt
  };
}

module.exports = {
  agoraUidFromUserId,
  generateRtcToken
};
