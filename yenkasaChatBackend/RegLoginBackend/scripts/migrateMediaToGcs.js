require('dotenv').config();

const mongoose = require('mongoose');
const path = require('path');
const mediaStorage = require('../services/mediaStorage.service');

const CLOUDINARY_RE = /^https?:\/\/res\.cloudinary\.com\//i;

function isCloudinaryUrl(value) {
  return typeof value === 'string' && CLOUDINARY_RE.test(value);
}

function isGcsUrl(value) {
  return typeof value === 'string' && (
    value.includes('storage.googleapis.com') ||
    value.includes(`${mediaStorage.gcsBucketName()}.storage.googleapis.com`)
  );
}

function parseArgs(argv) {
  const args = new Set(argv.slice(2));
  const limitArg = argv.find((item) => item.startsWith('--limit='));
  return {
    write: args.has('--write'),
    dryRun: !args.has('--write'),
    limit: limitArg ? Math.max(1, Number(limitArg.split('=')[1]) || 100) : 100,
  };
}

function folderFor(kind, field) {
  if (kind === 'users') return 'profiles';
  if (kind === 'posts' && /video/i.test(field)) return 'videos';
  if (kind === 'posts') return 'posts';
  if (kind === 'communities') return 'communities';
  if (kind === 'chatrooms') return 'chat';
  if (kind === 'messages') return 'chat';
  if (kind === 'ads' && /video/i.test(field)) return 'videos';
  if (kind === 'ads') return 'posts';
  if (kind === 'announcements' && /video/i.test(field)) return 'videos';
  if (kind === 'announcements') return 'posts';
  if (kind === 'livestreams') return 'livestreams';
  if (kind === 'storeprofiles') return 'store';
  return 'posts';
}

function typeFor(url, field) {
  const lower = `${field} ${url}`.toLowerCase();
  if (lower.includes('/video/upload/') || lower.includes('video')) return 'video';
  if (lower.includes('audio')) return 'audio';
  if (lower.includes('file')) return 'file';
  return 'image';
}

function filenameFor(url, fallback) {
  try {
    const parsed = new URL(url);
    const base = path.basename(parsed.pathname) || fallback;
    return base.includes('.') ? base : `${base}.bin`;
  } catch (_error) {
    return fallback;
  }
}

async function fetchAsUploadFile(url, fallbackName) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Fetch failed ${response.status} for ${url}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return {
    buffer,
    size: buffer.length,
    mimetype: response.headers.get('content-type') || 'application/octet-stream',
    originalname: filenameFor(url, fallbackName),
  };
}

async function migrateUrl(url, context) {
  const file = await fetchAsUploadFile(url, `${context.kind}-${context.id}-${context.field}.bin`);
  const result = await mediaStorage.upload(file, {
    folder: folderFor(context.kind, context.field),
    type: typeFor(url, context.field),
    area: `media_migration_${context.kind}`,
    prefix: `${context.kind}-${context.field}`,
  });
  return result.secure_url;
}

function setByPath(target, dottedPath, value) {
  const parts = dottedPath.split('.');
  let current = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    current = current[parts[index]];
    if (!current) return;
  }
  current[parts[parts.length - 1]] = value;
}

function collectDocumentUrls(doc, spec) {
  const items = [];
  for (const field of spec.fields) {
    const value = doc[field];
    if (isCloudinaryUrl(value)) items.push({ field, value });
  }
  for (const field of spec.arrayFields || []) {
    const values = Array.isArray(doc[field]) ? doc[field] : [];
    values.forEach((value, index) => {
      if (isCloudinaryUrl(value)) items.push({ field: `${field}.${index}`, value });
    });
  }
  for (const nested of spec.nestedArrayFields || []) {
    const values = Array.isArray(doc[nested.array]) ? doc[nested.array] : [];
    values.forEach((item, index) => {
      for (const field of nested.fields) {
        const value = item?.[field];
        if (isCloudinaryUrl(value)) {
          items.push({ field: `${nested.array}.${index}.${field}`, value });
        }
      }
    });
  }
  return items.filter((item) => !isGcsUrl(item.value));
}

