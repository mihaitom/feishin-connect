import styles from './play-button-group.module.css';

import i18n from '/@/i18n/i18n';
import { PlayButton } from '/@/renderer/features/shared/components/play-button';
import { AppIconSelection } from '/@/shared/components/icon/icon';
import { Tooltip } from '/@/shared/components/tooltip/tooltip';
import { Play } from '/@/shared/types/types';

const playButtons: { icon: AppIconSelection; label: string; secondary: boolean; type: Play }[] = [
    {
        icon: 'mediaPlayNext',
        label: i18n.t('player.addNext', { postProcess: 'sentenceCase' }),
        secondary: true,
        type: Play.NEXT,
    },
    {
        icon: 'mediaPlay',
        label: i18n.t('player.play', { postProcess: 'sentenceCase' }),
        secondary: false,
        type: Play.NOW,
    },
    {
        icon: 'mediaPlayLast',
        label: i18n.t('player.addLast', { postProcess: 'sentenceCase' }),
        secondary: true,
        type: Play.LAST,
    },
];

const LONG_PRESS_PLAY_BEHAVIOR = {
    [Play.LAST]: Play.LAST_SHUFFLE,
    [Play.NEXT]: Play.NEXT_SHUFFLE,
    [Play.NOW]: Play.SHUFFLE,
};

interface PlayButtonGroupProps {
    loading?: boolean | Play;
    onPlay: (type: Play) => void;
}

export const PlayButtonGroup = ({ loading, onPlay }: PlayButtonGroupProps) => {
    return (
        <div className={styles.playButtonGroup}>
            {playButtons.map((button) => (
                <Tooltip key={button.type} label={button.label} openDelay={2000}>
                    <PlayButton
                        fill={button.type === Play.NOW}
                        icon={button.icon}
                        isSecondary={button.secondary}
                        loading={loading === button.type}
                        onClick={() => onPlay(button.type)}
                        onLongPress={() => onPlay(LONG_PRESS_PLAY_BEHAVIOR[button.type])}
                    />
                </Tooltip>
            ))}
        </div>
    );
};
