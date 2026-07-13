import { useCallback, useEffect, useRef, useState } from 'react';
import { create } from 'zustand';

import { useConnectPlayerStore } from './connect.store';
import { ConnectDevice, connectEventSource, connectFetch, ConnectStatus } from './types';

export interface ConnectHealth {
    apiReachable: boolean;
    ffmpegFound: boolean;
    unauthorized: boolean;
}

class HttpStatusError extends Error {
    status: number;
    constructor(status: number) {
        super(`HTTP ${status}`);
        this.status = status;
    }
}

export const useConnectDevices = () => {
    const [devices, setDevices] = useState<ConnectDevice[]>([]);
    const [health, setHealth] = useState<ConnectHealth | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    // Ref (not the `devices` state directly) so refresh() doesn't capture
    // reactive state — keeps its identity closure-safe for the mount effect
    // below without needing `devices`/`refresh` itself in a dependency array.
    const devicesRef = useRef<ConnectDevice[]>(devices);
    devicesRef.current = devices;

    const refresh = (fresh = false) => {
        // /discover already skips a real re-scan for a plain (non-fresh) call
        // once a cached device list exists — it serves that cache instantly
        // and only recomputes the live claim/track annotations (see
        // routes/devices.py). So reopening the popover to pick up fresh "in
        // use by"/"playing" labels shouldn't flash the scanning spinner and
        // disable "Scan again" every time — only an explicit fresh scan, or
        // the very first load (nothing cached client-side yet either), does.
        const showScanning = fresh || devicesRef.current.length === 0;
        if (showScanning) setIsScanning(true);
        // A non-2xx response (e.g. 401 from a wrong/missing CONNECT_TOKEN) is
        // still valid JSON — parsing it as if it were a real /health or
        // /discover body would silently produce bogus fields (e.g. "ffmpeg
        // missing") instead of surfacing the actual connectivity problem.
        const parseOk = (r: Response) => {
            if (!r.ok) throw new HttpStatusError(r.status);
            return r.json();
        };
        Promise.all([
            connectFetch(`/discover${fresh ? '?fresh=true' : ''}`).then(parseOk),
            connectFetch(`/health`).then(parseOk),
        ])
            .then(([discoverData, healthData]) => {
                const claimFields = (x: any) => ({
                    claimedByName: x.in_use_by_name ?? null,
                    claimedBySessionId: x.in_use_by_session_id ?? null,
                    claimedByTrack: x.in_use_by_track ?? null,
                });
                const sonos: ConnectDevice[] = (discoverData.sonos ?? []).map((x: any) => ({
                    ...claimFields(x),
                    name: x.name,
                    type: 'sonos' as const,
                }));
                const chromecast: ConnectDevice[] = (discoverData.chromecast ?? []).map(
                    (x: any) => ({
                        ...claimFields(x),
                        name: x.name,
                        type: 'chromecast' as const,
                    }),
                );
                const airplay: ConnectDevice[] = (discoverData.airplay ?? []).map((x: any) => ({
                    ...claimFields(x),
                    name: x.name,
                    needsPairing: x.needs_pairing ?? false,
                    type: 'airplay' as const,
                }));
                const dlna: ConnectDevice[] = (discoverData.dlna ?? []).map((x: any) => ({
                    ...claimFields(x),
                    name: x.name,
                    type: 'dlna' as const,
                }));
                const sort = (a: ConnectDevice, b: ConnectDevice) => a.name.localeCompare(b.name);
                setDevices([
                    ...sonos.sort(sort),
                    ...chromecast.sort(sort),
                    ...airplay.sort(sort),
                    ...dlna.sort(sort),
                ]);
                setHealth({
                    apiReachable: true,
                    ffmpegFound: healthData.ffmpeg ?? false,
                    unauthorized: false,
                });
            })
            .catch((e) => {
                setHealth({
                    apiReachable: false,
                    ffmpegFound: false,
                    unauthorized: e instanceof HttpStatusError && e.status === 401,
                });
            })
            .finally(() => setIsScanning(false));
    };

    useEffect(() => {
        refresh();
    }, []);

    return { devices, health, isScanning, refresh };
};

