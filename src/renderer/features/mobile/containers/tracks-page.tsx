import { useMobilePlaylistSearch } from '/@/renderer/features/mobile/hooks/use-mobile-playlist-search';
import { useMobileTrackActions } from '/@/renderer/features/mobile/hooks/use-mobile-track-actions';
import { useMobileTrackSearch } from '/@/renderer/features/mobile/hooks/use-mobile-track-search';
import { TracksPage as SharedTracksPage } from '/@/shared/mobile-ui/containers/tracks-page';

export const TracksPage = () => {
    const { onAddToPlaylist, onPlay, onPlayTrackRadio } = useMobileTrackActions();

    return (
        <SharedTracksPage
            onAddToPlaylist={onAddToPlaylist}
            onPlay={onPlay}
            onPlayTrackRadio={onPlayTrackRadio}
            usePlaylistSearch={useMobilePlaylistSearch}
            useTrackSearch={useMobileTrackSearch}
        />
    );
};
