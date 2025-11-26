import clsx from 'clsx';
import { t } from 'i18next';
import { memo } from 'react';

import styles from './play-button.module.css';

import { usePlayButtonClick } from '/@/renderer/features/shared/hooks/use-play-button-click';
import { ActionIcon, ActionIconProps } from '/@/shared/components/action-icon/action-icon';
import { Button, ButtonProps } from '/@/shared/components/button/button';
import { Group } from '/@/shared/components/group/group';
import { AppIcon, Icon } from '/@/shared/components/icon/icon';
import { Spinner } from '/@/shared/components/spinner/spinner';

export interface DefaultPlayButtonProps extends ActionIconProps {
    size?: number | string;
}

export const DefaultPlayButton = ({
    className,
    variant = 'filled',
    ...props
}: DefaultPlayButtonProps) => {
    return (
        <ActionIcon
            className={clsx(styles.textButton, className, {
                [styles.unthemed]: variant !== 'filled',
            })}
            icon="mediaPlay"
            iconProps={{
                size: 'xl',
            }}
            variant={variant}
            {...props}
        />
    );
};

interface TextPlayButtonProps extends ButtonProps {}

export const PlayTextButton = ({
    className,
    variant = 'default',
    ...props
}: TextPlayButtonProps) => {
    return (
        <Button
            className={clsx(styles.wideTextButton, className, {
                [styles.unthemed]: variant !== 'filled',
            })}
            classNames={{
                label: styles.wideTextButtonLabel,
                root: styles.wideTextButton,
            }}
            variant="subtle"
            {...props}
        >
            {props.children || (
                <Group gap="sm" wrap="nowrap">
                    <Icon fill="default" icon="mediaPlay" size="lg" />
                    {t('player.play', { postProcess: 'sentenceCase' })}
                </Group>
            )}
        </Button>
    );
};

export const WideShuffleButton = ({ ...props }: TextPlayButtonProps) => {
    return (
        <PlayTextButton {...props}>
            <Group gap="sm" wrap="nowrap">
                <Icon fill="default" icon="mediaShuffle" size="lg" />
                {t('action.shuffle', { postProcess: 'sentenceCase' })}
            </Group>
        </PlayTextButton>
    );
};

interface PlayButtonProps {
    classNames?: string;
    fill?: boolean;
    icon?: keyof typeof AppIcon;
    isSecondary?: boolean;
    loading?: boolean;
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
    onLongPress?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

export const PlayButton = memo(
    ({
        classNames,
        fill,
        icon = 'mediaPlay',
        isSecondary,
        loading,
        onClick,
        onLongPress,
    }: PlayButtonProps) => {
        const clickHandlers = usePlayButtonClick({
            loading,
            onClick,
            onLongPress,
        });

        return (
            <button
                className={clsx(styles.playButton, classNames, {
                    [styles.fill]: fill,
                    [styles.secondary]: isSecondary,
                })}
                {...clickHandlers.handlers}
                {...clickHandlers.props}
            >
                {loading ? <Spinner color="black" /> : <Icon icon={icon} size="lg" />}
            </button>
        );
    },
);

PlayButton.displayName = 'PlayButton';
