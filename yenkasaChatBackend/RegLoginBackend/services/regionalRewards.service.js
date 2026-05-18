const axios = require('axios');
const ActivityLog = require('../models/activityLog.model');
const RegionalRewardDaily = require('../models/regionalRewardDaily.model');
const { auditSecurityEvent } = require('../utils/securityAudit');

const DEFAULT_COUNTRY = 'Ghana';
const DEFAULT_PLATFORM = 'api';
const DEFAULT_COUNTRY_CAP = Number(process.env.DEFAULT_DAILY_YKC_CAP || 300);

const COUNTRY_REWARD_CAPS = buildCountryRewardCaps();

function buildCountryRewardCaps() {
  const defaults = {
    ghana: { label: 'Ghana', dailyYkcCap: Number(process.env.GHANA_DAILY_YKC_CAP || 500) },
    nigeria: { label: 'Nigeria', dailyYkcCap: Number(process.env.NIGERIA_DAILY_YKC_CAP || 450) },
    kenya: { label: 'Kenya', dailyYkcCap: Number(process.env.KENYA_DAILY_YKC_CAP || 400) },
    'south africa': { label: 'South Africa', dailyYkcCap: Number(process.env.SOUTH_AFRICA_DAILY_YKC_CAP || 450) },
    default: { label: 'Default', dailyYkcCap: DEFAULT_COUNTRY_CAP }
  };

  const overrides = safeJsonParse(process.env.COUNTRY_REWARD_CAPS_JSON);
  if (!overrides || typeof overrides !== 'object') return defaults;

  Object.entries(overrides).forEach(([key, value]) => {
    const normalizedKey = normalizeCountryKey(key) || 'default';
    const label = String(value?.label || value?.name || key || normalizedKey).trim() || defaults.default.label;
    const cap = Number(value?.dailyYkcCap ?? value?.dailyCap ?? value?.maxDailyYkc ?? value?.cap);
    defaults[normalizedKey] = {
      label,
      dailyYkcCap: Number.isFinite(cap) && cap >= 0 ? cap : defaults.default.dailyYkcCap
    };
  });

  return defaults;
}

function safeJsonParse(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeCountryKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ');
}

function normalizeCountryLabel(value) {
  const normalized = normalizeCountryKey(value);
  if (!normalized) return '';
  const matchingCap = COUNTRY_REWARD_CAPS[normalized];
  if (matchingCap) return matchingCap.label;

  return normalized
    .split(' ')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');
}

function getCountryRewardConfig(country) {
  const key = normalizeCountryKey(country) || 'default';
  return COUNTRY_REWARD_CAPS[key] || COUNTRY_REWARD_CAPS.default;
}

function getRequestIp(req) {
  const forwarded = req?.headers?.['x-forwarded-for']?.toString().split(',')[0]?.trim();
  const realIp = req?.headers?.['x-real-ip']?.toString().trim();
  const cfIp = req?.headers?.['cf-connecting-ip']?.toString().trim();
  const socketIp = req?.socket?.remoteAddress || req?.ip || '';
  return (forwarded || realIp || cfIp || socketIp || '').trim();
}

function isPrivateIp(ip) {
  if (!ip) return true;
  const normalized = ip.replace(/^::ffff:/, '').trim();
  return (
    normalized === '::1' ||
    normalized === '127.0.0.1' ||
    normalized.startsWith('10.') ||
    normalized.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized) ||
    normalized.startsWith('169.254.') ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:')
  );
}

async function lookupGeoCountry(ip) {
  if (!ip || isPrivateIp(ip)) return null;

  const template = process.env.GEOIP_LOOKUP_URL || 'https://ipapi.co/{ip}/json/';
  const url = template.includes('{ip}')
    ? template.replace('{ip}', encodeURIComponent(ip))
    : `${template}${encodeURIComponent(ip)}`;

  try {
    const response = await axios.get(url, {
      timeout: Number(process.env.GEOIP_LOOKUP_TIMEOUT_MS || 1200),
      validateStatus: () => true
    });

    if (response.status < 200 || response.status >= 300) {
      return null;
    }

    const data = response.data || {};
    const country = normalizeCountryLabel(
      data.country_name ||
      data.country ||
      data.countryName ||
      data.region_name
    );

    if (!country) return null;

    return {
      country,
      confidence: Number(process.env.GEOIP_DEFAULT_CONFIDENCE || 0.92),
      source: 'geoip',
      ip
    };
  } catch (err) {
    console.warn('[CountryGeoIP] lookup failed', { ip, error: err.message });
    return null;
  }
}

