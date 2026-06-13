<img src="assets/icons/icon.png" alt="logo" title="feishin" align="right" height="60px" width="60px" />

# Feishin — Connect Fork

> **This is a fork of [jeffvli/feishin](https://github.com/jeffvli/feishin).** Currently built on upstream **v1.13.0**.
> It adds **Feishin Connect** — a Spotify Connect-like feature that streams your music library (Navidrome, Subsonic / OpenSubsonic, or Jellyfin) to Sonos, AirPlay and Chromecast devices directly from the player bar.
> All upstream features are preserved.

  <p align="center">
    <a href="https://github.com/jeffvli/feishin/blob/main/LICENSE">
      <img src="https://img.shields.io/github/license/mihaitom/feishin-connect?style=flat-square&color=brightgreen"
      alt="License">
    </a>
      <a href="https://github.com/jeffvli/feishin/releases">
      <img src="https://img.shields.io/github/v/release/mihaitom/feishin-connect?style=flat-square&color=blue"
      alt="Release">
    </a>
  </p>

---

## Feishin Connect

Feishin Connect adds a cast button to the player bar. Click it to stream the current queue — from Navidrome, Subsonic / OpenSubsonic, or Jellyfin — or a radio stream to any Sonos speaker, AirPlay or Chromecast device on your network, without touching the local player.

<img src="assets/feishin-connect-screenshot.png" width="350px">

## Development Notes

This fork was developed heavily with AI assistance, especially the Connect backend and streaming integration.
Please expect rough edges and report issues if you encounter them.

### How it works

- A **Python / FastAPI** backend runs alongside nginx in the same Docker container.
- It receives media server credentials (Navidrome / Subsonic / Jellyfin) automatically from Feishin on startup — no manual config.
- For Sonos and Chromecast, the backend re-encodes the media server stream via **FFmpeg** into a continuous MP3 stream the devices pull over HTTP.
- **Sonos** devices are controlled via UPnP (SoCo) and pull the stream over HTTP.
- **AirPlay** devices are fed via pyatv / RAOP — the track is downloaded directly from the media server and pushed to the device (no FFmpeg involved).
- **Chromecast** devices are controlled via pychromecast and pull the stream over HTTP.

### Features

- Stream the current queue to one or multiple Sonos / AirPlay / Chromecast devices simultaneously
- Sonos multiroom grouping (devices play in sync)
- Per-device volume control with a hover slider (Sonos and Chromecast)
- Play/pause/previous/next controls in the popover (operated on the remote device)
- In-track seeking — drag the progress slider to seek within the current track on the remote device
- Radio stream support (sends the live URL directly to the device)
- Synchronized lyrics follow along during remote playback, compensating for each device's buffering delay
- Now-Playing metadata (title, artist, album art) shown on Sonos and Chromecast devices
- Persistent state — Connect continues if you reload Feishin in the browser
- Local playback pauses automatically when handing off to a device (Crossfade and Gapless transitions are also disabled locally while Connect is active to prevent double-audio)

### Docker (recommended)

> **`network_mode: host` is required.** The Connect backend discovers Sonos, AirPlay and Chromecast devices via mDNS/SSDP multicast, which only works when the container shares the host's network stack. Without it, no devices will be found. Host networking is Linux-only — on Mac or Windows, run the backend natively.

```yaml
services:
    feishin:
        container_name: feishin
        image: "ghcr.io/mihaitom/feishin-connect:latest"
        restart: unless-stopped
        network_mode: host
        environment:
            - SERVER_NAME=navidrome
            - SERVER_TYPE=navidrome
            - SERVER_URL=http://your-navidrome:4533
            - SERVER_LOCK=false
            - ANALYTICS_DISABLED=true
            - CONNECT_TOKEN=change-me-to-a-random-secret
            # - SERVER_INTERNAL_URL=http://10.x.x.x:4533
            # - DEBUG=false
```

| Port | Service |
|------|---------|
| 9180 | Feishin web UI (nginx) |
| 9181 | Connect API (FastAPI, also reachable via `/api/` through nginx) |

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CONNECT_TOKEN` | *(public default)* | Secret token protecting the Connect API on port 9181. **Change this** to a random string — the built-in default is publicly known (open source) and only blocks anonymous scanners. nginx adds the token to every internal request automatically; the browser never handles it directly. In Electron, a random token is generated at startup instead. |
| `CONNECT_URL` | `/api` | URL the browser uses to reach the Connect API. The default (`/api`) routes through nginx on the same domain — no CORS issues, no extra config needed. Change to `http://host:9181` only if you need direct access to the backend, bypassing nginx. |
| `SERVER_INTERNAL_URL` | — | Internal media server address for the backend proxy (e.g. `http://10.x.x.x:4533`). Only needed when the media server sits behind an SSO layer that the browser cannot bypass. See [Media server behind SSO](#media-server-behind-sso-authentik-etc) below. With `network_mode: host`, use the actual IP — Docker container names do not resolve in host network mode. The old name `NAVIDROME_INTERNAL_URL` is still accepted as a fallback. |
| `ALLOWED_ORIGINS` | — | Extra CORS origins for the Connect API, comma-separated. **Not needed in standard Docker deployments**: when the browser and the API share the same domain via nginx, all requests are same-origin and CORS never applies. Only relevant if the backend is accessed from a different origin than the page (e.g. backend running standalone, frontend on a separate domain). |
| `SERVER_URL` | — | Media server URL (Navidrome / Subsonic / Jellyfin) shown to the browser |
| `SERVER_NAME` | — | Pre-configured server name shown in Feishin |
| `SERVER_TYPE` | — | `navidrome`, `jellyfin`, or `subsonic` |
| `SERVER_LOCK` | `false` | When `true`, only username and password can be changed in the UI — server name, type and URL are fixed |
| `DEBUG` | `false` | When `true`, enables verbose playback logs across all renderers (AirPlay via pyatv, Sonos via SoCo, internal streamer) |

### Requirements

- Navidrome, Subsonic / OpenSubsonic-compatible server, or Jellyfin
- Sonos, AirPlay and/or Chromecast devices on the same network as the Docker host
- Docker host on Linux (host networking is Linux-only; Mac/Windows users need to run the backend natively)

### Electron (desktop app)

The Connect backend starts and stops automatically alongside the Electron app — no separate Python installation required in the packaged build. The backend port is selected dynamically at startup (starting from 9181), so it never conflicts with other services already using that port.

**Development** (Python + uv required):

```bash
npm run dev        # Electron starts and spawns the backend via `uv run python main.py`
```

**Packaging** (build once per platform before `npm run package`):

```bash
npm run build:connect   # compiles the Python backend to a standalone binary via PyInstaller
npm run package:linux   # builds the Electron app; the binary is bundled automatically
```

The binary lives in `connect/dist/connect-server/` and is picked up by `electron-builder` via `extraResources`. Users need **ffmpeg** installed on their system (`apt install ffmpeg` / `brew install ffmpeg`) — it is not bundled.

When you quit the app, it sends a stop command to the backend and kills the process so all connected devices stop playing.

### Building locally (Docker image)

```bash
./build.sh <registry> <namespace> <image-name>
# example:
./build.sh ghcr.io myuser feishin-connect
```

Or for web development:

```bash
# Frontend
npm install
npm run dev:web

# Backend (separate terminal)
cd connect
uv sync
uv run python main.py
```

---

## Media server behind SSO (Authentik etc.)

If your media server (Navidrome, Subsonic, or Jellyfin) is protected by an SSO layer (e.g. Authentik forward auth via Traefik/nginx), the browser cannot reach its API directly — every request is intercepted and redirected to the SSO login page.

Feishin Connect solves this with a built-in **backend proxy**: all media server API calls are routed through the Connect backend, which reaches the server on the internal network, bypassing the SSO middleware entirely.

**Setup:**

1. Set `SERVER_INTERNAL_URL` to the internal address where the media server is reachable without SSO:
   ```yaml
   - SERVER_INTERNAL_URL=http://10.x.x.x:4533
   ```
   With `network_mode: host`, use the actual IP — Docker container names don't resolve in host network mode.

2. Set `SERVER_URL` to the **Feishin Connect** URL (not the media server's URL):
   ```yaml
   - SERVER_URL=https://feishin.example.com
   ```
   Feishin will now call `feishin.example.com/rest/`, `feishin.example.com/auth/login`, etc., which nginx proxies to the Connect backend, which forwards internally to the media server.

3. The media server itself no longer needs to be reachable from the browser at all — Feishin Connect acts as the only entry point to its API.

**Security:** The Connect API (port 9181) is protected by `CONNECT_TOKEN`. nginx forwards it automatically, so the browser never handles it. Media server traffic is authenticated via Subsonic token/password or Jellyfin API key as usual — the proxy is transparent. How port 9180 is secured (firewall, SSO, etc.) is up to the deployment.

**Note:** This proxy is not needed if the media server is publicly reachable or on the same network as the browser. In that case, set `SERVER_URL` directly to the media server URL and leave `SERVER_INTERNAL_URL` unset.

---


## Upstream: Feishin

Rewrite of [Sonixd](https://github.com/jeffvli/sonixd). Original project by [@jeffvli](https://github.com/jeffvli).

### Features

- [x] MPV player backend
- [x] Web player backend
- [x] Modern UI
- [x] Scrobble playback to your server
- [x] Smart playlist editor (Navidrome)
- [x] Synchronized and unsynchronized lyrics support
- [x] **Stream to Sonos / AirPlay / Chromecast via Feishin Connect** *(this fork)*
- [ ] [Request a feature](https://github.com/jeffvli/feishin/issues) or [view taskboard](https://github.com/users/jeffvli/projects/5/views/1)

### Screenshots

<a href="./media/preview_full_screen_player.png"><img src="./media/preview_full_screen_player.png" width="49.5%"/></a> <a href="./media/preview_album_artist_detail.png"><img src="./media/preview_album_artist_detail.png" width="49.5%"/></a> <a href="./media/preview_album_detail.png"><img src="./media/preview_album_detail.png" width="49.5%"/></a> <a href="./media/preview_smart_playlist.png"><img src="./media/preview_smart_playlist.png" width="49.5%"/></a>

### Getting Started

#### Desktop (recommended)

Download the [latest desktop client](https://github.com/jeffvli/feishin/releases) from the upstream project. The desktop client supports both the MPV and web player backends and includes built-in lyrics fetching.

> **Note:** Feishin Connect is only available in the Docker / web build of this fork, not in the upstream desktop client.

#### macOS Notes

If you're using a device running macOS 12 (Monterey) or higher, [check here](https://github.com/jeffvli/feishin/issues/104#issuecomment-1553914730) for instructions on how to remove the app from quarantine.

For media keys to work, you will be prompted to allow Feishin to be a Trusted Accessibility Client. After allowing, you will need to restart Feishin for the privacy settings to take effect.

#### Linux Notes

Feishin is available in [Flathub](https://flathub.org/en/apps/org.jeffvli.feishin).

Alternatively, install it as an AppImage:

```sh
dir=/your/application/directory
curl 'https://raw.githubusercontent.com/jeffvli/feishin/refs/heads/development/install-feishin-appimage' | sh -s -- "$dir"
```

### Configuration

1. Upon startup you will be greeted with a prompt to select the path to your MPV binary. If you do not have MPV installed, you can download it [here](https://mpv.io/installation/). After inputting the path, restart the app.

2. After restarting, select a server via `Open menu → Manage servers → Add server`. Enter the full URL including protocol and port (e.g. `https://navidrome.my-server.com`).

- **Navidrome** — For the best experience, select "Save password" when creating the server and configure `SessionTimeout` to a larger value (e.g. `72h`) in your Navidrome config.

3. _Optional_ — Host on a subpath by setting `PUBLIC_PATH=/your-path`.

4. _Optional_ — Pre-configure the server via `SERVER_NAME`, `SERVER_TYPE`, `SERVER_URL`, and `SERVER_LOCK=true`.

5. _Optional_ — Set `REMOTE_URL` if your server uses a separate public-facing URL.

6. _Optional_ — Disable analytics with `ANALYTICS_DISABLED=true`.

7. _Optional_ — Override app defaults with `FS_`-prefixed environment variables on first run. See [the settings environment variable documentation](docs/ENV_SETTINGS.md).

## Differences from upstream

| Feature | This fork | Upstream |
|---------|-----------|----------|
| Feishin Connect (Sonos / AirPlay / Chromecast) | ✅ | ❌ |
| Auto-updater | ❌ disabled | ✅ GitHub Releases |
| Docker image | `ghcr.io/mihaitom/feishin-connect` | `ghcr.io/jeffvli/feishin` |

The auto-updater is disabled in this fork. It would otherwise pull releases from `jeffvli/feishin` and overwrite the Connect feature. Update by pulling the latest image (`docker pull`) or rebuilding from source.

---

## FAQ

### MPV is either not working or is rapidly switching between pause/play states

Check that your MPV binary path is correct in Settings. Known working versions: `v0.35.x` and `v0.36.x`. `v0.34.x` is broken.

### What music servers does Feishin support?

Feishin supports any music server implementing [Navidrome](https://www.navidrome.org/), [Jellyfin](https://jellyfin.org/), or an [OpenSubsonic compatible](https://opensubsonic.netlify.app/) API.

- [Navidrome](https://github.com/navidrome/navidrome)
- [Jellyfin](https://github.com/jellyfin/jellyfin)
- OpenSubsonic compatible: Airsonic-Advanced, Ampache, Astiga, Funkwhale, Gonic, LMS, Nextcloud Music, Supysonic, Qm-Music, and more

### Feishin Connect: ffmpeg required

Feishin Connect uses **ffmpeg** to transcode the audio stream (from Navidrome, Subsonic or Jellyfin) into a continuous MP3 stream for **Sonos and Chromecast**, which pull it over HTTP. (AirPlay does not use ffmpeg — the track is downloaded directly from the media server and streamed via pyatv.) ffmpeg is **not bundled** with the app and must be installed separately.

| Platform | Install |
|----------|---------|
| Linux (Debian/Ubuntu) | `sudo apt install ffmpeg` |
| Linux (Arch) | `sudo pacman -S ffmpeg` |
| macOS | `brew install ffmpeg` |
| Windows | Download from [ffmpeg.org](https://ffmpeg.org/download.html) and add to PATH |

In the Docker image (`ghcr.io/mihaitom/feishin-connect`) ffmpeg is already included.

If ffmpeg is missing, the Connect backend logs `ffmpeg not found` on startup and all play requests will silently fail.

### Feishin Connect: no devices found

Ensure the container is running with `network_mode: host`. Without host networking, mDNS/SSDP multicast packets cannot reach the container and no devices will be discovered.

### Feishin Connect: nothing plays (device found but no audio)

Check the container or Electron logs for `ffmpeg not found`. FFmpeg is required for audio transcoding and is included in the Docker image. If you're running the backend natively, install FFmpeg via your package manager — see the ffmpeg install instructions above.

### Feishin Connect: my Sonos speaker doesn't appear under AirPlay

That's intentional. Sonos speakers advertise AirPlay 2 but require MFi hardware authentication that the AirPlay backend (pyatv) cannot perform, so streaming to them via AirPlay fails. They are filtered out of the AirPlay list and should be used via the dedicated **Sonos** output instead, where they appear with full volume and grouping support.

### Feishin Connect: AirPlay troubleshooting

Set the `PYATV_DEBUG=1` environment variable to log the full AirPlay protocol negotiation (device discovery, encryption, RTSP exchange). This is the quickest way to diagnose why a specific receiver won't play. Note that a `not connected to remote` line in the log is usually just the connection teardown masking the real error, which appears on the line above it.

### I have the issue "The SUID sandbox helper binary was found, but is not configured correctly" on Linux

Enable unprivileged namespaces or set the `chrome-sandbox` binary to Setuid:

```bash
chmod 4755 chrome-sandbox
sudo chown root:root chrome-sandbox
```

## Development

Built and tested using Node `v23.11.0`. This project is built off of [electron-vite](https://github.com/alex8088/electron-vite).

- `npm run dev` — Start the development server
- `npm run build:web` — Build the standalone web app
- `npm run typecheck` — Type check the project
- `npm run lint` — Lint the project

## Translation

This project uses [Weblate](https://hosted.weblate.org/projects/feishin/) for translations. Contributions welcome.

## License

[GNU General Public License v3.0 ©](https://github.com/jeffvli/feishin/blob/dev/LICENSE)
