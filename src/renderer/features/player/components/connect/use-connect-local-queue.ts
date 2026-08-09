import { MutableRefObject, useEffect, useRef } from 'react';

import { connectFetchEnsured } from './connect-request';
import { ConnectMode } from './connect.store';
import { ConnectStatus, getConnectClientId } from './types';

import { getItemImageUrl } from '/@/renderer/components/item-image/item-image';
import { usePlayer } from '/@/renderer/features/player/context/player-context';
import {
    usePlayerQueue,
    usePlayerSong,
    usePlayerStatus,
    usePlayerTimestamp,
} from '/@/renderer/store';
import { LibraryItem } from '/@/shared/types/domain-types';
import { PlayerStatus } from '/@/shared/types/types';

const QUEUE_PUSH_DEBOUNCE_MS = 400;
// Skip a reverse-sync correction for this long after this tab's own forward
// push — otherwise its own change round-tripping back over SSE could be
// misread as an external command to correct right back to where it just was.
const REVERSE_SYNC_GRACE_MS = 1500;
// Ignore small elapsed drift — normal ~2s SSE-tick lag, not a real remote seek.
const SEEK_DRIFT_THRESHOLD_S = 3;

interface UseConnectLocalQueueArgs {
    connectStatus: ConnectStatus | null;
    ensureConfigured: () => Promise<void>;
    forceReconfigure: () => Promise<void>;
    // So the cast-mode reverse-sync below can mark a server-driven queue
    // advance as already sent, before use-connect-playback.ts's auto-forward
    // effect sees the resulting currentSong change and would otherwise
    // re-send it as if the user had just skipped.
    lastAutoSentRef: MutableRefObject<string>;
    mode: ConnectMode;
}

/**
 * Cross-tab queue mirroring for *local* (non-cast) playback — the
 * `local-owner` half of the mobile-view plan's Phase 2. Forwards this tab's
 * queue and play/pause state to the backend (POST /queue, /pause, /resume)
 * whenever it's the account's current local-owner, and reverse-syncs the
 * other direction: a `mirror` tab's remote transport command (itself just a
 * plain POST to /pause, /resume, /seek, /next, /prev — see
 * use-mobile-connect-devices.ts-equivalent wiring in the mobile queue page)
 * reaches this tab only via the shared SSE status stream, which this effect
 * diffs against the real local player and applies. No reverse-sync for
 * mirror-initiated queue reorder/remove — out of scope for v1 (see the
 * mobile-view plan).
 *
 * The queue-forwarding effect also runs in `cast` mode, so the backend knows
 * what's next while casting too. Without it, a track ending had nothing to
 * auto-advance to server-side (see routes/stream.py's _fire_track_end) and
 * just sat there marked "ended" until this tab's own JS ran again and issued
 * a fresh /play — which stalls for as long as a locked phone's browser tab
 * keeps its JS suspended. /queue already leaves local_owner_client_id/
 * is_streaming untouched whenever active_delivery is set (see
 * routes/playback.py's push_queue), so pushing it while casting is safe —
 * it only ever updates queue/queue_index there.
 *
 * The reverse-sync effect also runs a `cast`-specific branch: once the
 * backend has auto-advanced on its own (same scenario as above), this tab's
 * *local* queue pointer — what the now-playing display actually reads for
 * anything beyond the bare title/artist/album/art a ConnectQueueItem
 * carries (favorite, rating, play count, release date) — would otherwise
 * stay stuck on whatever was playing when the phone locked. Play/pause and
 * seek are deliberately NOT reverse-synced in `cast` mode — the player-bar's
 * own play/pause already targets the device directly (use-connect-
 * controls.ts), and elapsed position for the display already comes from
 * connectStatus (see connect.store.ts's useConnectElapsed), not the local
 * player.
 */
