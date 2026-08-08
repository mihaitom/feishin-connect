import { rem, Slider, SliderProps } from '@mantine/core';
import { ReactNode, useState } from 'react';

import { Group } from '/@/shared/components/group/group';
import { Text } from '/@/shared/components/text/text';

const PlayerbarSlider = ({
    thumbSize = '1.3rem',
    ...props
}: SliderProps & { thumbSize?: string }) => {
    return (
        <Slider
            styles={{
                bar: {
                    transition: 'background-color 0.2s ease',
                },
                label: {
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    padding: '0 1rem',
                },
                root: {
                    '&:hover': {
                        '& .mantine-Slider-bar': {
                            backgroundColor: 'var(--primary-color)',
                        },
                    },
                    // Generous hit area beyond the visible track — this is a
                    // touch remote, not a mouse-driven UI, so the draggable
                    // region needs to be much taller than the visual bar.
                    padding: '0.5rem 0',
                },
                thumb: {
                    backgroundColor: 'var(--slider-thumb-bg)',
                    borderColor: 'var(--primary-color)',
                    borderWidth: rem(1),
                    height: thumbSize,
                    // Always visible — this is a touchscreen remote, where
                    // ":hover" barely exists, so a hover-only drag handle is
                    // effectively invisible until the user is already dragging.
                    opacity: 1,
                    width: thumbSize,
                },
                track: {
                    '&::before': {
                        right: 'calc(0.1rem * -1)',
                    },
                    height: '1rem',
                },
            }}
            {...props}
            onClick={(e) => {
                e?.stopPropagation();
            }}
        />
    );
};

export interface WrappedProps extends Omit<SliderProps, 'onChangeEnd'> {
    leftLabel?: ReactNode;
    onChangeEnd: (value: number) => void;
    rightLabel?: ReactNode;
    thumbSize?: string;
    trackSize?: number;
    value: number;
}

export const WrappedSlider = ({
    leftLabel,
    rightLabel,
    thumbSize,
    trackSize = 6,
    value,
    ...props
}: WrappedProps) => {
    const [isSeeking, setIsSeeking] = useState(false);
    const [seek, setSeek] = useState(0);

    return (
        <Group align="center" wrap="nowrap">
            {leftLabel && <Text size="sm">{leftLabel}</Text>}
            <PlayerbarSlider
                {...props}
                min={0}
                onChange={(e) => {
                    setIsSeeking(true);
                    setSeek(e);
                }}
                onChangeEnd={(e) => {
                    props.onChangeEnd(e);
                    setIsSeeking(false);
                }}
                size={trackSize}
                thumbSize={thumbSize}
                value={!isSeeking ? (value ?? 0) : seek}
                w="100%"
            />
            {rightLabel && <Text size="sm">{rightLabel}</Text>}
        </Group>
    );
};
