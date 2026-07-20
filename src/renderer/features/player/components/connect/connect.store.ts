import { useEffect, useState } from 'react';
import { create } from 'zustand';

/**
 * What this tab's relationship to the shared Connect session currently is:
 *   - 'inactive': nobody's playing anything in this session — today's plain
 *     local playback, untouched.
 *   - 'cast': this tab is casting to an external AirPlay/Sonos/Chromecast
 *     target — the original Connect behavior.
 *   - 'local-owner': THIS tab's own <audio>/mpv output is the session's
 *     audio source (no external target) — the new case that lets a plain
 *     desktop/mobile browser tab (no cast device) still be seen and
 *     controlled from another tab.
 *   - 'mirror': another tab/device owns playback (cast or local-owner) —
 *     this tab shows the same track read-only and forwards its own
 *     play/pause/seek/next/prev to the backend instead of local playback.
 */
export type ConnectMode = 'cast' | 'inactive' | 'local-owner' | 'mirror';

export interface ConnectPlayerHandlers {
    onNext: () => void;
    onPlayPause: () => void;
    onPrevious: () => void;
    onStop: () => void;
}

interface ConnectPlayerState {
    duration: number;
    elapsed: number;
    handlers: ConnectPlayerHandlers | null;
    isActive: boolean;
    isPlaying: boolean;
    isStreaming: boolean;
    mode: ConnectMode;
    // Wall-clock time of the last elapsed sync, for smooth local animation
    syncTime: number;
}

interface ConnectPlayerStore extends ConnectPlayerState {
    set: (patch: Partial<ConnectPlayerState>) => void;
}

export const useConnectPlayerStore = create<ConnectPlayerStore>((set) => ({
    duration: 0,
    elapsed: 0,
    handlers: null,
    isActive: false,
    isPlaying: false,
    isStreaming: false,
    mode: 'inactive',
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
