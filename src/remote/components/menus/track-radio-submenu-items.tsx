import { ActionSheet } from '/@/remote/components/action-sheet';
import { Play } from '/@/shared/types/types';

interface TrackRadioSubmenuItemsProps {
    onSelect: (playType: Play) => void;
}

export const TrackRadioSubmenuItems = ({ onSelect }: TrackRadioSubmenuItemsProps) => {
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
        </>
    );
};
