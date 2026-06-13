const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const axios = require('axios');
const FormData = require('form-data');
const { cloudinary } = require('../config/cloudinary');

const DEFAULT_BUCKET = 'yenkasa-media';
const DEFAULT_GCS_PROXY_UPLOAD_URL = 'https://yenkasa-chat-backend-backup-496173204476.europe-west1.run.app/api/media-proxy/upload';
const PROVIDERS = {
  GCS: 'gcs',
  CLOUDINARY: 'cloudinary',
};

const BUCKET_FOLDERS = {
  profiles: 'profiles',
  posts: 'posts',
  videos: 'videos',
  communities: 'communities',
  livestreams: 'livestreams',
  chat: 'chat',
  store: 'store',
};

function configuredProvider() {
  return String(process.env.MEDIA_STORAGE_PROVIDER || process.env.PRIMARY_MEDIA_STORAGE || PROVIDERS.GCS)
    .trim()
    .toLowerCase();
}

function gcsBucketName() {
  return process.env.GCS_MEDIA_BUCKET || process.env.GOOGLE_CLOUD_STORAGE_BUCKET || DEFAULT_BUCKET;
}

function publicBaseUrl() {
  return String(process.env.GCS_PUBLIC_BASE_URL || `https://storage.googleapis.com/${gcsBucketName()}`)
    .replace(/\/+$/, '');
}

function hasGcsConfig() {
  return Boolean(gcsBucketName());
}

function runningOnGoogleRuntime() {
  return Boolean(process.env.K_SERVICE || process.env.FUNCTION_TARGET || process.env.GAE_SERVICE);
}

function gcsProxyUploadUrl() {
  const configured = process.env.MEDIA_STORAGE_GCS_PROXY_URL || process.env.GCS_MEDIA_PROXY_URL;
  if (configured) return String(configured).trim();
  return runningOnGoogleRuntime() ? '' : DEFAULT_GCS_PROXY_UPLOAD_URL;
}

function mediaProxySecret() {
  return process.env.MEDIA_STORAGE_PROXY_SECRET || process.env.GCS_MEDIA_PROXY_SECRET || process.env.ACCESS_TOKEN_SECRET || '';
}

function gcsCredentials() {
  const raw = process.env.GCS_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return undefined;
  return JSON.parse(raw);
}

function hasCloudinaryConfig() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

function isImage(mimeType = '') {
  return String(mimeType).startsWith('image/');
}

function isVideo(mimeType = '') {
  return String(mimeType).startsWith('video/');
}

function isAudio(mimeType = '') {
  return String(mimeType).startsWith('audio/');
}

function inferResourceType(file = {}, type = '') {
  if (type === 'video' || isVideo(file.mimetype)) return 'video';
  if (type === 'audio' || isAudio(file.mimetype)) return 'video';
  if (type === 'file') return 'raw';
  return 'image';
}

function sanitizeSegment(value, fallback = 'file') {
  const cleaned = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || fallback;
}

function extensionFor(file = {}) {
  const fromName = path.extname(file.originalname || '');
  if (fromName) return fromName.toLowerCase();
  const mime = String(file.mimetype || '').toLowerCase();
  if (mime === 'image/jpeg') return '.jpg';
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  if (mime === 'video/mp4') return '.mp4';
  if (mime === 'audio/mpeg') return '.mp3';
  if (mime === 'audio/mp4') return '.m4a';
  if (mime === 'application/pdf') return '.pdf';
  return '';
}

function normalizeFolder(folder = 'posts') {
  const cleaned = sanitizeSegment(folder, 'posts').replace(/^yenkasa-?media-?/, '');
  return Object.values(BUCKET_FOLDERS).includes(cleaned) ? cleaned : cleaned;
}

