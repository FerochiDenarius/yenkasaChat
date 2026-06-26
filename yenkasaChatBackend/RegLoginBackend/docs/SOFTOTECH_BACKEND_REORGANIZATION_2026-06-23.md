# Soft-O-Tech Backend Reorganization

Date: 2026-06-23

## Reason

The Soft-O-Tech project management backend and portfolio backend were mixed into the main Yenkasa app backend folders:

- `routes/`
- `services/`
- `models/`
- `middleware/`
- `potfolioBackend/`

This made the codebase hard to reason about because Yenkasa app features and Soft-O-Tech business/project-management features lived side by side.

## New Location

Soft-O-Tech backend code now lives under:

```text
yenkasaChatBackend/RegLoginBackend/softotechBackend/
```

## New Structure

```text
softotechBackend/
  README.md
  projectManagement/
    middleware/
      softOTechPortalAuth.middleware.js
    models/
      projectRequest.model.js
    routes/
      projectRequest.page.js
      projectRequest.routes.js
      softOTechPortal.page.js
      softOTechPortal.routes.js
    services/
      projectInvoice.service.js
      projectRequestEmail.service.js
      projectRequestStore.service.js
      softOTechPortal.service.js
      softOTechPricing.service.js
  portfolio/
    middleware/
      portfolioAdminAuth.middleware.js
    routes/
      portfolioMedia.routes.js
    services/
      portfolioContent.service.js
```

## Route Mount Changes

`src/config/apiRoutes.js` now mounts the implementations from `softotechBackend/`:

```text
/api/project-requests -> softotechBackend/projectManagement/routes/projectRequest.routes
/api/project-portal   -> softotechBackend/projectManagement/routes/softOTechPortal.routes
/api/portfolio        -> softotechBackend/portfolio/routes/portfolioMedia.routes
/                     -> softotechBackend/projectManagement/routes/projectRequest.page
/                     -> softotechBackend/projectManagement/routes/softOTechPortal.page
```

## Compatibility Wrappers

The old paths were converted to one-line wrappers. They are kept only so older imports do not break immediately.

Examples:

```js
module.exports = require('../softotechBackend/projectManagement/routes/softOTechPortal.routes');
```

Do not add new logic to the old wrapper files.

## Shared Dependencies Left In Main Backend

Some dependencies remain in the main backend because they are shared infrastructure rather than Soft-O-Tech domain code:

- `middleware/auth.js`
- `middleware/permissions.js`
- `models/user.model.js`
- `services/adminBootstrap.service.js`
- `services/mediaStorage.service.js`
- `src/intelligence/services/eventPublisher.service.js`

## Legacy `potfolioBackend`

The misspelled `potfolioBackend/` folder remains as a compatibility shell. The real portfolio implementation is now:

```text
softotechBackend/portfolio/
```

## Follow-Up

After downstream imports and documentation have been updated, the compatibility wrappers can be removed in a separate cleanup.
