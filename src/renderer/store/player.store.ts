import type { QueryClient } from '@tanstack/react-query';

import merge from 'lodash/merge';
import { nanoid } from 'nanoid';
import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { useShallow } from 'zustand/react/shallow';

import { createSelectors } from '/@/renderer/lib/zustand';
import { shuffleInPlace } from '/@/renderer/utils/shuffle';
import { QueueSong, Song } from '/@/shared/types/domain-types';
import {
    Play,
    PlayerQueueType,
    PlayerRepeat,
    PlayerShuffle,
    PlayerStatus,
    PlayerStyle,
} from '/@/shared/types/types';

export interface PlayerData {
    currentTrack: QueueSong | undefined;
    nextTrack: QueueSong | undefined;
    player: {
        index: number;
        muted: boolean;
        playerNum: 1 | 2;
        repeat: PlayerRepeat;
        shuffle: PlayerShuffle;
        speed: number;
        status: PlayerStatus;
        transitionType: PlayerStyle;
        volume: number;
    };
    player1: QueueSong | undefined;
    player2: QueueSong | undefined;
    queue: QueueData;
}

export interface PlayerState extends Actions, State {}

export interface QueueData {
    default: QueueSong[];
    priority: QueueSong[];
    shuffled: string[];
}

export type QueueGroupingProperty = keyof QueueSong;

interface Actions {
    addToQueueByType: (items: Song[], playType: Play) => void;
    addToQueueByUniqueId: (items: Song[], uniqueId: string, edge: 'bottom' | 'top') => void;
    clearQueue: () => void;
    clearSelected: (items: QueueSong[]) => void;
    decreaseVolume: (value: number) => void;
    getCurrentSong: () => QueueSong | undefined;
    getQueue: (groupBy?: QueueGroupingProperty) => GroupedQueue;
    getQueueOrder: () => {
        groups: { count: number; name: string }[];
        items: QueueSong[];
    };
    increaseVolume: (value: number) => void;
    mediaAutoNext: () => PlayerData;
    mediaNext: () => void;
    mediaPause: () => void;
    mediaPlay: (id?: string) => void;
    mediaPrevious: () => void;
    mediaSeekToTimestamp: (timestamp: number) => void;
    mediaStepBackward: () => void;
    mediaStepForward: () => void;
    mediaToggleMute: () => void;
    mediaTogglePlayPause: () => void;
    moveSelectedTo: (items: QueueSong[], uniqueId: string, edge: 'bottom' | 'top') => void;
    moveSelectedToBottom: (items: QueueSong[]) => void;
    moveSelectedToNext: (items: QueueSong[]) => void;
    moveSelectedToTop: (items: QueueSong[]) => void;
    setCrossfadeDuration: (duration: number) => void;
    setProgress: (timestamp: number) => void;
    setQueueType: (queueType: PlayerQueueType) => void;
    setRepeat: (repeat: PlayerRepeat) => void;
    setShuffle: (shuffle: PlayerShuffle) => void;
    setSpeed: (speed: number) => void;
    setTransitionType: (transitionType: PlayerStyle) => void;
    setVolume: (volume: number) => void;
    shuffle: () => void;
    shuffleAll: () => void;
    shuffleSelected: (items: QueueSong[]) => void;
}

interface GroupedQueue {
    groups: { count: number; name: string }[];
    items: QueueSong[];
}

interface State {
    player: {
        crossfadeDuration: number;
        index: number;
        muted: boolean;
        playerNum: 1 | 2;
        queueType: PlayerQueueType;
        repeat: PlayerRepeat;
        seekToTimestamp: string;
        shuffle: PlayerShuffle;
        speed: number;
        status: PlayerStatus;
        stepBackward: number;
        stepForward: number;
        timestamp: number;
        transitionType: PlayerStyle;
        volume: number;
    };
    queue: QueueData;
}

