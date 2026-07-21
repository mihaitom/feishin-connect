import type { QueueSong } from '/@/shared/types/domain-types';

import { MutableRefObject, useEffect, useRef } from 'react';

import { connectFetchEnsured } from './connect-request';
import { ConnectMode } from './connect.store';
import { ConnectDevice, ConnectStatus, getConnectClientId } from './types';

import { useMpvSettings } from '/@/renderer/store';
import {
    isShuffleEnabled,
    mapShuffledToQueueIndex,
    subscribeCurrentTrack,
    subscribePlayerQueue,
    usePlayerStoreBase,
} from '/@/renderer/store/player.store';
import { calculateReplayGain } from '/@/renderer/utils/replay-gain';

interface ConnectPlaybackArgs {
    activeTargets: ConnectDevice[];
    connectStatus: ConnectStatus | null;
    currentSong: QueueSong | undefined;
    ensureConfigured: () => Promise<void>;
    forceReconfigure: () => Promise<void>;
    isRadioActive: boolean;
    lastAutoSentRef: MutableRefObject<string>;
    mediaNext: () => void;
    mediaPause: () => void;
    mode: ConnectMode;
    pauseRadio: () => void;
    radioStationName: null | string | undefined;
    radioStreamUrl: null | string | undefined;
    setLocalMode: (mode: 'inactive' | 'local-owner' | 'mirror') => void;
}

/**
 * Wires up four playback effects:
 *   1. Auto-forward on track change (shuffle-aware via usePlayerSong) — casts
 *      to activeTargets in 'cast' mode, or registers this tab as the local
 *      (non-cast) audio source in 'inactive'/'local-owner' mode. Skipped
 *      entirely in 'mirror' mode — this tab's own local queue is irrelevant
 *      while it's reflecting another tab/device's session.
 *   2. Auto-forward on radio switch (cast/local-owner only, same reasoning)
 *   3. Queue mirror push (/queue) — lets other tabs in the same session see
 *      and navigate this tab's queue, independent of playback ownership.
 *   4. Track-ended detection — level-triggered via backend `ended` flag so it
 *      survives SSE reconnects and page reloads. 'cast'-only: it force-
 *      advances *this* tab's local queue/display, which is only correct when
 *      this tab is the one actually casting — see connect.store.ts's
 *      ConnectMode docstring.
 */
