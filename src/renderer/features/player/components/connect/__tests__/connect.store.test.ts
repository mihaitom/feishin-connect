import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConnectDevice } from '../types';

import { useConnectElapsed, useConnectPlayerStore } from '../connect.store';

const resetStore = () => {
    useConnectPlayerStore.setState({
        activeTargets: [],
        devices: [],
        duration: 0,
        elapsed: 0,
        handlers: null,
        isActive: false,
        isPlaying: false,
        isStreaming: false,
        mySessionId: '',
        remoteActions: null,
        syncTime: 0,
    });
};

const livingRoom: ConnectDevice = { name: 'Living Room', type: 'sonos' };

describe('connect.store', () => {
    beforeEach(() => {
        resetStore();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('useConnectPlayerStore', () => {
        it('exposes a settable patch via set()', () => {
            useConnectPlayerStore.getState().set({ elapsed: 42, isActive: true });

            expect(useConnectPlayerStore.getState().elapsed).toBe(42);
            expect(useConnectPlayerStore.getState().isActive).toBe(true);
        });

        // Regression coverage for the fields added so parts of the app outside
        // Playerbar's subtree (the phone-remote IPC bridge) can read device
        // state and drive Connect without ConnectSessionContext — see
        // use-connect-remote-sync.ts, the sole writer of these in the real app.
        it('defaults the remote-bridge fields to empty/inactive', () => {
            const state = useConnectPlayerStore.getState();

            expect(state.devices).toEqual([]);
            expect(state.activeTargets).toEqual([]);
            expect(state.mySessionId).toBe('');
            expect(state.remoteActions).toBeNull();
        });

        it('accepts a patch for devices/activeTargets/mySessionId/remoteActions', () => {
            const remoteActions = {
                connectDevices: vi.fn(),
                disconnectAll: vi.fn(),
                disconnectDevice: vi.fn(),
                refresh: vi.fn(),
            };

            useConnectPlayerStore.getState().set({
                activeTargets: [livingRoom],
                devices: [livingRoom],
                mySessionId: 'session-1',
                remoteActions,
            });

            const state = useConnectPlayerStore.getState();
            expect(state.devices).toEqual([livingRoom]);
            expect(state.activeTargets).toEqual([livingRoom]);
            expect(state.mySessionId).toBe('session-1');
            expect(state.remoteActions).toBe(remoteActions);
        });
    });

    describe('useConnectElapsed', () => {
        it('returns the synced elapsed value when Connect is inactive', () => {
            useConnectPlayerStore.setState({ elapsed: 10, isActive: false, isPlaying: false });

            const { result } = renderHook(() => useConnectElapsed());

            expect(result.current).toBe(10);
        });

        it('does not advance the local value over time when not playing', () => {
            vi.useFakeTimers();
            useConnectPlayerStore.setState({
                elapsed: 10,
                isActive: true,
                isPlaying: false,
                syncTime: Date.now(),
            });

            const { result } = renderHook(() => useConnectElapsed());

            act(() => {
                vi.advanceTimersByTime(2000);
            });

            expect(result.current).toBe(10);
        });

        it('smoothly advances between server polls while active and playing', () => {
            vi.useFakeTimers();
            const syncTime = Date.now();
            useConnectPlayerStore.setState({
                elapsed: 10,
                isActive: true,
                isPlaying: true,
                syncTime,
            });

            const { result } = renderHook(() => useConnectElapsed());
            expect(result.current).toBe(10);

            act(() => {
                vi.advanceTimersByTime(1500);
            });

            expect(result.current).toBeCloseTo(11.5, 1);
        });

        // Regression test: a stale `isPlaying` (e.g. the SSE connection died
        // silently while the tab was backgrounded) used to let this run away
        // arbitrarily far past the track's actual length.
        it('clamps the projected value to duration', () => {
            vi.useFakeTimers();
            useConnectPlayerStore.setState({
                duration: 12,
                elapsed: 10,
                isActive: true,
                isPlaying: true,
                syncTime: Date.now(),
            });

            const { result } = renderHook(() => useConnectElapsed());

            act(() => {
                vi.advanceTimersByTime(5000);
            });

            expect(result.current).toBe(12);
        });

        it('resets to the new elapsed value whenever the store updates', () => {
            vi.useFakeTimers();
            useConnectPlayerStore.setState({
                elapsed: 10,
                isActive: true,
                isPlaying: true,
                syncTime: Date.now(),
            });

            const { rerender, result } = renderHook(() => useConnectElapsed());
            expect(result.current).toBe(10);

            act(() => {
                useConnectPlayerStore.getState().set({ elapsed: 50, syncTime: Date.now() });
            });
            rerender();

            expect(result.current).toBe(50);
        });
    });
});
