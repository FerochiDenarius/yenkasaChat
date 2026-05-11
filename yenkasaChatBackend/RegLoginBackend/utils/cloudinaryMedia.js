const CLOUDINARY_DELIVERY_RE = /^https?:\/\/res\.cloudinary\.com\/[^/]+\/(image|video)\/upload\//i;
const TRANSFORM_TOKEN_RE = /(^|,)(a_|ar_|b_|bo_|c_|co_|d_|dpr_|e_|f_|fl_|g_|h_|l_|o_|q_|r_|so_|t_|u_|w_|x_|y_|z_)/i;

const DEFAULT_WIDTHS = {
  avatar: 160,
  thumbnail: 300,
  preview: 500,
  feed: 800,
  full: 1200,
};

function normalizeWidth(width, fallback = DEFAULT_WIDTHS.feed) {
  const value = Number(width || fallback);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.round(Math.min(Math.max(value, 80), 1600));
}

function isCloudinaryDeliveryUrl(value) {
  return typeof value === 'string' && CLOUDINARY_DELIVERY_RE.test(value);
}

function mergeTransformation(existing, desired) {
  const desiredPrefixes = new Set(
    desired
      .map((token) => token.split('_')[0])
      .filter(Boolean)
  );
  const keep = String(existing || '')
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !desiredPrefixes.has(token.split('_')[0]));

  return [...desired, ...keep].join(',');
}

function injectTransformation(url, resourceType, desiredTokens) {
  if (!isCloudinaryDeliveryUrl(url)) return url;

  const marker = `/${resourceType}/upload/`;
  const markerIndex = url.indexOf(marker);
  if (markerIndex === -1) return url;

  const prefixEnd = markerIndex + marker.length;
  const prefix = url.slice(0, prefixEnd);
  const rest = url.slice(prefixEnd);
  const suffixIndex = rest.search(/[?#]/);
  const path = suffixIndex === -1 ? rest : rest.slice(0, suffixIndex);
  const suffix = suffixIndex === -1 ? '' : rest.slice(suffixIndex);
  const [firstSegment, ...remainingSegments] = path.split('/');
  const desired = desiredTokens.filter(Boolean);

  if (firstSegment && TRANSFORM_TOKEN_RE.test(firstSegment) && !/^v\d+$/i.test(firstSegment)) {
    return `${prefix}${mergeTransformation(firstSegment, desired)}/${remainingSegments.join('/')}${suffix}`;
  }

  return `${prefix}${desired.join(',')}/${path}${suffix}`;
}

function buildOptimizedImageUrl(url, options = {}) {
  if (!url || typeof url !== 'string') return url;
  const width = normalizeWidth(options.width, DEFAULT_WIDTHS.feed);
  const crop = options.crop || 'c_limit';
  return injectTransformation(url, 'image', ['f_auto', 'q_auto', `w_${width}`, crop]);
}

function buildOptimizedVideoUrl(url) {
  if (!url || typeof url !== 'string') return url;
  return injectTransformation(url, 'video', ['f_auto', 'q_auto']);
}

function buildVideoPosterUrl(url, options = {}) {
  if (!url || typeof url !== 'string') return url;
  const width = normalizeWidth(options.width, DEFAULT_WIDTHS.preview);
  return injectTransformation(url, 'video', ['so_1', 'f_jpg', 'q_auto', `w_${width}`, 'c_limit']);
}

function widthForKey(key = '') {
  const normalized = key.toLowerCase();
  if (/(avatar|profile|icon|logo|badge)/.test(normalized)) return DEFAULT_WIDTHS.avatar;
  if (/(thumb|thumbnail|preview|poster)/.test(normalized)) return DEFAULT_WIDTHS.preview;
  if (/(cover|background|banner)/.test(normalized)) return DEFAULT_WIDTHS.feed;
  if (/(full|original)/.test(normalized)) return DEFAULT_WIDTHS.full;
  return DEFAULT_WIDTHS.feed;
}

function optimizeCloudinaryUrlForKey(key, value) {
  if (!isCloudinaryDeliveryUrl(value)) return value;
  if (String(key || '').toLowerCase().includes('audio')) return value;
  if (value.includes('/video/upload/')) return buildOptimizedVideoUrl(value);
  if (value.includes('/image/upload/')) {
    return buildOptimizedImageUrl(value, { width: widthForKey(key) });
  }
  return value;
}

function optimizeCloudinaryMediaDeep(payload, stats = { urlsOptimized: 0, postersAdded: 0 }, seen = new WeakSet(), key = '') {
  if (payload == null) return payload;

  if (typeof payload === 'string') {
    const optimized = optimizeCloudinaryUrlForKey(key, payload);
    if (optimized !== payload) stats.urlsOptimized += 1;
    return optimized;
  }

  if (payload instanceof Date || Buffer.isBuffer(payload) || typeof payload !== 'object') {
    return payload;
  }

  if (seen.has(payload)) return payload;
  seen.add(payload);

  if (Array.isArray(payload)) {
    return payload.map((item) => optimizeCloudinaryMediaDeep(item, stats, seen, key));
  }

  if (typeof payload.toObject === 'function' && payload.constructor?.name !== 'ObjectId') {
    payload = payload.toObject({ virtuals: true });
  }

  const prototype = Object.getPrototypeOf(payload);
  if (prototype !== Object.prototype && prototype !== null) {
    return payload;
  }

  const result = {};
  for (const [childKey, childValue] of Object.entries(payload)) {
    result[childKey] = optimizeCloudinaryMediaDeep(childValue, stats, seen, childKey);
  }

  if (
    typeof result.videoUrl === 'string' &&
    result.videoUrl.includes('/video/upload/') &&
    !result.thumbnailUrl &&
    !result.posterUrl
  ) {
    result.thumbnailUrl = buildVideoPosterUrl(result.videoUrl, { width: DEFAULT_WIDTHS.preview });
    stats.postersAdded += 1;
  }

  return result;
}

function cloudinaryMediaResponseOptimizer(req, res, next) {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    const stats = { urlsOptimized: 0, postersAdded: 0 };
    const optimizedBody = optimizeCloudinaryMediaDeep(body, stats);
    if (stats.urlsOptimized || stats.postersAdded) {
      console.info('[CloudinaryMedia] optimized_response', {
        method: req.method,
        path: req.originalUrl,
        urlsOptimized: stats.urlsOptimized,
        postersAdded: stats.postersAdded,
      });
    }
    return originalJson(optimizedBody);
  };
  next();
}

function logUploadAudit({ area, file, result }) {
  const bytes = Number(file?.size || result?.bytes || 0);
  const megabytes = bytes / (1024 * 1024);
  if (megabytes >= 8) {
    console.warn('[CloudinaryMedia] large_upload', {
      area,
      fileName: file?.originalname || result?.original_filename || result?.public_id || 'unknown',
      mimeType: file?.mimetype || result?.resource_type || 'unknown',
      megabytes: Number(megabytes.toFixed(2)),
      publicId: result?.public_id,
    });
  }
}

module.exports = {
  buildOptimizedImageUrl,
  buildOptimizedVideoUrl,
  buildVideoPosterUrl,
  cloudinaryMediaResponseOptimizer,
  optimizeCloudinaryMediaDeep,
  logUploadAudit,
};
