# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.0-dev.0] - unreleased

### Added
- **The phone remote gained four new tabs, alongside the existing now-playing view:**
  - **Tracks, Playlists (both with search), and Radio** — so you can browse and pick what to play, not just skip within whatever's already queued. Long-pressing a track or playlist opens the same Play / Track Radio / Add to Playlist menu as the desktop app.
  - **Queue** — shows what's coming up; tap to jump straight to any track, swipe to remove one, or drag to reorder the queue.
- **The phone remote can now discover, connect to, and control Feishin Connect casting** — Sonos, AirPlay, Chromecast, and DLNA devices can be selected (including several at once) and controlled directly from the phone, each with its own volume and mute, with the same confirmation prompt as the desktop app before taking over a device someone else is using.
- **Tapping the album art on the phone remote's now-playing screen** opens a fullscreen view; tapping the volume icon mutes and unmutes, matching the desktop player.

## [0.6.6] - 2026-08-04

Quick hotfix after finding someone's Feishin Connect instance just sitting wide open on the internet. Patched what I could on my end. Securing your own deployment is still on you, though.

> [!CAUTION]
> **Put an authentication layer (Authentik, Authelia, or similar) in front of any Docker deployment reachable from outside your local network.**  
> **The media server's own login isn't a substitute for that.**

### Added
- **`WEB_PORT` and `PORT` environment variables** let the Feishin web UI and Connect API listen on ports other than the defaults (9180/9181)

### Fixed
- **Casting controls (device list, playback, volume, AirPlay pairing) now also require a signed-in session, not just the backend's access key.**
- **The Cast button no longer appears on the login screen** — it was previously rendered there along with the rest of the player bar.
- **Docker deployments without a custom access key for the Connect backend now get a random one generated automatically**, instead of a fixed default value.
- **The API's auto-generated documentation pages (`/docs`, `/openapi.json`, `/redoc`) are no longer served by default.**
- **An unrecognized session id no longer creates a new session entry on its own** — only signing in does that now.
- **Radio URLs passed to Connect must now be `http://` or `https://`.**
- **The media-server proxy (used when Navidrome/Jellyfin sits behind Authentik, Authelia, or oauth2-proxy) now also strips oauth2-proxy's identity headers**, matching the existing handling for the other two.
- **The Electron app could briefly (or, on a slow network/device scan, not so briefly) show a "Connect token doesn't match" error on startup** — the device list was requested before the app had finished signing in its Connect session, which looked like a real auth error but wasn't.

### Internal
- **Minor hardening of the reverse-proxy header handling and CORS configuration** — no functional change.

If something's broken, please [open an issue](https://github.com/mihaitom/feishin-connect/issues).

## [0.6.4] - 2026-08-04

### Fixed
- **Casting to AirPlay devices (HomePod, AirPort Express, etc.) never actually played anything, and switching tracks while casting could get refused by the device** — a leftover reference from the session-management rework silently failed every AirPlay play request behind the scenes, and switching tracks didn't stop the previous connection before opening a new one, leaving the device caught between two competing streams.
- **Pausing, stopping, or deselecting an AirPlay device while it was playing had no effect — it just kept playing** — AirPlay has no native pause, so pausing now stops the stream (and reconnects on resume), and deselecting the device now stops the actual active connection instead of a disconnected one.

## [0.6.3] - 2026-07-29

### Fixed
- **Radio never actually started playing on a Connect device** — starting a stream while casting to Sonos/AirPlay/Chromecast/DLNA re-sent the same play request roughly twice a second for as long as the radio stayed selected, which kept restarting the device's playback before it could buffer any audio.

### Internal
- **The Connect backend now ignores an identical `/play`/`/play-url` dispatch to the same target if one was already sent less than a second ago**, instead of relaying every one straight to the device — a safety net against this class of bug independent of the frontend fix above.

## [0.6.2] - 2026-07-26

