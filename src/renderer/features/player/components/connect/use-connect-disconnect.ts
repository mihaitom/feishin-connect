import { Dispatch, MutableRefObject, SetStateAction, useEffect, useRef } from 'react';

import { useConnectPlayerStore } from './connect.store';
import { ConnectDevice, connectFetch, ConnectStatus, SendStatus } from './types';

import { QueueSong } from '/@/shared/types/domain-types';

interface UseConnectDisconnectArgs {
    activeTargets: ConnectDevice[];
    connectElapsed: number;
    connectStatus: ConnectStatus | null;
    currentSongRef: MutableRefObject<QueueSong | undefined>;
    isActive: boolean;
    isRadioActive: boolean;
    lastAutoSentRef: MutableRefObject<string>;
    mediaPlay: (id?: string) => void;
    mediaSeekToTimestamp: (timestamp: number) => void;
    playRadio: () => void;
    refresh: (fresh?: boolean) => void;
    setActive: Dispatch<SetStateAction<ConnectDevice | null>>;
    setActiveTargets: Dispatch<SetStateAction<ConnectDevice[]>>;
    setSelectedForSend: Dispatch<SetStateAction<ConnectDevice[]>>;
    setStatus: Dispatch<SetStateAction<SendStatus>>;
}

/**
 * Disconnecting a device — explicit (Stop/Disconnect-all in the popover) and
 * implicit (another session took the device over via a Phase 2 takeover, or
 * the backend reaped an idle session) — and handing playback back to the
 * local player at the position Connect had reached.
 */
export const useConnectDisconnect = ({
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
}: UseConnectDisconnectArgs) => {
    // Hands playback back to the local player at the position Connect had reached,
    // so disconnecting mid-track doesn't lose the listener's place. `snapshot` must
    // be captured *before* the /stop request (SSE may flip isPlaying to false while
    // it's in flight), but the actual local play/seek must happen *after* isActive
    // has flipped to false — use-connect-controls.ts's safety-net effect force-pauses
    // local playback while isActive is true, and its subscription only unsubscribes
    // on the render triggered by setActive(null). Scheduling via setTimeout before
    // that render has even been requested fires way too early and gets immediately
    // undone.
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
        // Someone else's takeover just displaced this session — the device's
        // claim ownership changed hands, but this session's own device list
        // (with its "Playing for {name}" annotations) is only refreshed on
        // its own next popover open otherwise. Pick it up right away instead
        // of showing stale claim info if the popover happens to already be open.
        refresh();
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

    return { stopAllPlayback, stopSingleDevice };
};
