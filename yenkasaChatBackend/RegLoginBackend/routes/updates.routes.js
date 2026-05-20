const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Update = require('../models/update.model');
const User = require('../models/user.model');
const LiveStream = require('../models/LiveStream');
const { SYSTEM_USER_ID, SYSTEM_USERNAME } = require('../config/system');

const PLAY_STORE_URL = process.env.ANDROID_PLAY_STORE_URL || 'market://details?id=xyz.yenkasa.app';
const CHANNEL_NAME = 'Yenkasa Updates';
const VERIFIED_ROLE = 'verified';
const ALLOWED_REACTIONS = new Set(['fire', 'heart', 'clap']);

function isStaffUser(user) {
  if (!user) return false;
  const accessRole = String(user.accessRole || '').toLowerCase();
  const staffRole = String(user.staffRole || '').toLowerCase();
  const roleName = String(user.roleName || '').toLowerCase();

  return [
    accessRole,
    staffRole,
    roleName
  ].some(value => ['admin', 'moderator', 'senior_developer', 'senior_dev', 'junior_developer'].includes(value));
}

function normalizeCategory(value) {
  return String(value || 'announcement').trim().toLowerCase();
}

function normalizeMediaType(value) {
  return String(value || 'text').trim().toLowerCase();
}

function safeString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function parsePositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function badgeForUpdate(update) {
  if (update.pinned) return 'PINNED';

  const mediaType = normalizeMediaType(update.mediaType);
  if (mediaType === 'live') return 'LIVE';
  if (mediaType === 'video') return 'VIDEO';
  if (mediaType === 'image') return 'PHOTO';

  const category = normalizeCategory(update.category);
  if (category === 'app_update') return 'UPDATE';
  if (category === 'rewards') return 'YKC';
  if (category === 'ranking') return 'TOP';
  return 'NEWS';
}

function buildNotificationShape(update, receiverId) {
  const targetUrl = safeString(update.deepLinkUrl) || safeString(update.targetUrl);
  const publishedAt = update.publishedAt || update.createdAt || new Date();

  return {
    id: String(update._id || update.id),
    type: `update_${normalizeCategory(update.category)}`,
    senderId: update.authorUserId ? String(update.authorUserId) : SYSTEM_USER_ID,
    receiverId: receiverId ? String(receiverId) : null,
    message: update.title,
    title: update.title,
    subtitle: update.body,
    postId: normalizeCategory(update.targetType) === 'post' ? safeString(update.targetId) : null,
    commentId: null,
    activityId: safeString(update.targetId),
    status: 'unread',
    createdAt: publishedAt instanceof Date ? publishedAt.toISOString() : new Date(publishedAt).toISOString(),
    readAt: null,
    targetType: safeString(update.targetType) || 'system',
    targetId: safeString(update.targetId),
    targetUrl: targetUrl || null,
    sender: {
      userId: SYSTEM_USER_ID,
      username: CHANNEL_NAME,
      avatar: '',
      roleName: VERIFIED_ROLE
    },
    thumbnailUrl: safeString(update.thumbnailUrl),
    mediaType: normalizeMediaType(update.mediaType),
    pinned: Boolean(update.pinned),
    badge: badgeForUpdate(update),
    channelName: safeString(update.channelName, CHANNEL_NAME) || CHANNEL_NAME,
    verifiedBadge: update.verifiedBadge !== false,
    reactionFireCount: Number(update.reactions?.fire || 0),
    reactionHeartCount: Number(update.reactions?.heart || 0),
    reactionClapCount: Number(update.reactions?.clap || 0)
  };
}

