import type { QueueSong } from '/@/shared/types/domain-types';
import type { MutableRefObject } from 'react';

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConnectDevice, ConnectStatus } from '../types';

import { useConnectPlayerStore } from '../connect.store';
import { connectFetch } from '../types';
import { useConnectDisconnect } from '../use-connect-disconnect';

vi.mock('../types', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../types')>();
    return {
        ...actual,
        connectFetch: vi.fn(() => Promise.resolve(new Response('{}'))),
    };
});

const connectFetchMock = connectFetch as unknown as ReturnType<typeof vi.fn>;

const livingRoom: ConnectDevice = { name: 'Living Room', type: 'sonos' };
const kitchen: ConnectDevice = { name: 'Kitchen', type: 'chromecast' };

const status = (overrides: Partial<ConnectStatus> = {}): ConnectStatus =>
    ({
        current_track: null,
        current_track_index: 0,
        elapsed: 0,
        ended: false,
        paused: false,
        radio: null,
        streaming: false,
        targets: [],
        total_tracks: 1,
        ...overrides,
    }) as ConnectStatus;

const baseArgs = (overrides: Partial<Parameters<typeof useConnectDisconnect>[0]> = {}) => {
    const lastAutoSentRef: MutableRefObject<string> = { current: 'song-1' };
    const currentSongRef: MutableRefObject<QueueSong | undefined> = {
        current: { _uniqueId: 'song-1', id: 'track-1' } as unknown as QueueSong,
    };
    return {
        activeTargets: [livingRoom] as ConnectDevice[],
        connectElapsed: 30,
        connectStatus: null as ConnectStatus | null,
        currentSongRef,
        isActive: true,
        isRadioActive: false,
        lastAutoSentRef,
        mediaPlay: vi.fn(),
        mediaSeekToTimestamp: vi.fn(),
        playRadio: vi.fn(),
        refresh: vi.fn(),
        setActive: vi.fn(),
        setActiveTargets: vi.fn(),
        setSelectedForSend: vi.fn(),
        setStatus: vi.fn(),
        ...overrides,
    };
};

