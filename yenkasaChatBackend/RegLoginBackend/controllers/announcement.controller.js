const mongoose = require('mongoose');
const cron = require('node-cron');
const Announcement = require('../models/announcement.model');
const User = require('../models/user.model');
const { cloudinary } = require('../config/cloudinary');
const mediaStorage = require('../services/mediaStorage.service');
const { getPermissions } = require('../middleware/permissions');
const { sendNotification } = require('../services/notification.service');

const CHANNEL_NAME = 'Yenkasa Updates';
const MAX_MEDIA_FILES = 5;
const ANNOUNCEMENT_LINK_PREFIX = '/announcements/';
const SUPPORTED_AUDIENCES = new Set(['all', 'verified', 'admins', 'moderators', 'developers', 'community']);
const SUPPORTED_STATUSES = new Set(['draft', 'scheduled', 'published']);

function isAnnouncementManager(user) {
  const rank = getPermissions(user).rank;
  return rank === 'ADMIN' || rank === 'SENIOR_DEVELOPER';
}

function normalizeString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function stripRichText(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*_`>#]/g, ' ')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAudience(value) {
  const normalized = normalizeString(value, 'all').toLowerCase();
  return SUPPORTED_AUDIENCES.has(normalized) ? normalized : 'all';
}

function parseOptionalDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeStatus(rawStatus, scheduledAt) {
  const requested = normalizeString(rawStatus, '').toLowerCase();
  if (requested === 'draft') return 'draft';
  if (scheduledAt && scheduledAt.getTime() > Date.now()) return 'scheduled';
  if (SUPPORTED_STATUSES.has(requested)) return requested;
  return 'published';
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value;
  const normalized = normalizeString(value).toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
}

function normalizeCommunityId(value) {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

function resolveAuthorRole(user) {
  return String(getPermissions(user).rank || user?.staffRole || user?.accessRole || user?.roleName || 'unverified')
    .toLowerCase();
}

function resolveAudienceQuery(audience, communityId) {
  switch (audience) {
    case 'verified':
      return {
        $or: [
          { verified: true },
          { accessRole: 'VERIFIED' },
          { roleName: 'verified' },
          { publicRoles: 'verified_creator' }
        ]
      };
    case 'admins':
      return {
        $or: [
          { accessRole: 'ADMIN' },
          { staffRole: 'admin' }
        ]
      };
    case 'moderators':
      return {
        $or: [
          { accessRole: 'MODERATOR' },
          { staffRole: 'moderator' }
        ]
      };
    case 'developers':
      return {
        $or: [
          { accessRole: { $in: ['SENIOR_DEVELOPER', 'JUNIOR_DEVELOPER', 'SENIOR_DEV'] } },
          { staffRole: { $in: ['senior_developer', 'junior_developer'] } }
        ]
      };
    case 'community':
      return communityId ? { community: communityId } : { _id: null };
    case 'all':
    default:
      return {};
  }
}

function announcementVisibleToUser(user, announcement) {
  const audience = normalizeAudience(announcement.audience);
  const userRank = resolveAuthorRole(user);
  const userCommunity = user?.community ? String(user.community) : '';

  switch (audience) {
    case 'verified':
      return Boolean(
        user?.verified ||
        String(user?.accessRole || '').toUpperCase() === 'VERIFIED' ||
        String(user?.roleName || '').toLowerCase() === 'verified' ||
        Array.isArray(user?.publicRoles) && user.publicRoles.includes('verified_creator')
      );
    case 'admins':
      return userRank === 'admin';
    case 'moderators':
      return userRank === 'moderator' || userRank === 'admin';
    case 'developers':
      return ['senior_developer', 'junior_developer', 'admin'].includes(userRank);
    case 'community':
      return Boolean(userCommunity) && userCommunity === String(announcement.communityId || '');
    case 'all':
    default:
      return true;
  }
}

function buildAnnouncementTargetUrl(announcement) {
  const explicit = normalizeString(announcement.targetUrl);
  if (explicit) return explicit;
  return `${ANNOUNCEMENT_LINK_PREFIX}${announcement._id}`;
}

function getPrimaryMedia(announcement) {
  return Array.isArray(announcement.media) && announcement.media.length ? announcement.media[0] : null;
}

function buildBadge(announcement) {
  if (announcement.isPinned) return 'PINNED';
  const mediaType = normalizeString(getPrimaryMedia(announcement)?.type).toUpperCase();
  if (mediaType) return mediaType;
  return 'NEWS';
}

function serializeAnnouncement(announcement) {
  const primaryMedia = getPrimaryMedia(announcement);
  return {
    id: String(announcement._id),
    _id: String(announcement._id),
    title: announcement.title,
    message: announcement.message,
    authorId: announcement.authorId ? String(announcement.authorId) : '',
    authorUsername: announcement.authorUsername,
    authorRole: announcement.authorRole,
    media: Array.isArray(announcement.media) ? announcement.media : [],
    audience: announcement.audience,
    communityId: announcement.communityId ? String(announcement.communityId) : null,
    communityName: announcement.communityName || '',
    status: announcement.status,
    scheduledAt: announcement.scheduledAt ? new Date(announcement.scheduledAt).toISOString() : null,
    publishedAt: announcement.publishedAt ? new Date(announcement.publishedAt).toISOString() : null,
    isPinned: Boolean(announcement.isPinned),
    isDeleted: Boolean(announcement.isDeleted),
    viewsCount: Number(announcement.viewsCount || 0),
    likesCount: Number(announcement.likesCount || 0),
    targetUrl: normalizeString(announcement.targetUrl),
    deepLinkUrl: normalizeString(announcement.deepLinkUrl),
    previewText: stripRichText(announcement.message).slice(0, 220),
    primaryThumbnailUrl: normalizeString(primaryMedia?.thumbnail || primaryMedia?.url),
    primaryMediaType: normalizeString(primaryMedia?.type, 'text'),
    badge: buildBadge(announcement),
    channelName: CHANNEL_NAME,
    verifiedBadge: true,
    createdAt: announcement.createdAt ? new Date(announcement.createdAt).toISOString() : null,
    updatedAt: announcement.updatedAt ? new Date(announcement.updatedAt).toISOString() : null
  };
}

async function uploadAnnouncementMedia(file, index) {
  const mimeType = normalizeString(file?.mimetype);
  const originalName = normalizeString(file?.originalname, `attachment-${index + 1}`);
  const mediaType = mimeType.startsWith('image/')
    ? 'image'
    : mimeType.startsWith('video/')
      ? 'video'
      : mimeType.startsWith('audio/')
        ? 'audio'
        : 'file';

  const uploadResult = await mediaStorage.upload(file, {
    folder: mediaType === 'video' ? 'videos' : 'posts',
    type: mediaType,
    area: `announcement_${mediaType}`,
    prefix: `announcement-${index}`,
    cloudinary: {
      public_id: `${Date.now()}-${index}-${originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    }
  });

  let thumbnail = '';
  if (mediaType === 'video' && uploadResult?.provider === 'cloudinary' && uploadResult?.public_id) {
    thumbnail = cloudinary.url(uploadResult.public_id, {
      resource_type: 'video',
      format: 'jpg',
      secure: true,
      transformation: [{ width: 1280, height: 720, crop: 'fill', quality: 'auto' }]
    });
  } else if (mediaType === 'image') {
    thumbnail = uploadResult?.secure_url || '';
  }

  return {
    type: mediaType,
    url: uploadResult?.secure_url || '',
    thumbnail,
    filename: originalName,
    size: Number(file?.size || file?.buffer?.length || 0)
  };
}

