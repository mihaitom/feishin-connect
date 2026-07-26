import { useEffect, useState } from 'react';

import { useConnectPlayerStore } from './connect.store';
import { connectEventSource, connectFetch, ConnectStatus } from './types';

// Subscribes to SSE /events whenever Connect is active.
// Updates the connect player store for the playerbar progress display.
export const useConnectStatus = (active: boolean) => {
    const [status, setStatus] = useState<ConnectStatus | null>(null);

    useEffect(() => {
        if (!active) return;

        const applyStatus = (d: ConnectStatus) => {
            setStatus(d);
            useConnectPlayerStore.getState().set({
                duration: d.current_track?.duration ?? 0,
                elapsed: d.elapsed ?? 0,
                isPlaying: d.streaming && !d.paused,
                isStreaming: d.streaming,
                syncTime: Date.now(),
            });
        };

        const es = connectEventSource(`/events`);
        es.onmessage = (e: MessageEvent) => applyStatus(JSON.parse(e.data));

        // A backgrounded tab can get frozen by the browser, which suspends the
        // EventSource's own reconnect logic along with everything else — if the
        // underlying connection dies during that freeze, nothing reconnects
        // until the tab is foregrounded again, and a stale status can survive
        // until the session's idle reaper deletes it server-side. Refetching
        // once on return-to-foreground closes that gap immediately instead of
        // waiting on the browser's own reconnect.
        const onVisibilityChange = () => {
            if (document.visibilityState !== 'visible') return;
            connectFetch(`/status`)
                .then((r) => r.json())
                .then(applyStatus)
                .catch(() => {});
        };
        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            es.close();
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [active]);

    return status;
};
