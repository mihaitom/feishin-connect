import formatDuration from 'format-duration';
import { lazy, Suspense } from 'react';

import { PlayerbarSeekSlider } from './playerbar-seek-slider';
import styles from './playerbar-slider.module.css';

import {
    useConnectElapsed,
    useConnectPlayerStore,
} from '/@/renderer/features/player/components/connect/connect.store';
import { ScrobbleStatus } from '/@/renderer/features/player/components/scrobble-status';
import {
    useAppStore,
    useAppStoreActions,
    usePlayerSong,
    usePlayerTimestamp,
} from '/@/renderer/store';
import { PlayerbarSliderType, usePlayerbarSlider } from '/@/renderer/store/settings.store';
import { Slider, SliderProps } from '/@/shared/components/slider/slider';
import { Spinner } from '/@/shared/components/spinner/spinner';
import { Text } from '/@/shared/components/text/text';
import { PlaybackSelectors } from '/@/shared/constants/playback-selectors';

const PlayerbarWaveform = lazy(() =>
    import('./playerbar-waveform').then((module) => ({
        default: module.PlayerbarWaveform,
    })),
);

export const PlayerbarSlider = () => {
    const currentSong = usePlayerSong();
    const playerbarSlider = usePlayerbarSlider();
    const { duration: connectDuration, isActive: connectActive } = useConnectPlayerStore();
    const connectElapsed = useConnectElapsed();

    const songDuration = currentSong?.duration ? currentSong.duration / 1000 : 0;
    const currentTime = usePlayerTimestamp();

    const effectiveDuration = connectActive ? connectDuration : songDuration;
    const effectiveTime = connectActive ? connectElapsed : currentTime;

    const formattedDuration = formatDuration(effectiveDuration * 1000 || 0);
    const formattedTimeRemaining = formatDuration((effectiveTime - effectiveDuration) * 1000 || 0);
    const formattedTime = formatDuration(effectiveTime * 1000 || 0);

    const showTimeRemaining = useAppStore((state) => state.showTimeRemaining);
    const { setShowTimeRemaining } = useAppStoreActions();

    const isWaveform = playerbarSlider?.type === PlayerbarSliderType.WAVEFORM;

    return (
        <>
            <div className={styles.sliderContainer}>
                <div className={styles.sliderValueWrapperElapsed}>
                    <ScrobbleStatus formattedTime={formattedTime} />
                </div>
                <div className={styles.sliderWrapper}>
                    {connectActive ? (
                        // Read-only progress bar — seeking on the Connect stream is not supported
                        <div
                            style={{
                                background: 'var(--slider-track, rgba(255,255,255,0.15))',
                                borderRadius: '3px',
                                height: '6px',
                                overflow: 'hidden',
                                width: '100%',
                            }}
                        >
                            <div
                                style={{
                                    background: 'var(--primary-color, var(--theme-colors-primary))',
                                    borderRadius: '3px',
                                    height: '100%',
                                    transition: 'width 0.5s linear',
                                    width: `${effectiveDuration > 0 ? Math.min((connectElapsed / effectiveDuration) * 100, 100) : 0}%`,
                                }}
                            />
                        </div>
                    ) : isWaveform ? (
                        <Suspense fallback={<Spinner />}>
                            <PlayerbarWaveform />
                        </Suspense>
                    ) : (
                        <PlayerbarSeekSlider max={songDuration} min={0} />
                    )}
                </div>
                <div className={styles.sliderValueWrapper}>
                    <Text
                        className={PlaybackSelectors.totalDuration}
                        fw={600}
                        isMuted
                        isNoSelect
                        onClick={() => setShowTimeRemaining(!showTimeRemaining)}
                        role="button"
                        size="xs"
                        style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                        {showTimeRemaining ? formattedTimeRemaining : formattedDuration}
                    </Text>
                </div>
            </div>
        </>
    );
};

export const CustomPlayerbarSlider = ({ ...props }: SliderProps) => {
    return (
        <Slider
            classNames={{
                bar: styles.bar,
                label: styles.label,
                root: styles.root,
                thumb: styles.thumb,
                track: styles.track,
            }}
            {...props}
            size={6}
        />
    );
};
