# Yenkasa Media Migration Report: Cloudinary to Google Cloud Storage

Date: 2026-06-12

## Objective

Move Yenkasa media storage from Cloudinary-first uploads to Google Cloud Storage first, while keeping Cloudinary URLs working as legacy fallback.

## Current Status

The backend upload path has been migrated to a provider abstraction:

- Primary provider: Google Cloud Storage
- Legacy fallback: Cloudinary
- Bucket: `gs://yenkasa-media`
- GCP project: `project-10405180-0afd-4ecc-9f8`
- Public URL base: `https://storage.googleapis.com/yenkasa-media`

New uploads now go through `mediaStorage.upload()` instead of direct `cloudinary.uploader.upload()` calls in the main upload routes and controllers.

## Bucket Structure Created

```text
yenkasa-media/
├── profiles/
├── posts/
├── videos/
├── communities/
├── livestreams/
├── chat/
└── store/
```

The bucket was created with uniform bucket-level access. Public object reads are handled at the bucket IAM level with `allUsers` granted `roles/storage.objectViewer`.

## Files Added

- `services/mediaStorage.service.js`
- `scripts/migrateMediaToGcs.js`

## Files Updated

- `package.json`
- `package-lock.json`
- `utils/upload.js`
- `routes/post.routes.js`
- `routes/user.routes.js`
- `routes/messages.routes.js`
- `routes/portfolioMedia.routes.js`
- `routes/group.routes.js`
- `controllers/announcement.controller.js`
- `Controller/Ads.controller.js`
- `Controller/ChatMessageHandler.js`
- `store/yenkasa-store-server.js`
- `src/app.js`
- `public/admin.html`

## Upload Areas Covered

- Profile images
- Post images
- Post videos
- Post audio
- Chat media
- Group/community chat images
- Portfolio screenshots and videos
- Announcement media
- Ad media
- Store logo media

Existing Cloudinary URLs are not broken. They remain readable wherever the old source URL is still stored.

## Environment Variables Required

Recommended production settings:

```bash
MEDIA_STORAGE_PROVIDER=gcs
GCS_MEDIA_BUCKET=yenkasa-media
GOOGLE_CLOUD_PROJECT=project-10405180-0afd-4ecc-9f8
GCS_PUBLIC_BASE_URL=https://storage.googleapis.com/yenkasa-media
GCS_MAKE_PUBLIC=false
MEDIA_STORAGE_CLOUDINARY_FALLBACK=true
```

Cloudinary variables should remain configured while legacy URLs and fallback support are still needed:

```bash
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

## Migration Command

Dry-run:

```bash
GCS_MEDIA_BUCKET=yenkasa-media GOOGLE_CLOUD_PROJECT=project-10405180-0afd-4ecc-9f8 MEDIA_STORAGE_PROVIDER=gcs npm run migrate-media -- --limit=5000 --timeout-ms=120000
```

Write mode:

```bash
GCS_MEDIA_BUCKET=yenkasa-media GOOGLE_CLOUD_PROJECT=project-10405180-0afd-4ecc-9f8 MEDIA_STORAGE_PROVIDER=gcs npm run migrate-media -- --write --limit=5000 --timeout-ms=120000
```

Targeted collection mode:

```bash
GCS_MEDIA_BUCKET=yenkasa-media GOOGLE_CLOUD_PROJECT=project-10405180-0afd-4ecc-9f8 MEDIA_STORAGE_PROVIDER=gcs npm run migrate-media -- --write --limit=5000 --timeout-ms=120000 --only=chatrooms,announcements,livestreams,storeprofiles
```

## Migration Results

Initial dry-run found:

- Scanned documents: 731
- Cloudinary media fields found: 962
- Failed during dry-run: 0

Final verification found:

- Remaining Cloudinary media fields: 101
- Users remaining: 0
- Posts remaining: 3
- Communities remaining: 0
- Messages remaining: 97
- Chatrooms remaining: 0
- Ads remaining: 0
- Announcements remaining: 1
- Livestreams remaining: 0
- Store profiles remaining: 0

Net result:

- At least 861 database media fields were moved from Cloudinary URLs to GCS URLs.
- 101 legacy Cloudinary fields remain because source media fetches failed or terminated.

## Known Remaining Legacy Cloudinary Records

Posts:

- `69ebcd1fcc52f27d7925d400` field `videoUrl`
- `69f371f6761922e621970dcc` field `videoUrl`
- `6a1f217d300bcbd2aee763b2` field `videoUrl`

Announcement:

- `6a1348f21aeed68c46f5a23d` field `media.0.url`

Messages:

- 97 message media fields remain.
- These were mostly `fetch failed`, `terminated`, or Cloudinary/API/network resolution failures during migration.
- They were intentionally left unchanged so existing Cloudinary URLs still work if Cloudinary can serve them.

## Tooling Improvements Added During Migration

The migration script now supports:

- `--write` for DB mutation.
- Dry-run by default.
- `--limit=N`.
- `--timeout-ms=N`.
- `--only=collection1,collection2`.
- `--skip=collection1,collection2`.
- Per-run URL caching to avoid re-uploading repeated source URLs.

The media storage service was adjusted so `GCS_MAKE_PUBLIC` is opt-in. This avoids object-level ACL writes against the uniform bucket.

## Test Results

Passed:

```text
npm test
22 tests passed
0 failed
```

Passed syntax checks:

- `services/mediaStorage.service.js`
- `scripts/migrateMediaToGcs.js`
- `utils/upload.js`
- `routes/post.routes.js`
- `routes/user.routes.js`
- `routes/messages.routes.js`
- `routes/portfolioMedia.routes.js`
- `routes/group.routes.js`
- `controllers/announcement.controller.js`
- `Controller/Ads.controller.js`
- `Controller/ChatMessageHandler.js`
- `store/yenkasa-store-server.js`
- `src/app.js`

Known warning:

- Existing Mongoose duplicate index warning on `{"name":1}` still appears during tests. This is unrelated to the media migration.

## What Could Not Be Completed

The migration could not move 101 old Cloudinary-backed fields because the source media could not be fetched reliably. Those records remain on Cloudinary for backward compatibility.

The backend was not deployed. Deployment was intentionally left for manual deployment.

## Follow-Up Recommendations

1. Keep Cloudinary fallback enabled until the remaining 101 legacy fields are reviewed.
2. Retry failed records later with a longer timeout or from a stable server environment.
3. Consider a separate manual recovery job for the 97 remaining message media fields.
4. Rotate/remove the sensitive legacy file `routes/cloudinary code.txt`.
5. Keep `GCS_MAKE_PUBLIC=false` because the bucket uses uniform bucket-level access.
6. Monitor GCS object counts and billing after production deployment.