async function migrateCollection({ model, kind, fields, arrayFields, nestedArrayFields }, options) {
  const query = { $or: [] };
  for (const field of fields) query.$or.push({ [field]: CLOUDINARY_RE });
  for (const field of arrayFields || []) query.$or.push({ [field]: { $elemMatch: { $regex: CLOUDINARY_RE } } });
  for (const nested of nestedArrayFields || []) {
    for (const field of nested.fields) {
      query.$or.push({ [`${nested.array}.${field}`]: CLOUDINARY_RE });
    }
  }
  if (!query.$or.length) return { scanned: 0, migrated: 0, failed: 0 };

  const docs = await model.find(query).limit(options.limit);
  let migrated = 0;
  let failed = 0;

  for (const doc of docs) {
    const urls = collectDocumentUrls(doc, { fields, arrayFields, nestedArrayFields });
    if (!urls.length) continue;
    for (const item of urls) {
      try {
        if (options.dryRun) {
          console.log(`[dry-run] ${kind}:${doc._id} ${item.field} ${item.value}`);
          migrated += 1;
          continue;
        }
        const newUrl = await migrateUrl(item.value, { kind, id: doc._id, field: item.field });
        setByPath(doc, item.field, newUrl);
        migrated += 1;
        console.log(`[migrated] ${kind}:${doc._id} ${item.field}`);
      } catch (error) {
        failed += 1;
        console.error(`[failed] ${kind}:${doc._id} ${item.field}: ${error.message}`);
      }
    }
    if (!options.dryRun && doc.isModified()) {
      await doc.save();
    }
  }

  return { scanned: docs.length, migrated, failed };
}

async function main() {
  const options = parseArgs(process.argv);
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required.');
  }
  if (!mediaStorage.hasGcsConfig()) {
    throw new Error('GCS_MEDIA_BUCKET or GOOGLE_CLOUD_STORAGE_BUCKET is required.');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const specs = [
    { kind: 'users', model: require('../models/user.model'), fields: ['profileImage', 'avatar'] },
    { kind: 'posts', model: require('../models/post.model'), fields: ['imageUrl', 'videoUrl', 'audioUrl'], arrayFields: ['imageUrls'] },
    { kind: 'communities', model: require('../models/community.model'), fields: ['coverImage', 'icon'] },
    { kind: 'messages', model: require('../models/message.model'), fields: ['imageUrl', 'audioUrl', 'videoUrl', 'fileUrl'] },
    { kind: 'chatrooms', model: require('../models/chatroom.model'), fields: ['groupImage'] },
    { kind: 'ads', model: require('../models/Ad.model'), fields: ['imageUrl', 'videoUrl', 'thumbnailUrl'] },
    { kind: 'announcements', model: require('../models/announcement.model'), fields: [], nestedArrayFields: [{ array: 'media', fields: ['url', 'thumbnail'] }] },
    { kind: 'livestreams', model: require('../models/LiveStream'), fields: ['hostAvatar', 'thumbnail'] },
    { kind: 'storeprofiles', model: require('../models/storeProfile.model'), fields: ['logoUrl'] },
  ];

  const totals = { scanned: 0, migrated: 0, failed: 0 };
  console.log(`Media migration mode: ${options.dryRun ? 'dry-run' : 'write'}`);
  for (const spec of specs) {
    const result = await migrateCollection(spec, options);
    totals.scanned += result.scanned;
    totals.migrated += result.migrated;
    totals.failed += result.failed;
    console.log(`[${spec.kind}] scanned=${result.scanned} candidates=${result.migrated} failed=${result.failed}`);
  }

  console.log(`Done. scanned=${totals.scanned} candidates=${totals.migrated} failed=${totals.failed}`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('[migrate-media] failed:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
