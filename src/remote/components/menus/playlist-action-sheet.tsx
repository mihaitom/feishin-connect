import { ActionSheet } from '/@/remote/components/action-sheet';
import { PlaySubmenuItems } from '/@/remote/components/menus/play-submenu-items';
import { useAckedAction } from '/@/remote/hooks/use-acked-action';
import { useConfirmedSend } from '/@/remote/hooks/use-confirmed-send';
import { Play } from '/@/shared/types/types';

interface PlaylistActionSheetProps {
    onClose: () => void;
    playlist: null | { id: string };
}

export const PlaylistActionSheet = ({ onClose, playlist }: PlaylistActionSheetProps) => {
    const confirmedSend = useConfirmedSend();
    const { pendingKey, run } = useAckedAction();

    return (
        <ActionSheet onClose={onClose} opened={!!playlist}>
            {playlist && (
                <PlaySubmenuItems
                    disabled={pendingKey !== null}
                    onSelect={(playType) =>
                        run(
                            playType,
                            confirmedSend({ event: 'play-playlist', id: playlist.id, playType }),
                            onClose,
                        )
                    }
                    pendingPlayType={pendingKey as null | Play}
                />
            )}
        </ActionSheet>
    );
};
