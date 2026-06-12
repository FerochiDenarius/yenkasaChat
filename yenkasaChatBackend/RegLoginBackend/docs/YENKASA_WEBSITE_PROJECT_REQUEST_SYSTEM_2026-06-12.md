# Yenkasa Soft-O-Tech Client Portal and Project Request System

Date: 2026-06-12

## Summary

Extended `www.yenkasa.xyz` from a portfolio/request form into a Firestore-backed Soft-O-Tech client acquisition and operations platform.

Public pages:

- `/website-request`
- `/website-request/success`
- `/client/register`
- `/client/login`
- `/client/dashboard`
- `/admin`
- `/admin/project-requests`

Primary APIs:

- `POST /api/project-requests`
- `GET /api/project-requests/admin`
- `GET /api/project-requests/admin/clients`
- `GET /api/project-requests/admin/analytics`
- `PATCH /api/project-requests/admin/:requestId/status`
- `POST /api/project-portal/auth/register`
- `POST /api/project-portal/auth/login`
- `GET /api/project-portal/client/dashboard`
- `PATCH /api/project-portal/me`
- `POST /api/project-portal/client/messages`
- `POST /api/project-portal/client/documents`
- `PATCH /api/project-portal/client/quotations/:quotationId/respond`
- `GET /api/project-portal/admin/dashboard`
- `POST /api/project-portal/admin/projects`
- `POST /api/project-portal/admin/quotations`
- `POST /api/project-portal/admin/invoices`
- `POST /api/project-portal/admin/messages`
- `POST /api/project-portal/admin/documents`

## Files Added

- `routes/projectRequest.routes.js`
- `routes/projectRequest.page.js`
- `routes/softOTechPortal.routes.js`
- `routes/softOTechPortal.page.js`
- `services/projectRequestStore.service.js`
- `services/projectRequestEmail.service.js`
- `services/adminBootstrap.service.js`
- `services/softOTechPortal.service.js`
- `models/projectRequest.model.js`
- `public/yenkasa_web/images/yenkasa-soft-o-tech-emblem.png`
- `docs/YENKASA_WEBSITE_PROJECT_REQUEST_SYSTEM_2026-06-12.md`

## Files Modified

- `src/config/apiRoutes.js`
- `routes/auth.js`
- `routes/routes.js`
- `public/yenkasa_web/index.html`

## Completed

- Rebranded the intake flow from website-only to project requests for:
  - Website Development
  - Mobile App Development
  - AI Solution Development
  - Business Software
  - UI/UX Design
  - Cloud Infrastructure
  - Custom Project
- Added client registration details:
  - name
  - company
  - email
  - phone
  - WhatsApp
  - location
  - preferred contact method
  - best time to contact
- Added Firestore as the default project request storage path.
- Kept MongoDB as explicit fallback only with `PROJECT_REQUEST_STORAGE=mongo`.
- Added Firestore client lead profiles in `project_request_clients`.
- Added reusable client accounts with hashed passwords.
- Added portal JWT login for clients/admins.
- Added admin auto-assignment using `SOFTOTECH_ADMIN_EMAILS` or `ADMIN_EMAILS`, with a default list:
  - `ki.longrich@gmail.com`
  - `kofiinspirion@gmail.com`
  - `ofosumenyabrightkofi@gmail.com`
  - `ferochidenarius@gmail.com`
- Added the same privileged role rule to the existing Yenkasa app auth registration/login paths.
- Added the Soft-O-Tech logo image to the new pages and CTAs.
- Added `YST-YYYY-0001` tracking ID generation using Firestore counters.
- Added status flow:
  - New
  - In Review
  - Proposal Sent
  - Approved
  - In Progress
  - Rejected
  - Completed
- Added client dashboard widgets:
  - Total Requests
  - Active Projects
  - Pending Quotations
  - Completed Projects
- Added admin dashboard modules:
  - Clients
  - Project Requests
  - Projects
  - Quotations
  - Invoices
  - Messages
  - Analytics
  - Settings
- Added Firestore-backed operations collections:
  - `project_requests`
  - `project_request_clients`
  - `softotech_projects`
  - `softotech_quotations`
  - `softotech_invoices`
  - `softotech_messages`
  - `softotech_documents`
  - `softotech_counters`
- Added upload support through the existing `mediaStorage` abstraction, so documents use GCS when `MEDIA_STORAGE_PROVIDER=gcs`.
- Added portfolio CTAs:
  - `Request a Website or App`
  - `Client Portal`

## Scaffolded But Not Fully Finished

- Email verification token generation is implemented, but the verification endpoint/email template still needs to be completed.
- Password reset is not yet wired for the Soft-O-Tech portal.
- PDF quotation and invoice exports are not yet generated.
- Admin create-project/quotation/invoice APIs exist, but the `/admin` page currently displays records and metrics; rich creation forms can be added next.
- Charts/exportable reports are not yet visualized; analytics data is available as dashboard payload.
- CSRF protection is not added because these portal APIs currently use bearer-token JSON requests rather than cookie sessions.

## Required Environment Variables

Storage/database:

- `GOOGLE_CLOUD_PROJECT=project-10405180-0afd-4ecc-9f8`
- `PROJECT_REQUEST_STORAGE=firestore`
- `PROJECT_REQUEST_COLLECTION=project_requests`
- `PROJECT_REQUEST_CLIENT_COLLECTION=project_request_clients`
- `SOFTOTECH_COUNTER_COLLECTION=softotech_counters`

Auth/admin:

- `SOFTOTECH_PORTAL_JWT_SECRET`
- `ACCESS_TOKEN_SECRET`
- `SOFTOTECH_ADMIN_EMAILS=ki.longrich@gmail.com,kofiinspirion@gmail.com,ofosumenyabrightkofi@gmail.com,ferochidenarius@gmail.com`

Email:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `EMAIL_USER`
- `EMAIL_PASS`
- `EMAIL_FROM`
- `WEBSITE_REQUEST_NOTIFY_EMAIL` or `SOFTOTECH_EMAIL`

Media:

- `MEDIA_STORAGE_PROVIDER=gcs`
- `GCS_MEDIA_BUCKET=yenkasa-media`
- `GCS_MAKE_PUBLIC=false`

## Verification

Passed:

```text
node --check services/softOTechPortal.service.js
node --check routes/softOTechPortal.routes.js
node --check routes/softOTechPortal.page.js
node --check routes/projectRequest.page.js
node --check routes/projectRequest.routes.js
node --check services/projectRequestStore.service.js
node --check services/adminBootstrap.service.js
node --check src/config/apiRoutes.js
npm test
```

Test result:

```text
22 tests passed
```

## Where Work Stopped

The platform foundation is implemented and tested locally. Remaining production polish is mostly around richer admin UI forms, PDF generation, email verification/password reset flows, and deployment/configuration of the new env vars on the live server.
