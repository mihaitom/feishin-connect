import { ActionSheet } from '/@/shared/mobile-ui/components/action-sheet';
import { PlaySubmenuItems } from '/@/shared/mobile-ui/containers/menus/play-submenu-items';
import { Play } from '/@/shared/mobile-ui/types';

interface PlaylistActionSheetProps {
    onClose: () => void;
    onPlay: (playlistId: string, playType: Play) => void;
    playlist: null | { id: string };
}

export const PlaylistActionSheet = ({ onClose, onPlay, playlist }: PlaylistActionSheetProps) => {
    return (
        <ActionSheet onClose={onClose} opened={!!playlist}>
            {playlist && (
                <PlaySubmenuItems
                    onSelect={(playType) => {
                        onPlay(playlist.id, playType);
                        onClose();
                    }}
                />
            )}
        </ActionSheet>
    );
};
