# Yenkasa Soft-O-Tech Client Portal and Project Request System

Date: 2026-06-12

## Summary

Extended `www.yenkasa.xyz` from a portfolio/request form into a Firestore-backed Soft-O-Tech client acquisition and operations platform.

Public pages:

- `/software-solutions`
- `/services`
- `/request-project`
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
- `POST /api/project-portal/assistant`
- `POST /api/project-portal/client/messages`
- `POST /api/project-portal/client/documents`
- `PATCH /api/project-portal/client/quotations/:quotationId/respond`
- `GET /api/project-portal/admin/dashboard`
- `POST /api/project-portal/admin/projects`
- `POST /api/project-portal/admin/projects/approve-request`
- `PATCH /api/project-portal/admin/projects/:projectId/milestones`
- `POST /api/project-portal/admin/proposals/generate`
- `POST /api/project-portal/admin/quotations`
- `POST /api/project-portal/admin/invoices`
- `POST /api/project-portal/admin/payments`
- `POST /api/project-portal/admin/messages`
- `POST /api/project-portal/admin/documents`
- `POST /api/project-portal/admin/portfolio-projects`

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
  - Team Assignments
  - Payments
  - Quotations
  - Invoices
  - Files & Assets
  - Messages
  - Project Timeline
  - Risk Tracking
  - Deliverables
  - Project AI Assistant
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
  - `softotech_proposals`
  - `softotech_payments`
  - `softotech_audit_logs`
  - `softotech_portfolio_projects`
- Added `/software-solutions` as the visible public entry point for:
  - Project requests
  - Client registration
  - Client login
  - Admin login
  - Services
- Added the Software Solutions request experience directly to the portfolio root page at `public/index.html`.
- Removed Soft-O-Tech business CTAs from the Yenkasa app web shell at `public/yenkasa_web/index.html`; `/web` remains reserved for the Yenkasa app web version.
- Added a portfolio-root Software Solutions section with:
  - Submit Software Request
  - Client Registration
  - Client Login
  - Admin Portal
  - Services
  - Contact Soft-O-Tech
- Added professional client dashboard sections following the supplied reference:
  - Dashboard
  - Project Details
  - Project Cost
  - Project Duration
  - Requirements
  - Project Updates
  - Messages
  - Files & Documents
  - Invoices
  - Payments
  - Support
  - Account Settings
- Added professional admin dashboard sections following the supplied reference:
  - Clients
  - Leads/Project Requests
  - Projects
  - Team Assignments
  - Payments
  - Quotations
  - Invoices
  - Files & Assets
  - Client Messages
  - Project Timeline
  - Risk Tracking
  - Deliverables
  - Project AI Assistant
  - Analytics
  - Settings
- Added request approval workflow API that creates a project from an approved request.
- Added milestone update API with automatic progress calculation.
- Added proposal generation API.
- Added payment recording API for milestone/payment tracking.
- Added portfolio project API for Yenkasa App, Yenkasa Store, YenkasaAI, and client project media metadata.
- Added Project AI Assistant API. It calls `YENKASA_AI_ENGINE_URL` or `YENKASA_AI_BACKEND_URL` when configured and falls back to a local project assistant response.
- Added audit logging for portal actions in `softotech_audit_logs`.
- Added upload support through the existing `mediaStorage` abstraction, so documents use GCS when `MEDIA_STORAGE_PROVIDER=gcs`.
- Added portfolio CTAs:
  - `Request a Website or App`
  - `Client Portal`
  - `Software Solutions`

## Scaffolded But Not Fully Finished

- Email verification token generation is implemented, but the verification endpoint/email template still needs to be completed.
- Password reset is not yet wired for the Soft-O-Tech portal.
- PDF quotation and invoice exports are not yet generated.
- Admin create-project/quotation/invoice/proposal/payment APIs exist, but the `/admin` page currently focuses on dashboards, records, and the assistant; rich creation/edit forms can be added next.
- Charts/exportable reports are not yet visualized; analytics data is available as dashboard payload.
- The portfolio project API stores screenshots/videos/architecture metadata, but a public portfolio media gallery editor is still future UI work.
- CSRF protection is not added because these portal APIs currently use bearer-token JSON requests rather than cookie sessions.

## Required Environment Variables

Storage/database:

- `GOOGLE_CLOUD_PROJECT=project-10405180-0afd-4ecc-9f8`
- `PROJECT_REQUEST_STORAGE=firestore`
- `PROJECT_REQUEST_COLLECTION=project_requests`
- `PROJECT_REQUEST_CLIENT_COLLECTION=project_request_clients`
- `SOFTOTECH_COUNTER_COLLECTION=softotech_counters`
- `SOFTOTECH_PROPOSAL_COLLECTION=softotech_proposals`
- `SOFTOTECH_PAYMENT_COLLECTION=softotech_payments`
- `SOFTOTECH_AUDIT_COLLECTION=softotech_audit_logs`
- `SOFTOTECH_PORTFOLIO_COLLECTION=softotech_portfolio_projects`

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

YenkasaAI assistant:

- `YENKASA_AI_ENGINE_URL` or `YENKASA_AI_BACKEND_URL`
- `YENKASA_AI_EVENT_API_KEY` if the AI backend requires bearer authorization

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
