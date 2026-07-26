import { useCallback, useEffect } from 'react';
import { create } from 'zustand';

import { ConnectDevice, connectFetch } from './types';

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
