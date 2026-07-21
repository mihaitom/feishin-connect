import { Dispatch, MutableRefObject, SetStateAction } from 'react';

import { connectFetchEnsured } from './connect-request';
import { useConnectPlayerStore } from './connect.store';
import { ConnectDevice, SendStatus } from './types';

import { useTimestampStoreBase } from '/@/renderer/store/timestamp.store';
import { QueueSong } from '/@/shared/types/domain-types';

interface UseConnectSendArgs {
    currentSong: QueueSong | undefined;
    currentTrackId: null | string;
    ensureConfigured: () => Promise<void>;
    forceReconfigure: () => Promise<void>;
    isRadioActive: boolean;
    lastAutoSentRef: MutableRefObject<string>;
    mediaPause: () => void;
    pauseRadio: () => void;
    radioStationName: null | string | undefined;
    radioStreamUrl: null | string | undefined;
    setActive: Dispatch<SetStateAction<ConnectDevice | null>>;
    setActiveTargets: Dispatch<SetStateAction<ConnectDevice[]>>;
    setSelectedForSend: Dispatch<SetStateAction<ConnectDevice[]>>;
    setStatus: Dispatch<SetStateAction<SendStatus>>;
}

/**
 * The two primitives that actually claim device(s) on the backend: sendTo()
 * (claim + start playback) and claimOnly() (claim without playback, for
 * connecting with nothing loaded yet). Composed by use-connect-actions.ts
 * into the public sendToSelected()/takeoverDevice() actions.
 */
export const useConnectSend = ({
    currentSong,
    currentTrackId,
    ensureConfigured,
    forceReconfigure,
    isRadioActive,
    lastAutoSentRef,
    mediaPause,
    pauseRadio,
    radioStationName,
    radioStreamUrl,
    setActive,
    setActiveTargets,
    setSelectedForSend,
    setStatus,
}: UseConnectSendArgs) => {
    // `force` re-sends as a takeover (Phase 2) after the user confirms a
    // "device in use" dialog — see takeoverDevice() in use-connect-actions.ts.
    // Plain sendToSelected()/addToStream() always pass force=false and can
    // still come back with a device_in_use error, which the caller surfaces
    // for the confirm dialog.
    const sendTo = async (devicesToSend: ConnectDevice[], force: boolean) => {
        if (devicesToSend.length === 0) return { error: null as null | string };
        const hasRadio = isRadioActive && !!radioStreamUrl;
        // Checked BEFORE touching any state below — previously, with neither a
        // radio stream nor a queued track, this fell through both branches
        // below silently doing nothing, yet had already marked the device
        // "active" (setActive/setActiveTargets happen unconditionally further
        // down) and still reported `setStatus('success')`. That left the UI
        // stuck believing it was connected to a device nothing was ever sent
        // to: local play/pause routed into Connect's (inert) handler instead
        // of local playback, and — for a takeover specifically — the claim
        // was never actually taken, so the device stayed claimed by its
        // original owner, meaning even disconnecting it re-opened the
        // takeover dialog instead.
        if (!hasRadio && !currentTrackId) {
            return { error: 'Nothing to play — select a track or start radio first.' };
        }
        const first = devicesToSend[0];
        lastAutoSentRef.current = currentSong?._uniqueId ?? '';
        setActive(first);
        setActiveTargets(devicesToSend);
        setStatus('loading');
        try {
            const targets = devicesToSend.map((d) => ({ name: d.name, type: d.type }));
            if (hasRadio) {
                pauseRadio();
                const res = await connectFetchEnsured(
                    `/play-url`,
                    {
                        body: JSON.stringify({
                            force,
                            targets,
                            title: radioStationName ?? 'Radio',
                            url: radioStreamUrl,
                        }),
                        headers: { 'Content-Type': 'application/json' },
                        method: 'POST',
                    },
                    ensureConfigured,
                    forceReconfigure,
                );
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                // Backend returns HTTP 200 with { error } on logical failures
                // (e.g. delivery error) rather than a non-2xx status.
                const body = await res.json();
                if (body.error) throw new Error(body.error);
                useConnectPlayerStore.getState().set({ isPlaying: true, isStreaming: true });
            } else {
                // currentTrackId is guaranteed here — the guard above already
                // returned early if neither it nor hasRadio was set.
                //
                // Deliberately NOT gated on local PlayerStatus === PLAYING — a
                // paused (or never-yet-played) queue is just as valid a thing to
                // connect from. Gating on it used to mean clicking "Connect" while
                // paused silently sent nothing at all, even though activeDevice was
                // already optimistically set above — the popover/player-bar looked
                // "connected" with nothing actually playing, recoverable only via
                // the ungated /play path in handleTogglePlayPause's third branch.
                const startPosition = useTimestampStoreBase.getState().timestamp;
                mediaPause();
                const res = await connectFetchEnsured(
                    `/play`,
                    {
                        body: JSON.stringify({
                            force,
                            start_position: startPosition,
                            targets,
                            track_ids: [currentTrackId],
                        }),
                        headers: { 'Content-Type': 'application/json' },
                        method: 'POST',
                    },
                    ensureConfigured,
                    forceReconfigure,
                );
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

    // Claiming with nothing loaded to play yet: still worth doing on its own
    // — this session becomes "connected" to the device (visible in the
    // popover, ready for /play the moment a track is picked) without
    // starting anything. /claim performs just the claim(+displace when
    // force) step, no play() call attached. Used both as takeoverDevice()'s
    // fallback and as sendToSelected()'s (plain "Connect", not takeover) —
    // connecting with an empty queue must succeed the same way takeover does,
    // not fail silently with no track selected.
    const claimOnly = async (
        devicesToClaim: ConnectDevice[],
        force: boolean,
    ): Promise<{ error: null | string }> => {
        if (devicesToClaim.length === 0) return { error: null };
        const first = devicesToClaim[0];
        setActive(first);
        setActiveTargets(devicesToClaim);
        setStatus('loading');
        try {
            const res = await connectFetchEnsured(
                `/claim`,
                {
                    body: JSON.stringify({
                        force,
                        targets: devicesToClaim.map((d) => ({ name: d.name, type: d.type })),
                    }),
                    headers: { 'Content-Type': 'application/json' },
                    method: 'POST',
                },
                ensureConfigured,
                forceReconfigure,
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const body = await res.json();
            if (body.error) throw new Error(body.error);
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

    return { claimOnly, sendTo };
};
