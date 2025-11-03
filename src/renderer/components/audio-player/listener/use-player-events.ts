import { useEffect } from 'react';

import { createPlayerEvents } from '/@/renderer/components/audio-player/listener/player-events';
import { QueueData } from '/@/renderer/store';
import { QueueSong } from '/@/shared/types/domain-types';
import { PlayerStatus } from '/@/shared/types/types';

export interface PlayerEvents {
    onCurrentTrackChange?: (
        track: { index: number; track: QueueSong | undefined },
        prevTrack: { index: number; track: QueueSong | undefined },
    ) => void;
    onPlayerMute?: (muted: boolean, prevMuted: boolean) => void;
    onPlayerProgress?: (timestamp: number, prevTimestamp: number) => void;
    onPlayerQueueChange?: (queue: QueueData, prevQueue: QueueData) => void;
    onPlayerSeekToTimestamp?: (timestamp: number, prevTimestamp: number) => void;
    onPlayerSpeed?: (speed: number, prevSpeed: number) => void;
    onPlayerStatus?: (status: PlayerStatus, prevStatus: PlayerStatus) => void;
    onPlayerVolume?: (volume: number, prevVolume: number) => void;
}

export function usePlayerEvents(callbacks: PlayerEvents, deps: React.DependencyList) {
    useEffect(() => {
        const engine = createPlayerEvents(callbacks);

        return () => {
            engine.cleanup();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [...deps]);
}