### Fixed
- **Connect could get stuck reporting "not configured" after being left open for a while**, showing an error on the cast button until the page was reloaded — the backend forgets an idle session after about 30 minutes, but the app kept assuming it was still set up. It now recovers on its own and retries.
- **The play/pause button could silently stop responding after Connect had been connected but idle for a long time** — pausing or resuming against a session the backend had already forgotten looked like it worked but didn't actually do anything, with no way to reconnect except reloading the page. It's now detected and the app disconnects cleanly instead, so picking a device again works normally.
- **A `CONNECT_TOKEN` containing characters like `"` or `\` crashed the container in an nginx restart loop** with a cryptic `nginx: [emerg] unexpected "..."` error — the token is now checked at startup and rejected with a clear message (pointing at `openssl rand -hex 32` for a safe value) instead.

### Internal
- **Docker image is about half the size** (1.29GB → 656MB).
- **Frontend build stage now only copies what `pnpm run build:web` actually touches** — an unrelated backend-only change no longer busts its build cache.
- **Docker build context trimmed from 43MB to under 200KB.**
- **Alpine's `ffmpeg` package (~130MB, mostly unused video/GPU/capture support) replaced with our own minimal build**, compiled from source in a separate build stage containing only what Connect actually uses (audio decode/encode and HTTPS input) — the compiler toolchain itself never ends up in the final image, only the resulting ~8MB static binary does. Supported input formats: MP3, FLAC, WAV, AAC/M4A, ALAC, OGG (Vorbis/Opus), WMA, Monkey's Audio (APE) and AIFF. If your library has something in a format that's missing here, please <a href="https://github.com/mihaitom/feishin-connect/issues">open an issue</a> and I'll try to add it.
- **Python dependencies now also build in their own stage**, same idea as ffmpeg above — most resolve to a prebuilt wheel and don't actually need it, but one (`miniaudio`, used for AirPlay) has no prebuilt wheel for arm64 and must be compiled there, which needs a C++ compiler that otherwise wouldn't be part of the final image at all.

## [0.6.1] - 2026-07-20

### Added
- **The release notes modal now has an "Upstream" tab** showing the merged Feishin release's own notes.

### Changed
- **Merged upstream Feishin v1.15.1** — small hotfix release: fixes an inverted condition that could send scrobble progress updates on the wrong servers, a MediaSession handler that broke after stopping playback, and a tag editor default. See <a href="https://github.com/jeffvli/feishin/releases/tag/v1.15.1">Feishin Release Notes v1.15.1</a> for more details.
- **The desktop app's "update available" notification is now a small badge in Settings and the app menu**, instead of our own popup dialog — adopted from upstream's v1.15.1 rework, dropping our dialog in its favor. Now shows on Windows/Linux too, not just macOS, and no longer re-triggers electron-updater's download check on every periodic check (previously macOS-only) — it just polls GitHub's releases API. The startup auto-update flow (real download + install) is unchanged.

## [0.6.0] - 2026-07-19

### Added
- **DLNA/UPnP as a fourth Connect cast target**, alongside Sonos, AirPlay and Chromecast — for smart TVs, AV receivers, and other generic UPnP MediaRenderer devices with no dedicated protocol of their own. Discovered automatically via SSDP, controlled via standard AVTransport/RenderingControl SOAP calls (`async-upnp-client`), with full play/pause/resume/stop, real device-side position, and volume control — no vendor account or pairing needed. Sonos speakers also expose themselves as generic DLNA renderers; those are filtered out of the DLNA list so they only ever show up once, under Sonos.
- **Multi-user support** — different people logged into different accounts on the same household deployment can now cast independent tracks to independent devices at the same time, instead of sharing one global playback state. Sessions are identified by media-server login, so the same login stays one session across tabs/devices. If a device is already in use by someone else, the Connect popover shows who ("Playing for {name}") and what's currently playing on it — click it to take over, which stops their playback on that device and hands it to you, after a confirmation prompt. The person who lost the device sees their own playback stop and hand back to local playback automatically.

### Changed
- **Merged upstream Feishin v1.15.0** — 56 upstream commits since the previous base, including a batch metadata editor with artwork support in the tag editor, custom themes loadable from files, playlist creation from the current queue, furigana/romaji lyrics generation on the web build, and a long tail of lyrics/table/album-group bug fixes and translations. See <a href="https://github.com/jeffvli/feishin/releases/tag/v1.15.0">Feishin Release Notes v1.15.0</a> for more details.

### Fixed
- **On macOS, the Connect backend could report ffmpeg as missing even though it was installed** — GUI apps launched from Finder/Dock don't inherit PATH additions from `.zshrc`/`.bash_profile` the way a terminal does, so non-default ffmpeg installs were invisible to the bundled Connect server. The app now re-reads the real PATH from the user's login shell on startup before launching Connect. Not needed on Windows or Linux, where the same PATH is already available to GUI apps.
- **Logging into a second Navidrome account failed behind an SSO reverse proxy (e.g. Authentik ForwardAuth)** — the Connect proxy no longer forwards SSO identity headers that could override the actual login.
- **The Connect popover closed itself on device disconnect/deselect or on a successful connection** — it now only closes on an explicit "Connect"/"Add"/"Disconnect all" click.
- **The player-bar Stop button disconnected the Connect device entirely** — it now just pauses and resets to 0:00, without releasing the device.
- **Clicking "Connect" while paused sometimes silently did nothing** — connecting now works regardless of local play/pause state.
- **Album art could be unreachable when the media server sits behind `SERVER_INTERNAL_URL`** — cover art sent to cast devices now uses the internal, LAN-reachable address.
- **The play/pause button didn't reflect or control Connect during radio playback** (desktop and mobile fullscreen player) — both now stay in sync with the connected device.
- **Resuming or seeking radio on a Connect device produced no audio** — it now reconnects to the radio's own URL instead of the track-only stream endpoint.
- **Clicking "Connect" with an empty queue failed silently** — it now claims the device the same way takeover already did, ready to play once a track is picked.
- **The very first "Connect" click after a page reload could fail while backend setup was still finishing** — connecting now waits for setup instead of racing it, with a spinner on the cast button.
- **The in-app release notes showed a generic error for pre-release versions like `0.6.0-dev.1`** — the fallback that reads the bundled changelog when GitHub doesn't have that version published yet didn't recognize the pre-release suffix in the changelog's own version headers.
- **Leaving the app/browser tab in the background for a while could leave the Connect progress bar stuck showing a wildly wrong time and stop the next queued track from starting automatically** — returning to the app/tab now immediately re-checks the real playback state instead of waiting indefinitely.

### Internal
- **Split the oversized `use-connect-session.ts` frontend hook and `routes/devices.py` backend module into smaller, single-purpose files** — no behavior change, just easier to navigate.
- **Starting a radio stream to an already-claimed device wasn't logged** — `/play-url` now logs every attempt, like `/play` already did.

### Known issues
- **Skipping ahead or scrubbing the position directly on the device itself** (the Sonos app, a Chromecast remote, etc., instead of Feishin's own controls) **isn't detected**. Connect estimates playback position from its own wall clock, calibrated once when a track starts — it doesn't continuously poll the device for its actual position. A device-side seek or skip throws that estimate off, which shows up as the playerbar/lyrics drifting out of sync, and — more disruptively — as the wrong moment for the next track to auto-start, since that's also driven by the same estimated position. Fixing this properly would mean periodically polling every connected device for its live position, which adds constant background traffic for a relatively rare case. Haven't decided yet whether that trade-off is worth it.

## [0.5.0] - 2026-07-12

### Added
- **Playerbar volume slider now controls the connected device while streaming to Connect** - instead of the (inaudible) local volume, the slider and mute button now show and control the volume of the Sonos or Chromecast device you're streaming to, kept in sync with the per-device volume control in the Connect popover. When multiple devices are selected, or the active device doesn't support remote volume (AirPlay), the control is disabled instead of controlling nothing.
- **Desktop app auto-updater (experimental)** - the app now checks `mihaitom/feishin-connect`'s own GitHub releases on startup and periodically, and can download and install updates automatically. This hasn't seen real-world use yet, so treat it as experimental for now. Turn it off via Settings → Updates, or the `DISABLE_AUTO_UPDATES` environment variable, if you'd rather update manually.
- **Web/Docker build now shows a "new version available" notification** - A dismissible banner (top-right corner) now checks GitHub for a newer release. Only checks against tagged/stable builds, not dev or pre-release versions.

### Changed
- **"Add"/"Connect" button in the Connect popover moved above "Scan again"** - it now sits directly under the device list, closer to the devices it acts on.
- **The cast button is no longer greyed out when nothing is playing** - you can now select a Connect device with an empty queue or a paused/unstarted track. The device is remembered and streaming starts automatically as soon as you play something, instead of requiring a track to already be playing before you could connect at all.
- **Merged upstream Feishin v1.14.0** — headline change is a large lyrics rewrite: a new karaoke-style word-by-word lyrics view, Japanese furigana/romaji overlays, and OpenSubsonic structured (word-level) lyrics support. Also adds a Subsonic jukebox integration and a "stopped" playback state. Synced-lyrics scroll/seek and the karaoke view now also follow a Connect device's playback position when one is active, matching the existing classic lyrics view. See <a href="https://github.com/jeffvli/feishin/releases/tag/v1.14.0">Feishin Release Notes v1.14.0</a> for more details. Furigana/romaji support for the web/Docker build (ported to the Connect backend) was built but held back on the `feature/japanese-lyrics` branch — I don't speak Japanese and can't verify the output myself, so it stays there until there's demand for it and someone can test it. Furigana/romaji already works natively in the Electron desktop app (upstream's own implementation) — use that in the meantime if you need it.

### Fixed
- **Connecting/disconnecting a Connect device reset playback to the start of the track** - connecting mid-track always started the device from 0:00 instead of the local playhead, and disconnecting left local playback stuck at the (stale) position it had before connecting. Both directions now hand off at the actual position and resume automatically if it was playing.
- **Stop button did nothing while radio was playing on a Connect device** - clicking "Stop" only cleared the local radio UI state; the Connect target (Sonos/Chromecast) was never told to stop, so it kept streaming the radio station while the playerbar and lyrics jumped to showing a queued library track instead.
- **"Disconnect" and "Scan again" buttons in the Connect popover looked inconsistent** - the scan button used its own one-off styling (different color, size and no hover highlight) instead of the shared button style used everywhere else in the popover.
- **AirPlay pairing was lost on every desktop app update, and on every Docker container recreation** - paired AirPlay 2 credentials were saved next to the backend binary/inside the container, so they were gone after an Electron update or a `docker compose up` that recreates the container. They're now stored in a persistent location instead: automatically in Docker (mount a volume at `/data`) and in the app's per-user data directory in Electron. Existing pairings from before this fix are not migrated and need to be re-paired once.
- **AirPlay pairing dialog could flicker and fail with a cryptic error** - an unrelated re-render of the player bar could re-trigger the pairing dialog's start step, firing another pairing attempt at the device while the first one was still in progress. The device can only handle one at a time, so the losing attempt(s) failed. The dialog now only starts pairing once per device, and the backend also guards against overlapping attempts for the same device as a second safety net.
- **Desktop app auto-updater's alpha/beta channels pointed at upstream Feishin** - inherited from upstream and never adapted for the fork, the "beta" channel published to and checked `jeffvli/feishin`'s own GitHub releases, and "alpha" checked a mismatched, non-functional S3 endpoint. Either could have silently downloaded and installed an upstream build, overwriting the Connect feature. Both channels (and the release-channel picker in Settings) are removed - see "Desktop app auto-updater" above.
- **Connect was unusable on mobile** - the cast button was missing from the mobile player bar entirely (it only appeared by accident in landscape, when the layout happened to switch to the desktop one), and the device popover had no height limit or scrolling, so on short screens only the last few devices were visible with no way to reach the rest. The cast button is now part of the mobile player bar (mobile play/pause now also controls the connected device), and the popover is capped to the available screen height and scrolls when needed.

### Internal
- **Reorganized the Connect backend's directory layout** - `connect/` now only holds the files Python packaging tools expect at the project root (`main.py`, `pyproject.toml`, `uv.lock`, `.env.example`). Shared app infrastructure (auth, runtime state, the FFmpeg streamer) moved into `connect/core/`, and the PyInstaller build script + spec moved into `connect/packaging/`. No behavior change.
- **Extracted playback position tracking into its own `PlaybackClock` class** (`connect/core/playback_clock.py`) - the wall-clock/seek/buffering-offset math used to be six loosely related fields on the shared app state, independently re-derived across `/play`, `/pause`, `/resume`, `/seek` and the device-buffering calibration task. Now covered by 20 focused unit tests. No behavior change.
- **Updated backend dependencies** - routine bump of all Python packages (FastAPI, uvicorn, pyatv, SoCo, cryptography, etc.) to their latest compatible versions. Also added `httpx2` as a dev dependency, which the bumped starlette now prefers for its test client; test-only, no change to the `httpx` used for actual HTTP requests at runtime.

## [0.4.0] - 2026-06-20

### Added
- **Hourly device rescan** — Connect now automatically rescans for Sonos, AirPlay and Chromecast devices once an hour in the background. Newly available devices show up without having to manually hit "Scan again", and devices that are no longer reachable drop out of the list.
- **Remote lyrics lookup in the web/Docker build** — fetching lyrics from the internet (lrclib.net, SimpMusic, NetEase) has so far only worked via IPC in the Electron app, in both upstream and this fork; the web/Docker build (this fork only) could so far only show lyrics already stored on the media server. A new Connect backend lyrics module (`/lyrics/search`, `/lyrics/auto`, `/lyrics/by-remote-id`) now brings remote lyrics lookup to the web build too. Genius is not available in the web build — it requires HTML scraping that doesn't fit the Connect backend's lightweight setup, so it remains Electron-only.
- **Manual lyrics search, clear/refresh and translation now available in the web/Docker build** — these actions, and the related lyrics settings, were hidden outside of Electron because they depended on IPC. They now use the new Connect backend endpoints above and behave the same as in the desktop app.
- **Loading indicator for background lyrics lookups** — with "prefer local lyrics" enabled, a remote lyrics search now still runs in the background when local lyrics exist. A small spinner now shows while that lookup is in progress.
- **ReplayGain now applies to Connect playback on Sonos and Chromecast** — your existing ReplayGain settings (Settings → Playback) are now also applied when streaming to Sonos or Chromecast via Connect, matching the volume normalization already used for local playback. AirPlay is not covered yet, since it streams directly from the media server without going through Connect's ffmpeg pipeline.

### Fixed
- **Switching to a radio station while streaming to a Connect device left the playerbar and lyrics showing the previous track** — the radio switch used to fully stop local radio playback, which made the app think radio mode had ended, so the UI fell back to the last queued track (and re-enabled lyrics for it). The radio is now only paused locally, so the playerbar keeps showing the radio station and lyrics stay hidden while it plays on the Connect device.
- **Connect popover polish** — on AirPlay devices, the "Pair"/"Unpair" button is now only shown on hover (the device name uses the full row width otherwise) without the row jumping in height; the hover highlight now also covers the volume slider; and the "Connect"/"Add" button animates in/out instead of appearing abruptly.
- **Lyrics not found on lrclib.net were never retried** — "not found" results were cached indefinitely, including across reloads and restarts (persisted query cache), so a track without lyrics on first try would never be looked up again — even after lrclib.net added them later. Such results are now retried automatically after 24 hours, and previously cached "not found" results from before this fix are invalidated once.

### Changed
- **Easier to read backend logs** — log output is now more consistent and less cluttered with noise that wasn't useful day-to-day, making it easier to spot real problems when something goes wrong.
- **Docker: container now restarts if nginx or the backend crashes** — previously the container could stay up in a broken state if either process died unexpectedly. Now the container exits as soon as one of them crashes, so `restart: unless-stopped` actually restarts it.
- **Docker: added a health check** — the container now reports its health status (visible in `docker ps`), so it's easier to spot when the app is unresponsive even if it hasn't crashed.
- **Windows app identity changed** — the desktop app now identifies itself to Windows as `io.github.mihaitom.feishin-connect` instead of upstream's `org.jeffvli.feishin`, matching this fork's app ID. As a side effect, Windows treats this as a different app: the taskbar pin/grouping and notification settings from a previous install won't carry over and may need to be set up again.

### Removed
- Internal `publish.py` script and `package-lock.json` — the project is now fully on pnpm.

### Internal
- **Added a frontend test suite (Vitest)** covering the Connect player components — token/URL handling, the elapsed-time animation, auto-forward on track/radio changes, track-ended detection, scrobble triggers and server config mapping — plus the fork's other changes to upstream code: the Connect-backend lyrics fallback (`lyrics-api.ts`) and the library-scan store. A new CI workflow runs these tests on every push and PR, giving a quick signal on what still works after future upstream merges.

---

## [0.3.1] - 2026-06-13

### Added
- **Nicer AirPlay pairing dialog** — the pairing window now matches Feishin's look and feel, with clear status icons and a "Try again" button that lets you re-enter the PIN if it was wrong.
- **Unpair AirPlay devices** — paired AirPlay 2 devices now show an "Unpair" button (with a confirmation prompt) so you can remove a pairing without digging into config files.
- **Synced lyrics in Connect mode** — the lyrics view now follows along during remote playback, using the Connect device's playback position. Clicking a line seeks the Connect device to that point.
- **Lyrics sync accounts for device buffering delay** — Sonos and Chromecast now report their real playback position, measured once shortly after a track starts, so the reported elapsed time matches what's actually audible. AirPlay has no such feedback, so a fixed 2-second offset is applied instead.
- **Now-Playing metadata for Sonos and Chromecast** — Sonos and Chromecast now show the track title, artist and album art on the device itself (e.g. on a TV screen or the Sonos app), not just a generic "Connect" label.

### Known limitations
- **No audio visualizer in Connect mode** — the visualizer needs a live audio signal from the Web Audio API to analyze. In Connect mode, audio is streamed directly from the Connect backend to the target device (AirPlay/Sonos/Chromecast) and never passes through the app's audio engine, so there's no signal to visualize. Lyrics work because they only need playback position, not the audio itself.

### Fixed
- **Long tracks restarted from the beginning during remote playback** — on long tracks, the audio player sometimes jumped back to the very start instead of continuing. This is fixed now.
- **Confusing AirPlay pairing errors** — entering a wrong PIN used to show a generic error mentioning Sonos and MFi devices, which made no sense if you were pairing a HomePod or AirPort Express. It now simply says the PIN was incorrect and lets you try again.
- **AirPlay pairing got stuck after reopening the dialog** — closing and reopening the pairing window (or reloading the app) while a pairing was in progress could make the device refuse all further attempts until it was power-cycled. This no longer happens.
- **German UI text was only capitalized on the first letter** — some translated texts (e.g. in the AirPlay pairing and device list) ignored German capitalization rules for nouns. Affected texts are now shown exactly as translated.

---

## [0.3.0] - 2026-06-07

### Added

- **Token-based auth for the Connect API** — the Connect API is now always protected by a secret token. In Electron, a random token is generated at startup and injected into the renderer automatically — secure by default, no config required. In Docker, nginx forwards the token transparently so the browser never handles it directly. Set `CONNECT_TOKEN` in `docker-compose.yaml` to a custom secret; without it, a publicly known default is used (blocks anonymous scanners but not targeted attacks — change it).
- **CORS restricted to known origins** — browser access to the Connect API is limited to `localhost` (development) and Electron's `file://` origin. Set `ALLOWED_ORIGINS` to a comma-separated list for custom deployments.
- **`/stream` deliberately left open** — `GET` and `HEAD /stream` require no token so Sonos, AirPlay and Chromecast devices can always pull audio. CORS does not apply to hardware devices.
- **13 new auth tests** — `tests/test_auth.py` covers open vs. protected endpoints, missing/wrong token (header and `?token=` query param), and the SSE rejection path.
- **In-track seeking in Connect mode** — the progress slider in the player bar is now interactive when a Connect device is active. Dragging and releasing sends a `POST /seek` request to the backend, which restarts playback from the chosen position. The slider freezes during the seek and unlocks automatically once the backend confirms. Sonos and Chromecast seek via FFmpeg `-ss` on the stream endpoint; AirPlay re-downloads from the seek position using `ffmpeg -ss` before passing the audio to pyatv.
- **AirPlay: radio stream support** — AirPlay can now stream radio stations. Previously the delivery always required a track from the media server and silently ignored radio URLs; they are now passed directly to pyatv's `stream_file`.

