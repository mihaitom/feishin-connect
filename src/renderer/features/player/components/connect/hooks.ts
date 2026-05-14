import { useCallback, useEffect, useRef, useState } from 'react';

import { useConnectPlayerStore } from './connect.store';
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
                const chromecast: ConnectDevice[] = (discoverData.chromecast ?? []).map(
                    (x: any) => ({
                        name: x.name,
                        type: 'chromecast' as const,
                    }),
                );
                const airplay: ConnectDevice[] = (discoverData.airplay ?? []).map((x: any) => ({
                    name: x.name,
                    needsPairing: x.needs_pairing ?? false,
                    type: 'airplay' as const,
                }));
                const sort = (a: ConnectDevice, b: ConnectDevice) => a.name.localeCompare(b.name);
                setDevices([...sonos.sort(sort), ...chromecast.sort(sort), ...airplay.sort(sort)]);
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

// Subscribes to SSE /events whenever Connect is active.
// Updates the connect player store for the playerbar progress display.
export const useConnectStatus = (active: boolean) => {
    const [status, setStatus] = useState<ConnectStatus | null>(null);

    useEffect(() => {
        if (!active) return;

        const es = new EventSource(`${CONNECT_URL}/events`);
        es.onmessage = (e: MessageEvent) => {
            const d: ConnectStatus = JSON.parse(e.data);
            setStatus(d);
            useConnectPlayerStore.getState().set({
                duration: d.current_track?.duration ?? 0,
                elapsed: d.elapsed ?? 0,
                isPlaying: d.streaming && !d.paused,
                isStreaming: d.streaming,
                syncTime: Date.now(),
            });
        };
        return () => es.close();
    }, [active]);

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
