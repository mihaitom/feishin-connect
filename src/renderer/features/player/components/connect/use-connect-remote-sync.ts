import { useEffect, useRef } from 'react';

import { RemoteConnectActions, useConnectPlayerStore } from './connect.store';
import { ConnectDevice } from './types';

interface UseConnectRemoteSyncArgs {
    activeTargets: ConnectDevice[];
    connectDevices: (devices: ConnectDevice[], force: boolean) => Promise<{ error: null | string }>;
    devices: ConnectDevice[];
    mySessionId: string;
    refresh: (fresh?: boolean) => void;
    stopAllPlayback: () => Promise<void>;
    stopSingleDevice: (device: ConnectDevice) => Promise<void>;
}

/**
 * Mirrors the Connect session's device list/targets/session-id and exposes
 * its device actions into the Context-free connect store, so the phone-remote
 * IPC bridge (use-remote-connect.tsx, mounted outside Playerbar's subtree)
 * can read and drive Connect the same way use-connect-controls.ts already
 * does for play/pause/stop.
 */
export const useConnectRemoteSync = ({
    activeTargets,
    connectDevices,
    devices,
    mySessionId,
    refresh,
    stopAllPlayback,
    stopSingleDevice,
}: UseConnectRemoteSyncArgs) => {
    // Ref-trampoline so remoteActions keeps a stable identity while always
    // calling the latest closures — same pattern as use-connect-controls.ts's
    // storeHandlersRef.
    const actionsRef = useRef({ connectDevices, refresh, stopAllPlayback, stopSingleDevice });
    actionsRef.current = { connectDevices, refresh, stopAllPlayback, stopSingleDevice };

    useEffect(() => {
        const remoteActions: RemoteConnectActions = {
            connectDevices: (targets, force) => actionsRef.current.connectDevices(targets, force),
            disconnectAll: () => actionsRef.current.stopAllPlayback(),
            disconnectDevice: (device) => actionsRef.current.stopSingleDevice(device),
            refresh: (fresh) => actionsRef.current.refresh(fresh),
        };
        useConnectPlayerStore.getState().set({ remoteActions });

        return () => {
            // Only clear if we're still the ones who set it — a remount (e.g.
            // mobile/desktop Playerbar swap) can re-set it first.
            if (useConnectPlayerStore.getState().remoteActions === remoteActions) {
                useConnectPlayerStore.getState().set({ remoteActions: null });
            }
        };
    }, []);

    useEffect(() => {
        useConnectPlayerStore.getState().set({ devices });
    }, [devices]);

    useEffect(() => {
        useConnectPlayerStore.getState().set({ activeTargets });
    }, [activeTargets]);

    useEffect(() => {
        useConnectPlayerStore.getState().set({ mySessionId });
    }, [mySessionId]);
};
