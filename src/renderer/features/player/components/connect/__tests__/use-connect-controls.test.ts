import type { QueueSong } from '/@/shared/types/domain-types';
import type { MutableRefObject } from 'react';

import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConnectDevice } from '../types';

import { ConnectMode, useConnectPlayerStore } from '../connect.store';
import { connectFetch } from '../types';
import { useConnectControls } from '../use-connect-controls';

import { usePlayerStoreBase } from '/@/renderer/store/player.store';
import { PlayerStatus } from '/@/shared/types/types';

vi.mock('../types', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../types')>();
    return {
        ...actual,
        connectFetch: vi.fn(() => Promise.resolve(new Response('{}'))),
    };
});

const connectFetchMock = connectFetch as unknown as ReturnType<typeof vi.fn>;

const song = (overrides: Partial<QueueSong> = {}): QueueSong =>
    ({
        _uniqueId: 'song-1',
        id: 'track-1',
        ...overrides,
    }) as unknown as QueueSong;

const targets: ConnectDevice[] = [{ name: 'Living Room', type: 'sonos' }];

const setLocalStatus = (status: PlayerStatus) =>
    usePlayerStoreBase.setState((state) => ({ player: { ...state.player, status } }));

const baseArgs = (overrides: Partial<Parameters<typeof useConnectControls>[0]> = {}) => {
    const lastAutoSentRef: MutableRefObject<string> = { current: '' };
    return {
        activeTargets: targets,
        currentSong: song(),
        currentTrackId: 'track-1' as null | string,
        ensureConfigured: vi.fn(() => Promise.resolve()),
        forceReconfigure: vi.fn(() => Promise.resolve()),
        isActive: true,
        lastAutoSentRef,
        mediaPause: vi.fn(),
        mediaTogglePlayPause: vi.fn(),
        mode: 'cast' as ConnectMode,
        ...overrides,
    };
};

