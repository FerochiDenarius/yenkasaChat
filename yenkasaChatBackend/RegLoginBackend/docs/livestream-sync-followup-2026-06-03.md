# Livestream Sync Follow-up - 2026-06-03

## Scope

This follow-up addressed livestream real-time sync regressions reported after recent livestream work:

- Joined viewer comments were not consistently appearing on the host screen.
- Like/reaction sync remained brittle.
- Livestream setup needed community association support already wired on Android.
- The stream device screen should stay awake during livestream usage.
- Comment overlays needed to be less blocking when messages flood the screen.
- The updated Android build needed to be installed on connected ADB devices.

## Findings

- Backend livestream socket routes are present and registered:
  - `live_join`
  - `live_leave`
  - `live_comment`
  - `live_reaction`
  - `live_like`
  - `send_like`
  - `streamLike`
  - `likeStream`
  - gift, share, and guest-seat events
- Android livestream listeners are present for:
  - `live_comment`
  - `new_comment`
  - `live_reaction`
  - `new_like`
  - join/leave/viewer-count events
  - gift and guest events
- The weak point was room membership and host targeting. Comments and reactions depended on a successful prior room join. If the sender or host socket missed the room join or raced against host readiness, backend events could be accepted without reaching all expected screens.

## Fixes

### Backend

- Hardened `emitToLiveRoom` to support extra target rooms in addition to livestream rooms.
- Added stream context resolution before comment/reaction processing.
- Added interaction membership repair so a user sending a comment or reaction is joined to the livestream rooms before broadcast.
- Added host fallback targeting via host socket rooms:
  - host id room
  - `user:{hostId}` room
- Updated comment broadcasts to emit both:
  - `live_comment`
  - `new_comment`
- Updated reaction/like broadcasts to emit both:
  - `live_reaction`
  - `new_like`
- Added sender acknowledgements:
  - `live_comment_ack`
  - `live_like_ack`
- Added host fallback targeting for livestream gift animation and gift reaction broadcasts.

### Android

- Added `FLAG_KEEP_SCREEN_ON` while `LiveStreamActivity` is active.
- Cleared the keep-awake flag when the livestream activity is destroyed.
- Made comment sending more resilient by forcing `live_join` before sending when the socket room flag is not ready.
- Added optimistic comment display for the sender with client event ids to reduce perceived sync delay.
- Made livestream comment cards more transparent:
  - changed comment card background to translucent black
  - reduced stroke opacity
  - changed comment text to white with 90 percent alpha
  - reduced the overlay height and max visible comment cards

## Files Changed

- `yenkasaChatBackend/RegLoginBackend/src/services/livestream/livestream.service.js`
- `yenkasaChatBackend/RegLoginBackend/src/services/livestream/livestream.socket.js`
- `yenkasaChatBackend/RegLoginBackend/routes/livestream.routes.js`
- `app/src/main/java/xyz/yenkasa/app/ui/LiveStreamActivity.kt`
- `app/src/main/res/drawable/bg_live_comment_card.xml`
- `app/src/main/res/layout/activity_live_stream.xml`

## Verification

- Backend syntax checks passed:
  - `node --check src/services/livestream/livestream.socket.js`
  - `node --check src/services/livestream/livestream.service.js`
  - `node --check routes/livestream.routes.js`
- Android Kotlin compilation passed:
  - `./gradlew :app:compileDebugKotlin`
- Android install passed:
  - `./gradlew :app:installDebug`
- Installed device verified:
  - Device: TECNO BG6m
  - Serial: `146353755V007782`
  - Package: `xyz.yenkasa.app`
  - Version code: `60`
  - Version name: `5.3`
  - Last update time: `2026-06-03 10:51:57`

## Remaining Deployment Note

The Android build has been installed on the connected TECNO device. The backend sync fixes are local code changes and must be deployed or the backend process must be restarted before production devices can receive the corrected socket behavior.