export const useConnectPlayback = ({
    activeTargets,
    connectStatus,
    currentSong,
    ensureConfigured,
    forceReconfigure,
    isRadioActive,
    lastAutoSentRef,
    mediaNext,
    mediaPause,
    mode,
    pauseRadio,
    radioStationName,
    radioStreamUrl,
    setLocalMode,
}: ConnectPlaybackArgs): void => {
    const advancingRef = useRef(false);
    const replayGainSettings = useMpvSettings();

    // ── Auto-forward: track change ────────────────────────────────────────────
    useEffect(() => {
        if (mode === 'mirror' || isRadioActive) return;
        const sig = currentSong?._uniqueId ?? '';
        if (!sig || sig === lastAutoSentRef.current) return;
        lastAutoSentRef.current = sig;
        const trackId = currentSong?.id;
        if (!trackId) return;

        if (mode === 'cast') {
            mediaPause();
            connectFetchEnsured(
                `/play`,
                {
                    body: JSON.stringify({
                        gain: currentSong
                            ? calculateReplayGain(currentSong, replayGainSettings)
                            : 1,
                        targets: activeTargets.map((t) => ({ name: t.name, type: t.type })),
                        track_ids: [trackId],
                    }),
                    headers: { 'Content-Type': 'application/json' },
                    method: 'POST',
                },
                ensureConfigured,
                forceReconfigure,
            ).catch(() => {});
            return;
        }

        // No cast device ('inactive' or already 'local-owner') — this tab's
        // own audio output becomes (or reaffirms being) the session's source.
        // Do NOT mediaPause(): unlike casting, there's nowhere else for the
        // audio to come from, so it must actually play here.
        connectFetchEnsured(
            `/play`,
            {
                body: JSON.stringify({
                    client_id: getConnectClientId(),
                    gain: currentSong ? calculateReplayGain(currentSong, replayGainSettings) : 1,
                    track_ids: [trackId],
                }),
                headers: { 'Content-Type': 'application/json' },
                method: 'POST',
            },
            ensureConfigured,
            forceReconfigure,
        ).catch(() => {});
        if (mode === 'inactive') setLocalMode('local-owner');
    }, [
        mode,
        isRadioActive,
        currentSong,
        activeTargets,
        mediaPause,
        lastAutoSentRef,
        replayGainSettings,
        setLocalMode,
        ensureConfigured,
        forceReconfigure,
    ]);

    // ── Auto-forward: radio switch ────────────────────────────────────────────
    // Cast/local-owner only — bootstrapping local-owner mode *from* a radio
    // switch isn't handled (radio has no queue/index to mirror), and mirror
    // must never push this tab's own radio state over the real session's.
    useEffect(() => {
        if (mode === 'inactive' || mode === 'mirror' || !isRadioActive || !radioStreamUrl) return;
        // Pause (don't stop) the local radio — stopping would clear
        // currentStreamUrl, flip isRadioActive back to false, and make the
        // playerbar/lyrics fall back to showing the previous track. Pausing keeps
        // the radio station "active" so the UI keeps showing it while the Connect
        // target streams the URL directly.
        pauseRadio();
        lastAutoSentRef.current = currentSong?._uniqueId ?? 'radio';
        connectFetchEnsured(
            `/play-url`,
            {
                body: JSON.stringify({
                    targets: activeTargets.map((t) => ({ name: t.name, type: t.type })),
                    title: radioStationName ?? 'Radio',
                    url: radioStreamUrl,
                }),
                headers: { 'Content-Type': 'application/json' },
                method: 'POST',
            },
            ensureConfigured,
            forceReconfigure,
        ).catch(() => {});
    }, [
        mode,
        isRadioActive,
        radioStreamUrl,
        radioStationName,
        activeTargets,
        pauseRadio,
        lastAutoSentRef,
        currentSong,
        ensureConfigured,
        forceReconfigure,
    ]);

    // ── Queue mirror push ──────────────────────────────────────────────────────
    // Whichever tab actually drives playback (cast or local-owner) mirrors its
    // effective (shuffle-resolved) play order to the backend whenever the queue
    // or current track changes, independent of the effects above — this is
    // what lets /next, /prev, and a future queue display work from another
    // tab. Deliberately does NOT push once immediately on entering cast/
    // local-owner mode — that moment always coincides with a genuine track
    // start (either the auto-forward effect above, or the action that
    // connected a device), which already changes the real player store and so
    // already triggers subscribeCurrentTrack below.
    useEffect(() => {
        if (mode !== 'cast' && mode !== 'local-owner') return;

        const pushQueue = () => {
            const state = usePlayerStoreBase.getState();
            const queue = state.getQueue();
            const trackIds = queue.items.map((s) => s.id).filter((id): id is string => !!id);
            let index = state.player.index;
            if (isShuffleEnabled(state)) {
                index = mapShuffledToQueueIndex(index, state.queue.shuffled);
            }
            connectFetchEnsured(
                `/queue`,
                {
                    body: JSON.stringify({ index, track_ids: trackIds }),
                    headers: { 'Content-Type': 'application/json' },
                    method: 'POST',
                },
                ensureConfigured,
                forceReconfigure,
            ).catch(() => {});
        };

        const unsubQueue = subscribePlayerQueue(pushQueue);
        const unsubTrack = subscribeCurrentTrack(pushQueue);
        return () => {
            unsubQueue();
            unsubTrack();
        };
    }, [mode, ensureConfigured, forceReconfigure]);

    // ── Track-ended detection ─────────────────────────────────────────────────
    // Level-triggered on backend `ended` flag — survives SSE reconnects and
    // page reloads. advancingRef prevents double-advance while /play is in
    // flight. 'cast'-only, deliberately: this force-advances *this* tab's own
    // local queue/display via mediaNext(), which is only correct when this
    // tab is the one actually casting — a 'mirror' tab reacting to the same
    // `ended` flag would advance its own unrelated local queue instead of the
    // real session's. 'local-owner' mode's natural track-end is detected by
    // Feishin's own (Connect-independent) local auto-advance, not this flag.
    useEffect(() => {
        if (!connectStatus || mode !== 'cast' || connectStatus.radio) return;
        if (connectStatus.streaming) {
            advancingRef.current = false;
            return;
        }
        if (connectStatus.ended && !advancingRef.current) {
            advancingRef.current = true;
            lastAutoSentRef.current = '';
            mediaNext();
            // Feishin calls audioElement.play() synchronously in mediaNext — pause
            // immediately after in the same task so pause() wins before audio is heard.
            mediaPause();
        }
        // Intentionally depends on the individual connectStatus fields the effect
        // reads, not the whole object, so it doesn't re-run on every SSE tick that
        // changes an unrelated field (e.g. elapsed).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        connectStatus?.streaming,
        connectStatus?.ended,
        mode,
        connectStatus?.radio,
        mediaNext,
        mediaPause,
        lastAutoSentRef,
    ]);
};
