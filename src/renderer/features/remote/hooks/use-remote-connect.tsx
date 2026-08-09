import isElectron from 'is-electron';
import { useEffect } from 'react';
import { useShallow } from 'zustand/shallow';

import { useConnectPlayerStore } from '/@/renderer/features/player/components/connect/connect.store';
import { ConnectDevice } from '/@/renderer/features/player/components/connect/types';
import {
    fetchDeviceVolumeIfNeeded,
    getDeviceVolumeEntry,
    setDeviceVolumeImperative,
    subscribeDeviceVolume,
} from '/@/renderer/features/player/components/connect/use-device-volume';
import { useRemoteSettings } from '/@/renderer/store';
import { RemoteConnectDevice, RemoteConnectDeviceRef } from '/@/shared/types/remote-types';

const remote = isElectron() ? window.api.remote : null;
const ipc = isElectron() ? window.api.ipc : null;

/**
 * Bridges phone-remote Connect requests to the Connect session's device
 * actions, and pushes the session's device/target state back out to phones.
 * Reads/writes useConnectPlayerStore instead of ConnectSessionContext, since
 * this hook is mounted in audio-players.tsx — outside Playerbar's subtree,
 * the only place that Context reaches (see connect.store.ts).
 */
export const useRemoteConnect = () => {
    const isRemoteEnabled = useRemoteSettings().enabled;

    const { activeTargets, devices, isActive, mySessionId } = useConnectPlayerStore(
        useShallow((s) => ({
            activeTargets: s.activeTargets,
            devices: s.devices,
            isActive: s.isActive,
            mySessionId: s.mySessionId,
        })),
    );

    // ── Outbound: session state → phones ───────────────────────────────────────
    // Devices carry their current volume (active/volume-capable ones only) so
    // the phone panel's per-device sliders have a starting value. Volume lives
    // in a separate store (shared with the desktop popover's own controls), so
    // this also re-pushes whenever that store changes, not just when the
    // device list itself changes.
    useEffect(() => {
        if (!isRemoteEnabled || !remote) return;

        for (const target of activeTargets) {
            fetchDeviceVolumeIfNeeded(target.type, target.name);
        }

        const pushDevices = () => {
            const withVolume: RemoteConnectDevice[] = devices.map((device) => {
                const entry = getDeviceVolumeEntry(device.type, device.name);
                return entry?.volume == null ? device : { ...device, volume: entry.volume };
            });
            remote?.updateConnectDevices(withVolume);
        };
        pushDevices();

        return subscribeDeviceVolume(pushDevices);
    }, [isRemoteEnabled, devices, activeTargets]);

    useEffect(() => {
        if (!isRemoteEnabled || !remote) return;
        remote.updateConnectState({ activeTargets, isActive, mySessionId });
    }, [isRemoteEnabled, activeTargets, isActive, mySessionId]);

    // ── Inbound: phone requests → session actions ──────────────────────────────
    useEffect(() => {
        if (!isRemoteEnabled || !remote) return;

        remote.requestConnectDiscover((data: { fresh?: boolean }) => {
            const { remoteActions } = useConnectPlayerStore.getState();
            if (!remoteActions) {
                remote?.sendConnectError('Connect is still starting up — try again in a moment.');
                return;
            }
            remoteActions.refresh(data.fresh);
        });

        remote.requestConnectConnect(
            (data: { devices: RemoteConnectDeviceRef[]; force: boolean }) => {
                const { remoteActions } = useConnectPlayerStore.getState();
                if (!remoteActions) {
                    remote?.sendConnectError(
                        'Connect is still starting up — try again in a moment.',
                    );
                    return;
                }
                remoteActions
                    .connectDevices(data.devices as ConnectDevice[], data.force)
                    .then(({ error }) => {
                        if (error) remote?.sendConnectError(error);
                    })
                    .catch(() => {});
            },
        );

        remote.requestConnectDisconnect((data: { device?: RemoteConnectDeviceRef }) => {
            const { remoteActions } = useConnectPlayerStore.getState();
            if (!remoteActions) {
                remote?.sendConnectError('Connect is still starting up — try again in a moment.');
                return;
            }
            const action = data.device
                ? remoteActions.disconnectDevice(data.device as ConnectDevice)
                : remoteActions.disconnectAll();
            action.catch(() => {});
        });

        remote.requestConnectSetVolume(
            (data: { device: RemoteConnectDeviceRef; volume: number }) => {
                setDeviceVolumeImperative(data.device.type, data.device.name, data.volume);
            },
        );

        return () => {
            ipc?.removeAllListeners('request-connect-discover');
            ipc?.removeAllListeners('request-connect-connect');
            ipc?.removeAllListeners('request-connect-disconnect');
            ipc?.removeAllListeners('request-connect-set-volume');
        };
    }, [isRemoteEnabled]);
};

export const RemoteConnectHook = () => {
    useRemoteConnect();
    return null;
};
