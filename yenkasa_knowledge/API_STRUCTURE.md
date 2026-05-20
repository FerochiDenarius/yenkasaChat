# API Structure

## Overview

The API surface is mounted primarily in `server.js`. It covers auth, messaging, communities, feed, moderation, notifications, livestreaming, wallet operations, and auxiliary web/store endpoints.

## Main API groups

### Identity and account

- `/api/auth`
- `/api/reset-password`
- `/api/verify`
- `/api/account`
- `/api/users`
- `/api/profile`
- `/api/email-verification`

### Social and messaging

- `/api/contacts`
- `/api/messages`
- `/api/chatrooms`
- `/api/groups`
- `/api/follow`
- `/api/user-privacy`

### Content and feed

- `/api/posts`
- `/api/comments`
- `/api/feed`
- `/api/search`
- `/api/views`
- `/api/social`

### Communities and roles

- `/api/communities`
- `/api/roles`
- `/api/post-approval`
- `/api/app-verification`

### Economy and analytics

- `/api/coin-transactions`
- `/api/wallet`
- `/api/leaderboard`
- `/api/metrics`
- `/api/admin` (payout/admin operations)

### Realtime and livestream

- `/api/live`
- `/api/livestream`

### Ads and notifications

- `/api/ads`
- `/api/notifications`
- `/api/onesignal`

## Important characteristics

- most API routes are feature-grouped by file
- route mounts mix `safeMount(...)` with direct `app.use(...)`
- some web pages and static assets are mounted alongside API paths in the same server

## Known issues

- route topology is broad and partly duplicated
- policy pages, static assets, store pages, blog pages, and API routes share one runtime

## Recommended improvements

1. generate and version an OpenAPI spec
2. split external/public HTTP surfaces from internal/admin ones
3. separate static site delivery from JSON APIs