async function buildMediaPayload(files) {
  const list = Array.isArray(files) ? files.slice(0, MAX_MEDIA_FILES) : [];
  const uploads = [];
  for (let index = 0; index < list.length; index += 1) {
    uploads.push(await uploadAnnouncementMedia(list[index], index));
  }
  return uploads.filter(item => item.url);
}

async function dispatchAnnouncementNotifications(announcement) {
  if (!announcement || announcement.status !== 'published' || announcement.isDeleted) return;
  if (announcement.notificationsDispatchedAt) return;

  const audienceQuery = resolveAudienceQuery(announcement.audience, announcement.communityId || null);
  const users = await User.find(audienceQuery).select('_id').lean();
  const receiverIds = users
    .map(user => user?._id)
    .filter(Boolean)
    .map(userId => String(userId))
    .filter(userId => userId !== String(announcement.authorId));

  const previewText = stripRichText(announcement.message).slice(0, 160) || announcement.title;
  const serialized = serializeAnnouncement(announcement.toObject ? announcement.toObject() : announcement);

  if (receiverIds.length) {
    const notificationJobs = receiverIds.map(receiverId => sendNotification({
      type: 'announcement',
      senderId: announcement.authorId,
      receiverId,
      activityId: String(announcement._id),
      targetType: 'announcement',
      targetId: String(announcement._id),
      targetUrl: buildAnnouncementTargetUrl(announcement),
      message: announcement.title,
      push: true,
      pushTitle: announcement.title,
      pushBody: previewText,
      pushData: {
        announcementId: String(announcement._id),
        previewText,
        mediaThumbnail: serialized.primaryThumbnailUrl || '',
        targetUrl: buildAnnouncementTargetUrl(announcement)
      },
      allowSelfNotification: true,
      pushCollapseId: `announcement_${announcement._id}`,
      pushAndroidGroup: 'yenkasa_updates',
      pushAndroidGroupMessage: '$[notif_count] new Yenkasa updates'
    }));

    const results = await Promise.allSettled(notificationJobs);
    const rejected = results.filter(result => result.status === 'rejected');
    if (rejected.length) {
      console.error('[announcements] some notifications failed to dispatch', {
        announcementId: String(announcement._id),
        failedCount: rejected.length
      });
    }
  }

  announcement.notificationsDispatchedAt = new Date();
  await announcement.save();

  if (global.io) {
    global.io.emit('newAnnouncement', serialized);
  }
}

