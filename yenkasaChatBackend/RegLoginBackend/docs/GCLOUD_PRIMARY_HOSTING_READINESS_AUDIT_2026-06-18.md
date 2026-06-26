# GCloud Primary Hosting Readiness Audit

Date: 2026-06-18

## Goal

Move Yenkasa App primary hosting from DigitalOcean to Google Cloud Run and prepare Cloudflare DNS cutover for:

- `yenkasa.xyz`
- `www.yenkasa.xyz`

## Live GCloud State

Project:

```text
project-10405180-0afd-4ecc-9f8
```

Cloud Run service:

```text
yenkasa-chat-backend-backup
```

Region:

```text
europe-west1
```

Current ready revision:

```text
yenkasa-chat-backend-backup-00022-hf2
```

Public URLs:

```text
https://yenkasa-chat-backend-backup-496173204476.europe-west1.run.app
https://yenkasa-chat-backend-backup-3vx2nvls4a-ew.a.run.app
https://gcloud.yenkasa.xyz
```

Readiness checks:

- Cloud Run service status is `Ready=True`.
- IAM allows public invocation through `roles/run.invoker` for `allUsers`.
- `https://yenkasa-chat-backend-backup-496173204476.europe-west1.run.app/health` returns `200`.
- `https://gcloud.yenkasa.xyz/health` returns `200`.

## Current DNS State

Observed DNS before cutover:

```text
yenkasa.xyz A      172.66.0.96
yenkasa.xyz A      162.159.140.98
yenkasa.xyz AAAA   2606:4700:7::60
yenkasa.xyz AAAA   2a06:98c1:58::60
www.yenkasa.xyz    yenkasa-8rjea.ondigitalocean.app.
gcloud.yenkasa.xyz ghs.googlehosted.com.
```

`https://www.yenkasa.xyz/health` still serves through DigitalOcean headers, so production traffic is not cut over yet.

## Cloud Run Domain Mappings

Ready:

- `gcloud.yenkasa.xyz` -> `yenkasa-chat-backend-backup`
- Certificate is provisioned.
- Domain is routable.

Pending DNS:

- `www.yenkasa.xyz` -> `yenkasa-chat-backend-backup`
- `yenkasa.xyz` -> `yenkasa-chat-backend-backup`

Both pending mappings report certificate provisioning blocked because the expected DNS records are not visible publicly yet.

## Required Cloudflare DNS Records

For Google certificate provisioning, set these records to DNS-only first.

Remove or replace the existing DigitalOcean target for `www`:

```text
www CNAME yenkasa-8rjea.ondigitalocean.app
```

Add or update:

```text
www CNAME ghs.googlehosted.com
```

For apex/root `yenkasa.xyz`, add or update these A records:

```text
@ A 216.239.32.21
@ A 216.239.34.21
@ A 216.239.36.21
@ A 216.239.38.21
```

Add or update these AAAA records:

```text
@ AAAA 2001:4860:4802:32::15
@ AAAA 2001:4860:4802:34::15
@ AAAA 2001:4860:4802:36::15
@ AAAA 2001:4860:4802:38::15
```

Recommended Cloudflare setting during provisioning:

```text
Proxy status: DNS only
TTL: Auto
```

After Cloud Run reports `CertificateProvisioned=True` for both `www.yenkasa.xyz` and `yenkasa.xyz`, Cloudflare proxying can be re-enabled if desired.

## Repo Changes Made

The Android app main API base URL was moved from DigitalOcean to the production domain:

```text
app/src/main/java/xyz/yenkasa/app/network/ApiClient.kt
https://www.yenkasa.xyz/api/
```

This lets the app follow the Cloudflare/GCloud cutover without shipping a provider-specific `run.app` URL.

## Remaining Blockers

1. Cloudflare API/CLI credentials are not available in the current shell, so DNS could not be changed directly from this workspace.
2. Cloud Build trigger listing does not show a `FerochiDenarius/yenkasaChat` trigger for `yenkasa-chat-backend-backup`; only a separate `yenkasa-code-agent` trigger is present.
3. The Cloud Run service currently stores sensitive runtime values as plain environment variables. Move them into Secret Manager before treating this as hardened production hosting.
4. Redis URL is not visible in the live Cloud Run env, while `YENKASA_SOCKET_REDIS_ENABLED=true` and `YENKASA_PRESENCE_REDIS_ENABLED=true` are set. Verify Redis is actually configured before scaling beyond one instance or enabling cross-provider failover.
5. Android call signaling still points at the separate Heroku caller service:

```text
app/src/main/java/xyz/yenkasa/app/network/DailyApiClient.kt
app/src/main/java/xyz/yenkasa/app/webrtc/WebSocketManager.kt
```

The GCloud backend exposes Socket.IO, not the same standalone `/ws` endpoint, so that caller service needs its own migration plan before Heroku is retired.

## Cutover Verification

After DNS changes propagate:

```bash
curl -i https://www.yenkasa.xyz/health
curl -i https://yenkasa.xyz/health
gcloud beta run domain-mappings list --region europe-west1 --project project-10405180-0afd-4ecc-9f8
```

Expected:

- `/health` returns `200`.
- Response server path no longer shows DigitalOcean origin headers.
- `www.yenkasa.xyz` domain mapping has `Ready=True`.
- `yenkasa.xyz` domain mapping has `Ready=True`.

Then smoke test:

- Android login
- feed read
- post creation with media upload
- profile image upload
- Socket.IO connect
- notifications
- project portal login
