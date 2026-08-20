import { ActionSheet } from '/@/remote/components/action-sheet';
import { PlaySubmenuItems } from '/@/remote/components/menus/play-submenu-items';
import { useConfirmedSend } from '/@/remote/hooks/use-confirmed-send';

interface AlbumActionSheetProps {
    album: null | { id: string };
    onClose: () => void;
}

export const AlbumActionSheet = ({ album, onClose }: AlbumActionSheetProps) => {
    const confirmedSend = useConfirmedSend();

    return (
        <ActionSheet onClose={onClose} opened={!!album}>
            {album && (
                <PlaySubmenuItems
                    onSelect={(playType) => {
                        confirmedSend({ event: 'play-album', id: album.id, playType });
                        onClose();
                    }}
                />
            )}
        </ActionSheet>
    );
};