describe('useConnectControls', () => {
    beforeEach(() => {
        connectFetchMock.mockClear();
        connectFetchMock.mockResolvedValue(new Response('{}'));
        useConnectPlayerStore.setState({
            handlers: null,
            isActive: false,
            isPlaying: false,
            isStreaming: false,
        });
        setLocalStatus(PlayerStatus.PAUSED);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('handleTogglePlayPause', () => {
        it('controls local playback instead when Connect is inactive', () => {
            const args = baseArgs({ isActive: false, mode: 'inactive' });
            const { result } = renderHook(() => useConnectControls(args));

            result.current.handleTogglePlayPause();

            expect(args.mediaTogglePlayPause).toHaveBeenCalledTimes(1);
            expect(connectFetchMock).not.toHaveBeenCalled();
        });

        it('pauses the device when currently playing', () => {
            useConnectPlayerStore.setState({ isPlaying: true, isStreaming: true });
            const args = baseArgs();
            const { result } = renderHook(() => useConnectControls(args));

            result.current.handleTogglePlayPause();

            expect(useConnectPlayerStore.getState().isPlaying).toBe(false);
            expect(connectFetchMock).toHaveBeenCalledWith('/pause', { method: 'POST' });
        });

        it('resumes the device when paused but still streaming', () => {
            useConnectPlayerStore.setState({ isPlaying: false, isStreaming: true });
            const args = baseArgs();
            const { result } = renderHook(() => useConnectControls(args));

            result.current.handleTogglePlayPause();

            expect(useConnectPlayerStore.getState().isPlaying).toBe(true);
            expect(connectFetchMock).toHaveBeenCalledWith('/resume', { method: 'POST' });
        });

        // Deliberately not gated on local PlayerStatus === PLAYING — a paused
        // (or never-yet-played) queue is a valid thing to start Connect from.
        it('starts a fresh /play when neither playing nor streaming, as long as a track is queued', async () => {
            useConnectPlayerStore.setState({ isPlaying: false, isStreaming: false });
            const args = baseArgs();
            const { result } = renderHook(() => useConnectControls(args));

            result.current.handleTogglePlayPause();
            await Promise.resolve();
            await Promise.resolve();

            expect(useConnectPlayerStore.getState().isPlaying).toBe(true);
            expect(useConnectPlayerStore.getState().isStreaming).toBe(true);
            expect(args.lastAutoSentRef.current).toBe('song-1');
            const [path, options] = connectFetchMock.mock.calls[0];
            expect(path).toBe('/play');
            expect(JSON.parse(options.body)).toEqual({
                targets: [{ name: 'Living Room', type: 'sonos' }],
                track_ids: ['track-1'],
            });
        });

        it('does nothing when neither playing/streaming nor a track is queued', () => {
            useConnectPlayerStore.setState({ isPlaying: false, isStreaming: false });
            const args = baseArgs({ currentTrackId: null });
            const { result } = renderHook(() => useConnectControls(args));

            result.current.handleTogglePlayPause();

            expect(connectFetchMock).not.toHaveBeenCalled();
        });
    });

    describe('handleStop', () => {
        it('pauses the device and seeks back to 0:00 without disconnecting', async () => {
            useConnectPlayerStore.setState({ isPlaying: true });
            const args = baseArgs();
            const { result } = renderHook(() => useConnectControls(args));

            result.current.handleStop();
            await Promise.resolve();
            await Promise.resolve();

            expect(useConnectPlayerStore.getState().isPlaying).toBe(false);
            expect(connectFetchMock).toHaveBeenCalledWith('/pause', { method: 'POST' });
            const [path, options] = connectFetchMock.mock.calls[1];
            expect(path).toBe('/seek');
            expect(JSON.parse(options.body)).toEqual({ position: 0 });
        });
    });

    describe('store handler wiring', () => {
        it('publishes onPlayPause/onStop handlers to the shared store while active', () => {
            const args = baseArgs({ isActive: true });
            renderHook(() => useConnectControls(args));

            expect(useConnectPlayerStore.getState().isActive).toBe(true);
            expect(useConnectPlayerStore.getState().handlers).not.toBeNull();
        });

        it('clears the handlers once Connect goes inactive', () => {
            const args = baseArgs({ isActive: true });
            const { rerender } = renderHook((props) => useConnectControls(props), {
                initialProps: args,
            });

            rerender({ ...args, isActive: false, mode: 'inactive' });

            expect(useConnectPlayerStore.getState().handlers).toBeNull();
            expect(useConnectPlayerStore.getState().isActive).toBe(false);
        });

        it('the published onPlayPause always calls the current handler, not a stale closure', async () => {
            useConnectPlayerStore.setState({ isPlaying: false, isStreaming: false });
            const args = baseArgs({ currentTrackId: 'track-1' });
            const { rerender } = renderHook((props) => useConnectControls(props), {
                initialProps: args,
            });

            // Re-render with a different track id — the published handler
            // must reflect this new render's closure, via storeHandlersRef.
            rerender({ ...args, currentTrackId: 'track-2' });

            useConnectPlayerStore.getState().handlers!.onPlayPause();
            await Promise.resolve();
            await Promise.resolve();

            const [, options] = connectFetchMock.mock.calls[0];
            expect(JSON.parse(options.body).track_ids).toEqual(['track-2']);
        });
    });

    describe('safety net: keep local playback paused while Connect is active', () => {
        it('force-pauses local playback if it flips to PLAYING while Connect is active', () => {
            const args = baseArgs({ isActive: true });
            renderHook(() => useConnectControls(args));

            setLocalStatus(PlayerStatus.PLAYING);

            expect(args.mediaPause).toHaveBeenCalledTimes(1);
        });

        it('does not subscribe/interfere when Connect is inactive', () => {
            const args = baseArgs({ isActive: false, mode: 'inactive' });
            renderHook(() => useConnectControls(args));

            setLocalStatus(PlayerStatus.PLAYING);

            expect(args.mediaPause).not.toHaveBeenCalled();
        });

        it('unsubscribes once Connect goes inactive', () => {
            const args = baseArgs({ isActive: true });
            const { rerender } = renderHook((props) => useConnectControls(props), {
                initialProps: args,
            });

            rerender({ ...args, isActive: false, mode: 'inactive' });
            setLocalStatus(PlayerStatus.PLAYING);

            expect(args.mediaPause).not.toHaveBeenCalled();
        });

        it('does not force-pause local playback in local-owner mode — this tab IS the audio source', () => {
            const args = baseArgs({ isActive: true, mode: 'local-owner' });
            renderHook(() => useConnectControls(args));

            setLocalStatus(PlayerStatus.PLAYING);

            expect(args.mediaPause).not.toHaveBeenCalled();
        });

        it('still force-pauses in mirror mode', () => {
            const args = baseArgs({ isActive: true, mode: 'mirror' });
            renderHook(() => useConnectControls(args));

            setLocalStatus(PlayerStatus.PLAYING);

            expect(args.mediaPause).toHaveBeenCalledTimes(1);
        });
    });

    describe('handleNext/handlePrevious', () => {
        it('POSTs /next with a client id when active', async () => {
            const args = baseArgs();
            const { result } = renderHook(() => useConnectControls(args));

            result.current.handleNext();
            await Promise.resolve();
            await Promise.resolve();

            const [path, options] = connectFetchMock.mock.calls[0];
            expect(path).toBe('/next');
            expect(JSON.parse(options.body)).toHaveProperty('client_id');
        });

        it('POSTs /prev with a client id when active', async () => {
            const args = baseArgs();
            const { result } = renderHook(() => useConnectControls(args));

            result.current.handlePrevious();
            await Promise.resolve();
            await Promise.resolve();

            const [path, options] = connectFetchMock.mock.calls[0];
            expect(path).toBe('/prev');
            expect(JSON.parse(options.body)).toHaveProperty('client_id');
        });

        it('does nothing when Connect is inactive', () => {
            const args = baseArgs({ isActive: false, mode: 'inactive' });
            const { result } = renderHook(() => useConnectControls(args));

            result.current.handleNext();
            result.current.handlePrevious();

            expect(connectFetchMock).not.toHaveBeenCalled();
        });
    });
});
