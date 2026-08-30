import { useCallback } from 'react';

import { useConfirmQueueChanges, useSendAcked } from '/@/remote/store';
import { useQueueState, useRemoteLibraryStore } from '/@/remote/store/library';
import {
    ClientPlayAlbum,
    ClientPlayPlaylist,
    ClientPlayTrack,
    ClientPlayTrackRadio,
} from '/@/shared/types/remote-types';
import { Play } from '/@/shared/types/types';

type ConfirmablePlayEvent =
    | ClientPlayAlbum
    | ClientPlayPlaylist
    | ClientPlayTrack
    | ClientPlayTrackRadio;

// Mirrors the desktop's own isReplaceQueueType() (player-context.tsx) — only
// these two actually discard the current queue.
const REPLACES_QUEUE = new Set([Play.NOW, Play.SHUFFLE]);

/**
 * The single place every queue-replacing send goes through — both the
 * direct "tap a row to play it" path (track-row.tsx/album-row.tsx/
 * playlist-row.tsx, implicit Play.NOW) and the long-press action-sheet's
 * explicit Play/Play (shuffled) options. Without this, either path would
 * reach use-remote-library.tsx's `skipConfirmation: true` calls with no
 * confirmation having happened at all — that flag only skips the desktop's
 * *own* confirm (which can't reach the phone anyway), it doesn't imply the
 * user already agreed to anything.
 *
 * Returns a promise that resolves once the desktop has actually applied the
 * operation (see AckableClientEvent) — callers that care (the long-press
 * action sheets, blocking their spinner on it) can await it; callers that
 * don't (the plain row-tap path) can ignore it, since a declined confirm
 * resolves rather than rejects and every other rejection is pre-caught
 * below, so an ignored return value never surfaces as an unhandled
 * rejection.
 */
export function useConfirmedSend() {
    const sendAcked = useSendAcked();
    const confirmQueueChanges = useConfirmQueueChanges();
    const queueHasItems = useQueueState().items.length > 0;
    const requestConfirm = useRemoteLibraryStore(
        (state) => state.actions.requestQueueReplaceConfirm,
    );

    return useCallback(
        (event: ConfirmablePlayEvent): Promise<void> => {
            const playType = event.playType ?? Play.NOW;

            let promise: Promise<void>;
            if (REPLACES_QUEUE.has(playType) && confirmQueueChanges && queueHasItems) {
                promise = new Promise<void>((resolve, reject) => {
                    requestConfirm({
                        // Declining isn't a failure — it's the user
                        // choosing not to proceed, so this resolves quietly
                        // rather than rejecting into an "Action failed"
                        // toast.
                        cancel: () => resolve(),
                        execute: () => sendAcked(event).then(resolve, reject),
                    });
                });
            } else {
                promise = sendAcked(event);
            }

            // A caller that doesn't await this (every plain row tap) would
            // otherwise log an unhandled-rejection warning the moment a send
            // fails — harmless here since the failure has nowhere else to
            // go, but noisy. Callers that do await/catch this same promise
            // (the action sheets) are unaffected: a promise can carry any
            // number of independent .then/.catch subscribers.
            promise.catch(() => {});

            return promise;
        },
        [sendAcked, confirmQueueChanges, queueHasItems, requestConfirm],
    );
}