export const useConnectLocalQueue = ({
    connectStatus,
    ensureConfigured,
    forceReconfigure,
    lastAutoSentRef,
    mode,
}: UseConnectLocalQueueArgs): void => {
    const { mediaPause, mediaPlay, mediaPlayByIndex, mediaSeekToTimestamp } = usePlayer();
    const queue = usePlayerQueue();
    const currentSong = usePlayerSong();
    const status = usePlayerStatus();
    const position = usePlayerTimestamp();
    const lastLocalActionAtRef = useRef(0);

    const currentIndex = currentSong
        ? queue.findIndex((song) => song._uniqueId === currentSong._uniqueId)
        : -1;

    // ── Forward: push queue + current index on change ──────────────────────────
    // Runs in both local-owner and cast mode — see this hook's own docstring.
    useEffect(() => {
        if ((mode !== 'local-owner' && mode !== 'cast') || queue.length === 0) return;

        // Refresh the grace period synchronously, in the same commit as this
        // change — not only once the debounced push actually lands. Otherwise
        // a local skip's currentIndex change is visible to the reverse-sync
        // effect below (same commit, same tick) up to QUEUE_PUSH_DEBOUNCE_MS
        // before lastLocalActionAtRef caught up, which could misread it as a
        // remote command and immediately mediaPlayByIndex() back to the stale
        // connectStatus.queue_index.
        lastLocalActionAtRef.current = Date.now();
        const timeout = window.setTimeout(() => {
            connectFetchEnsured(
                `/queue`,
                {
                    body: JSON.stringify({
                        client_id: getConnectClientId(),
                        index: Math.max(currentIndex, 0),
                        items: queue.map((song) => ({
                            album: song.album ?? undefined,
                            artist: song.artistName,
                            cover_art_url:
                                getItemImageUrl({
                                    id: song.id,
                                    imageUrl: song.imageUrl,
                                    itemType: LibraryItem.SONG,
                                    serverId: song._serverId,
                                    type: 'itemCard',
                                    useRemoteUrl: true,
                                }) ?? null,
                            duration: song.duration,
                            id: song.id,
                            title: song.name,
                        })),
                    }),
                    headers: { 'Content-Type': 'application/json' },
                    method: 'POST',
                },
                ensureConfigured,
                forceReconfigure,
            ).catch(() => {});
        }, QUEUE_PUSH_DEBOUNCE_MS);

        return () => window.clearTimeout(timeout);
    }, [mode, queue, currentIndex, ensureConfigured, forceReconfigure]);

    // ── Forward: push local play/pause status ───────────────────────────────────
    useEffect(() => {
        if (mode !== 'local-owner') return;

        lastLocalActionAtRef.current = Date.now();
        const path = status === PlayerStatus.PLAYING ? '/resume' : '/pause';
        connectFetchEnsured(path, { method: 'POST' }, ensureConfigured, forceReconfigure).catch(
            () => {},
        );
    }, [mode, status, ensureConfigured, forceReconfigure]);

    // ── Reverse: apply a mirror tab's remote command to the real player, or
    // keep the local queue pointer in sync with a server-side auto-advance ──
    useEffect(() => {
        if (!connectStatus || !connectStatus.streaming) return;
        if (Date.now() - lastLocalActionAtRef.current < REVERSE_SYNC_GRACE_MS) return;

        if (mode === 'cast') {
            if (
                connectStatus.queue.length === 0 ||
                connectStatus.queue_index === currentIndex ||
                connectStatus.queue_index < 0 ||
                connectStatus.queue_index >= queue.length
            ) {
                return;
            }
            const target = queue[connectStatus.queue_index];
            // Mark it sent *before* mediaPlayByIndex() so the resulting
            // currentSong change doesn't look unsent to the auto-forward
            // effect in use-connect-playback.ts — the backend already
            // started this track itself, a fresh /play would just restart
            // the device on the same track it's already playing.
            lastAutoSentRef.current = target._uniqueId;
            mediaPlayByIndex(connectStatus.queue_index);
            // mediaPlayByIndex() briefly flips local status to PLAYING —
            // paused back off immediately, same belt-and-suspenders the
            // auto-forward effect's own mediaNext()+mediaPause() pair
            // relies on (see its comment) — the real safety net is
            // use-connect-controls.ts's subscriber, this just narrows the
            // window before it fires.
            mediaPause();
            return;
        }

        if (mode !== 'local-owner') return;

        const isPlaying = status === PlayerStatus.PLAYING;
        if (connectStatus.paused === isPlaying) {
            if (connectStatus.paused) mediaPause();
            else mediaPlay();
            return; // one correction per tick — avoid stacking actions
        }

        if (connectStatus.queue.length > 0 && connectStatus.queue_index !== currentIndex) {
            if (connectStatus.queue_index >= 0 && connectStatus.queue_index < queue.length) {
                mediaPlayByIndex(connectStatus.queue_index);
            }
            return;
        }

        if (Math.abs(connectStatus.elapsed - position) > SEEK_DRIFT_THRESHOLD_S) {
            mediaSeekToTimestamp(connectStatus.elapsed);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, connectStatus, status, position, currentIndex, queue, lastAutoSentRef]);
};
