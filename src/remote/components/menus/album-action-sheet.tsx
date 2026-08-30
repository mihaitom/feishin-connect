import { ActionSheet } from '/@/remote/components/action-sheet';
import { PlaySubmenuItems } from '/@/remote/components/menus/play-submenu-items';
import { useAckedAction } from '/@/remote/hooks/use-acked-action';
import { useConfirmedSend } from '/@/remote/hooks/use-confirmed-send';
import { Play } from '/@/shared/types/types';

interface AlbumActionSheetProps {
    album: null | { id: string };
    onClose: () => void;
}

export const AlbumActionSheet = ({ album, onClose }: AlbumActionSheetProps) => {
    const confirmedSend = useConfirmedSend();
    const { pendingKey, run } = useAckedAction();

    return (
        <ActionSheet onClose={onClose} opened={!!album}>
            {album && (
                <PlaySubmenuItems
                    disabled={pendingKey !== null}
                    onSelect={(playType) =>
                        run(
                            playType,
                            confirmedSend({ event: 'play-album', id: album.id, playType }),
                            onClose,
                        )
                    }
                    pendingPlayType={pendingKey as null | Play}
                />
            )}
        </ActionSheet>
    );
};
