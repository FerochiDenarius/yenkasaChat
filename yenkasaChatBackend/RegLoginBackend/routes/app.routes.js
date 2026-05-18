const express = require('express');

const router = express.Router();

function envNumber(name, fallback = 0) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === '') return fallback;

  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    console.warn('[app-version] Ignoring invalid numeric env', { name, raw });
    return fallback;
  }
  return Math.floor(value);
}

function envBoolean(name, fallback = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === '') return fallback;
  return ['true', '1', 'yes', 'on'].includes(String(raw).toLowerCase().trim());
}

router.get('/minimum-version', (req, res) => {
  const minimumVersionCode = envNumber('ANDROID_MIN_VERSION_CODE', 0);
  const latestVersionCode = envNumber('ANDROID_LATEST_VERSION_CODE', minimumVersionCode);
  const forceUpdate = envBoolean('ANDROID_FORCE_UPDATE', false);
  const updateMessage = process.env.ANDROID_UPDATE_MESSAGE ||
    'A better Yenkasa experience is available with performance improvements, livestream fixes, and security updates.';

  console.info('[app-version] minimum-version requested', {
    minimumVersionCode,
    latestVersionCode,
    forceUpdate,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  return res.json({
    minimumVersionCode,
    latestVersionCode,
    forceUpdate,
    updateMessage
  });
});

module.exports = router;
