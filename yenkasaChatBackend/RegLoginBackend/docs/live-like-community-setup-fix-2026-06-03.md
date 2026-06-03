# Yenkasa Livestream Like Sync and Community Setup Fix

Date: 2026-06-03

## Scope

This report documents the follow-up fixes after the livestream like button still did not work as expected and the livestream setup screen was not wired to joined communities.

## Findings

1. Android livestream likes were using `live_reaction` only from the UI click path.
2. The backend socket handler accepts multiple like aliases, but its canonical like broadcast is `new_like`.
3. The Android client listened for `new_like`, but the emit path did not explicitly use `send_like`.
4. The host screen had the livestream control bar anchored in the same bottom-right area as the action rail. This could make the like action difficult or impossible to tap on host devices.
5. The livestream setup screen used a free-text community field. It did not load or bind the user's joined communities.
6. Unverified users were blocked from starting livestreams by Android client gating and backend permission rules.
7. The splash and in-app logo drawables were still pointing to edited logo files instead of the original `logo.png` asset.

## Fixes Applied

### Livestream Like Sync

Files changed:

- `app/src/main/java/xyz/yenkasa/app/ui/LiveStreamActivity.kt`
- `app/src/main/res/layout/activity_live_stream.xml`

Changes:

- Kept the like/reaction rail available for host and viewer sessions.
- Hid the request-seat action for hosts using the full container, not only the icon.
- Moved host camera/mic/end controls to the left of the action rail so they do not cover the like button.
- Updated like emit flow to send:
  - `send_like`
  - `live_reaction`
- Kept listener support for:
  - `live_reaction`
  - `new_like`
- Preserved immediate local feedback:
  - like count increments immediately
  - heart animation displays immediately
- Preserved broadcast feedback:
  - backend count from `new_like` updates the sender, host, and other viewers
  - duplicate animation is avoided with `clientEventId` de-dupe

Expected flow now:

Frontend Like Button -> `send_like` socket emit -> backend `handleLiveReaction` -> room broadcast `new_like` -> host/viewers receive -> like count updates -> heart animation displays.

### Livestream Community Selector

Files changed:

- `app/src/main/java/xyz/yenkasa/app/ui/StartLiveActivity.kt`
- `app/src/main/res/layout/activity_start_live.xml`
- `app/src/main/res/layout/item_live_community_spinner.xml`
- `app/src/main/java/xyz/yenkasa/app/model/LiveStreamModels.kt`

Changes:

- Replaced free-text community entry with a spinner.
- Loads primary community first.
- Loads joined communities from `getJoinedCommunities("Bearer $token")`.
- De-dupes primary and joined communities by community ID.
- Adds `No Community` as the first option for creator-only streams.
- Sends selected community name in the existing backend `community` field.
- Adds optional `communityId` to the Android request model for compatibility with future backend support.

### Unverified Livestream Access

Files changed:

- `app/src/main/java/xyz/yenkasa/app/util/UserPermissions.kt`
- `yenkasaChatBackend/RegLoginBackend/config/livestreamPermissions.js`

Changes:

- Android no longer hides Start Live controls for unverified/default users.
- Backend now allows unverified/default users to start livestreams.
- Backend sets `maxDurationMinutes: 15` for:
  - `unverified`
  - `user`
  - users with no recognized higher livestream role
- Existing staff roles remain unlimited.
- Existing ranked creator duration limits remain active.

Backend verification:

```text
canStartLivestream({ roleName: 'unverified' })
=> allowed: true, role: 'unverified', maxDurationMinutes: 15

canStartLivestream({ roleName: 'user' })
=> allowed: true, role: 'user', maxDurationMinutes: 15

canStartLivestream({ staffRole: 'senior developer' })
=> allowed: true, role: 'senior_developer', maxDurationMinutes: null
```

### Logo Correction

Files changed:

- `app/src/main/res/drawable/ic_logo_emblem.png`
- `app/src/main/res/drawable/ic_yenkasa_logo.png`
- `app/src/main/res/drawable/ic_yenkasa_foreground.png`

Changes:

- Replaced all three in-app/splash logo drawables with the original `NewAssets/logo.png`.
- No generated edits or retouching were applied.

Hash verification:

```text
65d50b4fe60a4656a45b57cad6ae7b74c8512bfc72ac9eafacf13ed76dddbec8  NewAssets/logo.png
65d50b4fe60a4656a45b57cad6ae7b74c8512bfc72ac9eafacf13ed76dddbec8  app/src/main/res/drawable/ic_logo_emblem.png
65d50b4fe60a4656a45b57cad6ae7b74c8512bfc72ac9eafacf13ed76dddbec8  app/src/main/res/drawable/ic_yenkasa_logo.png
65d50b4fe60a4656a45b57cad6ae7b74c8512bfc72ac9eafacf13ed76dddbec8  app/src/main/res/drawable/ic_yenkasa_foreground.png
```

The launcher icon still matches the original `NewAssets/appIcon.png`.

```text
3edde90167411bf2a86e63ce9bd47cbb2cf35582938274bcaec4d07a57b8c5d6  NewAssets/appIcon.png
3edde90167411bf2a86e63ce9bd47cbb2cf35582938274bcaec4d07a57b8c5d6  app/src/main/res/branding/yenkasa_app_icon_original.png
```

## Verification Evidence

Android compile:

```text
./gradlew :app:compileDebugKotlin
BUILD SUCCESSFUL in 4m 25s
```

Android install:

```text
./gradlew :app:installDebug
Installed on 1 device.
BUILD SUCCESSFUL in 4m 1s
```

ADB device:

```text
146353755V007782  TECNO_BG6m
```

Installed package metadata:

```text
versionCode=60 minSdk=21 targetSdk=35
versionName=5.3
lastUpdateTime=2026-06-03 10:02:51
firstInstallTime=2026-06-02 17:16:33
```

Launch activity:

```text
xyz.yenkasa.app/.ui.SplashActivity
```

## Manual Test Checklist

Use one host and two viewers.

Viewer A likes:

- Host receives `new_like`
- Viewer A sees immediate count and heart animation
- Viewer B receives `new_like`
- All three show the same backend like count

Viewer B likes:

- Host receives `new_like`
- Viewer A receives `new_like`
- Viewer B sees immediate count and heart animation
- All three show the same backend like count

Host likes:

- Host sees immediate count and heart animation
- Viewer A receives `new_like`
- Viewer B receives `new_like`

Community setup:

- Start Live shows `No Community` first.
- Joined communities load into the selector.
- Selecting a community sends its name in `community`.
- Leaving `No Community` selected creates a creator-only livestream.

Unverified livestream access:

- Unverified user can open Start Live.
- Backend creates stream with `maxDurationMinutes: 15`.
- Stream receives `scheduledEndAt` 15 minutes from creation.
- Auto-end path emits `live_time_limit` and `live_ended` when time expires.

## Remaining Notes

The Android client and backend source changes are in place and installed on the connected Android device. A live multi-device test still requires active authenticated accounts on Host, Viewer A, and Viewer B connected to the backend environment.
