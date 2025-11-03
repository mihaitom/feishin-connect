import { useEffect } from 'react';

import {
    createPlayerEvents,
    PlayerEventsCallbacks,
} from '/@/renderer/features/player/audio-player/listener/player-events';

export function usePlayerEvents(callbacks: PlayerEventsCallbacks, deps: React.DependencyList) {
    useEffect(() => {
        const engine = createPlayerEvents(callbacks);

        return () => {
            engine.cleanup();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [...deps]);
}
