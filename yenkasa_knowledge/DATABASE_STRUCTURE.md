# Database Structure

## Overview

MongoDB stores the entire social graph, content layer, moderation workflows, rewards ledger, and livestream session state.

## Core collections

### Users

- model: `user.model.js`
- identity: username, email, phone, password
- location: country, verifiedCountry, detectedCountry
- roles: `role`, `roleName`, `accessRole`, `staffRole`, `publicRoles`
- social graph: followers/following
- economy: balances, wallet id, monthly reward counters
- auth state: refresh token, token revocation timestamps
- presence: `online`, `lastSeen`

### Posts

- model: `post.model.js`
- author, community, text/media payload
- moderation state
- engagement counters
- `clientRequestId` for idempotent submission

### Communities

- model: `community.model.js`
- country-scoped container for members and posts
- stores counts, moderators, and metadata

### Notifications

- model: `notifications.model.js`
- sender, receiver, type, message, target routing data

### Livestreams

- model: `LiveStream.js`
- host identity, Agora channel, lifecycle status, viewer counts, guest seats

### Coin transactions

- model: `cointransaction.model.js`
- reward and transfer ledger
- ties wallet movement to posts, comments, live gifts, and system actions

## Other notable collections

- `PostApproval`
- `ModerationItem`
- `Comment`
- `LikeActivity`
- `View`
- `Follow`
- `RoleActivationCode`
- `AppVerification`
- `MonthlyYkcSnapshot`
- monetization and ad metric collections

## Known issues

- some view-specific fields are stored in core collections
- counters such as `memberCount` can drift from relationship reality
- role data is denormalized across several user fields

## Scaling concerns

- several query paths rely on denormalized counters staying correct
- feed, moderation, and analytics routes use populate-heavy reads
- scheduled jobs scan broad collections without partitioning

## Recommended improvements

1. document ownership of denormalized counters
2. add repair jobs or derived views for critical counters
3. define schema migration rules for legacy role fields

