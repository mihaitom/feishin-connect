import { useEffect, useMemo, useRef, useState } from 'react';

import { buildConfigBody } from './connect-config';
import { computeConnectSessionId } from './connect-session-id';
import { useConnectElapsed, useConnectPlayerStore } from './connect.store';
import { useConnectDevices, useConnectStatus, useConnectVolume, usePairedDevices } from './hooks';
import {
    ConnectDevice,
    connectFetch,
    ConnectSession,
    ConnectStatus,
    SendStatus,
    setConnectSessionId,
} from './types';
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
    const mySessionId = useMemo(
        () => (server?.url ? computeConnectSessionId(server) : ''),
        [server],
    );

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
        // Must be set before the first /config call so it — and every request
        // after it — is scoped to this login's session from the start.
        setConnectSessionId(computeConnectSessionId(server));
        connectFetch(`/config`, {
            body: JSON.stringify(buildConfigBody(server)),
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
        })
            .then(() => {
                configuredRef.current = true;
            })
            .catch(() => {});
        // Deliberately narrower than [server]: the auth store hands out a new
        // `currentServer` object on nearly every Navidrome response (it also
        // carries ndCredential, refreshed constantly) even though none of the
        // fields /config actually cares about changed. Depending on the whole
        // object re-sent /config on every unrelated store update — up to
        // several times a second during a page load's request burst.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [server?.url, server?.credential, server?.type, server?.userId, server?.username]);

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
            setConnectSessionId(computeConnectSessionId(server));
            await connectFetch(`/config`, {
                body: JSON.stringify(buildConfigBody(server)),
                headers: { 'Content-Type': 'application/json' },
                method: 'POST',
            });
            configuredRef.current = true;
        }
    };

    // `force` re-sends as a takeover (Phase 2) after the user confirms a
    // "device in use" dialog — see takeoverDevice() below. Plain sendToSelected()/
    // addToStream() always pass force=false and can still come back with a
    // device_in_use error, which the caller surfaces for the confirm dialog.
    const sendTo = async (devicesToSend: ConnectDevice[], force: boolean) => {
        if (devicesToSend.length === 0) return { error: null as null | string };
        const first = devicesToSend[0];
        lastAutoSentRef.current = currentSong?._uniqueId ?? '';
        setActive(first);
        setActiveTargets(devicesToSend);
        setStatus('loading');
        try {
            await ensureConfigured();
            const targets = devicesToSend.map((d) => ({ name: d.name, type: d.type }));
            if (isRadioActive && radioStreamUrl) {
                pauseRadio();
                const res = await connectFetch(`/play-url`, {
                    body: JSON.stringify({
                        force,
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
                // Deliberately NOT gated on local PlayerStatus === PLAYING — a
                // paused (or never-yet-played) queue is just as valid a thing to
                // connect from. Gating on it used to mean clicking "Connect" while
                // paused silently sent nothing at all, even though activeDevice was
                // already optimistically set above — the popover/player-bar looked
                // "connected" with nothing actually playing, recoverable only via
                // the ungated /play path in handleTogglePlayPause's third branch.
                const startPosition = useTimestampStoreBase.getState().timestamp;
                mediaPause();
                const res = await connectFetch(`/play`, {
                    body: JSON.stringify({
                        force,
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
            setStatus('success');
            setSelectedForSend([]);
            return { error: null };
        } catch (e) {
            console.error('[Connect]', e);
            setStatus('error');
            setActive(null);
            setActiveTargets([]);
            setTimeout(() => setStatus('idle'), 2000);
            return { error: e instanceof Error ? e.message : String(e) };
        }
    };

    const sendToSelected = async () => {
        await sendTo(selectedForSend, false);
    };

    const joinTo = async (devicesToJoin: ConnectDevice[], force: boolean) => {
        for (const device of devicesToJoin) {
            await connectFetch(`/join`, {
                body: JSON.stringify({
                    force,
                    target_name: device.name,
                    target_type: device.type,
                }),
                headers: { 'Content-Type': 'application/json' },
                method: 'POST',
            }).catch(() => {});
        }
        setActiveTargets((prev) => {
            const existing = new Set(prev.map((d) => `${d.type}:${d.name}`));
            const added = devicesToJoin.filter((d) => !existing.has(`${d.type}:${d.name}`));
            return [...prev, ...added];
        });
        setSelectedForSend((prev) =>
            prev.filter((d) => !devicesToJoin.some((j) => j.type === d.type && j.name === d.name)),
        );
    };

    const addToStream = async () => {
        if (selectedForSend.length === 0) return;
        await joinTo(selectedForSend, false);
    };

    // Confirmed via the takeover dialog in DeviceItem — re-sends as a single
    // device, either joining the active stream or starting a new one, with
    // force=true so the backend displaces whoever currently owns it.
    const takeoverDevice = async (device: ConnectDevice) => {
        if (isActive) {
            await joinTo([device], true);
        } else {
            await sendTo([device], true);
        }
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

    // ── External stop (device taken over by another session, or reaped) ───────
    // stopAllPlayback()/stopSingleDevice() already clear activeDevice/activeTargets
    // themselves as soon as they fire the request, without waiting on SSE — so by
    // the time a self-initiated /stop's status update arrives, isActive is already
    // false and this is a no-op. It only fires for a stop this session didn't
    // request itself: another session took over its last device (Phase 2 takeover)
    // or the backend reaped an idle session. Mirrors stopAllPlayback's own
    // snapshot/resume dance so the local player picks up where Connect left off.
    //
    // hasStreamedRef guards against a race with /play itself: /events sends the
    // session's *current* status immediately on connect (see routes/stream.py),
    // and the SSE connection opens as soon as isActive flips true — before the
    // in-flight /play request has finished and actually started streaming. That
    // first snapshot always reads streaming=false, which without this guard looks
    // identical to an external stop and immediately reverts the connection that
    // was just requested. Only treat streaming=false as a loss once we've
    // actually observed streaming=true during this activation.
    const hasStreamedRef = useRef(false);
    useEffect(() => {
        if (!isActive) {
            hasStreamedRef.current = false;
            return;
        }
        if (!connectStatus) return;
        if (connectStatus.streaming) {
            hasStreamedRef.current = true;
            return;
        }
        if (connectStatus.ended || !hasStreamedRef.current) return;
        const snapshot = captureDisconnectSnapshot();
        setStatus('idle');
        setActive(null);
        setActiveTargets([]);
        setSelectedForSend([]);
        lastAutoSentRef.current = '';
        resumeLocalAfterDisconnect(snapshot);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [connectStatus, isActive]);

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

    // Player-bar Stop button while Connect is active — pauses the device and
    // resets position to 0:00, same as pause/seek(0) combined, it does NOT
    // disconnect. Disconnecting is a separate, explicit action
    // (stopAllPlayback/stopSingleDevice in the popover) — conflating the two here
    // meant every "Stop" click released the device, requiring a full reconnect
    // just to play the next track. Pause is requested before the seek so the
    // device doesn't audibly jump back to 0:00 and keep playing — /seek only
    // restarts the device's stream when not paused (see routes/playback.py).
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
        mySessionId,
        paired,
        refresh,
        refreshPaired,
        selectedForSend,
        sendToSelected,
        status,
        stopAllPlayback,
        stopSingleDevice,
        takeoverDevice,
        toggleSelectForSend,
        trackLabel: isRadioActive ? `Radio · ${radioStationName ?? ''}` : null,
    };
};
