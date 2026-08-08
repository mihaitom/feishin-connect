import type { RemoteConnectActions } from '/@/renderer/features/player/components/connect/connect.store';
import type { ConnectDevice } from '/@/renderer/features/player/components/connect/types';

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('is-electron', () => ({ default: () => true }));

vi.mock('/@/renderer/features/player/components/connect/types', async (importOriginal) => {
    const actual =
        await importOriginal<
            typeof import('/@/renderer/features/player/components/connect/types')
        >();
    return {
        ...actual,
        connectFetch: vi.fn(() => Promise.resolve(new Response('{}'))),
    };
});

const livingRoom: ConnectDevice = { name: 'Living Room', type: 'sonos' };
const kitchen: ConnectDevice = { name: 'Kitchen', type: 'chromecast' };

const fakeRemoteActions = (
    overrides: Partial<RemoteConnectActions> = {},
): RemoteConnectActions => ({
    connectDevices: vi.fn(() => Promise.resolve({ error: null })),
    disconnectAll: vi.fn(() => Promise.resolve()),
    disconnectDevice: vi.fn(() => Promise.resolve()),
    refresh: vi.fn(),
    ...overrides,
});

// Every module read below must come from a *dynamic* import performed after
// vi.resetModules(), otherwise it resolves to the stale pre-reset instance —
// disconnected from the one use-remote-connect.tsx itself imports, since
// module-level singletons (the connect store, window.api reads) only line up
// within the same reset cycle. See connect/__tests__/types.test.ts for the
// same pattern applied to a simpler module.
const setup = async (settingsOverrides: { enabled?: boolean } = {}) => {
    vi.resetModules();

    const remoteApi = {
        requestConnectConnect: vi.fn(),
        requestConnectDisconnect: vi.fn(),
        requestConnectDiscover: vi.fn(),
        requestConnectSetVolume: vi.fn(),
        sendConnectError: vi.fn(),
        updateConnectDevices: vi.fn(),
        updateConnectState: vi.fn(),
    };
    const ipcApi = { removeAllListeners: vi.fn() };
    (window as any).api = { ipc: ipcApi, remote: remoteApi };

    const { useSettingsStore } = await import('/@/renderer/store/settings.store');
    useSettingsStore.setState((state) => ({
        remote: { ...state.remote, enabled: true, ...settingsOverrides },
    }));

    const { useConnectPlayerStore } =
        await import('/@/renderer/features/player/components/connect/connect.store');
    useConnectPlayerStore.setState({
        activeTargets: [],
        devices: [],
        isActive: false,
        mySessionId: '',
        remoteActions: null,
    });

    const deviceVolume =
        await import('/@/renderer/features/player/components/connect/use-device-volume');

    const { useRemoteConnect } = await import('../use-remote-connect');

    const hook = renderHook(() => useRemoteConnect());

    // Capture the callbacks the hook registered, so tests can invoke them the
    // same way an incoming WS→IPC message would.
    const handlers = {
        connect: remoteApi.requestConnectConnect.mock.calls[0]?.[0],
        disconnect: remoteApi.requestConnectDisconnect.mock.calls[0]?.[0],
        discover: remoteApi.requestConnectDiscover.mock.calls[0]?.[0],
        setVolume: remoteApi.requestConnectSetVolume.mock.calls[0]?.[0],
    };

    return { deviceVolume, handlers, hook, ipcApi, remoteApi, useConnectPlayerStore };
};

