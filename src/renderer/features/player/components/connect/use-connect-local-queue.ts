import { useEffect, useRef } from 'react';

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
 */
export const useConnectLocalQueue = ({
    connectStatus,
    ensureConfigured,
    forceReconfigure,
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
    useEffect(() => {
        if (mode !== 'local-owner' || queue.length === 0) return;

        const timeout = window.setTimeout(() => {
            lastLocalActionAtRef.current = Date.now();
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

    // ── Reverse: apply a mirror tab's remote command to the real player ────────
    useEffect(() => {
        if (mode !== 'local-owner' || !connectStatus || !connectStatus.streaming) return;
        if (Date.now() - lastLocalActionAtRef.current < REVERSE_SYNC_GRACE_MS) return;

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
    }, [mode, connectStatus, status, position, currentIndex, queue.length]);
};
