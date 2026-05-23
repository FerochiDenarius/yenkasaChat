---
title: Current Stack and Architecture
category: technical_stack
knowledge_domain: engineering
tags: [kotlin, android, nodejs, express, mongodb, springboot, mysql, socketio, cloudinary, paystack, agora, cloud_run, flutter, architecture]
source_documents: THE STORY OF YENKASAFullBio.pdf, CURRENT_ARCHITECTURE.md, FEED_PLAYER_FRONTEND.md, STORE_PROXY_AND_INTEGRATION.md, LIVESTREAM_ARCHITECTURE.md
---

# Current Stack and Architecture

## Product surfaces

The broader Yenkasa ecosystem currently spans multiple surfaces:

- legacy/native Android social app
- Yenkasa AI interfaces
- Yenkasa Store commerce surface
- web and admin surfaces
- livestream and realtime systems

## Mobile and frontend stack

The founder bio identifies the core social app as Android-first, with Kotlin as the primary language and a stack that includes:

- Android Studio
- Media3 and ExoPlayer
- Retrofit
- Coroutines
- RecyclerView
- ViewPager2
- Firebase Authentication
- OneSignal
- Jetpack components
- Room Database

Current architecture notes show the feed has evolved into a PlayerView-style immersive surface centered on:

- `FeedFragment`
- `FeedPlayerCoordinator`
- `YenkasaPlayerView`
- controller-based feed orchestration

## Backend stack

The core backend stack includes:

- Node.js
- Express.js
- MongoDB
- JWT authentication
- Socket.IO
- Cloudinary
- PM2
- REST APIs

Current architecture notes describe the main backend as a monolith that still contains:

- mobile API routes
- web routes
- store integration
- Socket.IO
- cron-like workers

## Store and payment stack

The founder bio and store integration notes show:

- Java Spring Boot and MySQL are used in the commerce side
- a Node/Express proxy layer connects the main backend to store flows
- Paystack powers payment flows
- seller payouts and commissions are part of the commerce direction

## Livestream stack

The livestream system combines:

- REST lifecycle endpoints
- Socket.IO room events
- Agora for media transport
- persisted livestream state models

## AI stack

Yenkasa AI currently uses a separate Cloud Run-oriented backend that combines:

- FastAPI
- Vertex AI generation
- Chroma vector retrieval
- Google Cloud Storage snapshot persistence
- separate public and engineering collections

## Architecture interpretation

Yenkasa is best understood as a multi-surface ecosystem with:

- a strong Android-first product history
- a monolithic Node backend with realtime extensions
- commerce integrations that already pressure service boundaries
- newer AI infrastructure running separately from the legacy monolith

