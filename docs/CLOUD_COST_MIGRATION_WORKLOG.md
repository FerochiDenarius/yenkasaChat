# Cloud Cost And GenAI Credit Migration Worklog

Date: 2026-07-11

## Objective

Reduce current Google Cloud infrastructure cost, document each stage, and prepare a controlled migration path for eligible AI workloads to GenAI App Builder / Agent Search usage where it makes sense.

## Guardrails

- Do not expose or copy secrets into documentation.
- Do not delete production resources without explicit approval.
- Do not stop databases without explicit approval.
- Do not change application source behavior without validation and fallback.
- Prefer reversible cost controls first.

## Stage 1 - Current State Reconfirmation

### Project

- Active Google Cloud project: `project-10405180-0afd-4ecc-9f8`

### Cloud Run Services

| Service | Region | CPU | Memory | Min scale | Max scale | CPU always allocated | Notes |
|---|---:|---:|---:|---:|---:|---|---|
| `yenkasa-ai` | `europe-west1` | 2 | 2Gi | not set | 10 | not set | Can scale to zero if traffic allows. |
| `yenkasa-ai-backend` | `europe-west1` | 2 | 8Gi | 1 | 5 | true | Highest Cloud Run cost risk due always-on min instance and unthrottled CPU. |
| `yenkasa-chat-backend-backup` | `europe-west1` | 2 | 2Gi | not set | 2 | not set | Backup/service endpoint; verify live traffic before any change. |
| `yenkasa-code-agent` | `europe-west1` | 2 | 2Gi | not set | 5 | not set | Uses Cloud SQL connection. |

### Cloud SQL Instances

| Instance | Engine | Region | Tier | Disk | Activation | State | Notes |
|---|---|---|---|---:|---|---|---|
| `yenkasa-ai-postgres` | PostgreSQL 16 | `europe-west1` | `db-custom-2-7680` | 10GB SSD | ALWAYS | RUNNABLE | Major always-on database cost source. |
| `yenkasa-store-mysql` | MySQL 8 | `europe-west1` | `db-f1-micro` | 10GB SSD | ALWAYS | RUNNABLE | Smaller but still always-on database cost source. |

### Artifact Registry

| Repository | Region | Size | Notes |
|---|---:|---:|---|
| `cloud-run-source-deploy` | `europe-west1` | ~380GB | Major storage cost source. Needs cleanup policy or old image deletion after confirming active revisions. |
| `yenkasa-code-agent` | `europe-west1` | ~0.29GB | Low cost risk. |
| `cloud-run-source-deploy` | `us-central1` | ~3.15GB | Moderate stale deploy artifact risk. |

## Stage 1 Findings

1. The biggest immediate infrastructure cost risk is `yenkasa-ai-backend` because it has `minScale=1`, `cpu-throttling=false`, 2 CPU, and 8Gi memory.
2. The biggest storage cost risk is Artifact Registry repository `cloud-run-source-deploy` in `europe-west1`, currently around 380GB.
3. Cloud SQL remains a major non-GenAI cost area because both SQL instances are `ALWAYS` active.
4. These infrastructure costs are not expected to consume GenAI App Builder promotional credits.

## Stage 2 - Heroku Access

### Status

- Initial Heroku CLI state was not authenticated.
- `heroku auth:whoami` first returned invalid credentials.
- Browser login flow was started from the CLI and completed successfully.
- Authenticated Heroku account: `denarius@yenkasa.xyz`.

### Decision

- Use Heroku CLI authentication instead of manually copying API keys from the dashboard.
- Do not document, print, or store Heroku API keys.

### Heroku App Inventory

| App | Region | Stack | Buildpack | Dynos | Assessment |
|---|---|---|---|---|---|
| `yenkasa-caller` | `eu` | `heroku-24` | `heroku/nodejs` | `web: 1` | Existing app, but not configured like the Yenkasa backend. Do not deploy backend here without explicit approval. |
| `yenkasa-backend-backup` | `eu` | `heroku-24` | pending deployment | pending deployment | Created as a clean backend migration target. |

### `yenkasa-caller` Config Var Names

Values were intentionally not printed or stored. Existing names only:

- `DAILY_API_KEY`
- `DAILY_DOMAIN`
- `ONESIGNAL_APP_ID`
- `ONESIGNAL_CHANNEL_ID`
- `yenkasachatOneSignalKey`

### Heroku Finding

`yenkasa-caller` does not currently expose the expected backend config var names such as MongoDB, JWT, media storage, Redis, Agora, Cloudinary, email, or Yenkasa AI relay settings. It appears to be a separate caller/video-related app, not the main Yenkasa backend target.

## Stage 3 - Backend Heroku Readiness Check

### Backend Location

- Backend path: `yenkasaChatBackend/RegLoginBackend`

### Files Found

- `package.json`
- `server.js`
- `src/server.js`
- `Procfile`
- `app.json`

### Readiness Findings