async function buildCountryVerification(req, { clientCountry = '', currentCountry = '', userId = null } = {}) {
  const ipAddress = getRequestIp(req);
  const detected = await lookupGeoCountry(ipAddress);
  const client = normalizeCountryLabel(clientCountry);
  const current = normalizeCountryLabel(currentCountry);

  let verifiedCountry = detected?.country || '';
  let countryConfidence = detected?.confidence || 0.2;
  let verificationStatus = detected ? 'geoip_verified' : 'fallback';
  let countrySwitchSuspected = false;

  if (!detected && client && current && normalizeCountryKey(client) !== normalizeCountryKey(current)) {
    countrySwitchSuspected = true;
    verificationStatus = 'client_fallback';
  }

  if (detected && client && normalizeCountryKey(client) !== normalizeCountryKey(detected.country)) {
    countrySwitchSuspected = true;
  }

  return {
    ipAddress,
    clientCountry: client || '',
    detectedCountry: detected?.country || '',
    verifiedCountry,
    countryConfidence,
    verificationStatus,
    countrySwitchSuspected,
    userId: userId ? userId.toString() : null
  };
}

function resolveRewardCountry(user = {}) {
  const verifiedCountry = normalizeCountryLabel(user.verifiedCountry);
  const detectedCountry = normalizeCountryLabel(user.detectedCountry);
  const country = normalizeCountryLabel(user.country);
  const confidence = Number(user.countryConfidence || 0);
  const verificationStatus = String(user.countryVerificationStatus || '').trim().toLowerCase();

  if (verifiedCountry) {
    return {
      country: verifiedCountry,
      source: 'verifiedCountry',
      confidence: confidence > 0 ? confidence : 0.9
    };
  }

  if (detectedCountry && confidence >= 0.6) {
    return {
      country: detectedCountry,
      source: 'detectedCountry',
      confidence
    };
  }

  if (country && confidence >= 0.85) {
    return {
      country,
      source: 'storedCountry',
      confidence
    };
  }

  if (verificationStatus === 'client_fallback' || verificationStatus === 'fallback') {
    return {
      country: DEFAULT_COUNTRY,
      source: verificationStatus,
      confidence: 0.1
    };
  }

  return {
    country: DEFAULT_COUNTRY,
    source: 'default',
    confidence: 0.15
  };
}

async function recordCountrySecuritySignal({
  req,
  userId,
  action,
  country,
  detectedCountry,
  verifiedCountry,
  countryConfidence,
  suspicious = false,
  metadata = {}
}) {
  const payload = {
    userId: userId || req?.user?.id || req?.user?._id || null,
    action,
    coinsAwarded: 0,
    timestamp: new Date(),
    suspicious: Boolean(suspicious),
    ipAddress: getRequestIp(req),
    metadata: {
      ...metadata,
      country: normalizeCountryLabel(country),
      detectedCountry: normalizeCountryLabel(detectedCountry),
      verifiedCountry: normalizeCountryLabel(verifiedCountry),
      countryConfidence: Number(countryConfidence || 0)
    }
  };

  auditSecurityEvent(action, req, payload.metadata);
  await ActivityLog.create(payload).catch((err) => {
    console.warn('[CountrySecurity] activity log failed', err.message);
  });
  return payload;
}

async function recordRegionalRewardDaily({
  country,
  platform = DEFAULT_PLATFORM,
  impressions = 0,
  requests = 0,
  adRevenue = 0,
  rewardPayout = 0,
  rewardCount = 0,
  accountCreations = 0,
  suspiciousSignals = 0,
  detectedCountry = '',
  verifiedCountry = '',
  countryConfidence = 0,
  metadata = {}
}) {
  const normalizedCountry = normalizeCountryLabel(country) || DEFAULT_COUNTRY;
  const normalizedPlatform = String(platform || DEFAULT_PLATFORM).trim().toLowerCase() || DEFAULT_PLATFORM;
  const date = new Date().toISOString().slice(0, 10);
  const totalAdImpressions = Number(impressions || 0);
  const totalRequests = Number(requests || 0);
  const totalRevenue = Number(adRevenue || 0);

  const estimatedCpm = totalAdImpressions > 0 ? (totalRevenue / totalAdImpressions) * 1000 : 0;

  return RegionalRewardDaily.findOneAndUpdate(
    { date, country: normalizedCountry, platform: normalizedPlatform },
    {
      $inc: {
        impressions: totalAdImpressions,
        requests: totalRequests,
        adRevenue: totalRevenue,
        rewardPayout: Number(rewardPayout || 0),
        rewardCount: Number(rewardCount || 0),
        accountCreations: Number(accountCreations || 0),
        suspiciousSignals: Number(suspiciousSignals || 0)
      },
      $set: {
        estimatedCpm,
        verifiedCountry: normalizeCountryLabel(verifiedCountry) || '',
        detectedCountry: normalizeCountryLabel(detectedCountry) || '',
        countryConfidence: Number(countryConfidence || 0),
        lastEventAt: new Date(),
        metadata
      }
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
}

module.exports = {
  COUNTRY_REWARD_CAPS,
  DEFAULT_COUNTRY,
  DEFAULT_COUNTRY_CAP,
  buildCountryVerification,
  getCountryRewardConfig,
  getRequestIp,
  normalizeCountryKey,
  normalizeCountryLabel,
  recordCountrySecuritySignal,
  recordRegionalRewardDaily,
  resolveRewardCountry
};