### Fixed

- **Radio via Connect: switching to a radio station played a queue track instead** — when `stopRadio()` was called inside the auto-forward effect to silence local playback, it synchronously cleared `isRadioActive`. On the next render the track effect saw `isRadioActive = false` and, with `lastAutoSentRef` empty, immediately sent the queue track to `/play` on top of the radio URL already dispatched to `/play-url`. The ref is now set to the current song ID so the track effect treats it as already-sent and skips.
- **AirPlay: "not connected to remote" no longer logged as ERROR** — when the Apple TV drops the audio connection, pyatv already logs the real cause (`Connection refused`) itself. The subsequent `RuntimeError: not connected to remote` thrown during RTSP teardown is now caught and downgraded to a warning.

### Changed

- **Connect backend restructured into packages** — `delivery.py` split into a `delivery/` package (`airplay`, `sonos`, `chromecast`, `manager`, `credentials`, `base`); `media.py`, `subsonic.py` and `jellyfin.py` merged into a `media/` package. All existing imports remain backwards-compatible via `__init__.py` re-exports.
- **`NAVIDROME_INTERNAL_URL` renamed to `SERVER_INTERNAL_URL`** — the proxy works for Navidrome, Subsonic and Jellyfin alike, so the variable name no longer made sense. The old name is still accepted as a fallback — existing deployments need no changes.
- **Default Connect API port changed from 8765 to 9181** — places it adjacent to Feishin's nginx port (9180) for easier firewall rules. Update any custom port mappings in `docker-compose.yaml` if you pinned the old port.
- **Electron: dynamic port selection** — instead of always binding to port 9181, the Electron app now picks a free port automatically at startup. This avoids conflicts if 9181 is already in use on the host. The port is injected into the renderer via `window.__CONNECT_URL__` — no manual configuration is needed.

