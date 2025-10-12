import { useEffect } from 'react';

import { useCurrentSong, useCurrentStatus, usePlaybackSettings } from '/@/renderer/store';
import { PlayerStatus } from '/@/shared/types/types';

export const useMediaSession = () => {
    const { mediaSession: mediaSessionEnabled } = usePlaybackSettings();
    const playerStatus = useCurrentStatus();
    const currentSong = useCurrentSong();
    const mediaSession = navigator.mediaSession;

    useEffect(() => {
        if (!mediaSessionEnabled || !mediaSession) {
            return;
        }

        const updateMetadata = () => {
            mediaSession.metadata = new MediaMetadata({
                album: currentSong?.album ?? '',
                artist: currentSong?.artistName ?? '',
                artwork: currentSong?.imageUrl
                    ? [{ src: currentSong.imageUrl, type: 'image/png' }]
                    : [],
                title: currentSong?.name ?? '',
            });
        };

        updateMetadata();
    }, [currentSong, mediaSession, mediaSessionEnabled]);

    useEffect(() => {
        if (!mediaSessionEnabled || !mediaSession) {
            return;
        }

        if (mediaSession) {
            const status = playerStatus === PlayerStatus.PLAYING ? 'playing' : 'paused';
            mediaSession.playbackState = status;
        }
    }, [playerStatus, mediaSession, mediaSessionEnabled]);
};
