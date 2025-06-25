import clsx from 'clsx';
import { t } from 'i18next';
import { forwardRef, ReactNode } from 'react';

import styles from './player-button.module.css';

import { ActionIcon, ActionIconProps } from '/@/shared/components/action-icon/action-icon';
import { Tooltip, TooltipProps } from '/@/shared/components/tooltip/tooltip';

interface PlayerButtonProps extends Omit<ActionIconProps, 'icon' | 'variant'> {
    icon: ReactNode;
    isActive?: boolean;
    tooltip?: Omit<TooltipProps, 'children'>;
    variant: 'main' | 'secondary' | 'tertiary';
}

export const PlayerButton = forwardRef<HTMLButtonElement, PlayerButtonProps>(
    ({ icon, isActive, tooltip, variant, ...rest }: PlayerButtonProps) => {
        if (tooltip) {
            return (
                <Tooltip {...tooltip}>
                    <ActionIcon
                        className={clsx({
                            [styles.active]: isActive,
                        })}
                        {...rest}
                        onClick={(e) => {
                            e.stopPropagation();
                            rest.onClick?.(e);
                        }}
                        variant="subtle"
                    >
                        {icon}
                    </ActionIcon>
                </Tooltip>
            );
        }

        return (
            <ActionIcon
                className={clsx(styles.playerButton, styles[variant], {
                    [styles.active]: isActive,
                })}
                {...rest}
                onClick={(e) => {
                    e.stopPropagation();
                    rest.onClick?.(e);
                }}
                variant="subtle"
            >
                {icon}
            </ActionIcon>
        );
    },
);

interface PlayButtonProps extends Omit<ActionIconProps, 'icon' | 'variant'> {
    isPaused?: boolean;
}

export const PlayButton = ({ isPaused, ...props }: PlayButtonProps) => {
    return (
        <ActionIcon
            className={styles.main}
            icon={isPaused ? 'mediaPlay' : 'mediaPause'}
            iconProps={{
                size: 'lg',
            }}
            tooltip={
                isPaused
                    ? t('player.play', { postProcess: 'sentenceCase' })
                    : t('player.pause', { postProcess: 'sentenceCase' })
            }
            variant="white"
            {...props}
        />
    );
};