### Removed

- `connect/sonos_ctrl.py` — legacy file not imported anywhere; replaced by `SonosDelivery` in `delivery/sonos.py` since v0.2.0.

---

## [0.2.5] - 2026-06-06

### Added

- **Library scan progress & completion feedback (Navidrome / Subsonic)** — the Scan Library action now polls the server via a new `getScanStatus` endpoint. The menu entry shows a spinner labelled "Scanning library…" for the entire scan (previously the loading state only covered the brief start request), and a toast reports when the scan finishes. The scan state lives in a global store, so the spinner and the completion toast survive the server-selector menu being closed and reopened mid-scan.
- **Always-available device rescan in Connect** — the "Scan again" control in the Connect (cast) popover is now always visible (not only when no devices were found) and shows a spinner while a fresh scan runs. The empty state shows "Scanning for devices…" and the "Send to" header is hidden until devices are present.
- **`airplay_probe.py`** — a standalone scan / pair / stream diagnostic script that mirrors the Connect delivery path, for reproducing AirPlay streaming issues without running the full app.

### Changed

- **`DEBUG` environment variable replaces `PYATV_DEBUG`** — set `DEBUG=true` (parsed as a boolean: `true`/`1`/`yes`/`on`) to surface verbose protocol/playback logs across every renderer at once — AirPlay (pyatv), Sonos (SoCo) and the app's own delivery/streamer/playback loggers — instead of AirPlay only. `PYATV_DEBUG` has been removed.
- **Connect "Scan again" forces a fresh scan** — the discovery endpoint now awaits a full rescan when explicitly requested instead of immediately returning cached results, so the spinner reflects the real scan duration and devices that have gone offline drop out of the list.

