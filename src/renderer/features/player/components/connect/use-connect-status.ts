import { useCallback, useEffect, useRef, useState } from 'react';

import { useConnectPlayerStore } from './connect.store';
import { connectEventSource, connectFetch, ConnectStatus } from './types';

// Subscribes to SSE /events whenever Connect is active.
// Updates the connect player store for the playerbar progress display.
export const useConnectStatus = (active: boolean) => {
    const [status, setStatus] = useState<ConnectStatus | null>(null);

    const applyStatus = useCallback((d: ConnectStatus) => {
        setStatus(d);
        useConnectPlayerStore.getState().set({
            duration: d.current_track?.duration ?? 0,
            elapsed: d.elapsed ?? 0,
            isPlaying: d.streaming && !d.paused,
            isStreaming: d.streaming,
            queue: d.queue ?? [],
            queueIndex: d.queue_index ?? 0,
            syncTime: Date.now(),
        });
    }, []);

    // Forces a one-off /status re-sync outside the normal SSE flow — used by
    // the visibility-change handler below, and exposed to callers (see
    // use-connect-controls.ts) that just found out via a "media server not
    // configured" response from /pause or /resume that the backend forgot
    // this session (idle-reaped — see core/session.py's SESSION_IDLE_TIMEOUT)
    // without the SSE stream ever reporting a status change. Applying a fresh
    // /status feeds use-connect-disconnect.ts's "external stop" effect the
    // streaming:false it needs to reset local state back to disconnected.
    const refetch = useCallback(() => {
        return connectFetch(`/status`)
            .then((r) => r.json())
            .then(applyStatus)
            .catch(() => {});
    }, [applyStatus]);

    const refetchRef = useRef(refetch);
    refetchRef.current = refetch;

    useEffect(() => {
        if (!active) return;

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
            refetchRef.current();
        };
        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            es.close();
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [active, applyStatus]);

    return { refetch, status };
};