describe('useRemoteConnect', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('outbound: devices/state push', () => {
        it('does not push anything when the remote is disabled', async () => {
            const { remoteApi } = await setup({ enabled: false });

            expect(remoteApi.updateConnectDevices).not.toHaveBeenCalled();
            expect(remoteApi.updateConnectState).not.toHaveBeenCalled();
        });

        it('pushes the device list once enabled', async () => {
            const { hook, remoteApi, useConnectPlayerStore } = await setup();
            remoteApi.updateConnectDevices.mockClear();

            act(() => {
                useConnectPlayerStore.getState().set({ devices: [livingRoom, kitchen] });
            });
            hook.rerender();

            expect(remoteApi.updateConnectDevices).toHaveBeenLastCalledWith([livingRoom, kitchen]);
        });

        it('merges known device volume into the pushed list', async () => {
            const { deviceVolume, hook, remoteApi, useConnectPlayerStore } = await setup();

            act(() => {
                deviceVolume.setDeviceVolumeImperative('sonos', livingRoom.name, 42);
                useConnectPlayerStore.getState().set({ devices: [livingRoom] });
            });
            hook.rerender();

            expect(remoteApi.updateConnectDevices).toHaveBeenLastCalledWith([
                { ...livingRoom, volume: 42 },
            ]);
        });

        it('re-pushes when a device volume changes elsewhere, without devices/activeTargets changing', async () => {
            const { deviceVolume, hook, remoteApi, useConnectPlayerStore } = await setup();
            act(() => {
                useConnectPlayerStore.getState().set({ devices: [livingRoom] });
            });
            hook.rerender();
            remoteApi.updateConnectDevices.mockClear();

            act(() => {
                deviceVolume.setDeviceVolumeImperative('sonos', livingRoom.name, 77);
            });

            expect(remoteApi.updateConnectDevices).toHaveBeenLastCalledWith([
                { ...livingRoom, volume: 77 },
            ]);
        });

        it('pushes connect-state whenever activeTargets/isActive/mySessionId change', async () => {
            const { hook, remoteApi, useConnectPlayerStore } = await setup();
            remoteApi.updateConnectState.mockClear();

            act(() => {
                useConnectPlayerStore.getState().set({
                    activeTargets: [livingRoom],
                    isActive: true,
                    mySessionId: 'session-1',
                });
            });
            hook.rerender();

            expect(remoteApi.updateConnectState).toHaveBeenLastCalledWith({
                activeTargets: [livingRoom],
                isActive: true,
                mySessionId: 'session-1',
            });
        });
    });

    describe('inbound: connect-discover', () => {
        it('calls remoteActions.refresh with the requested freshness', async () => {
            const { handlers, useConnectPlayerStore } = await setup();
            const remoteActions = fakeRemoteActions();
            useConnectPlayerStore.getState().set({ remoteActions });

            handlers.discover({ fresh: true });

            expect(remoteActions.refresh).toHaveBeenCalledWith(true);
        });
    });

    describe('inbound: connect-connect', () => {
        it('calls remoteActions.connectDevices with the requested devices and force flag', async () => {
            const { handlers, useConnectPlayerStore } = await setup();
            const remoteActions = fakeRemoteActions();
            useConnectPlayerStore.getState().set({ remoteActions });

            await act(async () => {
                handlers.connect({ devices: [livingRoom], force: true });
                await Promise.resolve();
            });

            expect(remoteActions.connectDevices).toHaveBeenCalledWith([livingRoom], true);
        });

        it('reports a logical error back to the phone instead of throwing', async () => {
            const { handlers, remoteApi, useConnectPlayerStore } = await setup();
            const remoteActions = fakeRemoteActions({
                connectDevices: vi.fn(() => Promise.resolve({ error: 'device_in_use' })),
            });
            useConnectPlayerStore.getState().set({ remoteActions });

            await act(async () => {
                handlers.connect({ devices: [livingRoom], force: false });
                await Promise.resolve();
            });

            expect(remoteApi.sendConnectError).toHaveBeenCalledWith('device_in_use');
        });

        it('reports a not-ready error instead of crashing when remoteActions is not set up yet', async () => {
            const { handlers, remoteApi, useConnectPlayerStore } = await setup();
            useConnectPlayerStore.getState().set({ remoteActions: null });

            expect(() => handlers.connect({ devices: [livingRoom], force: false })).not.toThrow();
            expect(remoteApi.sendConnectError).toHaveBeenCalledTimes(1);
        });
    });

    describe('inbound: connect-disconnect', () => {
        it('disconnects a single device when one is specified', async () => {
            const { handlers, useConnectPlayerStore } = await setup();
            const remoteActions = fakeRemoteActions();
            useConnectPlayerStore.getState().set({ remoteActions });

            handlers.disconnect({ device: kitchen });

            expect(remoteActions.disconnectDevice).toHaveBeenCalledWith(kitchen);
            expect(remoteActions.disconnectAll).not.toHaveBeenCalled();
        });

        it('disconnects everything when no device is specified', async () => {
            const { handlers, useConnectPlayerStore } = await setup();
            const remoteActions = fakeRemoteActions();
            useConnectPlayerStore.getState().set({ remoteActions });

            handlers.disconnect({});

            expect(remoteActions.disconnectAll).toHaveBeenCalledTimes(1);
            expect(remoteActions.disconnectDevice).not.toHaveBeenCalled();
        });

        it('reports a not-ready error when remoteActions is not set up yet', async () => {
            const { handlers, remoteApi, useConnectPlayerStore } = await setup();
            useConnectPlayerStore.getState().set({ remoteActions: null });

            handlers.disconnect({});

            expect(remoteApi.sendConnectError).toHaveBeenCalledTimes(1);
        });
    });

    describe('inbound: connect-set-volume', () => {
        it('sets the device volume via the shared device-volume store', async () => {
            const { deviceVolume, handlers } = await setup();

            handlers.setVolume({ device: livingRoom, volume: 65 });

            expect(deviceVolume.getDeviceVolumeEntry('sonos', livingRoom.name)?.volume).toBe(65);
        });
    });

    describe('cleanup', () => {
        it('removes all four IPC listeners on unmount', async () => {
            const { hook, ipcApi } = await setup();

            hook.unmount();

            expect(ipcApi.removeAllListeners).toHaveBeenCalledWith('request-connect-discover');
            expect(ipcApi.removeAllListeners).toHaveBeenCalledWith('request-connect-connect');
            expect(ipcApi.removeAllListeners).toHaveBeenCalledWith('request-connect-disconnect');
            expect(ipcApi.removeAllListeners).toHaveBeenCalledWith('request-connect-set-volume');
        });
    });
});