---

## [0.2.4] - 2026-06-05

### Fixed

- **AirPlay playback (Feishin Connect)** — devices paired and connected but no audio played. The AirPlay stream task referenced `ctx.state.current_tracks`, a leftover from before the playback state was simplified to a single `current_track`, raising `AttributeError: 'AppState' object has no attribute 'current_tracks'` right after the stream task started. Now reads `current_track`.
- **Sonos speakers no longer offered as AirPlay targets** — Sonos devices advertise AirPlay 2 but require MFi hardware authentication that pyatv cannot perform, so streaming to them via AirPlay failed (device refused the audio port). They are now filtered out of AirPlay discovery and must be used via the native Sonos output, where they already appear.
- **AirPlay startup delay** — playback to an AirPlay device took ~20s to start because every play did a full ~10s mDNS network scan to locate the device. It now does a targeted unicast scan to the IP from the last discovery, returning as soon as the device replies (~ms), with a full-scan fallback if the cached IP is missing or stale.
- **AirPlay 2 credentials applied to RAOP** — paired-device credentials were only set on the AirPlay (HAP) protocol, not on RAOP which carries the actual audio. Both are now set, so encrypted receivers (HomePod, Apple TV) don't refuse the audio connection.

### Added

- **`PYATV_DEBUG` environment variable** — when set, surfaces pyatv's full protocol negotiation (AirPlay version, encryption, RTSP exchange, ports) to aid diagnosing AirPlay issues.