export const usePlayerStoreBase = create<PlayerState>()(
    persist(
        subscribeWithSelector(
            immer((set, get) => ({
                addToQueueByType: (items, playType) => {
                    const newItems = items.map(toQueueSong);

                    const queueType = getQueueType();

                    switch (queueType) {
                        case PlayerQueueType.DEFAULT: {
                            switch (playType) {
                                case Play.LAST: {
                                    set((state) => {
                                        const currentIndex = state.player.index;

                                        state.queue.default = [...state.queue.default, ...newItems];

                                        if (state.player.shuffle === PlayerShuffle.TRACK) {
                                            state.queue.shuffled = [
                                                ...state.queue.shuffled.slice(0, currentIndex),
                                                state.queue.shuffled[currentIndex],
                                                ...shuffleInPlace([
                                                    ...state.queue.shuffled.slice(currentIndex + 1),
                                                    ...newItems.map((item) => item.uniqueId),
                                                ]),
                                            ];
                                        }
                                    });
                                    break;
                                }
                                case Play.NEXT: {
                                    set((state) => {
                                        const currentIndex = state.player.index;

                                        state.queue.default = [
                                            ...state.queue.default.slice(0, currentIndex + 1),
                                            ...newItems,
                                            ...state.queue.default.slice(currentIndex + 1),
                                        ];

                                        if (state.player.shuffle === PlayerShuffle.TRACK) {
                                            state.queue.shuffled = [
                                                ...state.queue.shuffled.slice(0, currentIndex),
                                                state.queue.shuffled[currentIndex],
                                                ...shuffleInPlace([
                                                    ...state.queue.shuffled.slice(currentIndex + 1),
                                                    ...newItems.map((item) => item.uniqueId),
                                                ]),
                                            ];
                                        }
                                    });
                                    break;
                                }
                                case Play.NOW: {
                                    set((state) => {
                                        state.queue.default = [];
                                        state.player.index = 0;
                                        state.player.status = PlayerStatus.PLAYING;
                                        state.player.playerNum = 1;
                                        state.queue.default = newItems;

                                        if (state.player.shuffle === PlayerShuffle.TRACK) {
                                            state.queue.shuffled = shuffleInPlace(
                                                newItems.map((item) => item.uniqueId),
                                            );
                                        }
                                    });

                                    break;
                                }
                            }
                            break;
                        }
                        case PlayerQueueType.PRIORITY: {
                            switch (playType) {
                                case Play.LAST: {
                                    set((state) => {
                                        state.queue.priority = [
                                            ...state.queue.priority,
                                            ...newItems,
                                        ];

                                        state.queue.shuffled = [
                                            ...state.queue.shuffled,
                                            ...newItems.map((item) => item.uniqueId),
                                        ];
                                    });
                                    break;
                                }
                                case Play.NEXT: {
                                    set((state) => {
                                        const currentIndex = state.player.index;
                                        const isInPriority =
                                            currentIndex < state.queue.priority.length;

                                        if (isInPriority) {
                                            state.queue.priority = [
                                                ...state.queue.priority.slice(0, currentIndex + 1),
                                                ...newItems,
                                                ...state.queue.priority.slice(currentIndex + 1),
                                            ];
                                        } else {
                                            state.queue.priority = [
                                                ...state.queue.priority,
                                                ...newItems,
                                            ];
                                        }

                                        state.queue.shuffled = [
                                            ...state.queue.shuffled.slice(0, currentIndex),
                                            state.queue.shuffled[currentIndex],
                                            ...shuffleInPlace([
                                                ...state.queue.shuffled.slice(currentIndex + 1),
                                                ...newItems.map((item) => item.uniqueId),
                                            ]),
                                        ];
                                    });
                                    break;
                                }
                                case Play.NOW: {
                                    set((state) => {
                                        state.queue.default = [];
                                        state.player.status = PlayerStatus.PLAYING;
                                        state.player.playerNum = 1;

                                        // Add the first item after the current playing track

                                        const currentIndex = state.player.index;

                                        const queue = state.getQueue();
                                        const currentTrack = queue.items[currentIndex];

                                        if (queue.items.length === 0) {
                                            state.queue.priority = [...newItems.slice(0, 1)];
                                            state.queue.default = [...newItems.slice(1)];
                                            state.player.index = 0;
                                        } else if (currentTrack) {
                                            const priorityIndex = state.queue.priority.findIndex(
                                                (item) => item.uniqueId === currentTrack.uniqueId,
                                            );

                                            // If the current track is in the priority queue, add the first item after the current track
                                            if (priorityIndex !== -1) {
                                                state.queue.priority = [
                                                    ...state.queue.priority.slice(
                                                        0,
                                                        priorityIndex + 1,
                                                    ),
                                                    ...newItems.slice(0, 1),
                                                    ...state.queue.priority.slice(
                                                        priorityIndex + 1,
                                                    ),
                                                ];

                                                state.player.index = priorityIndex + 1;

                                                state.queue.default = [
                                                    ...state.queue.default,
                                                    ...newItems.slice(1),
                                                ];
                                            } else {
                                                // If the current track is not in the priority queue, add it to the end of the priority queue
                                                state.queue.priority = [
                                                    ...state.queue.priority.slice(0, currentIndex),
                                                    ...newItems.slice(0, 1),
                                                    ...state.queue.priority.slice(currentIndex),
                                                ];

                                                state.queue.default = [
                                                    ...state.queue.default,
                                                    ...newItems.slice(1),
                                                ];

                                                state.player.index =
                                                    state.queue.priority.length - 1;
                                            }
                                        }

                                        if (state.player.shuffle === PlayerShuffle.TRACK) {
                                            state.queue.shuffled = shuffleInPlace(
                                                newItems.map((item) => item.uniqueId),
                                            );
                                        }
                                    });
                                    break;
                                }
                            }
                            break;
                        }
                    }
                },
                addToQueueByUniqueId: (items, uniqueId, edge) => {
                    const newItems = items.map(toQueueSong);
                    const queueType = getQueueType();

                    set((state) => {
                        if (queueType === PlayerQueueType.DEFAULT) {
                            const index = state.queue.default.findIndex(
                                (item) => item.uniqueId === uniqueId,
                            );

                            const insertIndex = Math.max(0, edge === 'top' ? index : index + 1);

                            // Recalculate the player index if we're inserting items above the current index
                            if (insertIndex <= state.player.index) {
                                state.player.index = state.player.index + newItems.length;
                            }

                            const newQueue = [
                                ...state.queue.default.slice(0, insertIndex),
                                ...newItems,
                                ...state.queue.default.slice(insertIndex),
                            ];

                            recalculatePlayerIndex(state, newQueue);

                            state.queue.default = newQueue;
                        } else {
                            const priorityIndex = state.queue.priority.findIndex(
                                (item) => item.uniqueId === uniqueId,
                            );

                            if (priorityIndex !== -1) {
                                const insertIndex = Math.max(
                                    0,
                                    edge === 'top' ? priorityIndex : priorityIndex + 1,
                                );

                                state.queue.priority = [
                                    ...state.queue.priority.slice(0, insertIndex),
                                    ...newItems,
                                    ...state.queue.priority.slice(insertIndex),
                                ];
                            } else {
                                const defaultIndex = state.queue.default.findIndex(
                                    (item) => item.uniqueId === uniqueId,
                                );

                                if (defaultIndex !== -1) {
                                    const insertIndex = Math.max(
                                        0,
                                        edge === 'top' ? defaultIndex : defaultIndex + 1,
                                    );

                                    state.queue.default = [
                                        ...state.queue.default.slice(0, insertIndex),
                                        ...newItems,
                                        ...state.queue.default.slice(insertIndex),
                                    ];
                                }
                            }

                            if (state.player.shuffle === PlayerShuffle.TRACK) {
                                const currentIndex = state.player.index;

                                state.queue.shuffled = [
                                    ...state.queue.shuffled.slice(0, currentIndex),
                                    state.queue.shuffled[currentIndex],
                                    ...shuffleInPlace([
                                        ...state.queue.shuffled.slice(currentIndex + 1),
                                        ...newItems.map((item) => item.uniqueId),
                                    ]),
                                ];
                            }
                        }
                    });
                },
                clearQueue: () => {
                    set((state) => {
                        state.player.index = -1;
                        state.queue.default = [];
                        state.queue.priority = [];
                    });
                },
                clearSelected: (items: QueueSong[]) => {
                    set((state) => {
                        const uniqueIds = items.map((item) => item.uniqueId);

                        state.queue.default = state.queue.default.filter(
                            (item) => !uniqueIds.includes(item.uniqueId),
                        );

                        state.queue.priority = state.queue.priority.filter(
                            (item) => !uniqueIds.includes(item.uniqueId),
                        );

                        const newQueue = [...state.queue.priority, ...state.queue.default];

                        recalculatePlayerIndex(state, newQueue);
                    });
                },
                decreaseVolume: (value: number) => {
                    set((state) => {
                        state.player.volume = Math.max(0, state.player.volume - value);
                    });
                },
                getCurrentSong: () => {
                    const queue = get().getQueue();
                    return queue.items[get().player.index];
                },
                getQueue: (groupBy?: QueueGroupingProperty) => {
                    const queue = get().getQueueOrder();
                    const queueType = getQueueType();

                    if (!groupBy || queueType === PlayerQueueType.PRIORITY) {
                        return queue;
                    }

                    // Track groups in order of appearance
                    const groups: { count: number; name: string }[] = [];
                    const seenGroups = new Set<string>();

                    // Process items and build groups in order
                    queue.items.forEach((item) => {
                        const groupValue = String(item[groupBy] || 'Unknown');

                        if (!seenGroups.has(groupValue)) {
                            seenGroups.add(groupValue);
                            groups.push({ count: 1, name: groupValue });
                        } else {
                            // Find the last occurrence of this group value
                            const lastIndex = [...groups]
                                .reverse()
                                .findIndex((g) => g.name === groupValue);
                            if (lastIndex === -1) return;

                            // If the previous group is different, create a new group
                            const previousGroup = groups[groups.length - 1];
                            if (previousGroup.name !== groupValue) {
                                groups.push({ count: 1, name: groupValue });
                            } else {
                                // Increment the count of the last matching group
                                groups[groups.length - 1].count++;
                            }
                        }
                    });

                    return { groups, items: queue.items };
                },
                getQueueOrder: () => {
                    const queueType = getQueueType();

                    if (queueType === PlayerQueueType.PRIORITY) {
                        const defaultQueue = get().queue.default;
                        const priorityQueue = get().queue.priority;

                        return {
                            groups: [
                                { count: priorityQueue.length, name: 'Priority' },
                                { count: defaultQueue.length, name: 'Default' },
                            ],
                            items: [...priorityQueue, ...defaultQueue],
                        };
                    }

                    const defaultQueue = get().queue.default;

                    return {
                        groups: [{ count: defaultQueue.length, name: 'All' }],
                        items: defaultQueue,
                    };
                },
                increaseVolume: (value: number) => {
                    set((state) => {
                        state.player.volume = Math.min(100, state.player.volume + value);
                    });
                },
                mediaAutoNext: () => {
                    const currentIndex = get().player.index;
                    const player = get().player;
                    const repeat = player.repeat;
                    const queue = get().getQueueOrder();

                    const newPlayerNum = player.playerNum === 1 ? 2 : 1;
                    let newIndex = Math.min(queue.items.length - 1, currentIndex + 1);
                    let newStatus = PlayerStatus.PLAYING;

                    if (repeat === PlayerRepeat.ONE) {
                        newIndex = currentIndex;
                    }

                    if (newIndex === queue.items.length - 1) {
                        newStatus = PlayerStatus.PAUSED;
                    }

                    set((state) => {
                        state.player.index = newIndex;
                        state.player.playerNum = newPlayerNum;
                        state.player.timestamp = 0;
                        state.player.status = newStatus;
                    });

                    return {
                        currentTrack: queue.items[newIndex],
                        nextTrack: queue.items[newIndex + 1],
                        player: {
                            index: newIndex,
                            muted: player.muted,
                            playerNum: newPlayerNum,
                            repeat: player.repeat,
                            shuffle: player.shuffle,
                            speed: player.speed,
                            status: newStatus,
                            transitionType: player.transitionType,
                            volume: player.volume,
                        },
                        player1:
                            newPlayerNum === 1 ? queue.items[newIndex] : queue.items[newIndex + 1],
                        player2:
                            newPlayerNum === 2 ? queue.items[newIndex] : queue.items[newIndex + 1],
                        queue: get().queue,
                    };
                },
                mediaNext: () => {
                    const currentIndex = get().player.index;
                    const queue = get().getQueueOrder();

                    set((state) => {
                        state.player.index = Math.min(queue.items.length - 1, currentIndex + 1);
                        state.player.playerNum = 1;
                    });
                },
                mediaPause: () => {
                    set((state) => {
                        state.player.status = PlayerStatus.PAUSED;
                    });
                },
                mediaPlay: (id?: string) => {
                    set((state) => {
                        if (id) {
                            const queue = state.getQueue();

                            const index = queue.items.findIndex((item) => item.uniqueId === id);

                            if (index !== -1) {
                                state.player.index = index;
                            }
                        }

                        state.player.status = PlayerStatus.PLAYING;
                    });
                },
                mediaPrevious: () => {
                    const currentIndex = get().player.index;

                    set((state) => {
                        // Only decrement if we're not at the start
                        state.player.index = Math.max(0, currentIndex - 1);
                    });
                },
                mediaSeekToTimestamp: (timestamp: number) => {
                    set((state) => {
                        state.player.seekToTimestamp = uniqueSeekToTimestamp(timestamp);
                    });
                },
                mediaStepBackward: () => {
                    set((state) => {
                        const newTimestamp = Math.max(
                            0,
                            state.player.timestamp - state.player.stepBackward,
                        );

                        state.player.seekToTimestamp = uniqueSeekToTimestamp(newTimestamp);
                    });
                },
                mediaStepForward: () => {
                    set((state) => {
                        const queue = state.getQueue();
                        const index = state.player.index;
                        const currentTrack = queue.items[index];
                        const duration = currentTrack?.duration;

                        if (!duration) {
                            return;
                        }

                        const newTimestamp = Math.min(
                            duration - 1,
                            state.player.timestamp + state.player.stepForward,
                        );

                        state.player.seekToTimestamp = uniqueSeekToTimestamp(newTimestamp);
                    });
                },
                mediaToggleMute: () => {
                    set((state) => {
                        state.player.muted = !state.player.muted;
                    });
                },
                mediaTogglePlayPause: () => {
                    set((state) => {
                        if (state.player.status === PlayerStatus.PLAYING) {
                            state.mediaPause();
                        } else {
                            state.mediaPlay();
                        }
                    });
                },
                moveSelectedTo: (items: QueueSong[], uniqueId: string, edge: 'bottom' | 'top') => {
                    const queueType = getQueueType();

                    set((state) => {
                        const uniqueIdMap = new Map(items.map((item) => [item.uniqueId, item]));

                        if (queueType == PlayerQueueType.DEFAULT) {
                            // Find the index of the drop target
                            const index = state.queue.default.findIndex(
                                (item) => item.uniqueId === uniqueId,
                            );

                            // Get the new index based on the edge
                            const insertIndex = Math.max(0, edge === 'top' ? index : index + 1);

                            const itemsBefore = state.queue.default
                                .slice(0, insertIndex)
                                .filter((item) => !uniqueIdMap.has(item.uniqueId));

                            const itemsAfter = state.queue.default
                                .slice(insertIndex)
                                .filter((item) => !uniqueIdMap.has(item.uniqueId));

                            const newQueue = [...itemsBefore, ...items, ...itemsAfter];

                            recalculatePlayerIndex(state, newQueue);
                            state.queue.default = newQueue;
                        } else {
                            const priorityIndex = state.queue.priority.findIndex(
                                (item) => item.uniqueId === uniqueId,
                            );

                            // If the item is in the priority queue
                            if (priorityIndex !== -1) {
                                const newIndex = Math.max(
                                    0,
                                    edge === 'top' ? priorityIndex : priorityIndex + 1,
                                );

                                const itemsBefore = state.queue.priority
                                    .slice(0, newIndex)
                                    .filter((item) => !uniqueIdMap.has(item.uniqueId));

                                const itemsAfter = state.queue.priority
                                    .slice(newIndex)
                                    .filter((item) => !uniqueIdMap.has(item.uniqueId));

                                const newPriorityQueue = [...itemsBefore, ...items, ...itemsAfter];

                                const newDefaultQueue = state.queue.default.filter(
                                    (item) => !uniqueIdMap.has(item.uniqueId),
                                );

                                recalculatePlayerIndex(state, newPriorityQueue);

                                state.queue.priority = newPriorityQueue;
                                state.queue.default = newDefaultQueue;
                            } else {
                                const defaultIndex = state.queue.default.findIndex(
                                    (item) => item.uniqueId === uniqueId,
                                );

                                if (defaultIndex !== -1) {
                                    const newIndex = Math.max(
                                        0,
                                        edge === 'top' ? defaultIndex : defaultIndex + 1,
                                    );

                                    const itemsBefore = state.queue.default
                                        .slice(0, newIndex)
                                        .filter((item) => !uniqueIdMap.has(item.uniqueId));

                                    const itemsAfter = state.queue.default
                                        .slice(newIndex)
                                        .filter((item) => !uniqueIdMap.has(item.uniqueId));

                                    const newDefaultQueue = [
                                        ...itemsBefore,
                                        ...items,
                                        ...itemsAfter,
                                    ];

                                    const newPriorityQueue = state.queue.priority.filter(
                                        (item) => !uniqueIdMap.has(item.uniqueId),
                                    );

                                    recalculatePlayerIndex(state, newDefaultQueue);

                                    state.queue.default = newDefaultQueue;
                                    state.queue.priority = newPriorityQueue;
                                }
                            }
                        }
                    });
                },
                moveSelectedToBottom: (items: QueueSong[]) => {
                    set((state) => {
                        const uniqueIds = items.map((item) => item.uniqueId);

                        if (state.player.queueType === PlayerQueueType.PRIORITY) {
                            const priorityFiltered = state.queue.priority.filter(
                                (item) => !uniqueIds.includes(item.uniqueId),
                            );

                            const newPriorityQueue = [...priorityFiltered, ...items];

                            const filtered = state.queue.default.filter(
                                (item) => !uniqueIds.includes(item.uniqueId),
                            );

                            const newDefaultQueue = [...filtered];

                            recalculatePlayerIndex(state, newPriorityQueue);

                            state.queue.default = newDefaultQueue;
                            state.queue.priority = newPriorityQueue;
                        } else {
                            const filtered = state.queue.default.filter(
                                (item) => !uniqueIds.includes(item.uniqueId),
                            );

                            const newQueue = [...filtered, ...items];

                            recalculatePlayerIndex(state, newQueue);

                            state.queue.default = newQueue;
                        }
                    });
                },
                moveSelectedToNext: (items: QueueSong[]) => {
                    const queueType = getQueueType();

                    set((state) => {
                        const queue = state.getQueue();
                        const index = state.player.index;
                        const currentTrack = queue.items[index];
                        const uniqueId = currentTrack?.uniqueId;

                        const uniqueIds = items.map((item) => item.uniqueId);

                        if (queueType === PlayerQueueType.DEFAULT) {
                            const currentIndex = state.player.index;
                            const filtered = state.queue.default.filter(
                                (item) => !uniqueIds.includes(item.uniqueId),
                            );

                            const newQueue = [
                                ...filtered.slice(0, currentIndex + 1),
                                ...items,
                                ...filtered.slice(currentIndex + 1),
                            ];

                            recalculatePlayerIndex(state, newQueue);
                            state.queue.default = newQueue;
                        } else {
                            const priorityIndex = state.queue.priority.findIndex(
                                (item) => item.uniqueId === uniqueId,
                            );

                            const uniqueIdMap = new Map(items.map((item) => [item.uniqueId, item]));

                            // If the item is in the priority queue
                            if (priorityIndex !== -1) {
                                const newIndex = Math.max(0, priorityIndex + 1);

                                const itemsBefore = state.queue.priority
                                    .slice(0, newIndex)
                                    .filter((item) => !uniqueIdMap.has(item.uniqueId));

                                const itemsAfter = state.queue.priority
                                    .slice(newIndex)
                                    .filter((item) => !uniqueIdMap.has(item.uniqueId));

                                const newPriorityQueue = [...itemsBefore, ...items, ...itemsAfter];

                                const newDefaultQueue = state.queue.default.filter(
                                    (item) => !uniqueIdMap.has(item.uniqueId),
                                );

                                recalculatePlayerIndex(state, newPriorityQueue);

                                state.queue.priority = newPriorityQueue;
                                state.queue.default = newDefaultQueue;
                            } else {
                                const defaultIndex = state.queue.default.findIndex(
                                    (item) => item.uniqueId === uniqueId,
                                );

                                if (defaultIndex !== -1) {
                                    const newIndex = Math.max(0, defaultIndex + 1);

                                    const itemsBefore = state.queue.default
                                        .slice(0, newIndex)
                                        .filter((item) => !uniqueIdMap.has(item.uniqueId));

                                    const itemsAfter = state.queue.default
                                        .slice(newIndex)
                                        .filter((item) => !uniqueIdMap.has(item.uniqueId));

                                    const newDefaultQueue = [
                                        ...itemsBefore,
                                        ...items,
                                        ...itemsAfter,
                                    ];

                                    const newPriorityQueue = state.queue.priority.filter(
                                        (item) => !uniqueIdMap.has(item.uniqueId),
                                    );

                                    recalculatePlayerIndex(state, newDefaultQueue);

                                    state.queue.default = newDefaultQueue;
                                    state.queue.priority = newPriorityQueue;
                                }
                            }
                        }
                    });
                },
                moveSelectedToTop: (items: QueueSong[]) => {
                    set((state) => {
                        const uniqueIds = items.map((item) => item.uniqueId);

                        if (state.player.queueType === PlayerQueueType.PRIORITY) {
                            const priorityFiltered = state.queue.priority.filter(
                                (item) => !uniqueIds.includes(item.uniqueId),
                            );

                            const newPriorityQueue = [...items, ...priorityFiltered];

                            const filtered = state.queue.default.filter(
                                (item) => !uniqueIds.includes(item.uniqueId),
                            );

                            const newDefaultQueue = [...filtered];

                            recalculatePlayerIndex(state, newPriorityQueue);

                            state.queue.default = newDefaultQueue;
                            state.queue.priority = newPriorityQueue;
                        } else {
                            const filtered = state.queue.default.filter(
                                (item) => !uniqueIds.includes(item.uniqueId),
                            );

                            const newQueue = [...items, ...filtered];

                            recalculatePlayerIndex(state, newQueue);

                            state.queue.default = newQueue;
                        }
                    });
                },
                player: {
                    crossfadeDuration: 5,
                    index: -1,
                    muted: false,
                    playerNum: 1,
                    queueType: PlayerQueueType.DEFAULT,
                    repeat: PlayerRepeat.NONE,
                    seekToTimestamp: uniqueSeekToTimestamp(0),
                    shuffle: PlayerShuffle.NONE,
                    speed: 1,
                    status: PlayerStatus.PAUSED,
                    stepBackward: 10,
                    stepForward: 10,
                    timestamp: 0,
                    transitionType: PlayerStyle.GAPLESS,
                    volume: 30,
                },
                queue: {
                    default: [],
                    priority: [],
                    shuffled: [],
                },
                setCrossfadeDuration: (duration: number) => {
                    set((state) => {
                        const normalizedDuration = Math.max(0, Math.min(10, duration));
                        state.player.crossfadeDuration = normalizedDuration;
                    });
                },
                setProgress: (timestamp: number) => {
                    set((state) => {
                        state.player.timestamp = timestamp;
                    });
                },
                setQueueType: (queueType: PlayerQueueType) => {
                    set((state) => {
                        // From default -> priority, move all items from default to priority
                        if (queueType === PlayerQueueType.PRIORITY) {
                            state.queue.priority = [
                                ...state.queue.default,
                                ...state.queue.priority,
                            ];
                            state.queue.default = [];
                        } else {
                            // From priority -> default, move all items from priority to the start of default
                            state.queue.default = [...state.queue.priority, ...state.queue.default];
                            state.queue.priority = [];
                        }

                        state.player.queueType = queueType;
                    });
                },
                setRepeat: (repeat: PlayerRepeat) => {
                    set((state) => {
                        state.player.repeat = repeat;
                    });
                },
                setShuffle: (shuffle: PlayerShuffle) => {
                    set((state) => {
                        state.player.shuffle = shuffle;
                        const queue = state.queue.default;
                        state.queue.shuffled = shuffleInPlace(queue.map((item) => item.uniqueId));
                    });
                },
                setSpeed: (speed: number) => {
                    set((state) => {
                        const normalizedSpeed = Math.max(0.5, Math.min(2, speed));
                        state.player.speed = normalizedSpeed;
                    });
                },
                setTransitionType: (transitionType: PlayerStyle) => {
                    set((state) => {
                        state.player.transitionType = transitionType;
                    });
                },
                setVolume: (volume: number) => {
                    set((state) => {
                        state.player.volume = volume;
                    });
                },
                shuffle: () => {
                    set((state) => {
                        const queue = state.queue.default;
                        state.queue.shuffled = shuffleInPlace(queue.map((item) => item.uniqueId));
                    });
                },
                shuffleAll: () => {
                    set((state) => {
                        const queue = state.queue.default;
                        state.queue.default = shuffleInPlace(queue);
                    });
                },
                shuffleSelected: (items: QueueSong[]) => {
                    set((state) => {
                        const indices = items.map((item) =>
                            state.queue.default.findIndex((i) => i.uniqueId === item.uniqueId),
                        );

                        const shuffledItems = shuffleInPlace(items);

                        indices.forEach((i, index) => {
                            state.queue.default[i] = shuffledItems[index];
                        });
                    });
                },
            })),
        ),
        {
            merge: (persistedState: any, currentState: any) => {
                return merge(currentState, persistedState);
            },
            name: 'player-store',
            // TODO: We need to use an alternative persistence method for the queue since it may not fit localStorage
            partialize: (state) => {
                return Object.fromEntries(
                    Object.entries(state).filter(([key]) => !['queue'].includes(key)),
                );
            },
            version: 1,
        },
    ),
);

