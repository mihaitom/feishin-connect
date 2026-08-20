import { ActionSheet } from '/@/remote/components/action-sheet';
import { PlaySubmenuItems } from '/@/remote/components/menus/play-submenu-items';
import { useConfirmedSend } from '/@/remote/hooks/use-confirmed-send';

interface PlaylistActionSheetProps {
    onClose: () => void;
    playlist: null | { id: string };
}

export const PlaylistActionSheet = ({ onClose, playlist }: PlaylistActionSheetProps) => {
    const confirmedSend = useConfirmedSend();

    return (
        <ActionSheet onClose={onClose} opened={!!playlist}>
            {playlist && (
                <PlaySubmenuItems
                    onSelect={(playType) => {
                        confirmedSend({ event: 'play-playlist', id: playlist.id, playType });
                        onClose();
                    }}
                />
            )}
        </ActionSheet>
    );
};