async function publishAnnouncementIfNeeded(announcement) {
  if (!announcement || announcement.isDeleted) return announcement;
  if (announcement.status !== 'published') {
    announcement.status = 'published';
  }
  if (!announcement.publishedAt) {
    announcement.publishedAt = new Date();
  }
  await announcement.save();
  await dispatchAnnouncementNotifications(announcement);
  return announcement;
}

async function flushScheduledAnnouncements() {
  const dueAnnouncements = await Announcement.find({
    isDeleted: false,
    status: 'scheduled',
    scheduledAt: { $lte: new Date() }
  });

  for (const announcement of dueAnnouncements) {
    try {
      await publishAnnouncementIfNeeded(announcement);
    } catch (error) {
      console.error('[announcements] failed to publish scheduled announcement', {
        announcementId: announcement?._id?.toString?.(),
        message: error.message
      });
    }
  }
}

if (!global.__ANNOUNCEMENT_CRON_STARTED) {
  cron.schedule('* * * * *', () => {
    flushScheduledAnnouncements().catch(error => {
      console.error('[announcements] scheduler failed', error);
    });
  });
  global.__ANNOUNCEMENT_CRON_STARTED = true;
}

async function createAnnouncement(req, res) {
  if (!isAnnouncementManager(req.user)) {
    return res.status(403).json({ success: false, message: 'Only admins and senior developers can create announcements.' });
  }

  try {
    const title = normalizeString(req.body?.title);
    const message = normalizeString(req.body?.message);
    const targetUrl = normalizeString(req.body?.targetUrl);
    const deepLinkUrl = normalizeString(req.body?.deepLinkUrl);
    const audience = normalizeAudience(req.body?.audience);
    const scheduledAt = parseOptionalDate(req.body?.scheduledAt);
    const requestedStatus = normalizeStatus(req.body?.status, scheduledAt);
    const isPinned = normalizeBoolean(req.body?.isPinned);
    const communityId = normalizeCommunityId(req.body?.communityId);
    const communityName = normalizeString(req.body?.communityName);

    if (!title) {
      return res.status(400).json({ success: false, message: 'Title is required.' });
    }
    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required.' });
    }
    if (audience === 'community' && !communityId) {
      return res.status(400).json({ success: false, message: 'Select a community for community announcements.' });
    }

    const media = await buildMediaPayload(req.files);
    const announcement = await Announcement.create({
      title,
      message,
      authorId: req.user._id,
      authorUsername: req.user.username || 'Yenkasa',
      authorRole: resolveAuthorRole(req.user),
      media,
      audience,
      communityId,
      communityName,
      status: requestedStatus,
      scheduledAt,
      publishedAt: requestedStatus === 'published' ? new Date() : null,
      isPinned,
      targetUrl,
      deepLinkUrl
    });

    if (announcement.status === 'published') {
      await dispatchAnnouncementNotifications(announcement);
    }

    return res.status(201).json({
      success: true,
      message: announcement.status === 'draft'
        ? 'Announcement saved as draft.'
        : announcement.status === 'scheduled'
          ? 'Announcement scheduled.'
          : 'Announcement published.',
      announcement: serializeAnnouncement(announcement.toObject())
    });
  } catch (error) {
    console.error('[announcements] create failed', error);
    return res.status(500).json({ success: false, message: 'Could not create announcement right now.' });
  }
}

