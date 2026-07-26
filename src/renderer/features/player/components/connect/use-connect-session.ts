import { useEffect, useRef, useState } from 'react';

import { useConnectElapsed } from './connect.store';
import { ConnectDevice, connectFetch, ConnectSession, ConnectStatus, SendStatus } from './types';
import { useConnectActions } from './use-connect-actions';
import { useConnectControls } from './use-connect-controls';
import { useConnectDevices } from './use-connect-devices';
import { useConnectDisconnect } from './use-connect-disconnect';
import { useConnectPlayback } from './use-connect-playback';
import { useConnectScrobble } from './use-connect-scrobble';
import { useConnectSetup } from './use-connect-setup';
import { useConnectStatus } from './use-connect-status';
import { useConnectVolume } from './use-connect-volume';
import { usePairedDevices } from './use-paired-devices';

import { usePlayer } from '/@/renderer/features/player/context/player-context';
import { useIsRadioActive, useRadioStore } from '/@/renderer/features/radio/hooks/use-radio-player';
import { usePlayerSong } from '/@/renderer/store/player.store';

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
    const connectElapsed = useConnectElapsed();

    const { ensureConfigured, forceReconfigure, mySessionId } = useConnectSetup();

    const lastAutoSentRef = useRef<string>('');

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
        ensureConfigured,
        forceReconfigure,
        isActive,
        isRadioActive,
        lastAutoSentRef,
        mediaNext: () => mediaNext(false),
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

    // ── Send/claim/join/takeover actions ───────────────────────────────────────
    const { addToStream, sendToSelected, takeoverDevice, toggleSelectForSend } = useConnectActions({
        currentSong,
        currentTrackId,
        ensureConfigured,
        forceReconfigure,
        isActive,
        isRadioActive,
        lastAutoSentRef,
        mediaPause,
        pauseRadio,
        radioStationName,
        radioStreamUrl,
        refresh,
        selectedForSend,
        setActive,
        setActiveTargets,
        setSelectedForSend,
        setStatus,
    });

    // ── Disconnect (explicit + external) ───────────────────────────────────────
    const { stopAllPlayback, stopSingleDevice } = useConnectDisconnect({
        activeTargets,
        connectElapsed,
        connectStatus,
        currentSongRef,
        isActive,
        isRadioActive,
        lastAutoSentRef,
        mediaPlay,
        mediaSeekToTimestamp,
        playRadio,
        refresh,
        setActive,
        setActiveTargets,
        setSelectedForSend,
        setStatus,
    });

    // ── Player-bar play/pause/stop pass-through + local-playback safety net ───
    const { handleStop, handleTogglePlayPause } = useConnectControls({
        activeTargets,
        currentSong,
        currentTrackId,
        ensureConfigured,
        forceReconfigure,
        isActive,
        lastAutoSentRef,
        mediaPause,
        mediaTogglePlayPause,
    });

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
        hasApiError: health !== null && !health.apiReachable && !health.unauthorized,
        hasAuthError: health !== null && !health.apiReachable && health.unauthorized,
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
