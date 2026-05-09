import { useEffect, useRef, useState } from 'react';
import { LuMusic2, LuRadio } from 'react-icons/lu';

import { ConnectStatus } from './types';

import { MainPlayButton } from '/@/renderer/features/player/components/player-button';
import { ActionIcon } from '/@/shared/components/action-icon/action-icon';

// Animates progress locally between 2-second polls using the last synced elapsed value.
const useProgressAnimation = (syncedElapsed: number, duration: number, paused: boolean) => {
    const [localElapsed, setLocalElapsed] = useState(syncedElapsed);
    // null until first effect runs — prevents computing a bad initial delta
    const syncRef = useRef<null | { elapsed: number; time: number }>(null);

    useEffect(() => {
        syncRef.current = { elapsed: syncedElapsed, time: Date.now() };
        setLocalElapsed(syncedElapsed);
    }, [syncedElapsed]);

    useEffect(() => {
        if (paused || duration <= 0) return;
        const id = setInterval(() => {
            if (!syncRef.current) return;
            const { elapsed, time } = syncRef.current;
            setLocalElapsed(Math.min(elapsed + (Date.now() - time) / 1000, duration));
        }, 500);
        return () => clearInterval(id);
    }, [paused, duration]);

    return Math.min(localElapsed, duration);
};

const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
};

interface NowPlayingProps {
    connectStatus: ConnectStatus | null;
    isPlaying: boolean;
    isRadioMode: boolean;
    onNext: () => void;
    onPrevious: () => void;
    onTogglePlayPause: () => void;
}

export const NowPlayingSection = ({
    connectStatus,
    isPlaying,
    isRadioMode,
    onNext,
    onPrevious,
    onTogglePlayPause,
}: NowPlayingProps) => {
    const track = connectStatus?.current_track ?? null;
    const radio = connectStatus?.radio ?? null;

    const title = track?.title ?? radio?.title ?? '…';
    const artist = track?.artist ?? '';
    const imageUrl = track?.cover_art_url ?? null;
    const duration = track?.duration ?? 0;
    const syncedElapsed = connectStatus?.elapsed ?? 0;
    const paused = connectStatus?.paused ?? false;

    const elapsed = useProgressAnimation(syncedElapsed, duration, paused);
    const progress = duration > 0 ? Math.min(elapsed / duration, 1) : 0;
    const showProgress = !isRadioMode && duration > 0;

    return (
        <>
            {/* Track info */}
            <div
                style={{
                    alignItems: 'center',
                    display: 'flex',
                    gap: '10px',
                    padding: '12px 12px 8px',
                }}
            >
                {imageUrl ? (
                    <img
                        alt=""
                        src={imageUrl}
                        style={{
                            borderRadius: '4px',
                            flexShrink: 0,
                            height: '48px',
                            objectFit: 'cover',
                            width: '48px',
                        }}
                    />
                ) : (
                    <div
                        style={{
                            alignItems: 'center',
                            background: 'rgba(255,255,255,0.06)',
                            borderRadius: '4px',
                            color: 'var(--theme-colors-text-secondary)',
                            display: 'flex',
                            flexShrink: 0,
                            height: '48px',
                            justifyContent: 'center',
                            width: '48px',
                        }}
                    >
                        {isRadioMode ? <LuRadio size={20} /> : <LuMusic2 size={20} />}
                    </div>
                )}
                <div style={{ minWidth: 0 }}>
                    <div
                        style={{
                            color: 'var(--theme-colors-text-primary)',
                            fontSize: '18px',
                            fontWeight: 600,
                            overflow: 'hidden',
                            padding: '0 12px 2px 0',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {title}
                    </div>
                    {artist && (
                        <div
                            style={{
                                color: 'var(--theme-colors-text-secondary)',
                                fontSize: '16px',
                                overflow: 'hidden',
                                padding: '0 12px 2px 0',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {artist}
                        </div>
                    )}
                </div>
            </div>

            {/* Playback controls — using Feishin's own ActionIcon / MainPlayButton */}
            <div
                style={{
                    alignItems: 'center',
                    display: 'flex',
                    gap: '2px',
                    justifyContent: 'center',
                    padding: '2px 12px 8px',
                }}
            >
                <ActionIcon
                    disabled={isRadioMode}
                    icon="mediaPrevious"
                    iconProps={{ size: 'lg' }}
                    onClick={(e) => {
                        e.stopPropagation();
                        onPrevious();
                    }}
                    size="md"
                    tooltip={{ label: 'Vorheriger Titel', openDelay: 500 }}
                    variant="subtle"
                />
                <MainPlayButton isPaused={!isPlaying} onClick={onTogglePlayPause} />
                <ActionIcon
                    disabled={isRadioMode}
                    icon="mediaNext"
                    iconProps={{ size: 'lg' }}
                    onClick={(e) => {
                        e.stopPropagation();
                        onNext();
                    }}
                    size="md"
                    tooltip={{ label: 'Nächster Titel', openDelay: 500 }}
                    variant="subtle"
                />
            </div>

            {/* Progress bar */}
            {showProgress && (
                <div style={{ padding: '0 12px 6px' }}>
                    <div
                        style={{
                            background: 'rgba(255,255,255,0.1)',
                            borderRadius: '2px',
                            height: '3px',
                            overflow: 'hidden',
                            width: '100%',
                        }}
                    >
                        <div
                            style={{
                                background: 'var(--theme-colors-primary)',
                                borderRadius: '2px',
                                height: '100%',
                                transition: 'width 0.5s linear',
                                width: `${progress * 100}%`,
                            }}
                        />
                    </div>
                    <div
                        style={{
                            color: 'var(--theme-colors-text-secondary)',
                            display: 'flex',
                            fontSize: '11px',
                            justifyContent: 'space-between',
                            marginTop: '3px',
                        }}
                    >
                        <span>{formatTime(elapsed)}</span>
                        <span>{formatTime(duration)}</span>
                    </div>
                </div>
            )}

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }} />
        </>
    );
};
