import { useRemoteQuery } from '/@/remote/hooks/use-remote-query';
import { useSend } from '/@/remote/store';
import { usePlaylistsResponse } from '/@/remote/store/library';
import { TrackActionSheet as SharedTrackActionSheet } from '/@/shared/mobile-ui/containers/menus/track-action-sheet';
import { RemotePlaylistItem } from '/@/shared/types/remote-types';

interface TrackActionSheetProps {
    onClose: () => void;
    track: null | { id: string; name: string };
}

export const TrackActionSheet = ({ onClose, track }: TrackActionSheetProps) => {
    const send = useSend();
    const playlistsResponse = usePlaylistsResponse();

    const usePlaylistSearch = (searchTerm: string) => {
        const { hasMore, items, loadMore } = useRemoteQuery<RemotePlaylistItem>({
            event: 'playlists-request',
            response: playlistsResponse,
            searchTerm: searchTerm || undefined,
        });
        return { hasMore, items, loadMore };
    };

    return (
        <SharedTrackActionSheet
            onAddToPlaylist={(playlistId, songId) =>
                send({ event: 'add-to-playlist', playlistId, songId })
            }
            onClose={onClose}
            onPlay={(id, playType) => send({ event: 'play-track', id, playType })}
            onPlayTrackRadio={(id, playType) => send({ event: 'play-track-radio', id, playType })}
            track={track}
            usePlaylistSearch={usePlaylistSearch}
        />
    );
};
