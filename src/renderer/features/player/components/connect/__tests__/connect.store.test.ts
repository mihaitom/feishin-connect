import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useConnectElapsed, useConnectPlayerStore } from '../connect.store';

const resetStore = () => {
    useConnectPlayerStore.setState({
        duration: 0,
        elapsed: 0,
        handlers: null,
        isActive: false,
        isPlaying: false,
        isStreaming: false,
        syncTime: 0,
    });
};

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
