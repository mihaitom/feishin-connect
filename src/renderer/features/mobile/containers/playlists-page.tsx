import { useMobilePlaylistSearch } from '/@/renderer/features/mobile/hooks/use-mobile-playlist-search';
import { usePlayer } from '/@/renderer/features/player/context/player-context';
import { useAuthStore } from '/@/renderer/store/auth.store';
import { PlaylistsPage as SharedPlaylistsPage } from '/@/shared/mobile-ui/containers/playlists-page';
import { LibraryItem } from '/@/shared/types/domain-types';
import { Play } from '/@/shared/types/types';

export const PlaylistsPage = () => {
    const { addToQueueByFetch } = usePlayer();

    return (
        <SharedPlaylistsPage
            onPlay={(id, playType = Play.NOW) => {
                const server = useAuthStore.getState().currentServer;
                if (!server) return;
                addToQueueByFetch(server.id, [id], LibraryItem.PLAYLIST, playType);
            }}
            usePlaylistSearch={useMobilePlaylistSearch}
        />
    );
};