### Changed

- **Merged upstream Feishin v1.13.0**

---

## [0.2.3] - 2026-05-30

### Added

- **Scan Library button for Navidrome / Subsonic** — accessible via the server selector dropdown in the sidebar (bottom-left). Triggers an immediate library scan via the `startScan` Subsonic API endpoint. Also available in Settings → Manage Servers for the desktop app. Shows a loading indicator while in flight and a toast on success or failure. Not shown for Jellyfin servers.

### Fixed

- **Favoriting / unfavoriting songs in playlists (Subsonic)** — starring a track from the playlist view sent the wrong item ID, so the favorite never registered on the server.

### Changed

- **Merged upstream Feishin v1.12.1**

---

## [0.2.2] - 2026-05-26

### Fixed

- **Scrobble tracks played via Feishin Connect** — the local scrobble flow in `use-scrobble.ts` was gated on `PlayerStatus.PLAYING`, but Connect force-pauses the local player, so listen time never accumulated and no `scrobble.view` call ever reached the server. New `use-connect-scrobble.ts` hook fires `submission: false` (now-playing) on track start and `submission: true` when the Connect backend signals `ended=true` (track played to completion). Mid-track skips are intentionally not scrobbled, matching Last.fm conventions.

### Changed

- **Merged upstream Feishin v1.12.0** — 49 upstream commits since the previous base, including React 19.2, React Router 7.14, React Query 5.96, MPV settings improvements, and a long tail of bug fixes and translations.
- **Track upstream version explicitly** — new `feishinUpstreamVersion` field in `package.json` records which upstream Feishin release we're built on, updated each time we merge upstream.