async function buildSyntheticUpdates() {
  const synthetic = [];
  const now = new Date();

  const [leader, liveStream] = await Promise.all([
    User.find({})
      .select('username profileImage ykcEarnedThisMonth totalQualifiedViews')
      .sort({ ykcEarnedThisMonth: -1, totalQualifiedViews: -1, updatedAt: -1 })
      .limit(1)
      .lean(),
    LiveStream.find({ isLive: true, lifecycleStatus: 'live' })
      .sort({ viewerCount: -1, startedAt: -1 })
      .limit(1)
      .lean()
  ]);

  const topUser = Array.isArray(leader) ? leader[0] : null;
  if (topUser?.username) {
    synthetic.push({
      _id: `synthetic-ranking-${topUser._id}`,
      title: `${topUser.username} is topping Yenkasa this month`,
      body: `${Number(topUser.ykcEarnedThisMonth || 0).toLocaleString()} YKC earned and ${Number(topUser.totalQualifiedViews || 0).toLocaleString()} qualified views so far.`,
      category: 'ranking',
      mediaType: 'image',
      thumbnailUrl: safeString(topUser.profileImage),
      targetType: 'profile',
      targetId: String(topUser._id),
      targetUrl: `/user/${topUser.username}`,
      deepLinkUrl: `/user/${topUser.username}`,
      pinned: false,
      verifiedBadge: true,
      channelName: CHANNEL_NAME,
      reactions: { fire: 0, heart: 0, clap: 0 },
      publishedAt: now
    });
  }

  if (liveStream?.hostUsername) {
    synthetic.push({
      _id: `synthetic-live-${liveStream._id}`,
      title: `${liveStream.hostUsername} just started a livestream`,
      body: safeString(liveStream.title) || 'Join the live session now.',
      category: 'livestream',
      mediaType: 'live',
      thumbnailUrl: safeString(liveStream.thumbnail || liveStream.hostAvatar),
      targetType: 'live',
      targetId: String(liveStream._id),
      targetUrl: `/live/${liveStream._id}`,
      deepLinkUrl: `/live/${liveStream._id}`,
      pinned: false,
      verifiedBadge: true,
      channelName: CHANNEL_NAME,
      reactions: { fire: 0, heart: 0, clap: 0 },
      publishedAt: liveStream.startedAt || now
    });
  }

  const latestVersionCode = parsePositiveInt(process.env.ANDROID_LATEST_VERSION_CODE, 0);
  const latestVersionName = safeString(process.env.ANDROID_LATEST_VERSION_NAME);
  const updateMessage = safeString(process.env.ANDROID_UPDATE_MESSAGE);
  if (latestVersionCode > 0) {
    const versionLabel = latestVersionName || `v${latestVersionCode}`;
    synthetic.push({
      _id: `synthetic-app-update-${latestVersionCode}`,
      title: `Yenkasa ${versionLabel} is now available`,
      body: updateMessage || 'Get the latest performance improvements, livestream fixes, and platform updates.',
      category: 'app_update',
      mediaType: 'link',
      thumbnailUrl: '',
      targetType: 'system',
      targetId: '',
      targetUrl: PLAY_STORE_URL,
      deepLinkUrl: PLAY_STORE_URL,
      pinned: true,
      verifiedBadge: true,
      channelName: CHANNEL_NAME,
      reactions: { fire: 0, heart: 0, clap: 0 },
      publishedAt: now
    });
  }

  return synthetic;
}

async function buildMergedUpdates(limit) {
  const now = new Date();
  const [storedUpdates, syntheticUpdates] = await Promise.all([
    Update.find({
      deletedAt: null,
      $or: [
        { scheduledFor: null },
        { scheduledFor: { $lte: now } }
      ]
    })
      .sort({ pinned: -1, publishedAt: -1, createdAt: -1 })
      .limit(limit)
      .lean(),
    buildSyntheticUpdates()
  ]);

  const merged = [...storedUpdates, ...syntheticUpdates];
  merged.sort((left, right) => {
    if (Boolean(left.pinned) !== Boolean(right.pinned)) {
      return left.pinned ? -1 : 1;
    }
    const leftTime = new Date(left.publishedAt || left.createdAt || 0).getTime();
    const rightTime = new Date(right.publishedAt || right.createdAt || 0).getTime();
    return rightTime - leftTime;
  });
  return merged.slice(0, limit);
}

function ensureStaff(req, res) {
  if (!isStaffUser(req.user)) {
    res.status(403).json({ success: false, message: 'Only admins and moderators can manage updates.' });
    return false;
  }
  return true;
}

function ensureSystemOrStaff(req, res) {
  if (String(req.user?.id || '') === SYSTEM_USER_ID || isStaffUser(req.user)) {
    return true;
  }
  res.status(403).json({ success: false, message: 'Only system and staff accounts can publish updates.' });
  return false;
}

