# Yenkasa Soft-O-Tech Project Portal Audit - 2026-06-13

## Scope

Reviewed Phase 1-3 project-management workflow and continued Phase 4 pricing catalog work after the Firestore/PostgreSQL platform audit was paused for the portfolio/project portal issue.

## Phase 1-3 Status

Implemented:
- Client registration, login, JWT portal auth, client profile updates, and admin client creation/update.
- Lead creation, listing, updating, and conversion to clients.
- Project request intake with authenticated client submission, file upload, pricing estimate, generated request invoice PDF, and email notification attempts.
- Admin project creation and request approval into projects.
- Quotations, invoices, payments, messages, documents, requirements, audit logs, and client/admin dashboards backed by Firestore.
- Client dashboard views for requests, project details, project cost, project duration, requirements, messages/support, documents, invoices, payments, and profile.
- Admin dashboard views for clients, leads, requests, projects, requirements, team assignments, payments, quotations, invoices, documents, messages, timeline, risks, deliverables, assistant, analytics, and settings.

Repaired in this pass:
- CSP-safe portal scripts using request nonces.
- Admin-created clients can now receive a temporary password and appear in ordered client lists through `registeredAt`.
- Admin Leads and Requirements panels are now exposed and wired to existing APIs.
- Client Project Cost and Project Updates panels now show related quotations, invoices, messages, and documents.
- Project, invoice, and payment status controls now match backend allowed values.

Partial or missing:
- Portal quotation/invoice PDF export, print, email invoice, and receipt generation are not complete for the Firestore portal records.
- Payment verification is record-only; no Paystack/MoMo verification workflow is wired here.
- Developer and senior-developer role scoping is coarse; admin-only guard currently allows privileged admin/senior developer accounts, but assigned-developer-only access is not enforced.
- Dashboard charts/team utilization are represented as lists/cards, not full chart visualizations.
- Requirement edit/approve/complete exists through API and new admin actions, but not a full inline edit UI.

## Phase 4 Pricing Status

Implemented before this pass:
- Firestore-backed service categories and pricing items.
- Default service catalog across domain/hosting, websites, mobile apps, backend, cloud, AI, security, maintenance, and marketing.
- Base price, discounts, tax, profit/internal cost fields, import/export CSV, archive, duplicate, and reports in service layer.
- Quotation and invoice services can calculate totals from `serviceSelections`.

Repaired in this pass:
- Admin pricing UI now supports create category, create item, edit item, archive, duplicate, import CSV, export CSV, search/filter, and report display.
- Admin quotation and invoice forms now select services from the pricing catalog and submit `serviceSelections`; manual amount remains as fallback for custom work.
- Admin dashboard now returns pricing categories/items for catalog-aware forms.

## Firestore Database Direction

Code now supports selecting a Firestore database through:
- `SOFTOTECH_FIRESTORE_DATABASE_ID`
- `PROJECT_REQUEST_FIRESTORE_DATABASE_ID`
- `FIRESTORE_DATABASE_ID`

The intended active project-management database is `yenkasa-project-mgmt`. Firestore database rename is not supported, so data must be copied into that database and Cloud Run must be deployed/updated with the database ID env vars.

## Verification

Passed:
- `node --check routes/softOTechPortal.page.js`
- `node --check services/softOTechPortal.service.js`
- `node --check services/softOTechPricing.service.js`
- `node --check routes/softOTechPortal.routes.js`
- `node --check src/app.js`

Remaining validation:
- Run authenticated browser/API smoke tests against deployed Cloud Run after Firestore migration and deployment.
- Confirm client registration/login, admin client creation/login, pricing CRUD, quotation creation, invoice creation, lead conversion, and requirement actions against `yenkasa-project-mgmt`.

## Backup Server Auto-Deploy Setup

Added repository build config:
- `cloudbuild.yenkasa-chat-backup.yaml`

Target:
- GitHub repo: `FerochiDenarius/yenkasaChat`
- Watched path: `yenkasaChatBackend/RegLoginBackend/**`
- Cloud Run service: `yenkasa-chat-backend-backup`
- Region: `europe-west1`
- Image repo: `europe-west1-docker.pkg.dev/project-10405180-0afd-4ecc-9f8/cloud-run-source-deploy/yenkasa-chat-backend-backup`

Cloud Build IAM prepared:
- `496173204476@cloudbuild.gserviceaccount.com` can push Artifact Registry images.
- `496173204476@cloudbuild.gserviceaccount.com` can deploy Cloud Run.
- `496173204476@cloudbuild.gserviceaccount.com` can act as the runtime service account during deployment.

Blocked:
- Cloud Build trigger creation failed because the GitHub repository is not connected to Cloud Build yet.
- Required action: connect `FerochiDenarius/yenkasaChat` in Google Cloud Console at Cloud Build > Triggers > Connect Repository.
- After connection, rerun the trigger creation command for `yenkasa-chat-backup-autodeploy`.

## GCloud Hosting Domain Mapping

Created Cloud Run custom domain mappings for the backup server:
- `www.yenkasa.xyz` -> `yenkasa-chat-backend-backup`
- `yenkasa.xyz` -> `yenkasa-chat-backend-backup`
- `gcloud.yenkasa.xyz` -> `yenkasa-chat-backend-backup`

Cloud Run service:
- `yenkasa-chat-backend-backup`
- Region: `europe-west1`

Required DNS records:
- `gcloud` CNAME `ghs.googlehosted.com`
- `www` CNAME `ghs.googlehosted.com`
- apex/root `@` A `216.239.32.21`
- apex/root `@` A `216.239.34.21`
- apex/root `@` A `216.239.36.21`
- apex/root `@` A `216.239.38.21`
- apex/root `@` AAAA `2001:4860:4802:32::15`
- apex/root `@` AAAA `2001:4860:4802:34::15`
- apex/root `@` AAAA `2001:4860:4802:36::15`
- apex/root `@` AAAA `2001:4860:4802:38::15`

Certificate status:
- Pending until DNS is changed away from DigitalOcean and points to the Cloud Run records above.
- If using Cloudflare, keep these records DNS-only during Google certificate provisioning.
- `gcloud.yenkasa.xyz` can be used as the permanent GCloud-hosted backup endpoint without changing the existing DigitalOcean `www` or apex records.
