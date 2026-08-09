import { useEffect, useRef, useState } from 'react';

import { ConnectMode, useConnectElapsed, useConnectPlayerStore } from './connect.store';
import {
    ConnectDevice,
    connectFetch,
    ConnectSession,
    ConnectStatus,
    getConnectClientId,
    SendStatus,
} from './types';
import { useConnectActions } from './use-connect-actions';
import { useConnectControls } from './use-connect-controls';
import { useConnectDevices } from './use-connect-devices';
import { useConnectDisconnect } from './use-connect-disconnect';
import { useConnectLocalQueue } from './use-connect-local-queue';
import { useConnectPlayback } from './use-connect-playback';
import { useConnectRemoteSync } from './use-connect-remote-sync';
import { useConnectScrobble } from './use-connect-scrobble';
import { useConnectSetup } from './use-connect-setup';
import { useConnectStatus } from './use-connect-status';
import { useConnectVolume } from './use-connect-volume';
import { usePairedDevices } from './use-paired-devices';

import { usePlayer } from '/@/renderer/features/player/context/player-context';
import { useIsRadioActive, useRadioStore } from '/@/renderer/features/radio/hooks/use-radio-player';
import { usePlayerSong, usePlayerStatus } from '/@/renderer/store/player.store';
import { PlayerStatus } from '/@/shared/types/types';

export const useConnectSession = (): ConnectSession => {
    const [status, setStatus] = useState<SendStatus>('idle');
    const [activeDevice, setActive] = useState<ConnectDevice | null>(null);
    const [activeTargets, setActiveTargets] = useState<ConnectDevice[]>([]);
    const [selectedForSend, setSelectedForSend] = useState<ConnectDevice[]>([]);
    // Local-playback half of `mode` (see connect.store.ts's ConnectMode) —
    // 'cast' is derived below from `isActive` instead, since a real cast
    // device already has its own well-established activeDevice/activeTargets
    // state machine that this shouldn't duplicate.
    const [localMode, setLocalMode] = useState<Exclude<ConnectMode, 'cast'>>('inactive');

    const { ensureConfigured, forceReconfigure, mySessionId } = useConnectSetup();

    const { devices, health, isScanning, refresh } = useConnectDevices(ensureConfigured);
    const { paired, refresh: refreshPaired } = usePairedDevices();
    const { fetchVolume } = useConnectVolume();
    const { mediaNext, mediaPause, mediaPlay, mediaSeekToTimestamp, mediaTogglePlayPause } =
        usePlayer();
    const pauseRadio = useRadioStore((s) => s.actions.pause);
    const playRadio = useRadioStore((s) => s.actions.play);
    const connectElapsed = useConnectElapsed();
    const localPlayerStatus = usePlayerStatus();

    const lastAutoSentRef = useRef<string>('');

    const currentSong = usePlayerSong();
    const currentSongRef = useRef(currentSong);
    currentSongRef.current = currentSong;
    const isRadioActive = useIsRadioActive();
    const radioStreamUrl = useRadioStore((s) => s.currentStreamUrl);
    const radioStationName = useRadioStore((s) => s.stationName);

    const isActive = !!activeDevice;
    const mode: ConnectMode = isActive ? 'cast' : localMode;
    const { refetch: refetchConnectStatus, status: connectStatus } = useConnectStatus(
        isActive || localMode === 'local-owner' || localMode === 'mirror',
    );
    const currentTrackId = currentSong?.id ?? null;

    // ── Publish mode to the Context-free store ─────────────────────────────────
    // Same reasoning as isActive/handlers in use-connect-controls.ts: anything
    // outside Playerbar's subtree (the mobile view's own Connect-aware
    // containers) needs to read this without ConnectSessionContext.
    useEffect(() => {
        useConnectPlayerStore.getState().set({ mode });
    }, [mode]);

    // ── Local-ownership promotion: this tab starts playing locally, isn't
    // already casting — it becomes (or takes back) the local-owner. Fires
    // from `mirror` too: the user tapping play on THIS device's own output
    // always makes it the owner of that output, regardless of what was
    // previously being observed (see the mobile-view plan's reasoning on
    // why this doesn't count as "silently stealing" — it's a different
    // audio stream, not a takeover of the other tab's).
    useEffect(() => {
        if (isActive || localMode === 'local-owner') return;
        if (localPlayerStatus === PlayerStatus.PLAYING) setLocalMode('local-owner');
    }, [isActive, localMode, localPlayerStatus]);

    // ── Local-ownership demotion + mirror/inactive reactive transitions ────────
    useEffect(() => {
        if (isActive) {
            if (localMode !== 'inactive') setLocalMode('inactive');
            return;
        }
        if (!connectStatus) return;

        if (localMode === 'local-owner') {
            const lostOwnership =
                !!connectStatus.local_owner_client_id &&
                connectStatus.local_owner_client_id !== getConnectClientId();
            const castTookOver = connectStatus.targets.length > 0;
            if (lostOwnership || castTookOver) setLocalMode('mirror');
            // Otherwise stay local-owner regardless of what the backend
            // currently echoes back — right after promotion it may simply
            // not have caught up yet (this tab's own first /queue push
            // hasn't round-tripped over SSE), and treating that transient
            // staleness as "session idle" would immediately demote this tab
            // right back to inactive, which re-promotes on the very next
            // tick, looping — that used to actually happen (React error
            // #185, "Maximum update depth exceeded"). Demotion away from
            // local-owner because THIS tab's own playback genuinely stopped
            // is handled by the separate effect below, driven directly by
            // the real local player state instead of a possibly-stale
            // server snapshot.
            return;
        }

        // mirror/inactive: react to the rest of the session's own activity —
        // not just at mount (the earlier "restore from backend" effect), but
        // also if another tab starts/stops while this one is already open.
        const sessionActive =
            connectStatus.streaming ||
            connectStatus.queue.length > 0 ||
            !!connectStatus.local_owner_client_id ||
            connectStatus.targets.length > 0;
        if (sessionActive && localMode === 'inactive') {
            setLocalMode('mirror');
        } else if (!sessionActive && localMode === 'mirror') {
            setLocalMode('inactive');
        }
    }, [isActive, connectStatus, localMode]);

    // ── Demote away from local-owner once THIS tab's own playback stops ────────
    // (empties its queue) — separate from the effect above specifically so
    // it never depends on connectStatus, only this tab's own real state.
    useEffect(() => {
        if (isActive || localMode !== 'local-owner') return;
        if (!currentSong) setLocalMode('inactive');
    }, [isActive, localMode, currentSong]);

    // ── Cross-tab queue mirroring for local (non-cast) playback ────────────────
    useConnectLocalQueue({ connectStatus, ensureConfigured, forceReconfigure, mode });

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
                    return;
                }
                // No cast device to restore — if another tab already owns
                // local playback (or something's queued with no clear owner
                // recorded, e.g. left over from before a reload), this tab
                // starts out only observing. It never silently claims
                // ownership on mount — see the promotion effect above, which
                // only fires once *this* tab's own player actually starts.
                if (d.local_owner_client_id || (d.queue && d.queue.length > 0)) {
                    setLocalMode('mirror');
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
    const { addToStream, connectDevices, sendToSelected, takeoverDevice, toggleSelectForSend } =
        useConnectActions({
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

    // ── Mirror device/target state + actions into the Context-free store ──────
    useConnectRemoteSync({
        activeTargets,
        connectDevices,
        devices,
        mySessionId,
        refresh,
        stopAllPlayback,
        stopSingleDevice,
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
        refetchConnectStatus,
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
