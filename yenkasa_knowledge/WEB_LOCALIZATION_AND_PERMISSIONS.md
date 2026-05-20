# Web Localization and Permissions

## Overview

The web client has its own localization and permission layer. It does not reuse Android string resources or backend permission middleware; it mirrors those concerns in browser code.

## Localization

- `LocaleContext.jsx` owns:
  - supported languages
  - translation dictionary
  - selected language persistence
- languages currently represented:
  - English
  - French
  - Twi
  - Hausa
- language selection is exposed in `Settings.jsx`
- profile updates attempt to sync `preferredLanguage`, but the language setting is intentionally resilient to backend sync failures

## Permissions

- `utils/permissions.js`
  - normalizes ranks
  - computes lightweight capability flags
  - currently focuses on analytics, moderation, economy, and fraud-monitor access
- permission logic is notably narrower than the Android `UserPermissions` helper

## Notification preferences

- browser notification sound is managed in browser storage
- app notification preferences are fetched and updated through notification APIs
- browser notification permission is requested directly through the Web Notification API

## Known issues

- localization coverage is explicit but dictionary-based, which becomes harder to scale as the UI grows
- role normalization differs from Android and backend terminology
- browser notifications, in-app notifications, and backend preferences are separate control planes

## Scaling concerns

- translation dictionaries will become harder to maintain without feature-based organization
- permissions drift is likely if browser rank logic is not aligned with backend capabilities
- browser-specific behavior creates more edge cases than the Android implementation

## Future improvements

1. split web translations by feature domain instead of one expanding dictionary
2. align web role capabilities with a backend-owned permission manifest
3. define a shared notification-preferences contract across web and mobile
