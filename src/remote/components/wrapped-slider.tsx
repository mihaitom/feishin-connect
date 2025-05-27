import { rem, Slider, SliderProps } from '@mantine/core';
import { ReactNode, useState } from 'react';
import styled from 'styled-components';

const SliderContainer = styled.div`
    display: flex;
    width: 95%;
    height: 20px;
    margin: 10px 0;
`;

const SliderValueWrapper = styled.div<{ $position: 'left' | 'right' }>`
    display: flex;
    flex: 1;
    align-self: flex-end;
    justify-content: center;
    max-width: 50px;
`;

const SliderWrapper = styled.div`
    display: flex;
    flex: 6;
    align-items: center;
    height: 100%;
`;

const PlayerbarSlider = ({ ...props }: SliderProps) => {
    return (
        <Slider
            styles={{
                bar: {
                    backgroundColor: 'var(--playerbar-slider-track-progress-bg)',
                    transition: 'background-color 0.2s ease',
                },
                label: {
                    backgroundColor: 'var(--tooltip-bg)',
                    color: 'var(--tooltip-fg)',
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    padding: '0 1rem',
                },
                root: {
                    '&:hover': {
                        '& .mantine-Slider-bar': {
                            backgroundColor: 'var(--primary-color)',
                        },
                        '& .mantine-Slider-thumb': {
                            opacity: 1,
                        },
                    },
                },
                thumb: {
                    backgroundColor: 'var(--slider-thumb-bg)',
                    borderColor: 'var(--primary-color)',
                    borderWidth: rem(1),
                    height: '1rem',
                    opacity: 0,
                    width: '1rem',
                },
                track: {
                    '&::before': {
                        backgroundColor: 'var(--playerbar-slider-track-bg)',
                        right: 'calc(0.1rem * -1)',
                    },
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
    value: number;
}

export const WrapperSlider = ({ leftLabel, rightLabel, value, ...props }: WrappedProps) => {
    const [isSeeking, setIsSeeking] = useState(false);
    const [seek, setSeek] = useState(0);

    return (
        <SliderContainer>
            {leftLabel && <SliderValueWrapper $position="left">{leftLabel}</SliderValueWrapper>}
            <SliderWrapper>
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
                    size={6}
                    value={!isSeeking ? (value ?? 0) : seek}
                    w="100%"
                />
            </SliderWrapper>
            {rightLabel && <SliderValueWrapper $position="right">{rightLabel}</SliderValueWrapper>}
        </SliderContainer>
    );
};
