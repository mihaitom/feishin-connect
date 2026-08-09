import { useEffect, useState } from 'react';
import { create } from 'zustand';

import { ConnectDevice, ConnectQueueItem } from './types';

// 'inactive': today's plain local playback, nothing shared. 'cast': casting
// to a real device (unchanged, existing behavior). 'local-owner': this tab's
// own <audio> is the account's current playback source, and it pushes state
// to /queue for other tabs to mirror. 'mirror': another tab/device owns
// playback (cast or local-owner) and this tab reflects it read-only,
// forwarding its own transport commands to the backend instead of its local
// player — see use-connect-session.ts's bootstrap/demotion effects. Additive
// to the existing fields — the Electron phone-remote bridge
// (use-connect-remote-sync.ts) doesn't read this and keeps working off
// `isActive` exactly as before.
export type ConnectMode = 'cast' | 'inactive' | 'local-owner' | 'mirror';

export interface ConnectPlayerHandlers {
    onPlayPause: () => void;
    onStop: () => void;
}

// Mirrors the Connect session's device/target state and exposes its device
// actions imperatively, so parts of the app outside Playerbar's own subtree
// (e.g. the phone-remote IPC bridge in use-remote-connect.tsx) can read and
// drive Connect without needing ConnectSessionContext, which only reaches
// Playerbar's descendants — see use-connect-remote-sync.ts, the sole writer.
export interface RemoteConnectActions {
    connectDevices: (devices: ConnectDevice[], force: boolean) => Promise<{ error: null | string }>;
    disconnectAll: () => Promise<void>;
    disconnectDevice: (device: ConnectDevice) => Promise<void>;
    refresh: (fresh?: boolean) => void;
}

interface ConnectPlayerState {
    activeTargets: ConnectDevice[];
    devices: ConnectDevice[];
    duration: number;
    elapsed: number;
    handlers: ConnectPlayerHandlers | null;
    isActive: boolean;
    isPlaying: boolean;
    isStreaming: boolean;
    mode: ConnectMode;
    mySessionId: string;
    // The shared queue as last reported by the backend (see AppState.queue) —
    // populated from every SSE tick/refetch alongside elapsed/duration above
    // (see use-connect-status.ts's applyStatus), so a `mirror` tab's queue
    // view (outside Playerbar's subtree, same reasoning as remoteActions)
    // can read it without ConnectSessionContext. Only meaningful in
    // `mirror`/`cast` mode — empty otherwise.
    queue: ConnectQueueItem[];
    queueIndex: number;
    remoteActions: null | RemoteConnectActions;
    // Wall-clock time of the last elapsed sync, for smooth local animation
    syncTime: number;
}

interface ConnectPlayerStore extends ConnectPlayerState {
    set: (patch: Partial<ConnectPlayerState>) => void;
}

export const useConnectPlayerStore = create<ConnectPlayerStore>((set) => ({
    activeTargets: [],
    devices: [],
    duration: 0,
    elapsed: 0,
    handlers: null,
    isActive: false,
    isPlaying: false,
    isStreaming: false,
    mode: 'inactive',
    mySessionId: '',
    queue: [],
    queueIndex: 0,
    remoteActions: null,
    set: (patch) => set(patch),
    syncTime: 0,
}));

/**
 * Smoothly animates Connect's elapsed time between 2-second server polls.
 * Only active when Connect is playing; returns the last synced value otherwise.
 */
export const useConnectElapsed = (): number => {
    const { duration, elapsed, isActive, isPlaying, syncTime } = useConnectPlayerStore();
    const [local, setLocal] = useState(elapsed);

    useEffect(() => {
        setLocal(elapsed);
    }, [elapsed]);

    useEffect(() => {
        if (!isActive || !isPlaying) return;
        const id = setInterval(() => {
            const projected = elapsed + (Date.now() - syncTime) / 1000;
            // Clamp to duration — without this, a stale `isPlaying` (e.g. the
            // SSE connection died while the tab was backgrounded and no fresh
            // status ever arrived to correct it) lets this run away well past
            // the track's actual length instead of holding at the end.
            setLocal(duration > 0 ? Math.min(projected, duration) : projected);
        }, 500);
        return () => clearInterval(id);
    }, [isActive, isPlaying, elapsed, syncTime, duration]);

    return local;
};