export const usePlayerStore = createSelectors(usePlayerStoreBase);

export const usePlayerActions = () => {
    return usePlayerStoreBase(
        useShallow((state) => ({
            addToQueueByType: state.addToQueueByType,
            addToQueueByUniqueId: state.addToQueueByUniqueId,
            clearQueue: state.clearQueue,
            clearSelected: state.clearSelected,
            decreaseVolume: state.decreaseVolume,
            getQueue: state.getQueue,
            increaseVolume: state.increaseVolume,
            mediaAutoNext: state.mediaAutoNext,
            mediaNext: state.mediaNext,
            mediaPause: state.mediaPause,
            mediaPlay: state.mediaPlay,
            mediaPrevious: state.mediaPrevious,
            mediaSeekToTimestamp: state.mediaSeekToTimestamp,
            mediaStepBackward: state.mediaStepBackward,
            mediaStepForward: state.mediaStepForward,
            mediaToggleMute: state.mediaToggleMute,
            mediaTogglePlayPause: state.mediaTogglePlayPause,
            moveSelectedTo: state.moveSelectedTo,
            moveSelectedToBottom: state.moveSelectedToBottom,
            moveSelectedToNext: state.moveSelectedToNext,
            moveSelectedToTop: state.moveSelectedToTop,
            setCrossfadeDuration: state.setCrossfadeDuration,
            setProgress: state.setProgress,
            setRepeat: state.setRepeat,
            setShuffle: state.setShuffle,
            setSpeed: state.setSpeed,
            setTransitionType: state.setTransitionType,
            setVolume: state.setVolume,
            shuffle: state.shuffle,
            shuffleAll: state.shuffleAll,
            shuffleSelected: state.shuffleSelected,
        })),
    );
};