async function getAnnouncementFeed(req, res) {
  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 50);

    const announcements = await Announcement.find({
      isDeleted: false,
      status: 'published'
    })
      .sort({ isPinned: -1, publishedAt: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const visible = announcements
      .filter(item => announcementVisibleToUser(req.user, item))
      .map(serializeAnnouncement);

    return res.json(visible);
  } catch (error) {
    console.error('[announcements] feed failed', error);
    return res.status(500).json({ success: false, message: 'Could not load announcements right now.' });
  }
}

async function getAnnouncementById(req, res) {
  try {
    const announcement = await Announcement.findOne({
      _id: req.params.id,
      isDeleted: false
    }).lean();

    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found.' });
    }
    if (!announcementVisibleToUser(req.user, announcement)) {
      return res.status(403).json({ success: false, message: 'You cannot view this announcement.' });
    }

    return res.json({ success: true, announcement: serializeAnnouncement(announcement) });
  } catch (error) {
    console.error('[announcements] single fetch failed', error);
    return res.status(500).json({ success: false, message: 'Could not load this announcement.' });
  }
}

async function updateAnnouncement(req, res) {
  if (!isAnnouncementManager(req.user)) {
    return res.status(403).json({ success: false, message: 'Only admins and senior developers can update announcements.' });
  }

  try {
    const announcement = await Announcement.findOne({
      _id: req.params.id,
      isDeleted: false
    });
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found.' });
    }

    const title = normalizeString(req.body?.title, announcement.title);
    const message = normalizeString(req.body?.message, announcement.message);
    const targetUrl = normalizeString(req.body?.targetUrl, announcement.targetUrl);
    const deepLinkUrl = normalizeString(req.body?.deepLinkUrl, announcement.deepLinkUrl);
    const audience = req.body?.audience ? normalizeAudience(req.body?.audience) : announcement.audience;
    const scheduledAt = req.body?.scheduledAt === ''
      ? null
      : parseOptionalDate(req.body?.scheduledAt) || announcement.scheduledAt;
    const requestedStatus = normalizeStatus(req.body?.status || announcement.status, scheduledAt);
    const isPinned = req.body?.isPinned == null ? announcement.isPinned : normalizeBoolean(req.body?.isPinned);
    const communityId = req.body?.communityId === ''
      ? null
      : normalizeCommunityId(req.body?.communityId) || announcement.communityId;
    const communityName = req.body?.communityName == null
      ? announcement.communityName
      : normalizeString(req.body?.communityName);

    announcement.title = title;
    announcement.message = message;
    announcement.targetUrl = targetUrl;
    announcement.deepLinkUrl = deepLinkUrl;
    announcement.audience = audience;
    announcement.scheduledAt = scheduledAt;
    announcement.status = requestedStatus;
    announcement.isPinned = isPinned;
    announcement.communityId = communityId;
    announcement.communityName = communityName;

    const replacementMedia = await buildMediaPayload(req.files);
    if (replacementMedia.length) {
      announcement.media = replacementMedia;
    }

    await announcement.save();

    if (announcement.status === 'published') {
      await publishAnnouncementIfNeeded(announcement);
    }

    return res.json({
      success: true,
      message: 'Announcement updated.',
      announcement: serializeAnnouncement(announcement.toObject())
    });
  } catch (error) {
    console.error('[announcements] update failed', error);
    return res.status(500).json({ success: false, message: 'Could not update this announcement.' });
  }
}

