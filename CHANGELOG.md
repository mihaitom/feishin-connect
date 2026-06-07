# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
