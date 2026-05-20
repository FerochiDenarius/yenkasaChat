# Yenkasa Engineering Knowledge Base

This folder contains internal backend and Android frontend architecture notes prepared for two audiences:

1. engineers onboarding into the codebase
2. YenkasaAI ingestion and retrieval

## Suggested ingestion order

1. [SYSTEM_OVERVIEW.md](/Users/kofibright/yenkasaChat/yenkasa_knowledge/SYSTEM_OVERVIEW.md)
2. [CURRENT_ARCHITECTURE.md](/Users/kofibright/yenkasaChat/yenkasa_knowledge/CURRENT_ARCHITECTURE.md)
3. [BACKEND_ARCHITECTURE.md](/Users/kofibright/yenkasaChat/yenkasa_knowledge/BACKEND_ARCHITECTURE.md)
4. [ANDROID_FRONTEND_ARCHITECTURE.md](/Users/kofibright/yenkasaChat/yenkasa_knowledge/ANDROID_FRONTEND_ARCHITECTURE.md)
5. [CLIENT_STATE_AND_NETWORKING.md](/Users/kofibright/yenkasaChat/yenkasa_knowledge/CLIENT_STATE_AND_NETWORKING.md)
6. [FEED_PLAYER_FRONTEND.md](/Users/kofibright/yenkasaChat/yenkasa_knowledge/FEED_PLAYER_FRONTEND.md)
7. [CHAT_CLIENT_ARCHITECTURE.md](/Users/kofibright/yenkasaChat/yenkasa_knowledge/CHAT_CLIENT_ARCHITECTURE.md)
8. [LIVESTREAM_CLIENT_ARCHITECTURE.md](/Users/kofibright/yenkasaChat/yenkasa_knowledge/LIVESTREAM_CLIENT_ARCHITECTURE.md)
9. [WEB_FRONTEND_ARCHITECTURE.md](/Users/kofibright/yenkasaChat/yenkasa_knowledge/WEB_FRONTEND_ARCHITECTURE.md)
10. [STORE_FRONTEND_ARCHITECTURE.md](/Users/kofibright/yenkasaChat/yenkasa_knowledge/STORE_FRONTEND_ARCHITECTURE.md)
11. [STORE_PROXY_AND_INTEGRATION.md](/Users/kofibright/yenkasaChat/yenkasa_knowledge/STORE_PROXY_AND_INTEGRATION.md)
12. [API_STRUCTURE.md](/Users/kofibright/yenkasaChat/yenkasa_knowledge/API_STRUCTURE.md)
13. [DATABASE_STRUCTURE.md](/Users/kofibright/yenkasaChat/yenkasa_knowledge/DATABASE_STRUCTURE.md)
14. domain-specific docs such as livestream, feed, moderation, rewards, notifications, localization, web, and store
15. public-facing product docs under `public/` for YenkasaAI in-app assistance

## Source of truth

These pages were derived from the current Node/Express backend under:

`yenkasaChatBackend/RegLoginBackend`

and the Android app under:

`app/src/main`

They summarize actual route mounts, activities, controllers, views, socket flows, and storage helpers rather than idealized target architecture.

## Export status

- Markdown: generated
- DOCX: generated
- PDF: generated

The Markdown files remain the authoritative source for AI ingestion. The `.docx` and `.pdf` copies are convenience exports for internal sharing.

The `public/` subfolder is the user-facing knowledge corpus. It is intended for platform-help answers such as YKC, ranks, verification, communities, Live Arena, creator growth, and moderation-safe explanations.
