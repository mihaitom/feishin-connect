export const CONNECT_URL =
    (window as any).__CONNECT_URL__ || import.meta.env.VITE_CONNECT_URL || 'http://localhost:8765';

export const CONNECT_TOKEN: string = (window as any).__CONNECT_TOKEN__ ?? '';

export function connectFetch(path: string, options?: RequestInit): Promise<Response> {
    const headers: Record<string, string> = {
        ...(options?.headers as Record<string, string> | undefined),
    };
    if (CONNECT_TOKEN) headers['X-Connect-Token'] = CONNECT_TOKEN;
    return fetch(`${CONNECT_URL}${path}`, { ...options, headers });
}

export function connectEventSource(path: string): EventSource {
    const url = CONNECT_TOKEN
        ? `${CONNECT_URL}${path}?token=${encodeURIComponent(CONNECT_TOKEN)}`
        : `${CONNECT_URL}${path}`;
    return new EventSource(url);
}

export interface ConnectDevice {
    name: string;
    needsPairing?: boolean;
    type: 'airplay' | 'chromecast' | 'sonos';
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
    hasFfmpegError: boolean;
    isActive: boolean;
    isEmpty: boolean;
    isScanning: boolean;
    paired: string[];
    refresh: (fresh?: boolean) => void;
    refreshPaired: () => void;
    selectedForSend: ConnectDevice[];
    sendToSelected: () => Promise<void>;
    status: SendStatus;
    stopAllPlayback: () => Promise<void>;
    stopSingleDevice: (device: ConnectDevice) => Promise<void>;
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