export type AddToQueueByPlayType = Play;

export type AddToQueueByUniqueId = {
    edge: 'bottom' | 'left' | 'right' | 'top' | null;
    uniqueId: string;
};

export type AddToQueueType = AddToQueueByPlayType | AddToQueueByUniqueId;

export async function addToQueueByData(type: AddToQueueType, data: Song[]) {
    const items = data.map(toQueueSong);

    if (typeof type === 'string') {
        usePlayerStoreBase.getState().addToQueueByType(items, type);
    } else {
        const normalizedEdge = type.edge === 'top' ? 'top' : 'bottom';
        usePlayerStoreBase.getState().addToQueueByUniqueId(items, type.uniqueId, normalizedEdge);
    }
}

export async function addToQueueByFetch(
    queryClient: QueryClient,
    libraryId: string,
    type: AddToQueueType,
    args: {
        id: string[];
        itemType: LibraryItemType;
        params?: GetApiLibraryIdAlbumsIdTracksParams;
    },
) {
    // const items: TrackItem[] = [];
    // if (args.itemType === LibraryItemType.ALBUM) {
    //     for (const id of args.id) {
    //         const result = await fetchTracksByAlbumId(queryClient, libraryId, id, {
    //             limit: '-1',
    //             offset: '0',
    //             sortBy: TrackListSortOptions.ID,
    //             sortOrder: ListSortOrder.ASC,
    //             ...args.params,
    //         });
    //         items.push(...result.data);
    //     }
    // } else if (args.itemType === LibraryItemType.PLAYLIST) {
    //     for (const id of args.id) {
    //         const result = await fetchTracksByPlaylistId(queryClient, libraryId, id, {
    //             limit: '-1',
    //             offset: '0',
    //             sortBy: TrackListSortOptions.ID,
    //             sortOrder: ListSortOrder.ASC,
    //             ...args.params,
    //         });
    //         items.push(...result.data);
    //     }
    // } else if (args.itemType === LibraryItemType.GENRE) {
    //     for (const id of args.id) {
    //         const result = await fetchTracksByGenreId(queryClient, libraryId, id, {
    //             limit: '-1',
    //             offset: '0',
    //             sortBy: TrackListSortOptions.ID,
    //             sortOrder: ListSortOrder.ASC,
    //             ...args.params,
    //         });
    //         items.push(...result.data);
    //     }
    // } else if (
    //     args.itemType === LibraryItemType.ALBUM_ARTIST ||
    //     args.itemType === LibraryItemType.ARTIST
    // ) {
    //     for (const id of args.id) {
    //         const result = await fetchTracksByAlbumArtistId(queryClient, libraryId, id, {
    //             limit: '-1',
    //             offset: '0',
    //             sortBy: TrackListSortOptions.ID,
    //             sortOrder: ListSortOrder.ASC,
    //             ...args.params,
    //         });
    //         items.push(...result.data);
    //     }
    // }
    // if (typeof type === 'string') {
    //     usePlayerStoreBase.getState().addToQueueByType(items, type);
    // } else {
    //     const normalizedEdge = type.edge === 'top' ? 'top' : 'bottom';
    //     usePlayerStoreBase.getState().addToQueueByUniqueId(items, type.uniqueId, normalizedEdge);
    // }
}

