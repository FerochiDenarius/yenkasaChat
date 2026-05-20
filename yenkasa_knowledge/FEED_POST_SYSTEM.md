# Feed and Post System

## Overview

The feed system serves approved posts scoped by country, community membership, follow graph, and privacy rules. It also injects sponsored ads into the response stream.

## Current implementation

### Post creation

- `POST /api/posts`
- supports text, image, video, and audio posts
- uses `clientRequestId` for idempotent retries
- checks suspensions and posting eligibility
- queues community notifications for approved community posts

### Post approval

- posts default to `pending`
- reviewer roles approve via `postapproval.routes.js`
- approved posts are emitted through `newPost` and `feedUpdate`

### Feed retrieval

- `GET /api/feed`
- `GET /api/feed/:mode`
- modes include `for-you`, `following`, `latest`, `trending`, and `popular`
- filters by allowed country communities and blocked relationships
- injects ads roughly every 6 posts

## Important modules

- `routes/post.routes.js`
- `routes/feed.routes.js`
- `routes/postapproval.routes.js`
- `models/post.model.js`
- `models/Ad.model.js`

## Known issues

- feed assembly is request-time and fully dynamic
- ad insertion happens in memory after post fetch
- post approval and feed emission logic is duplicated across post and approval routes

## Scaling concerns

- feed queries rely on populate + post-processing rather than a precomputed timeline
- trending/popular ranking uses request-time sorting on engagement counters
- view counts and liked-by-user state are attached after the main query

## Recommended improvements

1. centralize post publication and feed event emission
2. introduce feed caches or precomputed candidate sets
3. separate ad insertion policy from feed retrieval code
4. define one canonical feed event payload contract