describe('useConnectDisconnect', () => {
    beforeEach(() => {
        connectFetchMock.mockClear();
        connectFetchMock.mockResolvedValue(new Response('{}'));
        useConnectPlayerStore.setState({ isPlaying: true });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    describe('stopAllPlayback', () => {
        it('POSTs /stop and resets all active-session state', async () => {
            const args = baseArgs();
            const { result } = renderHook(() => useConnectDisconnect(args));

            await result.current.stopAllPlayback();

            expect(connectFetchMock).toHaveBeenCalledWith('/stop', { method: 'POST' });
            expect(args.setStatus).toHaveBeenCalledWith('idle');
            expect(args.setActive).toHaveBeenCalledWith(null);
            expect(args.setActiveTargets).toHaveBeenCalledWith([]);
            expect(args.setSelectedForSend).toHaveBeenCalledWith([]);
            expect(args.lastAutoSentRef.current).toBe('');
        });

        it('resumes local playback at the captured position once resolved', async () => {
            vi.useFakeTimers();
            const args = baseArgs({ connectElapsed: 45.2 });
            useConnectPlayerStore.setState({ isPlaying: true });
            const { result } = renderHook(() => useConnectDisconnect(args));

            await result.current.stopAllPlayback();
            act(() => {
                vi.runAllTimers();
            });

            expect(args.mediaSeekToTimestamp).toHaveBeenCalledWith(45.2);
            expect(args.mediaPlay).toHaveBeenCalledTimes(1);
        });

        it('does not seek for a negligible elapsed position', async () => {
            vi.useFakeTimers();
            const args = baseArgs({ connectElapsed: 0.2 });
            const { result } = renderHook(() => useConnectDisconnect(args));

            await result.current.stopAllPlayback();
            act(() => {
                vi.runAllTimers();
            });

            expect(args.mediaSeekToTimestamp).not.toHaveBeenCalled();
        });

        it('resumes local radio instead of the queue when radio was playing', async () => {
            vi.useFakeTimers();
            const args = baseArgs({ isRadioActive: true });
            useConnectPlayerStore.setState({ isPlaying: true });
            const { result } = renderHook(() => useConnectDisconnect(args));

            await result.current.stopAllPlayback();
            act(() => {
                vi.runAllTimers();
            });

            expect(args.playRadio).toHaveBeenCalledTimes(1);
            expect(args.mediaPlay).not.toHaveBeenCalled();
            expect(args.mediaSeekToTimestamp).not.toHaveBeenCalled();
        });

        it('does not resume playback if it was already paused', async () => {
            vi.useFakeTimers();
            const args = baseArgs();
            useConnectPlayerStore.setState({ isPlaying: false });
            const { result } = renderHook(() => useConnectDisconnect(args));

            await result.current.stopAllPlayback();
            act(() => {
                vi.runAllTimers();
            });

            expect(args.mediaPlay).not.toHaveBeenCalled();
            expect(args.playRadio).not.toHaveBeenCalled();
        });
    });

    describe('stopSingleDevice', () => {
        it('ends the session and resumes local playback when it was the last device', async () => {
            vi.useFakeTimers();
            const args = baseArgs({ activeTargets: [livingRoom] });
            useConnectPlayerStore.setState({ isPlaying: true });
            const { result } = renderHook(() => useConnectDisconnect(args));

            await result.current.stopSingleDevice(livingRoom);
            act(() => {
                vi.runAllTimers();
            });

            expect(connectFetchMock).toHaveBeenCalledWith(
                '/device-stop?device_type=sonos&name=Living%20Room',
                { method: 'POST' },
            );
            expect(args.setActive).toHaveBeenCalledWith(null);
            expect(args.setStatus).toHaveBeenCalledWith('idle');
            expect(args.mediaPlay).toHaveBeenCalledTimes(1);
        });

        it('keeps remaining devices active and does not touch local playback', async () => {
            const args = baseArgs({ activeTargets: [livingRoom, kitchen] });
            const { result } = renderHook(() => useConnectDisconnect(args));

            await result.current.stopSingleDevice(livingRoom);

            expect(args.setActiveTargets).toHaveBeenCalledWith([kitchen]);
            expect(args.setActive).toHaveBeenCalledWith(kitchen);
            expect(args.setStatus).not.toHaveBeenCalled();
            expect(args.mediaPlay).not.toHaveBeenCalled();
        });
    });

    describe('external stop (device taken over or reaped)', () => {
        it('ignores the initial streaming=false snapshot right after activating', () => {
            const args = baseArgs({ connectStatus: status({ streaming: false }) });

            renderHook(() => useConnectDisconnect(args));

            expect(args.setActive).not.toHaveBeenCalled();
            expect(args.refresh).not.toHaveBeenCalled();
        });

        it('treats streaming=false as a loss only after streaming was observed, and refreshes the device list', () => {
            const args = baseArgs({ connectStatus: status({ streaming: false }) });
            const { rerender } = renderHook((props) => useConnectDisconnect(props), {
                initialProps: args,
            });

            rerender({ ...args, connectStatus: status({ streaming: true }) });
            expect(args.setActive).not.toHaveBeenCalled();

            rerender({ ...args, connectStatus: status({ streaming: false }) });

            expect(args.setActive).toHaveBeenCalledWith(null);
            expect(args.setActiveTargets).toHaveBeenCalledWith([]);
            expect(args.setSelectedForSend).toHaveBeenCalledWith([]);
            expect(args.setStatus).toHaveBeenCalledWith('idle');
            expect(args.lastAutoSentRef.current).toBe('');
            expect(args.refresh).toHaveBeenCalledTimes(1);
        });

        it('does not treat a normal track-end (ended=true) as an external stop', () => {
            const args = baseArgs({ connectStatus: status({ streaming: true }) });
            const { rerender } = renderHook((props) => useConnectDisconnect(props), {
                initialProps: args,
            });

            rerender({
                ...args,
                connectStatus: status({ ended: true, streaming: false }),
            });

            expect(args.setActive).not.toHaveBeenCalled();
            expect(args.refresh).not.toHaveBeenCalled();
        });

        it('re-arms the guard after deactivating and reactivating', () => {
            const args = baseArgs({
                connectStatus: status({ streaming: true }),
                isActive: true,
            });
            const { rerender } = renderHook((props) => useConnectDisconnect(props), {
                initialProps: args,
            });

            // Deactivate (e.g. this session's own explicit stop already ran).
            rerender({ ...args, isActive: false });
            // Reactivate — the first streaming=false snapshot must be ignored
            // again, exactly like a fresh connection.
            rerender({ ...args, connectStatus: status({ streaming: false }), isActive: true });

            expect(args.setActive).not.toHaveBeenCalled();
        });
    });
});