export const subscribePlayerQueue = (
    onChange: (queue: QueueData, prevQueue: QueueData) => void,
) => {
    return usePlayerStoreBase.subscribe(
        (state) => state.queue,
        (queue, prevQueue) => {
            onChange(queue, prevQueue);
        },
    );
};

export const subscribeCurrentTrack = (
    onChange: (
        properties: { index: number; song: QueueSong | undefined },
        prev: { index: number; song: QueueSong | undefined },
    ) => void,
) => {
    return usePlayerStoreBase.subscribe(
        (state) => {
            const queue = state.getQueue();
            const index = state.player.index;
            return { index, song: queue.items[index] };
        },
        (song, prevSong) => {
            onChange(song, prevSong);
        },
        {
            equalityFn: (a, b) => {
                return a.song?.uniqueId === b.song?.uniqueId;
            },
        },
    );
};

export const subscribePlayerProgress = (
    onChange: (properties: { timestamp: number }, prev: { timestamp: number }) => void,
) => {
    return usePlayerStoreBase.subscribe(
        (state) => state.player.timestamp,
        (timestamp, prevTimestamp) => {
            onChange({ timestamp }, { timestamp: prevTimestamp });
        },
    );
};

export const subscribePlayerVolume = (
    onChange: (properties: { volume: number }, prev: { volume: number }) => void,
) => {
    return usePlayerStoreBase.subscribe(
        (state) => state.player.volume,
        (volume, prevVolume) => {
            onChange({ volume }, { volume: prevVolume });
        },
    );
};

