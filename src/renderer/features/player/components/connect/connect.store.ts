import { useEffect, useState } from 'react';
import { create } from 'zustand';

export interface ConnectPlayerHandlers {
    onPlayPause: () => void;
    onStop: () => void;
}

interface ConnectPlayerState {
    duration: number;
    elapsed: number;
    handlers: ConnectPlayerHandlers | null;
    isActive: boolean;
    isPlaying: boolean;
    isStreaming: boolean;
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
    set: (patch) => set(patch),
    syncTime: 0,
}));

/**
 * Smoothly animates Connect's elapsed time between 2-second server polls.
 * Only active when Connect is playing; returns the last synced value otherwise.
 */
export const useConnectElapsed = (): number => {
    const { elapsed, isActive, isPlaying, syncTime } = useConnectPlayerStore();
    const [local, setLocal] = useState(elapsed);

    useEffect(() => {
        setLocal(elapsed);
    }, [elapsed]);

    useEffect(() => {
        if (!isActive || !isPlaying) return;
        const id = setInterval(() => {
            setLocal(elapsed + (Date.now() - syncTime) / 1000);
        }, 500);
        return () => clearInterval(id);
    }, [isActive, isPlaying, elapsed, syncTime]);

    return local;
};
