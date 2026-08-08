import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConnectDevice } from '../types';

import { useConnectPlayerStore } from '../connect.store';
import { useConnectRemoteSync } from '../use-connect-remote-sync';

const livingRoom: ConnectDevice = { name: 'Living Room', type: 'sonos' };
const kitchen: ConnectDevice = { name: 'Kitchen', type: 'chromecast' };

const baseArgs = (overrides: Partial<Parameters<typeof useConnectRemoteSync>[0]> = {}) => ({
    activeTargets: [] as ConnectDevice[],
    connectDevices: vi.fn(() => Promise.resolve({ error: null })),
    devices: [] as ConnectDevice[],
    mySessionId: '',
    refresh: vi.fn(),
    stopAllPlayback: vi.fn(() => Promise.resolve()),
    stopSingleDevice: vi.fn(() => Promise.resolve()),
    ...overrides,
});

describe('useConnectRemoteSync', () => {
    beforeEach(() => {
        useConnectPlayerStore.setState({
            activeTargets: [],
            devices: [],
            mySessionId: '',
            remoteActions: null,
        });
    });

    it('publishes remoteActions into the store on mount', () => {
        renderHook(() => useConnectRemoteSync(baseArgs()));

        expect(useConnectPlayerStore.getState().remoteActions).not.toBeNull();
    });

    it('clears remoteActions on unmount when it is still the one we set', () => {
        const { unmount } = renderHook(() => useConnectRemoteSync(baseArgs()));

        expect(useConnectPlayerStore.getState().remoteActions).not.toBeNull();
        unmount();

        expect(useConnectPlayerStore.getState().remoteActions).toBeNull();
    });

    // A remount (e.g. mobile/desktop Playerbar swap) can publish its own
    // remoteActions before the old instance's cleanup runs — the old cleanup
    // must not clobber the new one back to null.
    it('does not clear remoteActions on unmount if another instance already replaced it', () => {
        const { unmount } = renderHook(() => useConnectRemoteSync(baseArgs()));

        const replacement = {
            connectDevices: vi.fn(),
            disconnectAll: vi.fn(),
            disconnectDevice: vi.fn(),
            refresh: vi.fn(),
        };
        useConnectPlayerStore.getState().set({ remoteActions: replacement });

        unmount();

        expect(useConnectPlayerStore.getState().remoteActions).toBe(replacement);
    });

    describe('ref-trampoline freshness', () => {
        it('connectDevices always calls the latest prop, not the one from mount', async () => {
            const first = vi.fn(() => Promise.resolve({ error: null }));
            const second = vi.fn(() => Promise.resolve({ error: null }));
            const { rerender } = renderHook((args) => useConnectRemoteSync(args), {
                initialProps: baseArgs({ connectDevices: first }),
            });

            // Same identity for activeTargets/devices/mySessionId so the
            // mount-only effect (deps: []) genuinely does not re-run — this
            // is what makes the ref-trampoline necessary in the first place.
            rerender(baseArgs({ connectDevices: second }));

            await useConnectPlayerStore
                .getState()
                .remoteActions!.connectDevices([livingRoom], false);

            expect(first).not.toHaveBeenCalled();
            expect(second).toHaveBeenCalledWith([livingRoom], false);
        });

        it('disconnectDevice/disconnectAll/refresh always call the latest props too', () => {
            const refreshA = vi.fn();
            const refreshB = vi.fn();
            const stopAllA = vi.fn(() => Promise.resolve());
            const stopAllB = vi.fn(() => Promise.resolve());
            const stopSingleA = vi.fn(() => Promise.resolve());
            const stopSingleB = vi.fn(() => Promise.resolve());

            const { rerender } = renderHook((args) => useConnectRemoteSync(args), {
                initialProps: baseArgs({
                    refresh: refreshA,
                    stopAllPlayback: stopAllA,
                    stopSingleDevice: stopSingleA,
                }),
            });

            rerender(
                baseArgs({
                    refresh: refreshB,
                    stopAllPlayback: stopAllB,
                    stopSingleDevice: stopSingleB,
                }),
            );

            const remoteActions = useConnectPlayerStore.getState().remoteActions!;
            remoteActions.refresh(true);
            remoteActions.disconnectAll();
            remoteActions.disconnectDevice(kitchen);

            expect(refreshA).not.toHaveBeenCalled();
            expect(refreshB).toHaveBeenCalledWith(true);
            expect(stopAllA).not.toHaveBeenCalled();
            expect(stopAllB).toHaveBeenCalledTimes(1);
            expect(stopSingleA).not.toHaveBeenCalled();
            expect(stopSingleB).toHaveBeenCalledWith(kitchen);
        });
    });

    describe('state mirroring', () => {
        it('mirrors devices into the store reactively', () => {
            const { rerender } = renderHook((args) => useConnectRemoteSync(args), {
                initialProps: baseArgs({ devices: [] }),
            });
            expect(useConnectPlayerStore.getState().devices).toEqual([]);

            rerender(baseArgs({ devices: [livingRoom, kitchen] }));

            expect(useConnectPlayerStore.getState().devices).toEqual([livingRoom, kitchen]);
        });

        it('mirrors activeTargets into the store reactively', () => {
            const { rerender } = renderHook((args) => useConnectRemoteSync(args), {
                initialProps: baseArgs({ activeTargets: [] }),
            });

            rerender(baseArgs({ activeTargets: [livingRoom] }));

            expect(useConnectPlayerStore.getState().activeTargets).toEqual([livingRoom]);
        });

        it('mirrors mySessionId into the store reactively', () => {
            const { rerender } = renderHook((args) => useConnectRemoteSync(args), {
                initialProps: baseArgs({ mySessionId: '' }),
            });

            rerender(baseArgs({ mySessionId: 'session-42' }));

            expect(useConnectPlayerStore.getState().mySessionId).toBe('session-42');
        });
    });
});
