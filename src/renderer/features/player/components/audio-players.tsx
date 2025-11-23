import { useEffect } from 'react';

import { eventEmitter } from '/@/renderer/events/event-emitter';
import { UserFavoriteEventPayload, UserRatingEventPayload } from '/@/renderer/events/events';
import { MpvPlayer } from '/@/renderer/features/player/audio-player/mpv-player';
import { WebPlayer } from '/@/renderer/features/player/audio-player/web-player';
import {
    updateQueueFavorites,
    updateQueueRatings,
    useCurrentServerId,
    usePlaybackType,
} from '/@/renderer/store';
import { LibraryItem } from '/@/shared/types/domain-types';
import { PlayerType } from '/@/shared/types/types';

export const AudioPlayers = () => {
    const playbackType = usePlaybackType();
    const serverId = useCurrentServerId();

    // Listen to favorite and rating events to update queue songs
    useEffect(() => {
        const handleFavorite = (payload: UserFavoriteEventPayload) => {
            if (payload.itemType !== LibraryItem.SONG || payload.serverId !== serverId) {
                return;
            }

            updateQueueFavorites(payload.id, payload.favorite);
        };

        const handleRating = (payload: UserRatingEventPayload) => {
            if (payload.itemType !== LibraryItem.SONG || payload.serverId !== serverId) {
                return;
            }

            updateQueueRatings(payload.id, payload.rating);
        };

        eventEmitter.on('USER_FAVORITE', handleFavorite);
        eventEmitter.on('USER_RATING', handleRating);

        return () => {
            eventEmitter.off('USER_FAVORITE', handleFavorite);
            eventEmitter.off('USER_RATING', handleRating);
        };
    }, [serverId]);

    return (
        <>
            {playbackType === PlayerType.WEB && <WebPlayer />}
            {playbackType === PlayerType.LOCAL && <MpvPlayer />}
        </>
    );
};
