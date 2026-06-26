# Soft-O-Tech Backend

This folder contains the backend code for Yenkasa Soft-O-Tech project operations and portfolio administration.

It is intentionally separated from the core Yenkasa app backend routes, models, and services. New Soft-O-Tech backend work should be added here instead of under the root `routes/`, `services/`, `models/`, or the legacy misspelled `potfolioBackend/` folder.

## Structure

- `projectManagement/`
  - Project request intake
  - Project portal API
  - Client/admin portal pages
  - Requirements, assignments, quotations, invoices, pricing, payments, documents, messages, and project dashboard logic
- `portfolio/`
  - Portfolio admin authentication middleware
  - Portfolio content service
  - Portfolio media upload and management routes

## Current Route Mounts

The app mounts Soft-O-Tech modules from `src/config/apiRoutes.js`:

- `/api/project-requests` -> `softotechBackend/projectManagement/routes/projectRequest.routes.js`
- `/api/project-portal` -> `softotechBackend/projectManagement/routes/softOTechPortal.routes.js`
- `/api/portfolio` -> `softotechBackend/portfolio/routes/portfolioMedia.routes.js`
- public/admin pages -> `softotechBackend/projectManagement/routes/projectRequest.page.js`
- client/admin portal pages -> `softotechBackend/projectManagement/routes/softOTechPortal.page.js`

## Compatibility Wrappers

The old scattered files now re-export the implementations from this folder. They exist only to avoid breaking older imports:

- `routes/projectRequest.page.js`
- `routes/projectRequest.routes.js`
- `routes/softOTechPortal.page.js`
- `routes/softOTechPortal.routes.js`
- `services/softOTechPortal.service.js`
- `services/projectRequestStore.service.js`
- `services/projectRequestEmail.service.js`
- `services/projectInvoice.service.js`
- `services/softOTechPricing.service.js`
- `models/projectRequest.model.js`
- `middleware/softOTechPortalAuth.middleware.js`
- `potfolioBackend/routes/portfolioMedia.routes.js`
- `potfolioBackend/services/portfolioContent.service.js`
- `potfolioBackend/middleware/portfolioAdminAuth.middleware.js`

Do not add new logic to those wrapper files.

## Shared Main Backend Dependencies

Soft-O-Tech still uses shared backend infrastructure from the main app where it is genuinely shared:

- `services/mediaStorage.service.js`
- `services/adminBootstrap.service.js`
- `middleware/auth.js`
- `middleware/permissions.js`
- `models/user.model.js`
- `src/intelligence/services/eventPublisher.service.js`

Those are not duplicated in this folder.

## Legacy Folder Note

`potfolioBackend/` is intentionally left in place as a compatibility shell because older imports and documentation reference it. The actual portfolio implementation now lives in `softotechBackend/portfolio/`.
