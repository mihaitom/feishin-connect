import { useRemoteQuery } from '/@/remote/hooks/use-remote-query';
import { useSend } from '/@/remote/store';
import { usePlaylistsResponse, useQueueState } from '/@/remote/store/library';
import { QueuePage as SharedQueuePage } from '/@/shared/mobile-ui/containers/queue-page';
import { RemotePlaylistItem } from '/@/shared/types/remote-types';

export const QueuePage = () => {
    const send = useSend();
    const { currentUniqueId, items } = useQueueState();
    const playlistsResponse = usePlaylistsResponse();

    const usePlaylistSearch = (searchTerm: string) => {
        const {
            hasMore,
            items: playlists,
            loadMore,
        } = useRemoteQuery<RemotePlaylistItem>({
            event: 'playlists-request',
            response: playlistsResponse,
            searchTerm: searchTerm || undefined,
        });
        return { hasMore, items: playlists, loadMore };
    };

    return (
        <SharedQueuePage
            currentUniqueId={currentUniqueId}
            items={items}
            onAddToPlaylist={(playlistId, songId) =>
                send({ event: 'add-to-playlist', playlistId, songId })
            }
            onJump={(uniqueId) => send({ event: 'queue-jump', uniqueId })}
            onPlay={(id, playType) => send({ event: 'play-track', id, playType })}
            onPlayTrackRadio={(id, playType) => send({ event: 'play-track-radio', id, playType })}
            onRemove={(uniqueId) => send({ event: 'remove-from-queue', uniqueId })}
            onReorder={(uniqueId, targetUniqueId, edge) =>
                send({ edge, event: 'reorder-queue', targetUniqueId, uniqueId })
            }
            usePlaylistSearch={usePlaylistSearch}
        />
    );
};
