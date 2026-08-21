# Tony Sanchez Yoga — Mobile App Build Notes (Android + iOS)

The app is a **mobile-first, installable PWA**. There are two ways to ship it to phones:

1. **PWA install** (fastest, no store): users open the site and "Add to Home Screen". Already works — the app is standalone, portrait, notch-safe, with icons + service worker.
2. **Native wrapper via Capacitor** (for App Store / Play Store): wraps the same React build in a WebView. Steps below. The codebase stays unified — no separate mobile app to maintain.

The frontend talks to the backend only through `REACT_APP_BACKEND_URL`, so the wrapped app hits the same deployed API with no code changes.

---

## Prerequisites
- Node 18+ and Yarn (already used by this repo)
- **Android:** Android Studio + JDK 17
- **iOS:** macOS + Xcode 15+ + CocoaPods (`sudo gem install cocoapods`)

`capacitor.config.json` already exists at `/app/frontend/capacitor.config.json`:
- `appId`: `com.tonysanchezyoga.app`
- `appName`: `Tony Sanchez Yoga`
- `webDir`: `build`

---

## One-time setup (run inside `/app/frontend`)
```bash
cd /app/frontend

# 1) Install Capacitor
yarn add @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios @capacitor/splash-screen @capacitor/status-bar

# 2) Build the production web bundle (uses REACT_APP_BACKEND_URL from .env)
yarn build

# 3) Add the native platforms (creates ./android and ./ios projects)
npx cap add android
npx cap add ios
```

## Every release
```bash
cd /app/frontend
yarn build          # rebuild web assets
npx cap sync        # copy build/ into the native projects + update plugins
```

### Android
```bash
npx cap open android     # opens Android Studio
# In Android Studio: Build > Generate Signed Bundle/APK  -> upload the .aab to Play Console
```

### iOS
```bash
npx cap open ios         # opens Xcode
# In Xcode: set your Team/signing, then Product > Archive -> upload via Organizer to App Store Connect
```

---

## Live-reload during development (optional)
Point the wrapper at the running dev/preview server instead of the bundled build by adding to `capacitor.config.json`:
```json
"server": { "url": "https://<your-preview-domain>", "cleartext": false }
```
Then `npx cap sync`. Remove this `url` before shipping a store build so the app uses bundled assets.

---

## Store assets checklist
- App icons: `/app/frontend/public/icons/icon-192.png`, `icon-512.png`, `icon-512-maskable.png` (already present). Generate platform icon sets with `@capacitor/assets` (`npx @capacitor/assets generate`).
- Splash: uses `backgroundColor #FAFAF7`; drop a `resources/splash.png` (2732×2732) and run `npx @capacitor/assets generate` for all sizes.
- Permissions: the app needs **microphone** (AI voice assistant) and **notifications** (web-push). Add to `AndroidManifest.xml` (`RECORD_AUDIO`, `POST_NOTIFICATIONS`) and iOS `Info.plist` (`NSMicrophoneUsageDescription`, and push capability).

---

## Notes / gotchas
- **API base URL:** the wrapped app must be built with the *production* `REACT_APP_BACKEND_URL`. Verify `frontend/.env` before `yarn build`.
- **Deep links / OAuth-less:** current auth is JWT Bearer in storage, so no cookie/OAuth redirect issues inside the WebView.
- **YouTube lessons:** play inside the in-app WebView on device; if a video is region/embargo-restricted it falls back to YouTube's "unavailable" frame (host clips as public/unlisted).
- **Safe areas:** `viewport-fit=cover` + iOS `contentInset: "always"` handle notches; the bottom tab bar already respects `safe-bottom`.
