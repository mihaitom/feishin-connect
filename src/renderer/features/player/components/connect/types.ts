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
    paused: boolean;
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
