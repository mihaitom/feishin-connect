import { createContext, useCallback, useContext, useMemo } from 'react';

import { AddToQueueType, usePlayerActions } from '/@/renderer/store';
import { LibraryItem, QueueSong, Song } from '/@/shared/types/domain-types';
import { Play } from '/@/shared/types/types';

interface PlayerContext {
    addToQueueByData: (data: Song[], type: AddToQueueType) => void;
    addToQueueByFetch: (id: string[], itemType: LibraryItem, type: AddToQueueType) => void;
    clearQueue: () => void;
    clearSelected: (items: QueueSong[]) => void;
    decreaseVolume: (amount: number) => void;
    increaseVolume: (amount: number) => void;
    mediaNext: () => void;
    mediaPause: () => void;
    mediaPlay: (id?: string) => void;
    mediaPrevious: () => void;
    mediaSeekToTimestamp: (timestamp: number) => void;
    mediaSkipBackward: () => void;
    mediaSkipForward: () => void;
    mediaToggleMute: () => void;
    mediaTogglePlayPause: () => void;
    moveSelectedTo: (items: QueueSong[], edge: 'bottom' | 'top', uniqueId: string) => void;
    moveSelectedToBottom: (items: QueueSong[]) => void;
    moveSelectedToNext: (items: QueueSong[]) => void;
    moveSelectedToTop: (items: QueueSong[]) => void;
    setVolume: (volume: number) => void;
    shuffle: () => void;
    shuffleAll: () => void;
    shuffleSelected: (items: QueueSong[]) => void;
}

export const PlayerContext = createContext<PlayerContext>({
    addToQueueByData: () => {},
    addToQueueByFetch: () => {},
    clearQueue: () => {},
    clearSelected: () => {},
    decreaseVolume: () => {},
    increaseVolume: () => {},
    mediaNext: () => {},
    mediaPause: () => {},
    mediaPlay: () => {},
    mediaPrevious: () => {},
    mediaSeekToTimestamp: () => {},
    mediaSkipBackward: () => {},
    mediaSkipForward: () => {},
    mediaToggleMute: () => {},
    mediaTogglePlayPause: () => {},
    moveSelectedTo: () => {},
    moveSelectedToBottom: () => {},
    moveSelectedToNext: () => {},
    moveSelectedToTop: () => {},
    setVolume: () => {},
    shuffle: () => {},
    shuffleAll: () => {},
    shuffleSelected: () => {},
});

export const PlayerProvider = ({ children }: { children: React.ReactNode }) => {
    const storeActions = usePlayerActions();

    const addToQueueByData = useCallback(
        (data: Song[], type: AddToQueueType) => {
            if (typeof type === 'object' && 'edge' in type && type.edge !== null) {
                const edge = type.edge === 'top' ? 'top' : 'bottom';
                storeActions.addToQueueByUniqueId(data, type.uniqueId, edge);
            } else {
                storeActions.addToQueueByType(data, type as Play);
            }
        },
        [storeActions],
    );

    const addToQueueByFetch = useCallback(
        (id: string[], itemType: LibraryItem, type: AddToQueueType) => {},
        [],
    );

    const clearQueue = useCallback(() => {
        storeActions.clearQueue();
    }, [storeActions]);

    const clearSelected = useCallback(
        (items: QueueSong[]) => {
            storeActions.clearSelected(items);
        },
        [storeActions],
    );

    const decreaseVolume = useCallback(
        (amount: number) => {
            storeActions.decreaseVolume(amount);
        },
        [storeActions],
    );

    const increaseVolume = useCallback(
        (amount: number) => {
            storeActions.increaseVolume(amount);
        },
        [storeActions],
    );

    const mediaNext = useCallback(() => {
        storeActions.mediaNext();
    }, [storeActions]);

    const mediaPause = useCallback(() => {
        storeActions.mediaPause();
    }, [storeActions]);

    const mediaPlay = useCallback(
        (id?: string) => {
            storeActions.mediaPlay(id);
        },
        [storeActions],
    );

    const mediaPrevious = useCallback(() => {
        storeActions.mediaPrevious();
    }, [storeActions]);

    const mediaSeekToTimestamp = useCallback(
        (timestamp: number) => {
            storeActions.mediaSeekToTimestamp(timestamp);
        },
        [storeActions],
    );

    const mediaSkipBackward = useCallback(() => {
        storeActions.mediaSkipBackward();
    }, [storeActions]);

    const mediaSkipForward = useCallback(() => {
        storeActions.mediaSkipForward();
    }, [storeActions]);

    const mediaToggleMute = useCallback(() => {
        storeActions.mediaToggleMute();
    }, [storeActions]);

    const mediaTogglePlayPause = useCallback(() => {
        storeActions.mediaTogglePlayPause();
    }, [storeActions]);

    const moveSelectedTo = useCallback(
        (items: QueueSong[], edge: 'bottom' | 'top', uniqueId: string) => {
            storeActions.moveSelectedTo(items, uniqueId, edge);
        },
        [storeActions],
    );

    const moveSelectedToBottom = useCallback(
        (items: QueueSong[]) => {
            storeActions.moveSelectedToBottom(items);
        },
        [storeActions],
    );

    const moveSelectedToNext = useCallback(
        (items: QueueSong[]) => {
            storeActions.moveSelectedToNext(items);
        },
        [storeActions],
    );

    const moveSelectedToTop = useCallback(
        (items: QueueSong[]) => {
            storeActions.moveSelectedToTop(items);
        },
        [storeActions],
    );

    const setVolume = useCallback(
        (volume: number) => {
            storeActions.setVolume(volume);
        },
        [storeActions],
    );

    const shuffle = useCallback(() => {
        storeActions.shuffle();
    }, [storeActions]);

    const shuffleAll = useCallback(() => {
        storeActions.shuffleAll();
    }, [storeActions]);

    const shuffleSelected = useCallback(
        (items: QueueSong[]) => {
            storeActions.shuffleSelected(items);
        },
        [storeActions],
    );

    const contextValue: PlayerContext = useMemo(
        () => ({
            addToQueueByData,
            addToQueueByFetch,
            clearQueue,
            clearSelected,
            decreaseVolume,
            increaseVolume,
            mediaNext,
            mediaPause,
            mediaPlay,
            mediaPrevious,
            mediaSeekToTimestamp,
            mediaSkipBackward,
            mediaSkipForward,
            mediaToggleMute,
            mediaTogglePlayPause,
            moveSelectedTo,
            moveSelectedToBottom,
            moveSelectedToNext,
            moveSelectedToTop,
            setVolume,
            shuffle,
            shuffleAll,
            shuffleSelected,
        }),
        [
            addToQueueByData,
            addToQueueByFetch,
            clearQueue,
            clearSelected,
            decreaseVolume,
            increaseVolume,
            mediaNext,
            mediaPause,
            mediaPlay,
            mediaPrevious,
            mediaSeekToTimestamp,
            mediaSkipBackward,
            mediaSkipForward,
            mediaToggleMute,
            mediaTogglePlayPause,
            moveSelectedTo,
            moveSelectedToBottom,
            moveSelectedToNext,
            moveSelectedToTop,
            setVolume,
            shuffle,
            shuffleAll,
            shuffleSelected,
        ],
    );

    return <PlayerContext.Provider value={contextValue}>{children}</PlayerContext.Provider>;
};

export const usePlayer = () => {
    return useContext(PlayerContext);
};
