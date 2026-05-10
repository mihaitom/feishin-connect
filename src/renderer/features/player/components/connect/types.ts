export const CONNECT_URL =
    (window as any).__CONNECT_URL__ ||
    import.meta.env.VITE_CONNECT_URL ||
    'http://localhost:8765';

export interface PairingStartResult {
    device_provides_pin: boolean;
    name: string;
}

export type PairingStep = 'idle' | 'started' | 'needs_pin' | 'success' | 'error';

export interface ConnectDevice {
    name: string;
    type: 'airplay' | 'sonos';
}

export interface ConnectStatus {
    current_track: ConnectTrack | null;
    current_track_index: number;
    elapsed: number;
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

export type SendStatus = 'error' | 'idle' | 'loading' | 'success';
