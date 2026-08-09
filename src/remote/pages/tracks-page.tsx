import { useRemoteQuery } from '/@/remote/hooks/use-remote-query';
import { useSend } from '/@/remote/store';
import { usePlaylistsResponse, useTracksResponse } from '/@/remote/store/library';
import { TracksPage as SharedTracksPage } from '/@/shared/mobile-ui/containers/tracks-page';
import { RemotePlaylistItem, RemoteTrackItem } from '/@/shared/types/remote-types';

export const TracksPage = () => {
    const send = useSend();
    const tracksResponse = useTracksResponse();
    const playlistsResponse = usePlaylistsResponse();

    const useTrackSearch = (searchTerm: string) => {
        const { hasMore, items, loadMore } = useRemoteQuery<RemoteTrackItem>({
            event: 'tracks-request',
            response: tracksResponse,
            searchTerm: searchTerm || undefined,
        });
        return { hasMore, items, loadMore };
    };

    const usePlaylistSearch = (searchTerm: string) => {
        const { hasMore, items, loadMore } = useRemoteQuery<RemotePlaylistItem>({
            event: 'playlists-request',
            response: playlistsResponse,
            searchTerm: searchTerm || undefined,
        });
        return { hasMore, items, loadMore };
    };

    return (
        <SharedTracksPage
            onAddToPlaylist={(playlistId, songId) =>
                send({ event: 'add-to-playlist', playlistId, songId })
            }
            onPlay={(id, playType) => send({ event: 'play-track', id, playType })}
            onPlayTrackRadio={(id, playType) => send({ event: 'play-track-radio', id, playType })}
            usePlaylistSearch={usePlaylistSearch}
            useTrackSearch={useTrackSearch}
        />
    );
};
