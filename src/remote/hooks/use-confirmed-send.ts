import { useCallback } from 'react';

import { useConfirmQueueChanges, useSend } from '/@/remote/store';
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
 */
export function useConfirmedSend() {
    const send = useSend();
    const confirmQueueChanges = useConfirmQueueChanges();
    const queueHasItems = useQueueState().items.length > 0;
    const requestConfirm = useRemoteLibraryStore(
        (state) => state.actions.requestQueueReplaceConfirm,
    );

    return useCallback(
        (event: ConfirmablePlayEvent) => {
            const playType = event.playType ?? Play.NOW;

            if (REPLACES_QUEUE.has(playType) && confirmQueueChanges && queueHasItems) {
                requestConfirm(() => send(event));
                return;
            }

            send(event);
        },
        [send, confirmQueueChanges, queueHasItems, requestConfirm],
    );
}
