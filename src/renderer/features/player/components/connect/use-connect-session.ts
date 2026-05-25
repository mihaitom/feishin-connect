import { useEffect, useRef, useState } from 'react';

import { useConnectPlayerStore } from './connect.store';
import { useConnectDevices, useConnectStatus, useConnectVolume, usePairedDevices } from './hooks';
import { CONNECT_URL, ConnectDevice, ConnectSession, ConnectStatus, SendStatus } from './types';
import { useConnectPlayback } from './use-connect-playback';
import { useConnectScrobble } from './use-connect-scrobble';

import { usePlayer } from '/@/renderer/features/player/context/player-context';
import { useIsRadioActive, useRadioStore } from '/@/renderer/features/radio/hooks/use-radio-player';
import { useCurrentServerWithCredential } from '/@/renderer/store/auth.store';
import { usePlayerSong, usePlayerStoreBase } from '/@/renderer/store/player.store';
import { PlayerStatus, ServerType } from '/@/shared/types/types';

const buildConfigBody = (server: {
    credential?: string;
    type?: ServerType;
    url?: string;
    userId?: null | string;
}) => ({
    credential: server.credential ?? '',
    server_type: server.type === ServerType.JELLYFIN ? 'jellyfin' : 'subsonic',
    url: server.url ?? '',
    user_id: server.userId ?? '',
});

export const useConnectSession = (): ConnectSession => {
    const [status, setStatus] = useState<SendStatus>('idle');
    const [activeDevice, setActive] = useState<ConnectDevice | null>(null);
    const [activeTargets, setActiveTargets] = useState<ConnectDevice[]>([]);
    const [selectedForSend, setSelectedForSend] = useState<ConnectDevice[]>([]);

    const { devices, health, refresh } = useConnectDevices();
    const { paired, refresh: refreshPaired } = usePairedDevices();
    const { fetchVolume } = useConnectVolume();
    const { mediaNext, mediaPause, mediaTogglePlayPause } = usePlayer();
    const stopRadio = useRadioStore((s) => s.actions.stop);
    const server = useCurrentServerWithCredential();

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
    const isEmpty = !currentTrackId && !radioStreamUrl;

    // ── Active targets sync ───────────────────────────────────────────────────
    useEffect(() => {
        if (!connectStatus) return;
        if (connectStatus.streaming && connectStatus.targets.length > 0) {
            setActiveTargets(
                connectStatus.targets.map((t) => ({
                    name: t.name,
                    type: t.type as ConnectDevice['type'],
                })),
            );
        } else if (!connectStatus.streaming && !isActive) {
            setActiveTargets([]);
        }
    }, [connectStatus, isActive]);

    // ── Server config ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (!server?.url || !server?.credential) return;
        fetch(`${CONNECT_URL}/config`, {
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
        fetch(`${CONNECT_URL}/status`)
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
        radioStationName,
        radioStreamUrl,
        stopRadio,
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
            await fetch(`${CONNECT_URL}/config`, {
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
                stopRadio();
                const res = await fetch(`${CONNECT_URL}/play-url`, {
                    body: JSON.stringify({
                        targets,
                        title: radioStationName ?? 'Radio',
                        url: radioStreamUrl,
                    }),
                    headers: { 'Content-Type': 'application/json' },
                    method: 'POST',
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                useConnectPlayerStore.getState().set({ isPlaying: true, isStreaming: true });
            } else if (currentTrackId) {
                const isCurrentlyPlaying =
                    usePlayerStoreBase.getState().player.status === PlayerStatus.PLAYING;
                if (isCurrentlyPlaying) {
                    mediaPause();
                    const res = await fetch(`${CONNECT_URL}/play`, {
                        body: JSON.stringify({ targets, track_ids: [currentTrackId] }),
                        headers: { 'Content-Type': 'application/json' },
                        method: 'POST',
                    });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
            await fetch(`${CONNECT_URL}/join`, {
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

    const stopAllPlayback = async () => {
        await fetch(`${CONNECT_URL}/stop`, { method: 'POST' }).catch(() => {});
        setStatus('idle');
        setActive(null);
        setActiveTargets([]);
        setSelectedForSend([]);
        lastAutoSentRef.current = '';
    };

    const stopSingleDevice = async (device: ConnectDevice) => {
        const url = `${CONNECT_URL}/device-stop?device_type=${device.type}&name=${encodeURIComponent(device.name)}`;
        await fetch(url, { method: 'POST' }).catch(() => {});
        const remaining = activeTargets.filter(
            (tgt) => !(tgt.type === device.type && tgt.name === device.name),
        );
        setActiveTargets(remaining);
        if (remaining.length === 0) {
            setActive(null);
            setStatus('idle');
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
            fetch(`${CONNECT_URL}/pause`, { method: 'POST' }).catch(() => {});
        } else if (isStreaming) {
            useConnectPlayerStore.getState().set({ isPlaying: true });
            fetch(`${CONNECT_URL}/resume`, { method: 'POST' }).catch(() => {});
        } else {
            if (!currentTrackId) return;
            useConnectPlayerStore.getState().set({ isPlaying: true, isStreaming: true });
            lastAutoSentRef.current = currentSong?._uniqueId ?? '';
            fetch(`${CONNECT_URL}/play`, {
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
        lastAutoSentRef.current = '';
        fetch(`${CONNECT_URL}/stop`, { method: 'POST' }).catch(() => {});
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
        isEmpty,
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