function gcsObjectName(file, options = {}) {
  const folder = normalizeFolder(options.folder || 'posts');
  const prefix = sanitizeSegment(options.prefix || options.type || 'media');
  const original = sanitizeSegment(path.basename(file.originalname || 'upload', path.extname(file.originalname || '')));
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${folder}/${prefix}-${suffix}-${original}${extensionFor(file)}`;
}

function fileToBuffer(file) {
  if (file?.buffer) return Promise.resolve(file.buffer);
  if (file?.path) return fs.promises.readFile(file.path);
  return Promise.reject(new Error('Media upload requires a memory buffer or local file path.'));
}

function fileToStream(file) {
  if (file?.buffer) return Readable.from(file.buffer);
  if (file?.path) return fs.createReadStream(file.path);
  throw new Error('Media upload requires a memory buffer or local file path.');
}

function cloudinaryFolder(folder = 'posts') {
  const map = {
    profiles: process.env.CLOUDINARY_PROFILE_FOLDER || 'yenkasa/profile',
    posts: process.env.CLOUDINARY_POSTS_FOLDER || 'yenkasachat/posts',
    videos: process.env.CLOUDINARY_VIDEOS_FOLDER || 'yenkasachat/posts',
    communities: process.env.CLOUDINARY_GROUP_IMAGE_FOLDER || 'yenkasa/chat/groups',
    livestreams: process.env.CLOUDINARY_LIVESTREAM_FOLDER || 'yenkasa/livestreams',
    chat: process.env.CLOUDINARY_CHAT_MEDIA_FOLDER || 'yenkasa/chat/media',
    store: process.env.CLOUDINARY_STORE_FOLDER || 'yenkasa/store',
  };
  return map[folder] || `yenkasa/${folder}`;
}

async function uploadToGcs(file, options = {}) {
  if (!hasGcsConfig()) {
    throw new Error('GCS media bucket is not configured.');
  }

  let Storage;
  try {
    ({ Storage } = require('@google-cloud/storage'));
  } catch (error) {
    throw new Error('@google-cloud/storage is required for GCS media uploads.');
  }

  const credentials = gcsCredentials();
  const storage = new Storage({
    projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || process.env.GCS_PROJECT_ID,
    ...(credentials ? { credentials } : {}),
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GCS_KEY_FILE,
  });
  const bucket = storage.bucket(gcsBucketName());
  const objectName = options.objectName || gcsObjectName(file, options);
  const object = bucket.file(objectName);
  const metadata = {
    contentType: file.mimetype || options.contentType || 'application/octet-stream',
    cacheControl: options.cacheControl || 'public, max-age=31536000, immutable',
    metadata: {
      originalName: file.originalname || '',
      area: options.area || options.folder || '',
      provider: PROVIDERS.GCS,
    },
  };

  const buffer = await fileToBuffer(file);
  await object.save(buffer, {
    resumable: buffer.length > 5 * 1024 * 1024,
    metadata,
    public: false,
    validation: 'crc32c',
  });

  if (String(process.env.GCS_MAKE_PUBLIC || 'false').toLowerCase() === 'true') {
    await object.makePublic().catch((error) => {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[MediaStorage] makePublic failed:', error.message);
      }
    });
  }

  const url = `${publicBaseUrl()}/${encodeURI(objectName).replace(/%2F/g, '/')}`;
  return {
    provider: PROVIDERS.GCS,
    bucket: gcsBucketName(),
    key: objectName,
    public_id: objectName,
    secure_url: url,
    url,
    bytes: Number(file.size || buffer.length || 0),
    resource_type: inferResourceType(file, options.type),
    original_filename: file.originalname || '',
  };
}

async function uploadToGcsProxy(file, options = {}) {
  const url = gcsProxyUploadUrl();
  if (!url) {
    throw new Error('GCS media proxy is not configured.');
  }
  const secret = mediaProxySecret();
  if (!secret) {
    throw new Error('GCS media proxy secret is not configured.');
  }

  const buffer = await fileToBuffer(file);
  const form = new FormData();
  form.append('file', buffer, {
    filename: file.originalname || 'upload',
    contentType: file.mimetype || options.contentType || 'application/octet-stream',
    knownLength: buffer.length,
  });

  ['folder', 'type', 'resourceType', 'prefix', 'area', 'contentType', 'objectName'].forEach((key) => {
    if (options[key] !== undefined && options[key] !== null) {
      form.append(key, String(options[key]));
    }
  });

  const response = await axios.post(url, form, {
    headers: {
      ...form.getHeaders(),
      'x-media-proxy-secret': secret,
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    timeout: Number(process.env.MEDIA_STORAGE_PROXY_TIMEOUT_MS || 120000),
  });

  if (!response.data?.success || !response.data?.result) {
    throw new Error(response.data?.message || 'GCS media proxy upload failed.');
  }
  return response.data.result;
}

function uploadToCloudinary(file, options = {}) {
  if (!hasCloudinaryConfig()) {
    return Promise.reject(new Error('Cloudinary media fallback is not configured.'));
  }

  const folder = cloudinaryFolder(normalizeFolder(options.folder || 'posts'));
  const resourceType = options.resourceType || inferResourceType(file, options.type);

  if (file.path) {
    return cloudinary.uploader.upload(file.path, {
      folder,
      resource_type: resourceType,
      use_filename: true,
      unique_filename: true,
      quality: isImage(file.mimetype) || isVideo(file.mimetype) ? 'auto:good' : undefined,
      fetch_format: isImage(file.mimetype) || isVideo(file.mimetype) ? 'auto' : undefined,
      ...options.cloudinary,
    });
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        use_filename: true,
        unique_filename: true,
        quality: isImage(file.mimetype) || isVideo(file.mimetype) ? 'auto:good' : undefined,
        fetch_format: isImage(file.mimetype) || isVideo(file.mimetype) ? 'auto' : undefined,
        ...options.cloudinary,
      },
      (error, result) => {
        if (error) return reject(error);
        return resolve(result);
      },
    );
    fileToStream(file).pipe(uploadStream);
  });
}

async function upload(file, options = {}) {
  const provider = configuredProvider();
  if (provider === PROVIDERS.CLOUDINARY) {
    return uploadToCloudinary(file, options);
  }

  const proxyUrl = gcsProxyUploadUrl();
  if (proxyUrl && !runningOnGoogleRuntime()) {
    return uploadToGcsProxy(file, options);
  }

  try {
    return await uploadToGcs(file, options);
  } catch (error) {
    if (proxyUrl) {
      console.warn('[MediaStorage] GCS upload failed; using GCS media proxy:', error.message);
      return uploadToGcsProxy(file, options);
    }
    if (String(process.env.MEDIA_STORAGE_CLOUDINARY_FALLBACK || 'true').toLowerCase() === 'false') {
      throw error;
    }
    console.warn('[MediaStorage] GCS upload failed; using Cloudinary fallback:', error.message);
    return uploadToCloudinary(file, options);
  }
}

function publicUrl(key) {
  return `${publicBaseUrl()}/${String(key || '').replace(/^\/+/, '')}`;
}

module.exports = {
  BUCKET_FOLDERS,
  PROVIDERS,
  configuredProvider,
  gcsBucketName,
  hasCloudinaryConfig,
  hasGcsConfig,
  publicUrl,
  upload,
  uploadToCloudinary,
  uploadToGcs,
  uploadToGcsProxy,
};
