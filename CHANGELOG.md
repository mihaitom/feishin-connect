# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

- **Navidrome-Proxy** — The Connect backend now proxies all Navidrome API calls (`/rest/`, `/auth/`, `/api/`). This allows Feishin to work when Navidrome is behind an SSO layer (e.g. Authentik forward auth via Traefik) that would otherwise block direct browser-to-Navidrome requests. Set `NAVIDROME_INTERNAL_URL` to the internal Navidrome address (e.g. `http://10.x.x.x:4533`) to enable the proxy; the backend then reaches Navidrome directly on the internal network, bypassing the SSO middleware entirely. See the Docker section in the README for details.
- **`CONNECT_URL` Docker default** — `CONNECT_URL` now defaults to `/api` in the Docker image. Previously it fell back to `http://localhost:8765`, which caused CORS errors when accessing Feishin remotely (the browser tried to reach the backend on the user's local machine instead of the server).

### Fixed

- Proxy streaming: removed `Content-Length` forwarding to prevent `Response content longer than Content-Length` errors caused by httpx automatically decompressing gzip responses from Navidrome while forwarding the compressed size header.

### Notes

- **Electron version unaffected** — The Electron app talks to Navidrome directly and never routes through the Connect backend proxy. `NAVIDROME_INTERNAL_URL` is irrelevant for Electron; leaving it unset makes the backend behave exactly as before.

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
