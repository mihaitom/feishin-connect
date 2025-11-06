import isElectron from 'is-electron';
import { useEffect } from 'react';

import { usePlayerEvents } from '/@/renderer/features/player/audio-player/hooks/use-player-events';
import { useCreateFavorite } from '/@/renderer/features/shared/mutations/create-favorite-mutation';
import { useDeleteFavorite } from '/@/renderer/features/shared/mutations/delete-favorite-mutation';
import { useSetRating } from '/@/renderer/features/shared/mutations/set-rating-mutation';
import { usePlayerActions } from '/@/renderer/store';
import { LibraryItem, Song } from '/@/shared/types/domain-types';
import { PlayerShuffle } from '/@/shared/types/types';

const remote = isElectron() ? window.api.remote : null;
const ipc = isElectron() ? window.api.ipc : null;

export const useRemote = () => {
    const { mediaSkipForward, setTimestamp, setVolume } = usePlayerActions();

    const updateRatingMutation = useSetRating({});
    const addToFavoritesMutation = useCreateFavorite({});
    const removeFromFavoritesMutation = useDeleteFavorite({});

    useEffect(() => {
        if (!remote) {
            return;
        }

        remote.requestPosition((_e: unknown, data: { position: number }) => {
            const newTime = data.position;
            setTimestamp(newTime);
        });

        remote.requestSeek((_e: unknown, data: { offset: number }) => {
            mediaSkipForward(data.offset);
        });

        remote.requestRating(
            (_e: unknown, data: { id: string; rating: number; serverId: string }) => {
                updateRatingMutation.mutate({
                    apiClientProps: { serverId: data.serverId },
                    query: {
                        item: [
                            {
                                _serverId: data.serverId,
                                id: data.id,
                                itemType: LibraryItem.SONG,
                            } as Song,
                        ],
                        rating: data.rating,
                    },
                });
            },
        );

        remote.requestVolume((_e: unknown, data: { volume: number }) => {
            setVolume(data.volume);
        });

        remote.requestFavorite(
            (_e: unknown, data: { favorite: boolean; id: string; serverId: string }) => {
                const mutator = data.favorite
                    ? addToFavoritesMutation
                    : removeFromFavoritesMutation;
                mutator.mutate({
                    apiClientProps: { serverId: data.serverId },
                    query: {
                        id: [data.id],
                        type: LibraryItem.SONG,
                    },
                });
            },
        );

        return () => {
            ipc?.removeAllListeners('request-position');
            ipc?.removeAllListeners('request-seek');
            ipc?.removeAllListeners('request-volume');
            ipc?.removeAllListeners('request-favorite');
            ipc?.removeAllListeners('request-rating');
        };
    }, [
        addToFavoritesMutation,
        mediaSkipForward,
        removeFromFavoritesMutation,
        setTimestamp,
        setVolume,
        updateRatingMutation,
    ]);

    usePlayerEvents(
        {
            onPlayerProgress: (properties) => {
                if (!remote) {
                    return;
                }

                remote.updatePosition(properties.timestamp);
            },
            onPlayerRepeat: (properties) => {
                if (!remote) {
                    return;
                }

                remote.updateRepeat(properties.repeat);
            },
            onPlayerShuffle: (properties) => {
                if (!remote) {
                    return;
                }

                const isShuffleEnabled = properties.shuffle !== PlayerShuffle.NONE;
                remote.updateShuffle(isShuffleEnabled);
            },
            onPlayerStatus: (properties) => {
                if (!remote) {
                    return;
                }

                remote.updatePlayback(properties.status);
            },
            onPlayerVolume: (properties) => {
                if (!remote) {
                    return;
                }

                remote.updateVolume(properties.volume);
            },
        },
        [],
    );
};
