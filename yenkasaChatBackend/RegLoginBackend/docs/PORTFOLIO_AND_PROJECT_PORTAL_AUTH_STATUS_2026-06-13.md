# Portfolio and Project Portal Auth Status - 2026-06-13

## Scope

This note documents the current status of the Yenkasa Soft-O-Tech portfolio admin auth and project management portal auth work.

## What was fixed

### Portfolio admin auth

- Added a dedicated portfolio admin middleware file:
  - `middleware/portfolioAdminAuth.middleware.js`
- Added dedicated portfolio admin auth endpoints:
  - `POST /api/portfolio/auth/register`
  - `POST /api/portfolio/auth/login`
- Added dedicated portfolio admin pages:
  - `/portfolio-admin/login`
  - `/portfolio-admin/register`
- Updated `/portfolio-admin` to use portfolio-specific login links instead of sharing the project management login page.
- Removed the public display of authorized admin emails from portfolio admin pages.
- Kept privileged email handling internal through:
  - `services/adminBootstrap.service.js`
- Portfolio admin registration now rejects non-approved emails before creating an account.
- Portfolio media upload and content update routes now require portfolio admin authorization.

### Project management portal auth

- Added a dedicated project portal auth middleware file:
  - `middleware/softOTechPortalAuth.middleware.js`
- Refactored project portal routes to use shared middleware instead of inline route-local auth functions.
- Project portal auth remains separate from portfolio admin auth:
  - `POST /api/project-portal/auth/register`
  - `POST /api/project-portal/auth/login`

### Admin email policy

The following emails are treated internally as admin/senior developer accounts:

- `ki.longrich@gmail.com`
- `kofiinspirion@gmail.com`
- `ofosumenyabrightkofi@gmail.com`
- `ferochidenarius@gmail.com`

These emails are not shown publicly on the portfolio admin UI.

## What was tested

### Automated checks

- `node --check middleware/softOTechPortalAuth.middleware.js`
- `node --check middleware/portfolioAdminAuth.middleware.js`
- `node --check routes/portfolioMedia.routes.js`
- `node --check routes/softOTechPortal.routes.js`
- `node --check routes/softOTechPortal.page.js`
- `npm test`

### Route-level checks

The backend app was started locally with test token secrets and these routes were checked:

- `GET /portfolio-admin/login` returned `200`
- `GET /portfolio-admin/register` returned `200`
- `GET /portfolio-admin` returned `200`
- `GET /api/portfolio/admin/verify` without a token returned `401`
- `GET /api/project-portal/admin/dashboard` without a token returned `401`
- `POST /api/portfolio/auth/register` with a non-admin email returned `403`

This confirms:

- Portfolio admin has separate login and registration pages.
- Project management portal protected routes reject unauthenticated requests.
- Portfolio admin protected routes reject unauthenticated requests.
- Non-approved portfolio admin registration is blocked before account creation.

## What has not been fully tested yet

- Real browser login using one of the approved admin emails.
- Real browser registration using one of the approved admin emails.
- Real client registration and login from the project management portal.
- Full media upload from `/portfolio-admin` after authenticated login.
- Full Firestore-backed project request and project dashboard lifecycle.
- Email verification and password reset flows.

Those tests require a real test account/password and live Firebase/Firestore credentials.

## Current stopping point

The auth separation and middleware wiring are in place. The remaining work is live end-to-end testing with real credentials:

1. Register or log in with an approved portfolio admin email.
2. Confirm portfolio admin receives upload access.
3. Register a normal client.
4. Confirm the client can log in only to the client/project portal.
5. Confirm the client cannot access portfolio admin or project admin APIs.
6. Upload product media through `/portfolio-admin`.
7. Confirm the uploaded media appears on product pages.

## Files changed

- `middleware/portfolioAdminAuth.middleware.js`
- `middleware/softOTechPortalAuth.middleware.js`
- `routes/portfolioMedia.routes.js`
- `routes/softOTechPortal.routes.js`
- `routes/softOTechPortal.page.js`
- `public/admin.html`
- `docs/YENKASA_WEBSITE_PROJECT_REQUEST_SYSTEM_2026-06-12.md`
- `docs/PORTFOLIO_AND_PROJECT_PORTAL_AUTH_STATUS_2026-06-13.md`

