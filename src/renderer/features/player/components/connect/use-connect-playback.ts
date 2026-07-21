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
import { PlayerStatus } from '/@/shared/types/types';

// How long after this tab's own explicit action (play/pause/seek/next/prev)
// the reverse-sync effect below stays quiet — long enough for that action's
// own broadcast to make its round trip back via SSE, so it doesn't get
// misread as a stale command from someone else and "corrected" right back
// to the pre-action state.
const REVERSE_SYNC_GRACE_MS = 1500;
// Minimum position divergence from the backend's tracked elapsed before
// treating it as an explicit remote /seek rather than routine drift between
// the ~2s SSE ticks and the real <audio> element's continuous position.
const SEEK_CORRECTION_THRESHOLD_S = 3;

interface ConnectPlaybackArgs {
    activeTargets: ConnectDevice[];
    connectStatus: ConnectStatus | null;
    currentSong: QueueSong | undefined;
    ensureConfigured: () => Promise<void>;
    forceReconfigure: () => Promise<void>;
    isRadioActive: boolean;
    lastAutoSentRef: MutableRefObject<string>;
    lastLocalActionAtRef: MutableRefObject<number>;
    localElapsed: number;
    mediaNext: () => void;
    mediaPause: () => void;
    mediaPlay: () => void;
    mediaPlayByIndex: (index: number) => void;
    mediaSeekToTimestamp: (timestamp: number) => void;
    mode: ConnectMode;
    pauseRadio: () => void;
    radioStationName: null | string | undefined;
    radioStreamUrl: null | string | undefined;
    setLocalMode: (mode: 'inactive' | 'local-owner' | 'mirror') => void;
}

/**
 * Wires up six playback effects:
 *   1. Auto-forward on track change (shuffle-aware via usePlayerSong) — casts
 *      to activeTargets in 'cast' mode, or registers this tab as the local
 *      (non-cast) audio source in 'inactive'/'local-owner' mode. Skipped
 *      entirely in 'mirror' mode — this tab's own local queue is irrelevant
 *      while it's reflecting another tab/device's session.
 *   2. Auto-forward on radio switch (cast/local-owner only, same reasoning)
 *   3. Queue mirror push (/queue) — lets other tabs in the same session see
 *      and navigate this tab's queue, independent of playback ownership.
 *   4. Local seek push (/seek) — 'local-owner' only: this tab's own seek
 *      slider moves its real <audio> directly (no Connect involvement there),
 *      so this detects that jump and mirrors the new position to the backend
 *      for other tabs to see/react to.
 *   5. Track-ended detection — level-triggered via backend `ended` flag so it
 *      survives SSE reconnects and page reloads. 'cast'-only: it force-
 *      advances *this* tab's local queue/display, which is only correct when
 *      this tab is the one actually casting — see connect.store.ts's
 *      ConnectMode docstring.
 *   6. Reverse-sync — 'local-owner' only: applies a play/pause/seek/next/prev
 *      that originated from a *different* tab (including this session's own
 *      mirror tabs) to this tab's real <audio>, closing the loop the other
 *      five effects don't: they only ever push local state outward.
 */
