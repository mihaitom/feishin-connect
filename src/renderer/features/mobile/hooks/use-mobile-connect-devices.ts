import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/shallow';

import { useConnectPlayerStore } from '/@/renderer/features/player/components/connect/connect.store';
import { ConnectDevice } from '/@/renderer/features/player/components/connect/types';
import {
    fetchDeviceVolumeIfNeeded,
    getDeviceVolumeEntry,
    setDeviceVolumeImperative,
    subscribeDeviceVolume,
} from '/@/renderer/features/player/components/connect/use-device-volume';
import { toast } from '/@/shared/components/toast/toast';
import {
    MobileConnectDevice,
    MobileConnectDeviceRef,
    MobileConnectState,
} from '/@/shared/mobile-ui/types';

// Reads the same Context-free Connect store the Electron phone-remote bridge
// (use-remote-connect.tsx) uses — it's already populated as a side effect of
// mounting useConnectSession() once (see mobile-shell.tsx), so no separate
// wiring is needed here. Per-device volume uses the same imperative helpers
// the phone-remote bridge uses, for the same reason: a dynamic-length device
// list can't call useDeviceVolume() in a loop (Rules of Hooks).
export function useMobileConnectDevices() {
    const { activeTargets, devices, isActive, mySessionId, remoteActions } = useConnectPlayerStore(
        useShallow((s) => ({
            activeTargets: s.activeTargets,
            devices: s.devices,
            isActive: s.isActive,
            mySessionId: s.mySessionId,
            remoteActions: s.remoteActions,
        })),
    );

    // Forces a re-render when any device's volume arrives/changes — the
    // mapping below reads the volume store imperatively (getDeviceVolumeEntry),
    // so React has no other way to know it needs to re-run.
    const [, forceUpdate] = useState(0);

    useEffect(() => {
        for (const target of activeTargets) {
            fetchDeviceVolumeIfNeeded(target.type, target.name);
        }
        return subscribeDeviceVolume(() => forceUpdate((v) => v + 1));
    }, [activeTargets]);

    const devicesWithVolume: MobileConnectDevice[] = devices.map((device) => {
        const entry = getDeviceVolumeEntry(device.type, device.name);
        return entry?.volume == null ? device : { ...device, volume: entry.volume };
    });

    const connectState: MobileConnectState = { activeTargets, isActive, mySessionId };

    return {
        connectState,
        devices: devicesWithVolume,
        onConnect: (targets: MobileConnectDeviceRef[], force: boolean) => {
            remoteActions
                ?.connectDevices(targets as ConnectDevice[], force)
                .then(({ error }) => {
                    if (error) toast.error({ message: error, title: 'Connect' });
                })
                .catch(() => {});
        },
        onDisconnect: (device?: MobileConnectDeviceRef) => {
            if (device) {
                remoteActions?.disconnectDevice(device as ConnectDevice).catch(() => {});
            } else {
                remoteActions?.disconnectAll().catch(() => {});
            }
        },
        onRescan: () => remoteActions?.refresh(true),
        onVolumeChange: (device: MobileConnectDeviceRef, volume: number) =>
            setDeviceVolumeImperative(device.type, device.name, volume),
    };
}
