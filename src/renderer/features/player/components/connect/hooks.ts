import { useCallback, useEffect, useRef, useState } from 'react';

import { CONNECT_URL, ConnectDevice, ConnectStatus } from './types';

export const useConnectDevices = () => {
    const [devices, setDevices] = useState<ConnectDevice[]>([]);
    const [ready, setReady] = useState(false);

    const refresh = () => {
        fetch(`${CONNECT_URL}/discover`)
            .then((r) => r.json())
            .then((d) => {
                const sonos: ConnectDevice[] = (d.sonos ?? []).map((x: any) => ({
                    name: x.name,
                    type: 'sonos' as const,
                }));
                const airplay: ConnectDevice[] = (d.airplay ?? []).map((x: any) => ({
                    name: x.name,
                    type: 'airplay' as const,
                }));
                setDevices([...sonos, ...airplay]);
                setReady(true);
            })
            .catch(() => setReady(true));
    };

    useEffect(() => {
        refresh();
    }, []);

    return { devices, ready, refresh };
};

// Polls /status every 2 s while the popover is open.
// prevIndexRef is owned by the parent — reset to -1 when a new play session starts.
// On first poll after a reset, advances Feishin to Connect's current position (initial sync).
// On subsequent polls, advances only by the delta.
export const useConnectStatus = (
    active: boolean,
    open: boolean,
    prevIndexRef: { current: number },
    onTrackAdvance: (delta: number) => void,
) => {
    const [status, setStatus] = useState<ConnectStatus | null>(null);

    useEffect(() => {
        if (!active || !open) return;

        const poll = () => {
            fetch(`${CONNECT_URL}/status`)
                .then((r) => r.json())
                .then((d: ConnectStatus) => {
                    setStatus(d);
                    if (d.radio) return; // no track-index sync for radio
                    const newIdx = d.current_track_index ?? 0;
                    if (prevIndexRef.current === -1) {
                        if (newIdx > 0) onTrackAdvance(newIdx);
                    } else if (newIdx !== prevIndexRef.current) {
                        onTrackAdvance(newIdx - prevIndexRef.current);
                    }
                    prevIndexRef.current = newIdx;
                })
                .catch(() => {});
        };

        poll();
        const id = setInterval(poll, 2000);
        return () => clearInterval(id);
    }, [active, open, onTrackAdvance, prevIndexRef]);

    return status;
};

export const useConnectVolume = () => {
    const [volume, setVolume] = useState<null | number>(null);
    const [muted, setMuted] = useState(false);
    const preMuteVolume = useRef(30);

    const fetchVolume = useCallback(() => {
        fetch(`${CONNECT_URL}/volume`)
            .then((r) => r.json())
            .then((d) => {
                if (d.volume !== undefined) setVolume(d.volume);
            })
            .catch(() => {});
    }, []);

    const setRemoteVolume = (v: number) => {
        setVolume(v);
        fetch(`${CONNECT_URL}/volume`, {
            body: JSON.stringify({ volume: v }),
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
        }).catch(() => {});
    };

    const toggleMute = () => {
        if (muted) {
            setMuted(false);
            setRemoteVolume(preMuteVolume.current);
        } else {
            preMuteVolume.current = volume ?? 30;
            setMuted(true);
            setRemoteVolume(0);
        }
    };

    return { fetchVolume, muted, setRemoteVolume, toggleMute, volume };
};
