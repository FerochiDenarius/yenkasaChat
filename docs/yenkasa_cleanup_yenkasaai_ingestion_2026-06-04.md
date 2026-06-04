# Yenkasa Cleanup and YenkasaAI Ingestion Work Log

Date: 2026-06-04

## Scope

This document records the cleanup and verification work done after the YenkasaAI Flutter/backend files were found inside the Yenkasa Kotlin app repository.

## Correct Folder Boundaries

- `/Users/kofibright/yenkasaChat`
  - Kept as the Yenkasa Kotlin app repository plus `yenkasaChatBackend/RegLoginBackend`.
  - Kept OIL and YenkasaAI bridge backend code in `yenkasaChatBackend/RegLoginBackend`.
  - Removed misplaced duplicated project folders from this repo.

- `/Users/kofibright/StudioProjects/YenkasaAi`
  - Treated as the real YenkasaAI Flutter frontend repository.
  - All Flutter PDF ingestion UI changes were applied here.

- `/Users/kofibright/Desktop/YenkasaAi alias`
  - Confirmed as a macOS shortcut/alias, not the real working tree.

- `/Users/kofibright/Desktop/yenkasa_ai_flutter`
  - Confirmed as a plain folder, not the real git repo.
  - Not used as the target Flutter project after confirmation.

## YenkasaChat Repository Cleanup

Removed these misplaced folders from `/Users/kofibright/yenkasaChat`:

- `yenkasa-ai`
- `yenkasa_ai_flutter`

Removed the old static React/YenkasaAI web bundle from the backend because YenkasaAI web will be generated from Flutter instead:

- `yenkasaChatBackend/RegLoginBackend/public/yenkasa_ai`

Kept the backend API/OIL bridge files under:

- `yenkasaChatBackend/RegLoginBackend/src/ai`
- `yenkasaChatBackend/RegLoginBackend/src/intelligence`
- `yenkasaChatBackend/RegLoginBackend/src/server.js`

## Backend/OIL Bridge Work Kept

Files involved:

- `yenkasaChatBackend/RegLoginBackend/src/server.js`
- `yenkasaChatBackend/RegLoginBackend/src/ai/providers/fastapi.provider.js`
- `yenkasaChatBackend/RegLoginBackend/src/intelligence/services/eventPublisher.service.js`
- `yenkasaChatBackend/RegLoginBackend/src/intelligence/services/serverIncidentOil.service.js`
- `yenkasaChatBackend/RegLoginBackend/tests/intelligenceEventPublisher.test.js`

Purpose:

- Allow server incidents and operational logs from `server.js` to be normalized as OIL/intelligence events.
- Keep YenkasaAI relay behavior in the app backend.
- Add test coverage for server incident log normalization.

## YenkasaAI Flutter Work

Real Flutter repo:

- `/Users/kofibright/StudioProjects/YenkasaAi`

Files changed:

- `pubspec.yaml`
- `pubspec.lock`
- `lib/features/chat/data/ai_api_service.dart`
- `lib/features/ingestion/presentation/ingestion_page.dart`
- `test/widget_test.dart`
- `macos/Flutter/GeneratedPluginRegistrant.swift`
- `macos/Podfile.lock`
- `ios/Podfile.lock`

Implemented:

- Added `file_picker` dependency.
- Added `IngestionUploadResult`.
- Added `AiApiService.uploadKnowledgePdfs`.
- Wired the ingestion page button to select PDF files.
- Uploads selected PDFs as multipart form data to `/ingest`.
- Shows selected file names.
- Shows upload success summary.
- Shows upload errors.
- Updated stale widget test so it renders `GetStartedPage` directly instead of waiting on router/bootstrap animations.

## Clean Build Procedure

The first Android and macOS release builds were treated as stale because they were produced before `flutter clean`.

Then the clean procedure was run:

- `flutter clean`
- `flutter pub get`
- `flutter analyze`
- `flutter test`
- `flutter build apk --release`
- `flutter build macos --release`
- `flutter build ios --release --no-codesign`

## Verification Evidence

Backend syntax checks passed:

- `node --check src/server.js`
- `node --check src/intelligence/services/eventPublisher.service.js`
- `node --check src/intelligence/services/serverIncidentOil.service.js`
- `node --check src/ai/providers/fastapi.provider.js`

Backend event publisher tests passed:

- Command: `node --test tests/intelligenceEventPublisher.test.js`
- Result: 9 tests passed.
- Covered: server incident logs, notification lifecycle events, community post notification events, livestream operational events, retry delay, relay payload mapping, and event normalization.

Flutter verification passed:

- `flutter analyze`
  - Result: No issues found.
- `flutter test`
  - Result: All tests passed.

Clean release builds passed:

- Android release APK:
  - `build/app/outputs/flutter-apk/app-release.apk`
  - Size: 57.6 MB

- macOS release app:
  - `build/macos/Build/Products/Release/YenkasaAi.app`
  - Size: 51.5 MB

- iOS release app:
  - `build/ios/iphoneos/Runner.app`
  - Size: 25.4 MB
  - Built with `--no-codesign`; manual signing is still required before physical device deployment.

## Build Warnings Observed

- Android build emitted Java source/target 8 obsolete warnings.
- macOS build emitted `flutter_tts` Swift future-compatibility warnings for `AVSpeechSynthesisVoiceQuality` and `AVSpeechSynthesisVoiceGender`.
- iOS build warned that code signing was disabled, which is expected for `--no-codesign`.

## Current Expected Git Status Summary

In `/Users/kofibright/yenkasaChat`:

- Deleted misplaced duplicate folders:
  - `yenkasa-ai`
  - `yenkasa_ai_flutter`
- Deleted old static YenkasaAI web bundle:
  - `yenkasaChatBackend/RegLoginBackend/public/yenkasa_ai`
- Kept backend/OIL bridge modifications under `yenkasaChatBackend/RegLoginBackend/src`.

In `/Users/kofibright/StudioProjects/YenkasaAi`:

- Flutter PDF ingestion wiring is present.
- Dependencies are restored after clean.
- Release artifacts were built from clean output.

## Notes

- The old React/YenkasaAI static web app inside `RegLoginBackend/public/yenkasa_ai` was removed because the future YenkasaAI web app will be built from Flutter.
- The backend `/api/yenkasa-ai` bridge code remains because it is not the old web frontend bundle.
- The iOS artifact is not device-installable until signed.
