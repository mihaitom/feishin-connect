import { ActionSheet } from '/@/remote/components/action-sheet';
import { PlaySubmenuItems } from '/@/remote/components/menus/play-submenu-items';
import { useSend } from '/@/remote/store';

interface AlbumActionSheetProps {
    album: null | { id: string };
    onClose: () => void;
}

export const AlbumActionSheet = ({ album, onClose }: AlbumActionSheetProps) => {
    const send = useSend();

    return (
        <ActionSheet onClose={onClose} opened={!!album}>
            {album && (
                <PlaySubmenuItems
                    onSelect={(playType) => {
                        send({ event: 'play-album', id: album.id, playType });
                        onClose();
                    }}
                />
            )}
        </ActionSheet>
    );
};