router.get('/', auth, async (req, res) => {
  try {
    const limit = Math.min(parsePositiveInt(req.query.limit, 25), 100);
    const updates = await buildMergedUpdates(limit);
    return res.json(updates.map(update => buildNotificationShape(update, req.user.id)));
  } catch (error) {
    console.error('[updates] failed to fetch updates:', error);
    return res.status(500).json({ success: false, message: 'Could not load updates right now.' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const update = await Update.findOne({ _id: req.params.id, deletedAt: null }).lean();
    if (!update) {
      return res.status(404).json({ success: false, message: 'Update not found.' });
    }

    return res.json(buildNotificationShape(update, req.user.id));
  } catch (error) {
    console.error('[updates] failed to fetch single update:', error);
    return res.status(500).json({ success: false, message: 'Could not load update.' });
  }
});

router.post('/admin', auth, async (req, res) => {
  if (!ensureStaff(req, res)) return;

  try {
    const title = safeString(req.body?.title);
    const body = safeString(req.body?.body);
    if (!title || !body) {
      return res.status(400).json({ success: false, message: 'Title and body are required.' });
    }

    const dedupeKey = safeString(req.body?.dedupeKey) || null;
    if (dedupeKey) {
      const existing = await Update.findOne({ dedupeKey, deletedAt: null }).lean();
      if (existing) {
        return res.status(200).json({ success: true, duplicate: true, update: existing });
      }
    }

    const category = normalizeCategory(req.body?.category);
    const mediaType = normalizeMediaType(req.body?.mediaType);
    const staffRole = String(req.user.staffRole || '').toLowerCase();

    const update = await Update.create({
      title,
      body,
      category,
      mediaType,
      thumbnailUrl: safeString(req.body?.thumbnailUrl),
      videoUrl: safeString(req.body?.videoUrl),
      targetType: safeString(req.body?.targetType, 'system') || 'system',
      targetId: safeString(req.body?.targetId),
      targetUrl: safeString(req.body?.targetUrl),
      deepLinkUrl: safeString(req.body?.deepLinkUrl),
      channelName: CHANNEL_NAME,
      verifiedBadge: true,
      pinned: Boolean(req.body?.pinned),
      authorType: staffRole === 'moderator' ? 'moderator' : 'admin',
      authorUserId: req.user.id,
      dedupeKey,
      scheduledFor: req.body?.scheduledFor ? new Date(req.body.scheduledFor) : null,
      publishedAt: req.body?.publishedAt ? new Date(req.body.publishedAt) : new Date()
    });

    return res.status(201).json({ success: true, update });
  } catch (error) {
    console.error('[updates] failed to create admin update:', error);
    return res.status(500).json({ success: false, message: 'Could not create update.' });
  }
});

router.post('/system', auth, async (req, res) => {
  if (!ensureSystemOrStaff(req, res)) return;

  try {
    const title = safeString(req.body?.title);
    const body = safeString(req.body?.body);
    if (!title || !body) {
      return res.status(400).json({ success: false, message: 'Title and body are required.' });
    }

    const dedupeKey = safeString(req.body?.dedupeKey) || null;
    if (dedupeKey) {
      const existing = await Update.findOne({ dedupeKey, deletedAt: null }).lean();
      if (existing) {
        return res.status(200).json({ success: true, duplicate: true, update: existing });
      }
    }

    const update = await Update.create({
      title,
      body,
      category: normalizeCategory(req.body?.category),
      mediaType: normalizeMediaType(req.body?.mediaType),
      thumbnailUrl: safeString(req.body?.thumbnailUrl),
      videoUrl: safeString(req.body?.videoUrl),
      targetType: safeString(req.body?.targetType, 'system') || 'system',
      targetId: safeString(req.body?.targetId),
      targetUrl: safeString(req.body?.targetUrl),
      deepLinkUrl: safeString(req.body?.deepLinkUrl),
      channelName: CHANNEL_NAME,
      verifiedBadge: true,
      pinned: Boolean(req.body?.pinned),
      authorType: 'system',
      authorUserId: SYSTEM_USER_ID,
      dedupeKey,
      scheduledFor: req.body?.scheduledFor ? new Date(req.body.scheduledFor) : null,
      publishedAt: req.body?.publishedAt ? new Date(req.body.publishedAt) : new Date()
    });

    return res.status(201).json({ success: true, update });
  } catch (error) {
    console.error('[updates] failed to create system update:', error);
    return res.status(500).json({ success: false, message: 'Could not create system update.' });
  }
});

router.post('/:id/pin', auth, async (req, res) => {
  if (!ensureStaff(req, res)) return;

  try {
    const pinned = Boolean(req.body?.pinned);
    const update = await Update.findOneAndUpdate(
      { _id: req.params.id, deletedAt: null },
      { $set: { pinned } },
      { new: true }
    );

    if (!update) {
      return res.status(404).json({ success: false, message: 'Update not found.' });
    }

    return res.json({ success: true, update });
  } catch (error) {
    console.error('[updates] failed to pin update:', error);
    return res.status(500).json({ success: false, message: 'Could not update pin status.' });
  }
});

router.post('/:id/reactions', auth, async (req, res) => {
  try {
    const reaction = String(req.body?.reaction || '').trim().toLowerCase();
    if (!ALLOWED_REACTIONS.has(reaction)) {
      return res.status(400).json({ success: false, message: 'Unsupported reaction.' });
    }

    const update = await Update.findOneAndUpdate(
      { _id: req.params.id, deletedAt: null },
      { $inc: { [`reactions.${reaction}`]: 1 } },
      { new: true }
    );

    if (!update) {
      return res.status(404).json({ success: false, message: 'Update not found.' });
    }

    return res.json({ success: true, update });
  } catch (error) {
    console.error('[updates] failed to react to update:', error);
    return res.status(500).json({ success: false, message: 'Could not save reaction.' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  if (!ensureStaff(req, res)) return;

  try {
    const update = await Update.findByIdAndUpdate(
      req.params.id,
      { $set: { deletedAt: new Date() } },
      { new: true }
    );

    if (!update) {
      return res.status(404).json({ success: false, message: 'Update not found.' });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('[updates] failed to delete update:', error);
    return res.status(500).json({ success: false, message: 'Could not delete update.' });
  }
});

module.exports = router;
