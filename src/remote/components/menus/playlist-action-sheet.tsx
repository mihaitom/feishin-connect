import { ActionSheet } from '/@/remote/components/action-sheet';
import { PlaySubmenuItems } from '/@/remote/components/menus/play-submenu-items';
import { useSend } from '/@/remote/store';

interface PlaylistActionSheetProps {
    onClose: () => void;
    playlist: null | { id: string };
}

export const PlaylistActionSheet = ({ onClose, playlist }: PlaylistActionSheetProps) => {
    const send = useSend();

    return (
        <ActionSheet onClose={onClose} opened={!!playlist}>
            {playlist && (
                <PlaySubmenuItems
                    onSelect={(playType) => {
                        send({ event: 'play-playlist', id: playlist.id, playType });
                        onClose();
                    }}
                />
            )}
        </ActionSheet>
    );
};