export const subscribePlayerStatus = (
    onChange: (
        properties: { song: QueueSong | undefined; status: PlayerStatus },
        prev: { song: QueueSong | undefined; status: PlayerStatus },
    ) => void,
) => {
    return usePlayerStoreBase.subscribe(
        (state) => {
            const currentSong = state.getCurrentSong();

            return {
                song: currentSong,
                status: state.player.status,
            };
        },
        (status, prevStatus) => {
            onChange(status, prevStatus);
        },
    );
};

export const subscribePlayerSeekToTimestamp = (
    onChange: (properties: { timestamp: number }, prev: { timestamp: number }) => void,
) => {
    return usePlayerStoreBase.subscribe(
        (state) => state.player.seekToTimestamp,
        (timestamp, prevTimestamp) => {
            onChange(
                { timestamp: parseUniqueSeekToTimestamp(timestamp) },
                { timestamp: parseUniqueSeekToTimestamp(prevTimestamp) },
            );
        },
    );
};

export const subscribePlayerMute = (
    onChange: (properties: { muted: boolean }, prev: { muted: boolean }) => void,
) => {
    return usePlayerStoreBase.subscribe(
        (state) => state.player.muted,
        (muted, prevMuted) => {
            onChange({ muted }, { muted: prevMuted });
        },
    );
};

