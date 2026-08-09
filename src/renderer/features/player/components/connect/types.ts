export const CONNECT_URL =
    (window as any).__CONNECT_URL__ || import.meta.env.VITE_CONNECT_URL || 'http://localhost:9181';

// Electron injects __CONNECT_TOKEN__ via the preload script; the bare web
// dev server (`pnpm run dev:web`) has no preload, so it needs its own
// fallback the same way CONNECT_URL falls back to VITE_CONNECT_URL above.
export const CONNECT_TOKEN: string =
    (window as any).__CONNECT_TOKEN__ ?? import.meta.env.VITE_CONNECT_TOKEN ?? '';

// Set once per app session by useConnectSession, before the first /config call,
// from computeConnectSessionId() — identifies this login for per-user backend
// state (see core/session.py) and device-claim ownership.
let connectSessionId = '';

export interface ConnectDevice {
    claimedByName?: null | string;
    claimedBySessionId?: null | string;
    claimedByTrack?: null | string;
    name: string;
    needsPairing?: boolean;
    type: 'airplay' | 'chromecast' | 'dlna' | 'sonos';
}

export interface ConnectQueueItem {
    album?: string;
    artist?: string;
    // Already a fully resolved, remotely-loadable URL (getItemImageUrl(...,
    // useRemoteUrl: true)) — pushed by whichever tab owns local playback.
    // Unlike current_track.cover_art_url (built server-side via
    // MediaClient.get_cover_art_url, only reachable because that tab is
    // actively casting through this backend), a mirror tab observing local
    // (non-cast) playback has no equivalent backend-relayed image path, so
    // the pushing tab must send something a plain <img> can load directly.
    cover_art_url?: null | string;
    duration?: number;
    id: string;
    title: string;
}

export interface ConnectSession {
    activeDevice: ConnectDevice | null;
    activeTargets: ConnectDevice[];
    addToStream: () => Promise<void>;
    connectStatus: ConnectStatus | null;
    currentTrackId: null | string;
    devices: ConnectDevice[];
    fetchVolume: () => void;
    handleStop: () => void;
    handleTogglePlayPause: () => void;
    hasApiError: boolean;
    hasAuthError: boolean;
    hasFfmpegError: boolean;
    isActive: boolean;
    isScanning: boolean;
    mySessionId: string;
    paired: string[];
    refresh: (fresh?: boolean) => void;
    refreshPaired: () => void;
    selectedForSend: ConnectDevice[];
    sendToSelected: () => Promise<void>;
    status: SendStatus;
    stopAllPlayback: () => Promise<void>;
    stopSingleDevice: (device: ConnectDevice) => Promise<void>;
    takeoverDevice: (device: ConnectDevice) => Promise<void>;
    toggleSelectForSend: (device: ConnectDevice) => void;
    trackLabel: null | string;
}

export interface ConnectStatus {
    current_track: ConnectTrack | null;
    current_track_index: number;
    elapsed: number;
    ended: boolean;
    // Which tab currently owns *local* (non-cast) playback — see
    // AppState.local_owner_client_id's docstring in core/state.py. Only ever
    // set while `targets` is empty; irrelevant once a real cast device is
    // active (every tab can equally control that).
    local_owner_client_id: null | string;
    paused: boolean;
    // Lightweight display objects, not bare track ids — see AppState.queue's
    // docstring. Empty unless some tab has pushed one via POST /queue.
    queue: ConnectQueueItem[];
    queue_index: number;
    radio: null | { title: string; url: string };
    streaming: boolean;
    targets: Array<{ name: string; type: string }>;
    total_tracks: number;
}

export interface ConnectTrack {
    artist: string;
    cover_art_url: null | string;
    duration: number;
    title: string;
}

export interface PairingStartResult {
    device_provides_pin: boolean;
    name: string;
}

export type PairingStep = 'error' | 'idle' | 'needs_pin' | 'started' | 'success';

export type SendStatus = 'error' | 'idle' | 'loading' | 'success';

export function connectEventSource(path: string): EventSource {
    const params: string[] = [];
    if (CONNECT_TOKEN) params.push(`token=${encodeURIComponent(CONNECT_TOKEN)}`);
    if (connectSessionId) params.push(`session=${encodeURIComponent(connectSessionId)}`);
    const query = params.join('&');
    return new EventSource(`${CONNECT_URL}${path}${query ? `?${query}` : ''}`);
}

export function connectFetch(path: string, options?: RequestInit): Promise<Response> {
    const headers: Record<string, string> = {
        ...(options?.headers as Record<string, string> | undefined),
    };
    if (CONNECT_TOKEN) headers['X-Connect-Token'] = CONNECT_TOKEN;
    if (connectSessionId) headers['X-Connect-Session'] = connectSessionId;
    return fetch(`${CONNECT_URL}${path}`, { ...options, headers });
}

export function getConnectSessionId(): string {
    return connectSessionId;
}

export function setConnectSessionId(id: string): void {
    connectSessionId = id;
}

const CONNECT_CLIENT_ID_KEY = 'connect-client-id';
let connectClientId: null | string = null;

// Identifies *this browser tab* for local-playback ownership (POST /queue,
// AppState.local_owner_client_id) — deliberately sessionStorage, not
// localStorage: a reload should never silently assume it's still the same
// owner it was before, only an explicit local /play or /queue push (see
// use-connect-session.ts) re-establishes ownership. Different tabs of the
// same account naturally get different sessionStorage, so this is unique
// per tab without needing to coordinate across them.
export function getConnectClientId(): string {
    if (connectClientId) return connectClientId;
    const stored = sessionStorage.getItem(CONNECT_CLIENT_ID_KEY);
    if (stored) {
        connectClientId = stored;
        return stored;
    }
    const id = crypto.randomUUID();
    sessionStorage.setItem(CONNECT_CLIENT_ID_KEY, id);
    connectClientId = id;
    return id;
}
