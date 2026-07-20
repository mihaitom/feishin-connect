import { MutableRefObject, useEffect, useRef } from 'react';

import { ConnectMode, useConnectPlayerStore } from './connect.store';
import { ConnectDevice, connectFetch, getConnectClientId } from './types';

import { usePlayerStoreBase } from '/@/renderer/store/player.store';
import { QueueSong } from '/@/shared/types/domain-types';
import { PlayerStatus } from '/@/shared/types/types';

interface UseConnectControlsArgs {
    activeTargets: ConnectDevice[];
    currentSong: QueueSong | undefined;
    currentTrackId: null | string;
    isActive: boolean;
    lastAutoSentRef: MutableRefObject<string>;
    mediaPause: () => void;
    mediaTogglePlayPause: () => void;
    mode: ConnectMode;
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
    isActive,
    lastAutoSentRef,
    mediaPause,
    mediaTogglePlayPause,
    mode,
}: UseConnectControlsArgs) => {
    const storeHandlersRef = useRef({
        handleNext,
        handlePrevious,
        handleStop,
        handleTogglePlayPause,
    });

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
            connectFetch(`/play`, {
                body: JSON.stringify({
                    targets: activeTargets.map((t) => ({ name: t.name, type: t.type })),
                    track_ids: [currentTrackId],
                }),
                headers: { 'Content-Type': 'application/json' },
                method: 'POST',
            }).catch(() => {});
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

    // Explicit next/prev press — always advances regardless of AppState.
    // stopped (see connect/core/state.py's docstring); only the *automatic*
    // track-ended advance defers to it.
    function handleNext() {
        if (!isActive) return;
        connectFetch(`/next`, {
            body: JSON.stringify({ client_id: getConnectClientId() }),
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
        }).catch(() => {});
    }

    function handlePrevious() {
        if (!isActive) return;
        connectFetch(`/prev`, {
            body: JSON.stringify({ client_id: getConnectClientId() }),
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
        }).catch(() => {});
    }

    storeHandlersRef.current = { handleNext, handlePrevious, handleStop, handleTogglePlayPause };

    useEffect(() => {
        useConnectPlayerStore.getState().set({
            handlers: isActive
                ? {
                      onNext: () => storeHandlersRef.current.handleNext(),
                      onPlayPause: () => storeHandlersRef.current.handleTogglePlayPause(),
                      onPrevious: () => storeHandlersRef.current.handlePrevious(),
                      onStop: () => storeHandlersRef.current.handleStop(),
                  }
                : null,
            isActive,
            mode,
        });
    }, [isActive, mode]);

    // ── Safety net: keep local Feishin player paused whenever Connect owns
    // playback via a *cast* target or as a *mirror* of another tab/device ──
    // Zustand subscribers fire synchronously on state change. If something flips
    // the local player to PLAYING (e.g. mediaNext() during auto-advance, which
    // sometimes wins over our same-task mediaPause() ~20% of the time in Docker
    // due to React timing), we immediately call mediaPause(). The PLAYING state
    // is overridden before Feishin's audio component renders and starts playback.
    //
    // Must NOT fire for mode 'local-owner': there, THIS tab's own <audio>/mpv
    // output is legitimately the session's audio source — force-pausing it
    // would permanently block local-owner playback from ever being heard.
    useEffect(() => {
        if (!isActive || mode === 'local-owner') return;
        return usePlayerStoreBase.subscribe((state) => {
            if (state.player.status === PlayerStatus.PLAYING) {
                mediaPause();
            }
        });
    }, [isActive, mode, mediaPause]);

    return { handleNext, handlePrevious, handleStop, handleTogglePlayPause };
};
