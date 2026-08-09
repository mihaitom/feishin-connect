import { useRemoteQuery } from '/@/remote/hooks/use-remote-query';
import { useSend } from '/@/remote/store';
import { usePlaylistsResponse } from '/@/remote/store/library';
import { PlaylistsPage as SharedPlaylistsPage } from '/@/shared/mobile-ui/containers/playlists-page';
import { RemotePlaylistItem } from '/@/shared/types/remote-types';

export const PlaylistsPage = () => {
    const send = useSend();
    const response = usePlaylistsResponse();

    const usePlaylistSearch = (searchTerm: string) => {
        const { hasMore, items, loadMore } = useRemoteQuery<RemotePlaylistItem>({
            event: 'playlists-request',
            response,
            searchTerm: searchTerm || undefined,
        });
        return { hasMore, items, loadMore };
    };

    return (
        <SharedPlaylistsPage
            onPlay={(id, playType) => send({ event: 'play-playlist', id, playType })}
            usePlaylistSearch={usePlaylistSearch}
        />
    );
};