// Subscribes to SSE /events whenever Connect is active.
// Updates the connect player store for the playerbar progress display.
export const useConnectStatus = (active: boolean) => {
    const [status, setStatus] = useState<ConnectStatus | null>(null);

    useEffect(() => {
        if (!active) return;

        const es = connectEventSource(`/events`);
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
        connectFetch(`/pair/airplay`)
            .then((r) => r.json())
            .then((d) => setPaired(d.paired ?? []))
            .catch(() => {});
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const unpair = useCallback(
        (name: string) =>
            connectFetch(`/pair/airplay/${encodeURIComponent(name)}`, { method: 'DELETE' })
                .then(() => refresh())
                .catch(() => {}),
        [refresh],
    );

    return { paired, refresh, unpair };
};

export const useConnectSeek = () => (position: number) =>
    connectFetch('/seek', {
        body: JSON.stringify({ position }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
    }).catch(() => {});

// Shared across all useDeviceVolume() call sites, keyed by "type:name", so the
// playerbar volume slider and a device's row in the Connect popover — which can
// both be showing/controlling the same device at the same time — stay in sync
// instead of each holding their own independent (and instantly stale) copy.
interface DeviceVolumeEntry {
    muted: boolean;
    preMute: number;
    volume: null | number;
}

const DEFAULT_DEVICE_VOLUME_ENTRY: DeviceVolumeEntry = { muted: false, preMute: 30, volume: null };

const useDeviceVolumeStore = create<{
    entries: Record<string, DeviceVolumeEntry>;
    patchEntry: (key: string, patch: Partial<DeviceVolumeEntry>) => void;
}>((set) => ({
    entries: {},
    patchEntry: (key, patch) =>
        set((state) => ({
            entries: {
                ...state.entries,
                [key]: {
                    ...DEFAULT_DEVICE_VOLUME_ENTRY,
                    ...state.entries[key],
                    ...patch,
                },
            },
        })),
}));

// Volume control for a single device, via /device-volume (Sonos, Chromecast and
// DLNA — AirPlay has no volume control in this backend).
// `enabled` gates the fetch (e.g. only fetch once a device row is hovered/expanded).
export const useDeviceVolume = (
    deviceType?: ConnectDevice['type'],
    deviceName?: string,
    enabled: boolean = true,
) => {
    const key = deviceType && deviceName ? `${deviceType}:${deviceName}` : null;
    const entry = useDeviceVolumeStore((s) => (key ? s.entries[key] : undefined));
    const patchEntry = useDeviceVolumeStore((s) => s.patchEntry);
    const volume = entry?.volume ?? null;
    const muted = entry?.muted ?? false;

    const supported =
        deviceType === 'sonos' || deviceType === 'chromecast' || deviceType === 'dlna';

    useEffect(() => {
        if (!enabled || !supported || !key || !deviceType || !deviceName || volume !== null) {
            return;
        }
        connectFetch(
            `/device-volume?device_type=${deviceType}&name=${encodeURIComponent(deviceName)}`,
        )
            .then((r) => r.json())
            .then((d) => {
                if (d.volume !== undefined) patchEntry(key, { volume: d.volume });
            })
            .catch(() => {});
    }, [enabled, supported, key, deviceType, deviceName, volume, patchEntry]);

    const setDeviceVolume = useCallback(
        (v: number) => {
            if (!key || !deviceType || !deviceName) return;
            patchEntry(key, { volume: v });
            connectFetch(
                `/device-volume?device_type=${deviceType}&name=${encodeURIComponent(deviceName)}`,
                {
                    body: JSON.stringify({ volume: v }),
                    headers: { 'Content-Type': 'application/json' },
                    method: 'POST',
                },
            ).catch(() => {});
        },
        [key, deviceType, deviceName, patchEntry],
    );

    const toggleMute = useCallback(() => {
        if (!key) return;
        if (muted) {
            patchEntry(key, { muted: false });
            setDeviceVolume(entry?.preMute ?? 30);
        } else {
            patchEntry(key, { muted: true, preMute: volume ?? 30 });
            setDeviceVolume(0);
        }
    }, [key, muted, volume, entry?.preMute, patchEntry, setDeviceVolume]);

    return { muted, setDeviceVolume, supported, toggleMute, volume };
};

export const useConnectVolume = () => {
    const [volume, setVolume] = useState<null | number>(null);
    const [muted, setMuted] = useState(false);
    const preMuteVolume = useRef(30);

    const fetchVolume = useCallback(() => {
        connectFetch(`/volume`)
            .then((r) => r.json())
            .then((d) => {
                if (d.volume !== undefined) setVolume(d.volume);
            })
            .catch(() => {});
    }, []);

    const setRemoteVolume = (v: number) => {
        setVolume(v);
        connectFetch(`/volume`, {
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