---

## [0.2.1] - 2026-05-16

### Added

- **Jellyfin support for Feishin Connect** — Connect now works with Jellyfin servers in addition to Navidrome / Subsonic / OpenSubsonic. The backend picks the right client based on the new `server_type` field in `/config`; the frontend forwards the server type and Jellyfin user ID automatically. Tracks are streamed via Jellyfin's `/Items/{id}/Download` endpoint (raw file, FFmpeg handles transcoding downstream to Sonos / AirPlay / Chromecast).
- **`JellyfinClient` + `MediaClient` protocol** — common interface (`get_track`, `get_stream_url`, `get_cover_art_url`, `ping`) shared by `SubsonicClient` and the new `JellyfinClient` so the rest of the backend stays server-agnostic. `Track` moved to `media.py`.
- **12 new pytest tests** covering the Jellyfin client (URL building, track parsing, auth header, ping, user-id validation) and the `/config` server-type switching.

---

## [0.2.0] - 2026-05-15

### Changed

- **Single-track streaming instead of playlist streaming** — Connect no longer pushes the whole queue to the backend at once. Each track is streamed individually, and the next one is sent automatically when the previous finishes. This makes shuffle / repeat / manual skips behave correctly on the remote and removes the need to re-sync the queue when it changes locally.
- **Upstream player UI reused for transport controls** — play, pause, next, previous, shuffle, repeat and stop now go through Feishin's existing playerbar controls. When Connect is active, the same buttons drive the remote stream instead of local playback (via `useConnectPlayback` and the `connect.store` handlers wired through `useConnectSession`). No more parallel control surface inside the Connect popover.

### Added

- **Chromecast (Google Cast) support** — stream to any Chromecast device on the network alongside Sonos and AirPlay. Discovery, playback, per-device volume, mid-stream join, and selective stop all work the same way as the other backends. A long-lived `CastBrowser` keeps zeroconf alive for the process lifetime so reconnects after network blips don't fail.
- **Connect popover refactor** — `connect-button.tsx` was split into focused modules: `connect-popover.tsx`, `connect-session-context.ts`, `use-connect-session.ts`, `use-connect-playback.ts`, and a dedicated Zustand `connect.store.ts`. The pairing modal is now i18n-aware and shows user-friendly error messages.
- **Backend test suite** — ~115 pytest tests covering `DeliveryManager` parsing and fan-out, all three delivery classes (Sonos, AirPlay, Chromecast), `/discover`, `/device-volume`, `/device-stop`, `/join`, credentials persistence and the Navidrome proxy. Runs in under a second without any real devices.

### Fixed

- **Local + remote double audio during auto track switch** (~20% of the time, Docker only) when **Crossfade** or **Gapless** transitions were enabled in playback settings. The crossfade and gapless handlers in the web player called `audio.play()` imperatively on the next player element, bypassing the status-based safety net. Both handlers now bail out early when Connect is active, eliminating any path for the local player to emit audio while a remote stream is running.
- **Local player runaway after Connect's track-end advance** — added a safety net that subscribes to the player store and pauses immediately if anything flips local status to `PLAYING` while Connect is active. Catches edge cases (MediaSession API calls, hotkeys, queue mutations) that the explicit `mediaPause()` calls miss.
- Connect i18n keys restored after upstream locale restructuring.

### Internal

- All remaining German log messages and code comments in the Python backend translated to English for consistency.
- `__pycache__` and `.pyc` files now gitignored.

### Known issues

- **AirPlay 1 (RAOP) verified** on AirPort Express hardware. **Sonos devices with AirPlay 2** require MFi hardware authentication (proprietary implementation) which pyatv cannot provide — the backend returns HTTP 470 with a clear message. Use Sonos speakers via the Sonos protocol instead.

---

## [0.1.3] - 2026-05-10

### Added

- **AirPlay 2 Pairing** — AirPlay devices that require authentication (HomePod, Apple TV) can now be paired via a one-time flow. A "Pair" button appears on hover next to unpaired AirPlay devices in the Connect popover. After pairing, credentials are stored persistently in `airplay_credentials.json` next to the backend and reused on every subsequent connection. Devices can be unpaired via `DELETE /pair/airplay/{name}`.
- **AirPlay track prefetch** — While a track is playing on an AirPlay device, the next track is downloaded in the background. This eliminates the silence gap between tracks that occurred when downloads happened sequentially.

