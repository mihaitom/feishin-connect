import isElectron from 'is-electron';
import React, { useCallback, useEffect, useMemo } from 'react';

import { getItemImageUrl } from '/@/renderer/components/item-image/item-image';
import { usePlayerEvents } from '/@/renderer/features/player/audio-player/hooks/use-player-events';
import { usePlayer } from '/@/renderer/features/player/context/player-context';
import {
    useIsRadioActive,
    useRadioPlayer,
} from '/@/renderer/features/radio/hooks/use-radio-player';
import {
    usePlaybackSettings,
    usePlaybackType,
    usePlayerStore,
    useSettingsStore,
    useSkipButtons,
    useTimestampStoreBase,
} from '/@/renderer/store';
import { LibraryItem, QueueSong } from '/@/shared/types/domain-types';
import { PlayerStatus, PlayerType } from '/@/shared/types/types';

const mediaSession = navigator.mediaSession;

export const useMediaSession = () => {
    const { mediaSession: mediaSessionEnabled } = usePlaybackSettings();
    const player = usePlayer();
    const skip = useSkipButtons();
    const playbackType = useSettingsStore((state) => state.playback.type);
    const isRadioActive = useIsRadioActive();
    const { isPlaying: isRadioPlaying, metadata: radioMetadata, stationName } = useRadioPlayer();

    const isMediaSessionEnabled = useMemo(() => {
        // Always enable media session on web
        if (!isElectron()) {
            return true;
        }

        return Boolean(mediaSessionEnabled && playbackType === PlayerType.WEB);
    }, [mediaSessionEnabled, playbackType]);

    useEffect(() => {
        if (!isMediaSessionEnabled) {
            return;
        }

        mediaSession.setActionHandler('nexttrack', () => {
            if (isRadioActive && isRadioPlaying) {
                return;
            }

            player.mediaNext();
        });

        mediaSession.setActionHandler('pause', () => {
            player.mediaPause();
        });

        mediaSession.setActionHandler('play', () => {
            player.mediaPlay();
        });

        mediaSession.setActionHandler('previoustrack', () => {
            if (isRadioActive && isRadioPlaying) {
                return;
            }

            player.mediaPrevious();
        });

        mediaSession.setActionHandler('seekto', (e) => {
            if (isRadioActive && isRadioPlaying) {
                return;
            }

            if (e.seekTime) {
                player.mediaSeekToTimestamp(e.seekTime);
            } else if (e.seekOffset) {
                const currentTimestamp = useTimestampStoreBase.getState().timestamp;
                player.mediaSeekToTimestamp(currentTimestamp + e.seekOffset);
            }
        });

        mediaSession.setActionHandler('stop', () => {
            player.mediaStop();
        });

        mediaSession.setActionHandler('seekbackward', (e) => {
            if (isRadioActive && isRadioPlaying) {
                return;
            }

            const currentTimestamp = useTimestampStoreBase.getState().timestamp;
            player.mediaSeekToTimestamp(
                currentTimestamp - (e.seekOffset || skip?.skipBackwardSeconds || 5),
            );
        });

        mediaSession.setActionHandler('seekforward', (e) => {
            if (isRadioActive && isRadioPlaying) {
                return;
            }

            const currentTimestamp = useTimestampStoreBase.getState().timestamp;
            player.mediaSeekToTimestamp(
                currentTimestamp + (e.seekOffset || skip?.skipForwardSeconds || 5),
            );
        });

        return () => {
            mediaSession.setActionHandler('nexttrack', null);
            mediaSession.setActionHandler('pause', null);
            mediaSession.setActionHandler('play', null);
            mediaSession.setActionHandler('previoustrack', null);
            mediaSession.setActionHandler('seekto', null);
            mediaSession.setActionHandler('stop', null);
            mediaSession.setActionHandler('seekbackward', null);
            mediaSession.setActionHandler('seekforward', null);
        };
    }, [
        player,
        skip?.skipBackwardSeconds,
        skip?.skipForwardSeconds,
        isMediaSessionEnabled,
        isRadioActive,
        isRadioPlaying,
    ]);

    const updateMediaSessionMetadata = useCallback(
        (song: QueueSong | undefined) => {
            if (!isMediaSessionEnabled) {
                return;
            }

            // Handle radio metadata when radio is active and playing
            if (isRadioActive && isRadioPlaying) {
                const title = radioMetadata?.title || stationName || 'Radio';
                const artist = radioMetadata?.artist || stationName || '';

                mediaSession.metadata = new MediaMetadata({
                    album: stationName || '',
                    artist: artist,
                    artwork: [],
                    title: title,
                });
                return;
            }

            // Handle regular song metadata
            if (!song) {
                return;
            }

            const imageUrl = getItemImageUrl({
                id: song?.imageId || undefined,
                imageUrl: song?.imageUrl,
                itemType: LibraryItem.SONG,
                type: 'itemCard',
            });

            mediaSession.metadata = new MediaMetadata({
                album: song?.album ?? '',
                artist: song?.artistName ?? '',
                artwork: imageUrl ? [{ src: imageUrl, type: 'image/png' }] : [],
                title: song?.name ?? '',
            });
        },
        [isMediaSessionEnabled, isRadioActive, isRadioPlaying, radioMetadata, stationName],
    );

    // Update metadata when radio metadata changes
    useEffect(() => {
        if (!isMediaSessionEnabled) {
            return;
        }

        if (isRadioActive && isRadioPlaying) {
            updateMediaSessionMetadata(undefined);
        }
    }, [
        isMediaSessionEnabled,
        isRadioActive,
        isRadioPlaying,
        radioMetadata,
        stationName,
        updateMediaSessionMetadata,
    ]);

    usePlayerEvents(
        {
            onCurrentSongChange: (properties) => {
                if (!isMediaSessionEnabled) {
                    return;
                }

                if (isRadioActive && isRadioPlaying) {
                    return;
                }

                updateMediaSessionMetadata(properties.song);
            },
            onPlayerRepeated: () => {
                if (!isMediaSessionEnabled) {
                    return;
                }

                if (isRadioActive && isRadioPlaying) {
                    return;
                }

                const currentSong = usePlayerStore.getState().getCurrentSong();
                updateMediaSessionMetadata(currentSong);
            },
            onPlayerStatus: (properties) => {
                if (!isMediaSessionEnabled) {
                    return;
                }

                const status = properties.status;
                mediaSession.playbackState = status === PlayerStatus.PLAYING ? 'playing' : 'paused';
            },
        },
        [isMediaSessionEnabled, isRadioActive, isRadioPlaying, updateMediaSessionMetadata],
    );
};

const MediaSessionHookInner = () => {
    useMediaSession();
    return null;
};

export const MediaSessionHook = () => {
    const isElectronEnv = isElectron();
    const playbackType = usePlaybackType();
    const isMediaSessionEnabled = useSettingsStore((state) => state.playback.mediaSession);

    // We always want to enable media session when on web
    // Otherwise, only enable if it is explicitly enabled in the settings AND using the web player
    const shouldUseMediaSession =
        !isElectronEnv || (isMediaSessionEnabled && playbackType === PlayerType.WEB);

    if (!shouldUseMediaSession) {
        return null;
    }

    return React.createElement(MediaSessionHookInner);
};