export const useConnectPlayback = ({
    activeTargets,
    connectStatus,
    currentSong,
    ensureConfigured,
    forceReconfigure,
    isRadioActive,
    lastAutoSentRef,
    lastLocalActionAtRef,
    localElapsed,
    mediaNext,
    mediaPause,
    mediaPlay,
    mediaPlayByIndex,
    mediaSeekToTimestamp,
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

    // ── Local seek push ────────────────────────────────────────────────────────
    // 'local-owner' only: the normal local seek slider (playerbar-seek-slider.
    // tsx) moves this tab's real <audio> position directly, with no Connect
    // involvement — unlike track changes, which already flow through the
    // auto-forward effect above. Detected as a jump in the local timestamp
    // bigger than routine playback progression could produce, while the
    // current track stays the same (a genuine track change already gets its
    // own /play via the auto-forward effect and must not also fire this).
    const seekPushBaselineRef = useRef({ elapsed: localElapsed, songId: currentSong?._uniqueId });
    useEffect(() => {
        const { elapsed: prevElapsed, songId: prevSongId } = seekPushBaselineRef.current;
        const sameTrack = currentSong?._uniqueId === prevSongId;
        const delta = Math.abs(localElapsed - prevElapsed);
        seekPushBaselineRef.current = { elapsed: localElapsed, songId: currentSong?._uniqueId };

        if (mode !== 'local-owner' || !sameTrack || delta <= SEEK_CORRECTION_THRESHOLD_S) return;

        lastLocalActionAtRef.current = Date.now();
        connectFetchEnsured(
            `/seek`,
            {
                body: JSON.stringify({ position: localElapsed }),
                headers: { 'Content-Type': 'application/json' },
                method: 'POST',
            },
            ensureConfigured,
            forceReconfigure,
        ).catch(() => {});
    }, [
        mode,
        localElapsed,
        currentSong?._uniqueId,
        lastLocalActionAtRef,
        ensureConfigured,
        forceReconfigure,
    ]);

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

    // ── Reverse-sync: apply another client's command to this tab's real audio ──
    // Every effect above only pushes THIS tab's own local changes outward to
    // the backend — nothing previously closed the loop back in, so a /next,
    // /pause, or /seek issued by a *different* tab (e.g. a 'mirror' tab, or
    // this same tab's own Connect-routed button) updated the backend and
    // mirror tabs' displays, but never actually told this tab's real
    // <audio>/mpv to do anything. 'local-owner'-only: this tab's own output
    // IS the session's audio, so it's the only one that can act on these.
    //
    // Reads (not writes) SessionState via the *same* SSE stream every tab
    // already subscribes to (see hooks.ts's useConnectStatus) — no new
    // channel needed, just the missing reaction to it.
    useEffect(() => {
        if (mode !== 'local-owner' || !connectStatus) return;
        if (Date.now() - lastLocalActionAtRef.current < REVERSE_SYNC_GRACE_MS) return;

        const state = usePlayerStoreBase.getState();
        let localIndex = state.player.index;
        if (isShuffleEnabled(state)) {
            localIndex = mapShuffledToQueueIndex(localIndex, state.queue.shuffled);
        }

        // Track changed remotely (another tab's /next, /prev, or /play with a
        // different track) — jump to the same index in our own local queue.
        // Indices line up because this tab is the one that pushed
        // queue_track_ids in the first place (see the queue mirror push
        // effect above): the backend's queue IS this tab's queue, in this
        // tab's order.
        if (
            connectStatus.queue_track_ids.length > 0 &&
            connectStatus.current_track_index !== localIndex
        ) {
            const newSong = state.getQueue().items[connectStatus.current_track_index];
            // Prevents the auto-forward effect from reacting to the
            // currentSong change this causes and re-pushing a redundant
            // /play — which would reset the backend's clock to 0, discarding
            // whatever position the remote command already set.
            lastAutoSentRef.current = newSong?._uniqueId ?? '';
            mediaPlayByIndex(connectStatus.current_track_index);
            // mediaPlayByIndex always starts playback — if the remote state
            // is actually paused/stopped (e.g. the stopped-flag race in
            // routes/playback.py's /next), the play/pause check below will
            // correct it on the very next tick, at the cost of a brief
            // audible blip. Not attempted to solve further this pass.
            return;
        }

        const localPlaying = state.player.status === PlayerStatus.PLAYING;
        const remotePlaying = connectStatus.streaming && !connectStatus.paused;
        if (localPlaying !== remotePlaying) {
            if (remotePlaying) mediaPlay();
            else mediaPause();
        }

        if (
            connectStatus.streaming &&
            Math.abs(localElapsed - connectStatus.elapsed) > SEEK_CORRECTION_THRESHOLD_S
        ) {
            mediaSeekToTimestamp(connectStatus.elapsed);
        }
        // Depends on the individual connectStatus fields the effect reads
        // (same reasoning as the track-ended effect above), plus localElapsed
        // so the seek-correction check re-evaluates on every local timestamp
        // tick too, not just every ~2s SSE update.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        mode,
        connectStatus?.queue_track_ids,
        connectStatus?.current_track_index,
        connectStatus?.streaming,
        connectStatus?.paused,
        connectStatus?.elapsed,
        localElapsed,
        lastLocalActionAtRef,
        lastAutoSentRef,
        mediaPlayByIndex,
        mediaPlay,
        mediaPause,
        mediaSeekToTimestamp,
    ]);
};
