import { useEffect, useRef, useState } from 'react';

import { buildConfigBody } from './connect-config';
import { useConnectElapsed, useConnectPlayerStore } from './connect.store';
import { useConnectDevices, useConnectStatus, useConnectVolume, usePairedDevices } from './hooks';
import { ConnectDevice, connectFetch, ConnectSession, ConnectStatus, SendStatus } from './types';
import { useConnectPlayback } from './use-connect-playback';
import { useConnectScrobble } from './use-connect-scrobble';

import { usePlayer } from '/@/renderer/features/player/context/player-context';
import { useIsRadioActive, useRadioStore } from '/@/renderer/features/radio/hooks/use-radio-player';
import { useCurrentServerWithCredential } from '/@/renderer/store/auth.store';
import { usePlayerSong, usePlayerStoreBase } from '/@/renderer/store/player.store';
import { useTimestampStoreBase } from '/@/renderer/store/timestamp.store';
import { PlayerStatus } from '/@/shared/types/types';

export const useConnectSession = (): ConnectSession => {
    const [status, setStatus] = useState<SendStatus>('idle');
    const [activeDevice, setActive] = useState<ConnectDevice | null>(null);
    const [activeTargets, setActiveTargets] = useState<ConnectDevice[]>([]);
    const [selectedForSend, setSelectedForSend] = useState<ConnectDevice[]>([]);

    const { devices, health, isScanning, refresh } = useConnectDevices();
    const { paired, refresh: refreshPaired } = usePairedDevices();
    const { fetchVolume } = useConnectVolume();
    const { mediaNext, mediaPause, mediaPlay, mediaSeekToTimestamp, mediaTogglePlayPause } =
        usePlayer();
    const pauseRadio = useRadioStore((s) => s.actions.pause);
    const playRadio = useRadioStore((s) => s.actions.play);
    const stopRadio = useRadioStore((s) => s.actions.stop);
    const server = useCurrentServerWithCredential();
    const connectElapsed = useConnectElapsed();

    const lastAutoSentRef = useRef<string>('');
    const configuredRef = useRef(false);
    const storeHandlersRef = useRef({ handleStop, handleTogglePlayPause });

    const currentSong = usePlayerSong();
    const currentSongRef = useRef(currentSong);
    currentSongRef.current = currentSong;
    const isRadioActive = useIsRadioActive();
    const radioStreamUrl = useRadioStore((s) => s.currentStreamUrl);
    const radioStationName = useRadioStore((s) => s.stationName);

    const isActive = !!activeDevice;
    const connectStatus = useConnectStatus(isActive);
    const currentTrackId = currentSong?.id ?? null;

    // ── Active targets sync ───────────────────────────────────────────────────
    useEffect(() => {
        if (!connectStatus) return;
        if (connectStatus.streaming && connectStatus.targets.length > 0) {
            setActiveTargets((prev) => {
                const next = connectStatus.targets.map((t) => ({
                    name: t.name,
                    type: t.type as ConnectDevice['type'],
                }));
                const unchanged =
                    prev.length === next.length &&
                    prev.every((t, i) => t.name === next[i].name && t.type === next[i].type);
                // Keep the existing array reference when unchanged so effects
                // depending on activeTargets don't re-run on every status poll.
                return unchanged ? prev : next;
            });
        } else if (!connectStatus.streaming && !isActive) {
            setActiveTargets((prev) => (prev.length === 0 ? prev : []));
        }
    }, [connectStatus, isActive]);

    // ── Server config ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (!server?.url || !server?.credential) return;
        connectFetch(`/config`, {
            body: JSON.stringify(buildConfigBody(server)),
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
        })
            .then(() => {
                configuredRef.current = true;
            })
            .catch(() => {});
    }, [server]);

    // ── Restore from backend on mount ─────────────────────────────────────────
    useEffect(() => {
        connectFetch(`/status`)
            .then((r) => r.json())
            .then((d: ConnectStatus) => {
                // Restore if actively streaming, or if a track just ended (ended=true).
                // Do NOT restore on ended=false+streaming=false — that means /stop was called.
                if (d.targets?.length > 0 && (d.streaming || d.ended)) {
                    const restored = d.targets.map((t: { name: string; type: string }) => ({
                        name: t.name,
                        type: t.type as ConnectDevice['type'],
                    }));
                    // Prevent auto-forward from re-sending the current track on restore
                    lastAutoSentRef.current = currentSongRef.current?._uniqueId ?? '';
                    setActiveTargets(restored);
                    setActive(restored[0]);
                    setStatus('success');
                    // If ended=true, the track-ended effect will call mediaNext() once SSE connects
                }
            })
            .catch(() => {});
    }, []);

    // ── Playback effects (auto-forward, timer, streaming-end) ─────────────────
    useConnectPlayback({
        activeTargets,
        connectStatus,
        currentSong,
        isActive,
        isRadioActive,
        lastAutoSentRef,
        mediaNext,
        mediaPause,
        pauseRadio,
        radioStationName,
        radioStreamUrl,
    });

    // ── Scrobble effects (start + submission via Connect events) ──────────────
    useConnectScrobble({
        connectStatus,
        currentSong,
        isActive,
        isRadioActive,
    });

    // ── Actions ───────────────────────────────────────────────────────────────

    const ensureConfigured = async () => {
        if (!configuredRef.current && server?.url && server?.credential) {
            await connectFetch(`/config`, {
                body: JSON.stringify(buildConfigBody(server)),
                headers: { 'Content-Type': 'application/json' },
                method: 'POST',
            });
            configuredRef.current = true;
        }
    };

    const sendToSelected = async () => {
        if (selectedForSend.length === 0) return;
        const first = selectedForSend[0];
        lastAutoSentRef.current = currentSong?._uniqueId ?? '';
        setActive(first);
        setActiveTargets(selectedForSend);
        setStatus('loading');
        try {
            await ensureConfigured();
            const targets = selectedForSend.map((d) => ({ name: d.name, type: d.type }));
            if (isRadioActive && radioStreamUrl) {
                pauseRadio();
                const res = await connectFetch(`/play-url`, {
                    body: JSON.stringify({
                        targets,
                        title: radioStationName ?? 'Radio',
                        url: radioStreamUrl,
                    }),
                    headers: { 'Content-Type': 'application/json' },
                    method: 'POST',
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                // Backend returns HTTP 200 with { error } on logical failures
                // (e.g. delivery error) rather than a non-2xx status.
                const body = await res.json();
                if (body.error) throw new Error(body.error);
                useConnectPlayerStore.getState().set({ isPlaying: true, isStreaming: true });
            } else if (currentTrackId) {
                const isCurrentlyPlaying =
                    usePlayerStoreBase.getState().player.status === PlayerStatus.PLAYING;
                if (isCurrentlyPlaying) {
                    const startPosition = useTimestampStoreBase.getState().timestamp;
                    mediaPause();
                    const res = await connectFetch(`/play`, {
                        body: JSON.stringify({
                            start_position: startPosition,
                            targets,
                            track_ids: [currentTrackId],
                        }),
                        headers: { 'Content-Type': 'application/json' },
                        method: 'POST',
                    });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const body = await res.json();
                    if (body.error) throw new Error(body.error);
                    useConnectPlayerStore.getState().set({ isPlaying: true, isStreaming: true });
                }
            }
            setStatus('success');
            setSelectedForSend([]);
        } catch (e) {
            console.error('[Connect]', e);
            setStatus('error');
            setActive(null);
            setActiveTargets([]);
            setTimeout(() => setStatus('idle'), 2000);
        }
    };

    const addToStream = async () => {
        if (selectedForSend.length === 0) return;
        for (const device of selectedForSend) {
            await connectFetch(`/join`, {
                body: JSON.stringify({ target_name: device.name, target_type: device.type }),
                headers: { 'Content-Type': 'application/json' },
                method: 'POST',
            }).catch(() => {});
        }
        setActiveTargets((prev) => {
            const existing = new Set(prev.map((d) => `${d.type}:${d.name}`));
            const added = selectedForSend.filter((d) => !existing.has(`${d.type}:${d.name}`));
            return [...prev, ...added];
        });
        setSelectedForSend([]);
    };

    // Hands playback back to the local player at the position Connect had reached,
    // so disconnecting mid-track doesn't lose the listener's place. `snapshot` must
    // be captured *before* the /stop request (SSE may flip isPlaying to false while
    // it's in flight), but the actual local play/seek must happen *after* isActive
    // has flipped to false — the safety-net effect below force-pauses local playback
    // while isActive is true, and its subscription only unsubscribes on the render
    // triggered by setActive(null). Scheduling via setTimeout before that render has
    // even been requested fires way too early and gets immediately undone.
    const captureDisconnectSnapshot = () => ({
        elapsed: connectElapsed,
        wasPlaying: useConnectPlayerStore.getState().isPlaying,
        wasRadio: isRadioActive,
    });

    const resumeLocalAfterDisconnect = (snapshot: {
        elapsed: number;
        wasPlaying: boolean;
        wasRadio: boolean;
    }) => {
        const { elapsed, wasPlaying, wasRadio } = snapshot;
        setTimeout(() => {
            if (wasRadio) {
                if (wasPlaying) playRadio();
                return;
            }
            if (!currentSongRef.current) return;
            if (elapsed > 0.5) {
                mediaSeekToTimestamp(elapsed);
            }
            if (wasPlaying) mediaPlay();
        }, 0);
    };

    const stopAllPlayback = async () => {
        const snapshot = captureDisconnectSnapshot();
        await connectFetch(`/stop`, { method: 'POST' }).catch(() => {});
        setStatus('idle');
        setActive(null);
        setActiveTargets([]);
        setSelectedForSend([]);
        lastAutoSentRef.current = '';
        resumeLocalAfterDisconnect(snapshot);
    };

    const stopSingleDevice = async (device: ConnectDevice) => {
        // This device is the last one active — disconnecting it ends the session.
        const willBecomeInactive = activeTargets.length <= 1;
        const snapshot = willBecomeInactive ? captureDisconnectSnapshot() : null;
        await connectFetch(
            `/device-stop?device_type=${device.type}&name=${encodeURIComponent(device.name)}`,
            { method: 'POST' },
        ).catch(() => {});
        const remaining = activeTargets.filter(
            (tgt) => !(tgt.type === device.type && tgt.name === device.name),
        );
        setActiveTargets(remaining);
        if (remaining.length === 0) {
            setActive(null);
            setStatus('idle');
            if (snapshot) resumeLocalAfterDisconnect(snapshot);
        } else {
            setActive(remaining[0]);
        }
    };

    const toggleSelectForSend = (device: ConnectDevice) => {
        const key = `${device.type}:${device.name}`;
        setSelectedForSend((prev) => {
            const exists = prev.some((d) => `${d.type}:${d.name}` === key);
            return exists ? prev.filter((d) => `${d.type}:${d.name}` !== key) : [...prev, device];
        });
    };

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

    function handleStop() {
        useConnectPlayerStore.getState().set({ isPlaying: false, isStreaming: false });
        connectFetch(`/stop`, { method: 'POST' }).catch(() => {});

        if (isRadioActive) {
            // Mark the current (stale) queue track as already sent before
            // flipping isRadioActive off, otherwise the auto-forward-on-track-change
            // effect in useConnectPlayback fires and immediately re-sends it to the
            // Connect target we just told to stop.
            lastAutoSentRef.current = currentSong?._uniqueId ?? '';
            stopRadio();
        } else {
            lastAutoSentRef.current = '';
        }
    }

    // ── Store sync ────────────────────────────────────────────────────────────
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

    return {
        activeDevice,
        activeTargets,
        addToStream,
        connectStatus,
        currentTrackId,
        devices,
        fetchVolume,
        handleStop,
        handleTogglePlayPause,
        hasApiError: health !== null && !health.apiReachable,
        hasFfmpegError: !!(health?.apiReachable && health.ffmpegFound === false),
        isActive,
        isScanning,
        paired,
        refresh,
        refreshPaired,
        selectedForSend,
        sendToSelected,
        status,
        stopAllPlayback,
        stopSingleDevice,
        toggleSelectForSend,
        trackLabel: isRadioActive ? `Radio · ${radioStationName ?? ''}` : null,
    };
};
