import { useEffect } from 'react';
import { useShallow } from 'zustand/shallow';

import { useConnectPlayerStore } from '/@/renderer/features/player/components/connect/connect.store';
import { ConnectDevice } from '/@/renderer/features/player/components/connect/types';
import {
    fetchDeviceVolumeIfNeeded,
    setDeviceVolumeImperative,
    useDeviceVolumeEntries,
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
// wiring is needed here. Per-device volume reads useDeviceVolumeEntries()
// (a proper reactive hook subscription), not useDeviceVolume() directly —
// this list is dynamic-length, and calling a hook once per device would
// violate the Rules of Hooks.
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
    const volumeEntries = useDeviceVolumeEntries();

    useEffect(() => {
        for (const target of activeTargets) {
            fetchDeviceVolumeIfNeeded(target.type, target.name);
        }
    }, [activeTargets]);

    const devicesWithVolume: MobileConnectDevice[] = devices.map((device) => {
        const entry = volumeEntries[`${device.type}:${device.name}`];
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