### Fixed

- AirPlay: fixed `failed to init decoder` error caused by pyatv's `InternetSource` timing out after ~10 seconds when downloading audio from Navidrome. The backend now downloads each track via httpx (with a proper timeout) and passes complete audio data to pyatv as `BytesIO`.
- AirPlay: fixed `Response content longer than Content-Length` proxy error by stripping `Content-Length` and `Content-Encoding` headers and forcing `Accept-Encoding: identity` on proxied requests.
- AirPlay: fixed race condition when two `POST /play` requests arrived simultaneously — an `asyncio.Lock` now serializes `play()` setup, preventing both tasks from sharing or closing each other's device connection.
- AirPlay: captured device connection at task-creation time so the `finally` block always closes the correct connection even if `self._atv` is replaced by a subsequent `play()` call.

### Known issues

- **AirPlay 1 (RAOP) verified** on AirPort Express hardware. **Sonos devices with AirPlay 2** require MFi hardware authentication (proprietary implementation) which pyatv cannot provide — the backend returns HTTP 470 with a clear message. Use Sonos speakers via the Sonos protocol instead.

---

## [0.1.2] - 2026-05-10

### Added

- **Navidrome-Proxy** — The Connect backend now proxies all Navidrome API calls (`/rest/`, `/auth/`, `/api/`). This allows Feishin to work when Navidrome is behind an SSO layer (e.g. Authentik forward auth via Traefik) that would otherwise block direct browser-to-Navidrome requests. Set `SERVER_INTERNAL_URL` to the internal Navidrome address (e.g. `http://10.x.x.x:4533`) to enable the proxy; the backend then reaches Navidrome directly on the internal network, bypassing the SSO middleware entirely. See the Docker section in the README for details.
- **`CONNECT_URL` Docker default** — `CONNECT_URL` now defaults to `/api` in the Docker image. Previously it fell back to `http://localhost:9181`, which caused CORS errors when accessing Feishin remotely (the browser tried to reach the backend on the user's local machine instead of the server).

### Fixed

- Proxy streaming: removed `Content-Length` forwarding to prevent `Response content longer than Content-Length` errors caused by httpx automatically decompressing gzip responses from Navidrome while forwarding the compressed size header.

### Notes

- **Electron version unaffected** — The Electron app talks to Navidrome directly and never routes through the Connect backend proxy. `SERVER_INTERNAL_URL` is irrelevant for Electron; leaving it unset makes the backend behave exactly as before.

### Known issues

- **AirPlay 1 (RAOP) verified** on AirPort Express hardware. AirPlay 2 pairing is implemented but has device-specific limitations: Apple devices (HomePod, Apple TV) support HAP pairing via pyatv; **Sonos devices require MFi hardware authentication** (proprietary Sonos AirPlay 2 implementation) which pyatv cannot provide — Sonos speakers must be used via the Sonos protocol instead. The backend returns a clear error message (HTTP 470) when MFi auth is required.

---

## [0.1.1] - 2026-05-09

### Added

- **Playback intercept** — selecting a track in Feishin while a device is active now automatically forwards it to the connected device instead of playing locally. Switching to a radio station while casting also routes it to the device.
- **About dialog** — Help menu now has an "About Feishin Connect" entry that shows version info and credits the upstream [Feishin](https://github.com/jeffvli/feishin) project.

### Fixed

- Release notes and update links now point to this fork instead of the upstream project.
- Devices in the cast popover are now sorted: Sonos first, AirPlay second, alphabetically within each group.

### Known issues

- **AirPlay 2 requires pairing** — see 0.1.2 Known issues above.

---

## [0.1.0] - 2026-05-09

This is the initial release of **Feishin Connect**, a fork of [jeffvli/feishin](https://github.com/jeffvli/feishin) that adds Spotify Connect-like casting to Sonos speakers and AirPlay devices — directly from the Feishin player bar.

### What's new

**Feishin Connect** adds a cast button to the player bar. Click it to stream the current Navidrome queue — or a radio stream — to any Sonos or AirPlay device on your network, without interrupting anything else.

- Stream to one or multiple Sonos / AirPlay devices simultaneously
- Sonos multiroom grouping — devices play in sync
- Per-device volume control with hover slider
- Play / pause / previous / next controls in the popover
- Radio stream support — sends the live URL directly to the device
- Persistent state — Connect keeps running if you reload Feishin in the browser
- Local playback pauses automatically when handing off to a device

### How it works

A Python / FastAPI backend runs alongside nginx in the same Docker container. It receives Navidrome credentials automatically from Feishin on startup. Feishin fetches the stream from Navidrome, re-encodes it via FFmpeg into a continuous MP3 stream, and pushes it to Sonos (UPnP / SoCo) or AirPlay (pyatv / RAOP) devices.

> This fork was developed with heavy AI assistance. Expect rough edges — please open an issue if you run into problems.

All upstream Feishin features are preserved.
