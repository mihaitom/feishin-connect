import { MutableRefObject, useEffect, useRef } from 'react';

import { connectFetchEnsured } from './connect-request';
import { useConnectPlayerStore } from './connect.store';
import { ConnectDevice, connectFetch } from './types';

import { usePlayerStoreBase } from '/@/renderer/store/player.store';
import { QueueSong } from '/@/shared/types/domain-types';
import { PlayerStatus } from '/@/shared/types/types';

interface UseConnectControlsArgs {
    activeTargets: ConnectDevice[];
    currentSong: QueueSong | undefined;
    currentTrackId: null | string;
    ensureConfigured: () => Promise<void>;
    forceReconfigure: () => Promise<void>;
    isActive: boolean;
    lastAutoSentRef: MutableRefObject<string>;
    mediaPause: () => void;
    mediaTogglePlayPause: () => void;
}

/**
 * Player-bar play/pause/stop while Connect is active, wired into the shared
 * connect store so any component (center controls, mobile playerbar, mobile
 * fullscreen player) controls the connected device instead of local playback.
 * Also the safety net that keeps local playback paused while Connect owns it.
 */
export const useConnectControls = ({
    activeTargets,
    currentSong,
    currentTrackId,
    ensureConfigured,
    forceReconfigure,
    isActive,
    lastAutoSentRef,
    mediaPause,
    mediaTogglePlayPause,
}: UseConnectControlsArgs) => {
    const storeHandlersRef = useRef({ handleStop, handleTogglePlayPause });

    function handleTogglePlayPause() {
        if (!isActive) {
            mediaTogglePlayPause();
            return;
        }
        const { isPlaying, isStreaming } = useConnectPlayerStore.getState();
        if (isPlaying) {
            useConnectPlayerStore.getState().set({ isPlaying: false });
            connectFetch(`/pause`, { method: 'POST' }).catch(() => {});
        } else if (isStreaming) {
            useConnectPlayerStore.getState().set({ isPlaying: true });
            connectFetch(`/resume`, { method: 'POST' }).catch(() => {});
        } else {
            if (!currentTrackId) return;
            useConnectPlayerStore.getState().set({ isPlaying: true, isStreaming: true });
            lastAutoSentRef.current = currentSong?._uniqueId ?? '';
            connectFetchEnsured(
                `/play`,
                {
                    body: JSON.stringify({
                        targets: activeTargets.map((t) => ({ name: t.name, type: t.type })),
                        track_ids: [currentTrackId],
                    }),
                    headers: { 'Content-Type': 'application/json' },
                    method: 'POST',
                },
                ensureConfigured,
                forceReconfigure,
            ).catch(() => {});
        }
    }

    // Player-bar Stop button while Connect is active — pauses the device and
    // resets position to 0:00, same as pause/seek(0) combined, it does NOT
    // disconnect. Disconnecting is a separate, explicit action
    // (stopAllPlayback/stopSingleDevice in use-connect-disconnect.ts) —
    // conflating the two here meant every "Stop" click released the device,
    // requiring a full reconnect just to play the next track. Pause is
    // requested before the seek so the device doesn't audibly jump back to
    // 0:00 and keep playing — /seek only restarts the device's stream when
    // not paused (see routes/playback.py).
    function handleStop() {
        useConnectPlayerStore.getState().set({ isPlaying: false });
        connectFetch(`/pause`, { method: 'POST' })
            .then(() =>
                connectFetch(`/seek`, {
                    body: JSON.stringify({ position: 0 }),
                    headers: { 'Content-Type': 'application/json' },
                    method: 'POST',
                }),
            )
            .catch(() => {});
    }

    storeHandlersRef.current = { handleStop, handleTogglePlayPause };

    useEffect(() => {
        useConnectPlayerStore.getState().set({
            handlers: isActive
                ? {
                      onPlayPause: () => storeHandlersRef.current.handleTogglePlayPause(),
                      onStop: () => storeHandlersRef.current.handleStop(),
                  }
                : null,
            isActive,
        });
    }, [isActive]);

    // ── Safety net: keep local Feishin player paused whenever Connect is active ─
    // Zustand subscribers fire synchronously on state change. If something flips
    // the local player to PLAYING (e.g. mediaNext() during auto-advance, which
    // sometimes wins over our same-task mediaPause() ~20% of the time in Docker
    // due to React timing), we immediately call mediaPause(). The PLAYING state
    // is overridden before Feishin's audio component renders and starts playback.
    useEffect(() => {
        if (!isActive) return;
        return usePlayerStoreBase.subscribe((state) => {
            if (state.player.status === PlayerStatus.PLAYING) {
                mediaPause();
            }
        });
    }, [isActive, mediaPause]);

    return { handleStop, handleTogglePlayPause };
};
