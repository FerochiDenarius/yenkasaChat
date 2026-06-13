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
- Added client login gate before project details:
  - `/request-project` and `/website-request` now show register/login first.
  - The project form is hidden until a valid Soft-O-Tech client portal token is present.
  - Submissions require `Authorization: Bearer <softOTechPortalToken>`.
  - Backend rejects submissions where the form email does not match the logged-in client email.
- Added admin login protection for project information:
  - `/admin/project-requests` now uses `softOTechPortalToken`.
  - Project request list/client/analytics/status actions are exposed through `/api/project-portal/admin/*`.
  - Admin access requires `is_admin=true` or `role=senior_developer`.
- Added request approval workflow API that creates a project from an approved request.
- Added milestone update API with automatic progress calculation.
- Added proposal generation API.
- Added payment recording API for milestone/payment tracking.
- Added portfolio project API for Yenkasa App, Yenkasa Store, YenkasaAI, and client project media metadata.
- Added admin dashboard creation forms:
  - Approve request into project
  - Create project
  - Assign project manager and developers
  - Set deadlines and progress
  - Create quotations
  - Create invoices
  - Record payments
  - Upload files/deliverables
  - Send client messages
- Added pricing catalog editor:
  - Stored in `softotech_pricing_items`
  - Admin can edit labels, unit prices, categories, triggers, and active state.
  - New project requests use this catalog for automatic estimates.
- Added automatic invoice PDF generation on request submission:
  - Generated from selected request details and pricing estimate.
  - Uploaded through `mediaStorage` to the `project-invoices` folder.
  - Response/success page includes the invoice PDF URL when generated.
- Added Project AI Assistant API. It calls `YENKASA_AI_ENGINE_URL` or `YENKASA_AI_BACKEND_URL` when configured and falls back to a local project assistant response.
- Added audit logging for portal actions in `softotech_audit_logs`.
- Added upload support through the existing `mediaStorage` abstraction, so documents use GCS when `MEDIA_STORAGE_PROVIDER=gcs`.
- Added portfolio homepage About Us/team section:
  - Bright Kofi Ofosu Menya
  - Arhinful Hudson
  - Elorm Wisdom
  - Ruth Awini
  - Placeholders are ready for photos, background, field of study, and major.
- Added portfolio admin live content wiring:
  - `/portfolio-admin` loads and saves live portfolio content through `/api/portfolio/content`.
  - Content is stored in Firestore collection `softotech_portfolio_content`.
  - Admin can verify access with `/api/portfolio/admin/verify`.
  - Portfolio admin now accepts Soft-O-Tech portal tokens and legacy Yenkasa app tokens.
  - These emails automatically receive senior developer/admin portal access on registration/login:
    - `ofosumenyabrightkofi@gmail.com`
    - `kofiinspirion@gmail.com`
    - `ferochidenarius@gmail.com`
    - `ki.longrich@gmail.com`
  - After logging in with one of those emails, `/portfolio-admin` can use the stored `softOTechPortalToken` to upload screenshots/videos.
  - Admin can upload screenshots/videos through `/api/portfolio/media`.
  - Uploaded GCS/Cloudinary URLs are added to the selected product media list.
  - Product pages fetch `/api/portfolio/content` and render saved screenshots/videos.
- Added portfolio CTAs:
  - `Request a Website or App`
  - `Client Portal`
  - `Software Solutions`

## Scaffolded But Not Fully Finished

- Email verification token generation is implemented, but the verification endpoint/email template still needs to be completed.
- Password reset is not yet wired for the Soft-O-Tech portal.
- PDF quotation exports are not yet generated.
- Invoice PDF generation now exists for request submission; richer invoice templates matching the DOCX exactly can still be improved.
- Admin create-project/quotation/invoice/payment/message/document forms are now wired. Full edit/delete screens can still be added later.
- Charts/exportable reports are not yet visualized; analytics data is available as dashboard payload.
- Portfolio admin media upload and live content saving is wired. Team profile photo upload/editing is still a future enhancement beyond the current placeholders.
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
- `PORTFOLIO_CONTENT_COLLECTION=softotech_portfolio_content`
- `PORTFOLIO_CONTENT_DOC_ID=main`
- `SOFTOTECH_PRICING_COLLECTION=softotech_pricing_items`

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
node --check services/softOTechPricing.service.js
node --check services/projectInvoice.service.js
node --check services/portfolioContent.service.js
node --check services/adminBootstrap.service.js
node --check src/config/apiRoutes.js
npm test
```

Test result:

```text
22 tests passed
```

## Where Work Stopped

The platform foundation is implemented and tested locally. Remaining production polish is mostly around exact DOCX-style PDF layout, email verification/password reset flows, visual chart exports, team photo/profile editing from portfolio admin, and deployment/configuration of the new env vars on the live server.