async function deleteAnnouncement(req, res) {
  if (!isAnnouncementManager(req.user)) {
    return res.status(403).json({ success: false, message: 'Only admins and senior developers can delete announcements.' });
  }

  try {
    const announcement = await Announcement.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { $set: { isDeleted: true } },
      { new: true }
    );

    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found.' });
    }

    return res.json({ success: true, message: 'Announcement deleted.' });
  } catch (error) {
    console.error('[announcements] delete failed', error);
    return res.status(500).json({ success: false, message: 'Could not delete this announcement.' });
  }
}

async function likeAnnouncement(req, res) {
  try {
    const announcement = await Announcement.findOne({
      _id: req.params.id,
      isDeleted: false,
      status: 'published'
    }).select('+likedBy');

    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found.' });
    }
    if (!announcementVisibleToUser(req.user, announcement)) {
      return res.status(403).json({ success: false, message: 'You cannot like this announcement.' });
    }

    const userId = String(req.user._id);
    const alreadyLiked = announcement.likedBy.map(id => String(id)).includes(userId);
    if (alreadyLiked) {
      announcement.likedBy = announcement.likedBy.filter(id => String(id) !== userId);
    } else {
      announcement.likedBy.push(req.user._id);
    }
    announcement.likesCount = announcement.likedBy.length;
    await announcement.save();

    return res.json({
      success: true,
      liked: !alreadyLiked,
      likesCount: announcement.likesCount,
      announcement: serializeAnnouncement(announcement.toObject())
    });
  } catch (error) {
    console.error('[announcements] like failed', error);
    return res.status(500).json({ success: false, message: 'Could not update the like right now.' });
  }
}

async function viewAnnouncement(req, res) {
  try {
    const announcement = await Announcement.findOne({
      _id: req.params.id,
      isDeleted: false,
      status: 'published'
    }).select('+viewedBy');

    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found.' });
    }
    if (!announcementVisibleToUser(req.user, announcement)) {
      return res.status(403).json({ success: false, message: 'You cannot view this announcement.' });
    }

    const userId = String(req.user._id);
    if (!announcement.viewedBy.map(id => String(id)).includes(userId)) {
      announcement.viewedBy.push(req.user._id);
      announcement.viewsCount = announcement.viewedBy.length;
      await announcement.save();
    }

    return res.json({
      success: true,
      viewsCount: announcement.viewsCount,
      announcement: serializeAnnouncement(announcement.toObject())
    });
  } catch (error) {
    console.error('[announcements] view failed', error);
    return res.status(500).json({ success: false, message: 'Could not update the view right now.' });
  }
}

module.exports = {
  createAnnouncement,
  getAnnouncementFeed,
  getAnnouncementById,
  updateAnnouncement,
  deleteAnnouncement,
  likeAnnouncement,
  viewAnnouncement,
  flushScheduledAnnouncements
};
