import { useSend } from '/@/remote/store';
import { PlaylistActionSheet as SharedPlaylistActionSheet } from '/@/shared/mobile-ui/containers/menus/playlist-action-sheet';

interface PlaylistActionSheetProps {
    onClose: () => void;
    playlist: null | { id: string };
}

export const PlaylistActionSheet = ({ onClose, playlist }: PlaylistActionSheetProps) => {
    const send = useSend();

    return (
        <SharedPlaylistActionSheet
            onClose={onClose}
            onPlay={(id, playType) => send({ event: 'play-playlist', id, playType })}
            playlist={playlist}
        />
    );
};
