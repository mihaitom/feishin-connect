import { createContext, useCallback, useMemo } from 'react';

import { AddToQueueType } from '/@/renderer/store';
import { LibraryItem, QueueSong, Song } from '/@/shared/types/domain-types';

interface PlayerContext {
    addToQueueByData: (data: Song[], type: AddToQueueType) => void;
    addToQueueByFetch: (id: string[], itemType: LibraryItem, type: AddToQueueType) => void;
    clearQueue: () => void;
    clearSelected: (items: QueueSong[]) => void;
    decreaseVolume: (amount: number) => void;
    increaseVolume: (amount: number) => void;
    mediaNext: () => void;
    mediaPause: () => void;
    mediaPlay: (id: string) => void;
    mediaPrevious: () => void;
    mediaSeekToTimestamp: (timestamp: number) => void;
    mediaStepBackward: () => void;
    mediaStepForward: () => void;
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
    mediaStepBackward: () => {},
    mediaStepForward: () => {},
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
    const addToQueueByData = useCallback((data: Song[], type: AddToQueueType) => {}, []);

    const addToQueueByFetch = useCallback(
        (id: string[], itemType: LibraryItem, type: AddToQueueType) => {},
        [],
    );
    const clearQueue = useCallback(() => {}, []);

    const clearSelected = useCallback((items: QueueSong[]) => {}, []);

    const decreaseVolume = useCallback((amount: number) => {}, []);

    const increaseVolume = useCallback((amount: number) => {}, []);

    const mediaNext = useCallback(() => {}, []);

    const mediaPause = useCallback(() => {}, []);

    const mediaPlay = useCallback((id: string) => {}, []);

    const mediaPrevious = useCallback(() => {}, []);

    const mediaSeekToTimestamp = useCallback((timestamp: number) => {}, []);

    const mediaStepBackward = useCallback(() => {}, []);

    const mediaStepForward = useCallback(() => {}, []);

    const mediaToggleMute = useCallback(() => {}, []);

    const mediaTogglePlayPause = useCallback(() => {}, []);

    const moveSelectedTo = useCallback(
        (items: QueueSong[], edge: 'bottom' | 'top', uniqueId: string) => {},
        [],
    );

    const moveSelectedToBottom = useCallback((items: QueueSong[]) => {}, []);

    const moveSelectedToNext = useCallback((items: QueueSong[]) => {}, []);

    const moveSelectedToTop = useCallback((items: QueueSong[]) => {}, []);

    const setVolume = useCallback((volume: number) => {}, []);

    const shuffle = useCallback(() => {}, []);

    const shuffleAll = useCallback(() => {}, []);

    const shuffleSelected = useCallback((items: QueueSong[]) => {}, []);

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
            mediaStepBackward,
            mediaStepForward,
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
            mediaStepBackward,
            mediaStepForward,
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