export const subscribePlayerSpeed = (
    onChange: (properties: { speed: number }, prev: { speed: number }) => void,
) => {
    return usePlayerStoreBase.subscribe(
        (state) => state.player.speed,
        (speed, prevSpeed) => {
            onChange({ speed }, { speed: prevSpeed });
        },
    );
};

export const usePlayerProperties = () => {
    return usePlayerStoreBase(
        useShallow((state) => ({
            crossfadeDuration: state.player.crossfadeDuration,
            isMuted: state.player.muted,
            playerNum: state.player.playerNum,
            queueType: state.player.queueType,
            repeat: state.player.repeat,
            shuffle: state.player.shuffle,
            speed: state.player.speed,
            status: state.player.status,
            transitionType: state.player.transitionType,
            volume: state.player.volume,
        })),
    );
};

export const usePlayerProgress = () => {
    return usePlayerStoreBase((state) => state.player.timestamp);
};

export const usePlayerDuration = () => {
    return usePlayerStoreBase((state) => {
        const queue = state.getQueue();
        const index = state.player.index;
        const currentTrack = queue.items[index];
        return currentTrack?.duration;
    });
};

export const usePlayerData = (): PlayerData => {
    return usePlayerStoreBase(
        useShallow((state) => {
            const queue = state.getQueue();
            const index = state.player.index;
            const currentTrack = queue.items[index];
            const nextTrack = queue.items[index + 1];

            return {
                currentTrack,
                nextTrack,
                player: state.player,
                player1: state.player.playerNum === 1 ? currentTrack : nextTrack,
                player2: state.player.playerNum === 2 ? currentTrack : nextTrack,
                queue: state.queue,
            };
        }),
    );
};