| Item | Status | Evidence |
|---|---|---|
| Start script | Present | `npm start` runs `node server.js`. |
| Runtime entry | Present | Root `server.js` loads `./src/server`. |
| Procfile | Present | `web: npm start`; workers defined but scaled separately. |
| Health endpoint | Present | `GET /health` in `src/app.js`. |
| Node engine | Present | `node: 20.x`. |
| Heroku stack intent | Present | `app.json` currently says `heroku-22`; existing Heroku app uses `heroku-24`. |
| Repository root issue | Open | Git repo root has a separate minimal `package.json`; backend is in a subdirectory. A plain root-level `git push heroku main` will not deploy the backend correctly unless we adjust deployment strategy. |

### Heroku Deployment Decision Needed

The current Heroku app `yenkasa-caller` should not be used for the backend unless the owner confirms it is intended to be repurposed. Safer path is to create a separate Heroku app for the backend, then deploy only `yenkasaChatBackend/RegLoginBackend`.

## Stage 4 - Heroku Backend App Creation

### Action

Created Heroku app:

- App: `yenkasa-backend-backup`
- Region: `eu`
- Stack: `heroku-24`
- Heroku URL: `https://yenkasa-backend-backup-45b321a459ee.herokuapp.com/`
- Git URL: `https://git.heroku.com/yenkasa-backend-backup.git`

### Reason

The existing Heroku app `yenkasa-caller` appears unrelated to the main backend and is already running a web dyno. A separate app avoids breaking the existing caller/video app.

### Validation

Heroku CLI returned successful app creation.

## Stage 5 - Cloudflare Routing Plan

### Hostname Chosen

- Backend hostname: `api.yenkasa.xyz`

### Heroku Domain Action

- Added `api.yenkasa.xyz` to Heroku app `yenkasa-backend-backup`.
- Heroku DNS target: `behavioural-skunk-ld74qlau87d60hr135nkiesy.herokudns.com`
- Heroku domain wait completed successfully.
- Heroku Automated Certificate Management was enabled.

### Cloudflare DNS Record Required

Create or update this Cloudflare DNS record:

| Type | Name | Target | Proxy |
|---|---|---|---|
| `CNAME` | `api` | `behavioural-skunk-ld74qlau87d60hr135nkiesy.herokudns.com` | DNS-only first |

After Heroku certificate status becomes OK, Cloudflare proxy mode can be evaluated.

### Current Status

- Heroku side is configured.
- Cloudflare side is configured and verified.
- Heroku ACM has issued a certificate for `api.yenkasa.xyz`.

### Cloudflare Access Attempt

- User confirmed they are logged into the Cloudflare dashboard in the browser.
- No browser-control connector or Cloudflare MCP/tool is available in this session.
- `wrangler` is not installed.
- `cloudflared` is not installed.

### Cloudflare Blocker

Being logged into the browser is not enough for this agent to click dashboard controls. To complete DNS automation from here, provide a Cloudflare API token with permission to edit DNS records for `yenkasa.xyz`. Otherwise, create the CNAME record manually in the dashboard using the record above.

### Cloudflare Validation

Validated after user created the DNS record:

- `api.yenkasa.xyz` CNAME resolves to `behavioural-skunk-ld74qlau87d60hr135nkiesy.herokudns.com`.
- Heroku domain status shows `api.yenkasa.xyz` attached to app `yenkasa-backend-backup`.
- Heroku ACM status: `Cert issued`.
- Certificate common name: `api.yenkasa.xyz`.

### `www.yenkasa.xyz` Safety Check

Validated that `www.yenkasa.xyz` was not repointed to Heroku:

- `www.yenkasa.xyz` still resolves through `ghs.googlehosted.com`.
- This confirms the Heroku change is isolated to `api.yenkasa.xyz`.

## Stage 6 - Backend Metadata Fix

### Action

Updated `yenkasaChatBackend/RegLoginBackend/app.json`:

- Changed stack from `heroku-22` to `heroku-24`.
- Removed fixed `PORT=8080` from app template.

### Reason

- The new Heroku backend app is on `heroku-24`.
- Heroku injects the dyno port at runtime; pinning `PORT` in app config can cause routing/startup issues.

### Validation

Ran backend test suite:

- Command: `npm test`
- Result: 26 tests passed, 0 failed.

## Next Approval Points

1. Cloud Run cost control: update `yenkasa-ai-backend` to remove `minScale=1` and restore CPU throttling, if cold starts/background workers are acceptable.
2. Artifact Registry cleanup: list active image digests used by Cloud Run revisions, then delete only unused old images or configure a cleanup policy.
3. Cloud SQL cost control: confirm whether `yenkasa-store-mysql` and/or `yenkasa-ai-postgres` are required 24/7 before stopping, resizing, or migrating.
4. GenAI migration: build an Agent Search adapter behind a feature flag for YenkasaAI repo/document search, with current RAG as fallback.
