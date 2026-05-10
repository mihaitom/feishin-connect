import { useCallback, useEffect, useRef, useState } from 'react';

import { CONNECT_URL, ConnectDevice, ConnectStatus } from './types';

export interface ConnectHealth {
    apiReachable: boolean;
    ffmpegFound: boolean;
}

export const useConnectDevices = () => {
    const [devices, setDevices] = useState<ConnectDevice[]>([]);
    const [health, setHealth] = useState<ConnectHealth | null>(null);

    const refresh = () => {
        Promise.all([
            fetch(`${CONNECT_URL}/discover`).then((r) => r.json()),
            fetch(`${CONNECT_URL}/health`).then((r) => r.json()),
        ])
            .then(([discoverData, healthData]) => {
                const sonos: ConnectDevice[] = (discoverData.sonos ?? []).map((x: any) => ({
                    name: x.name,
                    type: 'sonos' as const,
                }));
                const airplay: ConnectDevice[] = (discoverData.airplay ?? []).map((x: any) => ({
                    name: x.name,
                    type: 'airplay' as const,
                }));
                const sort = (a: ConnectDevice, b: ConnectDevice) =>
                    a.name.localeCompare(b.name);
                setDevices([...sonos.sort(sort), ...airplay.sort(sort)]);
                setHealth({ apiReachable: true, ffmpegFound: healthData.ffmpeg ?? false });
            })
            .catch(() => {
                setHealth({ apiReachable: false, ffmpegFound: false });
            });
    };

    useEffect(() => {
        refresh();
    }, []);

    return { devices, health, refresh };
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

export const usePairedDevices = () => {
    const [paired, setPaired] = useState<string[]>([]);

    const refresh = useCallback(() => {
        fetch(`${CONNECT_URL}/pair/airplay`)
            .then((r) => r.json())
            .then((d) => setPaired(d.paired ?? []))
            .catch(() => {});
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const unpair = useCallback(
        (name: string) =>
            fetch(`${CONNECT_URL}/pair/airplay/${encodeURIComponent(name)}`, { method: 'DELETE' })
                .then(() => refresh())
                .catch(() => {}),
        [refresh],
    );

    return { paired, refresh, unpair };
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