export const updateQueueFavorites = (ids: string[], favorite: boolean) => {
    const queue = usePlayerStore.getState().queue;

    const defaultQueue = queue.default.map((item) => {
        if (ids.includes(item.id)) {
            return { ...item, userFavorite: favorite };
        }

        return item;
    });

    const priorityQueue = queue.priority.map((item) => {
        if (ids.includes(item.id)) {
            return { ...item, userFavorite: favorite };
        }

        return item;
    });

    usePlayerStoreBase.setState({
        queue: { default: defaultQueue, priority: priorityQueue, shuffled: queue.shuffled },
    });
};

export const usePlayerMuted = () => {
    return usePlayerStoreBase((state) => state.player.muted);
};

export const usePlayerQueueType = () => {
    return usePlayerStoreBase((state) => state.player.queueType);
};

export const usePlayerRepeat = () => {
    return usePlayerStoreBase((state) => state.player.repeat);
};

export const usePlayerShuffle = () => {
    return usePlayerStoreBase((state) => state.player.shuffle);
};

export const usePlayerStatus = () => {
    return usePlayerStoreBase((state) => state.player.status);
};

export const usePlayerVolume = () => {
    return usePlayerStoreBase((state) => state.player.volume);
};

export const usePlayerSpeed = () => {
    return usePlayerStoreBase((state) => state.player.speed);
};

export const usePlayerTimestamp = () => {
    return usePlayerStoreBase((state) => state.player.timestamp);
};

export const usePlayerSong = () => {
    return usePlayerStoreBase((state) => {
        const queue = state.getQueue();
        const index = state.player.index;
        return queue.items[index];
    });
};

export const usePlayerNum = () => {
    return usePlayerStoreBase((state) => state.player.playerNum);
};

export const usePlayerQueue = () => {
    return usePlayerStoreBase((state) => {
        const queueType = state.player.queueType;

        switch (queueType) {
            case PlayerQueueType.DEFAULT:
                return state.queue.default;
            case PlayerQueueType.PRIORITY:
                return state.queue.priority;
            default:
                return state.queue.default;
        }
    });
};

function getQueueType() {
    const queueType: PlayerQueueType = usePlayerStore.getState().player.queueType;
    return queueType;
}

function parseUniqueSeekToTimestamp(timestamp: string) {
    return Number(timestamp.split('-')[0]);
}

function recalculatePlayerIndex(state: any, queue: QueueSong[]) {
    const currentTrack = state.getCurrentTrack() as QueueSong | undefined;

    if (!currentTrack) {
        return;
    }

    const index = queue.findIndex((item) => item.uniqueId === currentTrack.uniqueId);
    state.player.index = Math.max(0, index);
}

function toQueueSong(item: Song): QueueSong {
    return {
        ...item,
        uniqueId: nanoid(),
    };
}

// We need to use a unique id so that the equalityFn can work if attempting to set the same timestamp
function uniqueSeekToTimestamp(timestamp: number) {
    return `${timestamp}-${nanoid()}`;
}
