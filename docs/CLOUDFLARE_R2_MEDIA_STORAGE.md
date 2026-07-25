# Cloudflare R2 media storage

Yenkasa can use Cloudflare R2 as the primary media bucket for profile images, posts, videos, chat media, community images, livestream media, and store uploads.

## Cloudflare setup

1. In Cloudflare, open **Storage & databases > R2** and create a bucket, for example `yenkasa-media`.
2. Keep the bucket on **Standard** storage for the free monthly allowance.
3. Create an R2 API token with **Object Read & Write** permission scoped to this bucket.
4. Copy the Access Key ID, Secret Access Key, Account ID, and S3 endpoint.
5. For production, connect a custom domain to the bucket, for example `https://media.yenkasa.xyz`.
6. For local testing only, you can enable the Cloudflare-managed `r2.dev` public URL.

## Backend environment

Set these variables for `yenkasaChatBackend/RegLoginBackend`:

```bash
MEDIA_STORAGE_PROVIDER=r2
R2_MEDIA_BUCKET=yenkasa-media
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_PUBLIC_BASE_URL=https://media.yenkasa.xyz
```

`R2_ENDPOINT` can be used instead of `R2_ACCOUNT_ID` if you want to paste Cloudflare's full endpoint directly:

```bash
R2_ENDPOINT=https://your_account_id.r2.cloudflarestorage.com
```

Optional variables:

```bash
R2_REGION=auto
R2_JURISDICTION=eu
R2_FORCE_PATH_STYLE=true
MEDIA_STORAGE_CLOUDINARY_FALLBACK=true
```

## Notes

- R2 object writes use the S3-compatible API.
- The app stores public object URLs using `R2_PUBLIC_BASE_URL`, so that URL must point to a public R2 bucket domain.
- Keep Cloudinary configured if you want upload fallback when R2 is unavailable.
- Do not commit real R2 keys to git.
