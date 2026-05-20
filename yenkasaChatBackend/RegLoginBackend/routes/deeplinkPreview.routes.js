const express = require('express');
const mongoose = require('mongoose');

const Post = require('../models/post.model');
const User = require('../models/user.model');
const Community = require('../models/community.model');
const LiveStream = require('../models/LiveStream');
const {
  buildOptimizedImageUrl,
  buildVideoPosterUrl
} = require('../utils/cloudinaryMedia');

const router = express.Router();

const SITE_ORIGIN = 'https://www.yenkasa.xyz';
const APP_PACKAGE = 'xyz.yenkasa.app';
const FALLBACK_IMAGE_URL = `${SITE_ORIGIN}/web/images/app-icon.png`;
const BOT_UA_RE = /(facebookexternalhit|facebot|twitterbot|xbot|linkedinbot|slackbot|discordbot|telegrambot|whatsapp|skypeuripreview|googlebot|bingbot|duckduckbot|applebot|crawler|spider|bot)/i;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function normalizeWhitespace(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(value, maxLength) {
  const normalized = normalizeWhitespace(value);
  if (!normalized || normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function secureUrl(value) {
  if (!value || typeof value !== 'string') return '';
  return value.replace(/^http:\/\//i, 'https://');
}

function buildAbsoluteWebUrl(pathname) {
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${SITE_ORIGIN}${normalized}`;
}

function isCrawlerRequest(req) {
  const userAgent = String(req.get('user-agent') || '');
  return BOT_UA_RE.test(userAgent);
}

function sanitizeTimestamp(value) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function formatTimestamp(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '';
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

function appendTimestamp(url, seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return url;
  const target = new URL(url);
  target.searchParams.set('t', String(seconds));
  return target.toString();
}

function buildIntentUrl(appLinkUrl, fallbackUrl) {
  const target = new URL(appLinkUrl);
  const authorityAndPath = `${target.host}${target.pathname}${target.search}`;
  return `intent://${authorityAndPath}#Intent;scheme=https;package=${APP_PACKAGE};S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`;
}

function optimizeImage(url, width = 1200) {
  if (!url) return '';
  return secureUrl(buildOptimizedImageUrl(url, { width, crop: 'c_limit' }) || url);
}

function optimizeVideoPoster(url, width = 1200) {
  if (!url) return '';
  return secureUrl(buildVideoPosterUrl(url, { width }) || url);
}

function fallbackImage(...candidates) {
  for (const candidate of candidates) {
    if (candidate) return secureUrl(candidate);
  }
  return FALLBACK_IMAGE_URL;
}

function buildCanonicalUrl(req) {
  const target = new URL(`${SITE_ORIGIN}${req.path}`);
  const seconds = sanitizeTimestamp(req.query?.t);
  if (seconds !== null) target.searchParams.set('t', String(seconds));
  return target.toString();
}

function renderPreviewPage(res, req, preview, statusCode = 200) {
  const crawler = isCrawlerRequest(req);
  const userAgent = String(req.get('user-agent') || '');
  const isAndroid = /android/i.test(userAgent);
  const appLinkUrl = preview.appLinkUrl || preview.canonicalUrl;
  const webFallbackUrl = preview.webFallbackUrl || buildAbsoluteWebUrl('/web/');
  const redirectTarget = isAndroid ? buildIntentUrl(appLinkUrl, webFallbackUrl) : webFallbackUrl;
  const autoRedirect = !crawler && preview.autoRedirect !== false;

  const title = escapeHtml(preview.title || 'Yenkasa');
  const description = escapeHtml(preview.description || 'Open Yenkasa');
  const image = escapeAttr(preview.image || FALLBACK_IMAGE_URL);
  const canonicalUrl = escapeAttr(preview.canonicalUrl || appLinkUrl);
  const androidPackage = escapeAttr(APP_PACKAGE);
  const twitterCard = preview.image ? 'summary_large_image' : 'summary';
  const ogType = escapeAttr(preview.ogType || 'website');
  const pageHeading = escapeHtml(preview.heading || preview.title || 'Open in Yenkasa');
  const pageBody = escapeHtml(preview.body || preview.description || 'Open this content in Yenkasa.');
  const primaryLabel = escapeHtml(preview.primaryLabel || 'Open in app');
  const secondaryLabel = escapeHtml(preview.secondaryLabel || 'Continue on web');
  const safeWebFallbackUrl = escapeAttr(webFallbackUrl);
  const safeAppLinkUrl = escapeAttr(appLinkUrl);
  const primaryHref = escapeAttr(preview.primaryHref || (isAndroid ? redirectTarget : appLinkUrl));

  res.status(statusCode);
  res.setHeader('Vary', 'User-Agent');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self' https: data: blob:; img-src 'self' https: data: blob:; style-src 'self' 'unsafe-inline' https:; script-src 'self' 'unsafe-inline' https:; connect-src 'self' https:; font-src 'self' https: data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  );

  const refreshTag = autoRedirect
    ? `<meta http-equiv="refresh" content="${isAndroid ? '2' : '0'};url=${safeWebFallbackUrl}">`
    : '';

  const redirectScript = autoRedirect
    ? `
    <script>
      (function () {
        var redirectTarget = ${JSON.stringify(redirectTarget)};
        var fallbackUrl = ${JSON.stringify(webFallbackUrl)};
        var isAndroid = ${JSON.stringify(isAndroid)};

        if (!redirectTarget) return;

        if (!isAndroid) {
          window.location.replace(fallbackUrl);
          return;
        }

        window.location.replace(redirectTarget);

        window.setTimeout(function () {
          if (document.visibilityState === 'visible') {
            window.location.replace(fallbackUrl);
          }
        }, 1500);
      })();
    </script>`
    : '';

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <meta name="description" content="${description}">
    <link rel="canonical" href="${canonicalUrl}">
    <meta property="og:site_name" content="Yenkasa">
    <meta property="og:type" content="${ogType}">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${image}">
    <meta property="og:image:secure_url" content="${image}">
    <meta property="og:url" content="${canonicalUrl}">
    <meta name="twitter:card" content="${twitterCard}">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${image}">
    <meta property="al:android:package" content="${androidPackage}">
    <meta property="al:android:url" content="${safeAppLinkUrl}">
    <meta property="al:web:url" content="${safeWebFallbackUrl}">
    ${refreshTag}
    <style>
      :root {
        color-scheme: light dark;
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #0f172a;
        color: #f8fafc;
        padding: 24px;
      }
      main {
        width: min(560px, 100%);
        background: rgba(15, 23, 42, 0.92);
        border: 1px solid rgba(148, 163, 184, 0.18);
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 24px 80px rgba(15, 23, 42, 0.45);
      }
      img {
        display: block;
        width: 100%;
        aspect-ratio: 16 / 9;
        object-fit: cover;
        background: #111827;
      }
      section {
        padding: 20px;
      }
      p {
        margin: 0 0 12px;
        line-height: 1.5;
        color: rgba(226, 232, 240, 0.88);
      }
      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        letter-spacing: 0;
        color: #38bdf8;
        margin-bottom: 10px;
      }
      h1 {
        margin: 0 0 12px;
        font-size: 24px;
        line-height: 1.2;
      }
      .actions {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        margin-top: 18px;
      }
      .actions a {
        flex: 1 1 220px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 48px;
        border-radius: 12px;
        text-decoration: none;
        font-weight: 600;
      }
      .actions a.primary {
        background: #22c55e;
        color: #04130a;
      }
      .actions a.secondary {
        background: rgba(148, 163, 184, 0.14);
        color: #f8fafc;
        border: 1px solid rgba(148, 163, 184, 0.18);
      }
      .caption {
        font-size: 14px;
        color: rgba(191, 219, 254, 0.84);
      }
    </style>
    ${redirectScript}
  </head>
  <body>
    <main>
      <img src="${image}" alt="${title}">
      <section>
        <div class="eyebrow">Yenkasa deep link</div>
        <h1>${pageHeading}</h1>
        <p>${pageBody}</p>
        <p class="caption">${escapeHtml(preview.caption || '')}</p>
        <div class="actions">
          <a class="primary" href="${primaryHref}">${primaryLabel}</a>
          <a class="secondary" href="${safeWebFallbackUrl}">${secondaryLabel}</a>
        </div>
      </section>
    </main>
  </body>
</html>`;

  return res.send(html);
}

function notFoundPreview(req, kind, value) {
  const webFallbackUrl = buildAbsoluteWebUrl('/web/');
  return {
    title: `${kind} not found on Yenkasa`,
    heading: `${kind} unavailable`,
    description: `The requested ${kind.toLowerCase()} could not be found on Yenkasa.`,
    body: value
      ? `We could not find the requested ${kind.toLowerCase()} for “${value}”.`
      : `We could not find the requested ${kind.toLowerCase()}.`,
    image: FALLBACK_IMAGE_URL,
    canonicalUrl: buildCanonicalUrl(req),
    appLinkUrl: buildCanonicalUrl(req),
    webFallbackUrl,
    autoRedirect: true,
    ogType: 'website',
    primaryLabel: 'Open Yenkasa',
    secondaryLabel: 'Go to web'
  };
}

function buildPostImage(post) {
  const firstImage = Array.isArray(post.imageUrls) ? post.imageUrls.find(Boolean) : '';
  if (post.videoUrl) return fallbackImage(optimizeVideoPoster(post.videoUrl), optimizeImage(firstImage), optimizeImage(post.imageUrl));
  if (firstImage || post.imageUrl) return fallbackImage(optimizeImage(firstImage), optimizeImage(post.imageUrl));
  return fallbackImage(
    optimizeImage(post.userId?.profileImage, 720),
    optimizeImage(post.communityId?.coverImage, 1200),
    optimizeImage(post.communityId?.icon, 720)
  );
}

function buildPostPreview(req, post) {
  const timestamp = sanitizeTimestamp(req.query?.t);
  const canonicalUrl = buildCanonicalUrl(req);
  const appLinkUrl = canonicalUrl;
  const webFallbackUrl = appendTimestamp(buildAbsoluteWebUrl(`/web/post/${post._id}`), timestamp);
  const username = post.userId?.username || 'yenkasa';
  const handle = `@${username}`;
  const communityName = post.communityId?.displayName || post.communityName || '';
  const caption = truncate(post.text || '', 160);
  const hasImage = Boolean(post.imageUrl) || (Array.isArray(post.imageUrls) && post.imageUrls.some(Boolean));
  const mediaType = post.videoUrl
    ? 'video'
    : post.audioUrl
      ? 'audio'
      : hasImage
        ? 'image'
        : (post.postType || 'post');
  const timestampText = timestamp !== null ? ` Starts at ${formatTimestamp(timestamp)}.` : '';
  const descriptionBase = [
    `${handle} shared a ${mediaType} post on Yenkasa${communityName ? ` in ${communityName}` : ''}.${timestampText}`.trim(),
    caption
  ].filter(Boolean).join(' ');

  return {
    title: caption ? `${handle}: ${truncate(post.text, 72)}` : `${handle} on Yenkasa`,
    heading: `${handle} on Yenkasa`,
    description: truncate(descriptionBase, 200),
    body: communityName
      ? `${handle} posted in ${communityName}.`
      : `${handle} shared this on Yenkasa.`,
    caption,
    image: buildPostImage(post),
    canonicalUrl,
    appLinkUrl,
    webFallbackUrl,
    ogType: post.videoUrl ? 'video.other' : 'article'
  };
}

function buildUserPreview(req, user) {
  const canonicalUrl = buildCanonicalUrl(req);
  const appLinkUrl = canonicalUrl;
  const webFallbackUrl = buildAbsoluteWebUrl(`/web/profile/${user._id}`);
  const handle = `@${user.username}`;
  const socialLine = `${Number(user.followersCount || 0).toLocaleString()} followers`;
  const description = user.bio
    ? truncate(user.bio, 180)
    : `${handle} on Yenkasa. ${socialLine}.`;

  return {
    title: `${handle} on Yenkasa`,
    heading: `${handle} on Yenkasa`,
    description,
    body: `${socialLine}${user.verified ? ' · Verified account' : ''}`,
    caption: user.bio ? truncate(user.bio, 120) : '',
    image: fallbackImage(optimizeImage(user.profileImage, 960)),
    canonicalUrl,
    appLinkUrl,
    webFallbackUrl,
    ogType: 'profile'
  };
}

function buildCommunityPreview(req, community) {
  const canonicalUrl = buildCanonicalUrl(req);
  const appLinkUrl = canonicalUrl;
  const webFallbackUrl = buildAbsoluteWebUrl(`/web/communities?communityId=${encodeURIComponent(String(community._id))}`);
  const name = community.displayName || community.name || 'Community';
  const statsLine = `${Number(community.memberCount || 0).toLocaleString()} members · ${Number(community.postCount || 0).toLocaleString()} posts`;
  const description = community.description
    ? truncate(community.description, 180)
    : `${name} on Yenkasa. ${statsLine}.`;

  return {
    title: `${name} on Yenkasa`,
    heading: `${name}`,
    description,
    body: statsLine,
    caption: community.country ? `${community.country}${community.city ? ` · ${community.city}` : ''}` : '',
    image: fallbackImage(optimizeImage(community.coverImage), optimizeImage(community.icon, 960)),
    canonicalUrl,
    appLinkUrl,
    webFallbackUrl,
    ogType: 'website'
  };
}

function buildLivePreview(req, stream) {
  const canonicalUrl = buildCanonicalUrl(req);
  const appLinkUrl = canonicalUrl;
  const webFallbackUrl = buildAbsoluteWebUrl(`/web/?liveId=${encodeURIComponent(String(stream._id))}`);
  const handle = stream.hostUsername ? `@${stream.hostUsername}` : '@yenkasa';
  const liveState = stream.isLive ? 'Live now' : 'Livestream';
  const viewerLine = stream.isLive
    ? `${Number(stream.viewerCount || 0).toLocaleString()} watching now`
    : 'Open on Yenkasa';
  const description = truncate(
    `${stream.title || `${handle} is live on Yenkasa`}. ${viewerLine}${stream.community ? ` · ${stream.community}` : ''}.`,
    200
  );

  return {
    title: stream.title || `${handle} is live on Yenkasa`,
    heading: stream.title || `${handle} is live`,
    description,
    body: `${liveState}${stream.community ? ` in ${stream.community}` : ''} · ${viewerLine}`,
    caption: handle,
    image: fallbackImage(optimizeImage(stream.thumbnail), optimizeImage(stream.hostAvatar, 960)),
    canonicalUrl,
    appLinkUrl,
    webFallbackUrl,
    ogType: 'video.other'
  };
}

router.get('/post/:id', async (req, res, next) => {
  try {
    const postId = String(req.params.id || '').trim();
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return renderPreviewPage(res, req, notFoundPreview(req, 'Post', postId), 404);
    }

    const post = await Post.findOne({
      _id: postId,
      isActive: true,
      status: 'approved',
      visibility: 'public'
    })
      .populate('userId', 'username profileImage')
      .populate('communityId', 'displayName name coverImage icon')
      .lean();

    if (!post) {
      return renderPreviewPage(res, req, notFoundPreview(req, 'Post', postId), 404);
    }

    return renderPreviewPage(res, req, buildPostPreview(req, post));
  } catch (error) {
    return next(error);
  }
});

router.get('/user/:username', async (req, res, next) => {
  try {
    const username = normalizeWhitespace(decodeURIComponent(String(req.params.username || ''))).replace(/^@+/, '').toLowerCase();
    if (!username) {
      return renderPreviewPage(res, req, notFoundPreview(req, 'User', username), 404);
    }

    const user = await User.findOne({ username })
      .select('_id username bio profileImage followersCount verified')
      .lean();

    if (!user) {
      return renderPreviewPage(res, req, notFoundPreview(req, 'User', username), 404);
    }

    return renderPreviewPage(res, req, buildUserPreview(req, user));
  } catch (error) {
    return next(error);
  }
});

router.get('/community/:id', async (req, res, next) => {
  try {
    const communityId = String(req.params.id || '').trim();
    if (!mongoose.Types.ObjectId.isValid(communityId)) {
      return renderPreviewPage(res, req, notFoundPreview(req, 'Community', communityId), 404);
    }

    const community = await Community.findOne({
      _id: communityId,
      isActive: true,
      isApproved: true
    })
      .select('_id name displayName description coverImage icon memberCount postCount country city')
      .lean();

    if (!community) {
      return renderPreviewPage(res, req, notFoundPreview(req, 'Community', communityId), 404);
    }

    return renderPreviewPage(res, req, buildCommunityPreview(req, community));
  } catch (error) {
    return next(error);
  }
});

router.get('/live/:id', async (req, res, next) => {
  try {
    const streamId = String(req.params.id || '').trim();
    if (!mongoose.Types.ObjectId.isValid(streamId)) {
      return renderPreviewPage(res, req, notFoundPreview(req, 'Livestream', streamId), 404);
    }

    const stream = await LiveStream.findById(streamId)
      .select('_id hostUsername hostAvatar title thumbnail community isLive viewerCount')
      .lean();

    if (!stream) {
      return renderPreviewPage(res, req, notFoundPreview(req, 'Livestream', streamId), 404);
    }

    return renderPreviewPage(res, req, buildLivePreview(req, stream));
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
