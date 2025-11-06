import { useEffect } from 'react';

import {
    subscribeCurrentTrack,
    subscribePlayerMute,
    subscribePlayerProgress,
    subscribePlayerQueue,
    subscribePlayerSeekToTimestamp,
    subscribePlayerSpeed,
    subscribePlayerStatus,
    subscribePlayerVolume,
} from '/@/renderer/store';
import { QueueData, QueueSong } from '/@/shared/types/domain-types';
import { PlayerStatus } from '/@/shared/types/types';

interface PlayerEvents {
    cleanup: () => void;
}

interface PlayerEventsCallbacks {
    onCurrentSongChange?: (
        properties: { index: number; song: QueueSong | undefined },
        prev: { index: number; song: QueueSong | undefined },
    ) => void;
    onPlayerMute?: (properties: { muted: boolean }, prev: { muted: boolean }) => void;
    onPlayerProgress?: (properties: { timestamp: number }, prev: { timestamp: number }) => void;
    onPlayerQueueChange?: (queue: QueueData, prev: QueueData) => void;
    onPlayerSeek?: (properties: { seconds: number }, prev: { seconds: number }) => void;
    onPlayerSeekToTimestamp?: (
        properties: { timestamp: number },
        prev: { timestamp: number },
    ) => void;
    onPlayerSpeed?: (properties: { speed: number }, prev: { speed: number }) => void;
    onPlayerStatus?: (properties: { status: PlayerStatus }, prev: { status: PlayerStatus }) => void;
    onPlayerVolume?: (properties: { volume: number }, prev: { volume: number }) => void;
}

export function usePlayerEvents(callbacks: PlayerEventsCallbacks, deps: React.DependencyList) {
    useEffect(() => {
        const engine = createPlayerEvents(callbacks);

        return () => {
            engine.cleanup();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [...deps]);
}

function createPlayerEvents(callbacks: PlayerEventsCallbacks): PlayerEvents {
    const unsubscribers: (() => void)[] = [];

    // Subscribe to current track changes
    if (callbacks.onCurrentSongChange) {
        const unsubscribe = subscribeCurrentTrack(callbacks.onCurrentSongChange);
        unsubscribers.push(unsubscribe);
    }

    // Subscribe to player progress
    if (callbacks.onPlayerProgress) {
        const unsubscribe = subscribePlayerProgress(callbacks.onPlayerProgress);
        unsubscribers.push(unsubscribe);
    }

    // Subscribe to queue changes
    if (callbacks.onPlayerQueueChange) {
        const unsubscribe = subscribePlayerQueue(callbacks.onPlayerQueueChange);
        unsubscribers.push(unsubscribe);
    }

    // Subscribe to seek events
    if (callbacks.onPlayerSeekToTimestamp) {
        const unsubscribe = subscribePlayerSeekToTimestamp(callbacks.onPlayerSeekToTimestamp);
        unsubscribers.push(unsubscribe);
    }

    // Subscribe to player status changes
    if (callbacks.onPlayerStatus) {
        const unsubscribe = subscribePlayerStatus(callbacks.onPlayerStatus);
        unsubscribers.push(unsubscribe);
    }

    // Subscribe to volume changes
    if (callbacks.onPlayerVolume) {
        const unsubscribe = subscribePlayerVolume(callbacks.onPlayerVolume);
        unsubscribers.push(unsubscribe);
    }

    // Subscribe to mute changes
    if (callbacks.onPlayerMute) {
        const unsubscribe = subscribePlayerMute(callbacks.onPlayerMute);
        unsubscribers.push(unsubscribe);
    }

    // Subscribe to speed changes
    if (callbacks.onPlayerSpeed) {
        const unsubscribe = subscribePlayerSpeed(callbacks.onPlayerSpeed);
        unsubscribers.push(unsubscribe);
    }

    return {
        cleanup: () => {
            unsubscribers.forEach((unsubscribe) => unsubscribe());
        },
    };
}
