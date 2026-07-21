import formatDuration from 'format-duration';
import { lazy, Suspense, useRef, useState } from 'react';

import { PlayerbarSeekSlider } from './playerbar-seek-slider';
import styles from './playerbar-slider.module.css';

import {
    useConnectElapsed,
    useConnectPlayerStore,
} from '/@/renderer/features/player/components/connect/connect.store';
import { useConnectSeek } from '/@/renderer/features/player/components/connect/hooks';
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
    const { duration: connectDuration, mode } = useConnectPlayerStore();
    const connectElapsed = useConnectElapsed();

    // 'cast'/'mirror' both display the shared session's server-tracked
    // position — 'local-owner' has no external target, so its own local
    // <audio>/mpv position (below) is the real source of truth, same as
    // 'inactive'. See connect.store.ts's ConnectMode docstring.
    const isRemoteDisplay = mode === 'cast' || mode === 'mirror';

    const songDuration = currentSong?.duration ? currentSong.duration / 1000 : 0;
    const currentTime = usePlayerTimestamp();

    const effectiveDuration = isRemoteDisplay ? connectDuration : songDuration;
    const effectiveTime = isRemoteDisplay ? connectElapsed : currentTime;

    const formattedDuration = formatDuration(effectiveDuration * 1000 || 0);
    const formattedTimeRemaining = formatDuration((effectiveTime - effectiveDuration) * 1000 || 0);
    const formattedTime = formatDuration(effectiveTime * 1000 || 0);

    const showTimeRemaining = useAppStore((state) => state.showTimeRemaining);
    const { setShowTimeRemaining } = useAppStoreActions();

    const isWaveform = playerbarSlider?.type === PlayerbarSliderType.WAVEFORM;

    return (
        <>
            <div className={styles.sliderContainer}>
                <div className={styles.sliderValueWrapper}>
                    <ScrobbleStatus formattedTime={formattedTime} />
                </div>
                <div className={styles.sliderWrapper}>
                    {mode === 'cast' || mode === 'mirror' ? (
                        // For 'mirror', /seek only updates the backend's clock — it's
                        // the owner tab's reverse-sync effect (use-connect-playback.ts)
                        // that actually moves its real <audio> position in response.
                        <ConnectSeekSlider duration={effectiveDuration} elapsed={connectElapsed} />
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

const ConnectSeekSlider = ({
    disabled,
    duration,
    elapsed,
}: {
    disabled?: boolean;
    duration: number;
    elapsed: number;
}) => {
    const [isSeeking, setIsSeeking] = useState(false);
    const [seekValue, setSeekValue] = useState(0);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const seek = useConnectSeek();

    const clearTimeout_ = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    };

    return (
        <CustomPlayerbarSlider
            disabled={disabled || duration === 0}
            label={(v) => formatDuration(v * 1000)}
            max={duration}
            min={0}
            onChange={(v) => {
                clearTimeout_();
                setIsSeeking(true);
                setSeekValue(v);
            }}
            onChangeEnd={(v) => {
                setSeekValue(v);
                seek(v);
                clearTimeout_();
                // Keep slider frozen for 2s while FFmpeg restarts; clear on timeout
                timeoutRef.current = setTimeout(() => {
                    setIsSeeking(false);
                    timeoutRef.current = null;
                }, 2000);
            }}
            value={isSeeking ? seekValue : elapsed}
            w="100%"
        />
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
            }}
            {...props}
            size={6}
        />
    );
};
