import { ActionSheet } from '/@/shared/mobile-ui/components/action-sheet';
import { Play } from '/@/shared/mobile-ui/types';

interface PlaySubmenuItemsProps {
    onSelect: (playType: Play) => void;
}

export const PlaySubmenuItems = ({ onSelect }: PlaySubmenuItemsProps) => {
    return (
        <>
            <ActionSheet.Item leftIcon="mediaPlay" onClick={() => onSelect(Play.NOW)}>
                Play
            </ActionSheet.Item>
            <ActionSheet.Item leftIcon="mediaPlayNext" onClick={() => onSelect(Play.NEXT)}>
                Next
            </ActionSheet.Item>
            <ActionSheet.Item leftIcon="mediaPlayLast" onClick={() => onSelect(Play.LAST)}>
                Last
            </ActionSheet.Item>
            <ActionSheet.Divider />
            <ActionSheet.Item leftIcon="mediaShuffle" onClick={() => onSelect(Play.SHUFFLE)}>
                Play (shuffled)
            </ActionSheet.Item>
            <ActionSheet.Item leftIcon="mediaPlayNext" onClick={() => onSelect(Play.NEXT_SHUFFLE)}>
                Next (shuffled)
            </ActionSheet.Item>
            <ActionSheet.Item leftIcon="mediaPlayLast" onClick={() => onSelect(Play.LAST_SHUFFLE)}>
                Last (shuffled)
            </ActionSheet.Item>
        </>
    );
};
