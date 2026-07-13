import type { QueueSong } from '/@/shared/types/domain-types';
import type { MutableRefObject } from 'react';

import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConnectDevice } from '../types';

import { useConnectPlayerStore } from '../connect.store';
import { connectFetch } from '../types';
import { useConnectSend } from '../use-connect-send';

import { useTimestampStoreBase } from '/@/renderer/store/timestamp.store';

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

const devices: ConnectDevice[] = [{ name: 'Living Room', type: 'sonos' }];

const baseArgs = (overrides: Partial<Parameters<typeof useConnectSend>[0]> = {}) => {
    const lastAutoSentRef: MutableRefObject<string> = { current: '' };
    return {
        currentSong: song(),
        currentTrackId: 'track-1',
        ensureConfigured: vi.fn(() => Promise.resolve()),
        isRadioActive: false,
        lastAutoSentRef,
        mediaPause: vi.fn(),
        pauseRadio: vi.fn(),
        radioStationName: null as null | string,
        radioStreamUrl: null as null | string,
        setActive: vi.fn(),
        setActiveTargets: vi.fn(),
        setSelectedForSend: vi.fn(),
        setStatus: vi.fn(),
        ...overrides,
    };
};

describe('useConnectSend', () => {
    beforeEach(() => {
        connectFetchMock.mockClear();
        useConnectPlayerStore.setState({ isPlaying: false, isStreaming: false });
        useTimestampStoreBase.setState({ timestamp: 0 });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('sendTo', () => {
        it('does nothing and returns no error when the device list is empty', async () => {
            const args = baseArgs();
            const { result } = renderHook(() => useConnectSend(args));

            const outcome = await result.current.sendTo([], false);

            expect(outcome).toEqual({ error: null });
            expect(connectFetchMock).not.toHaveBeenCalled();
            expect(args.setActive).not.toHaveBeenCalled();
        });

        // Regression test: this guard must run BEFORE any state mutation —
        // previously setActive/setActiveTargets/setStatus('success') fired
        // unconditionally even with nothing to play, leaving the UI stuck
        // believing it was connected to a device nothing was ever sent to.
        it('refuses with no state mutation when there is neither a track nor radio', async () => {
            const args = baseArgs({ currentTrackId: null, isRadioActive: false });
            const { result } = renderHook(() => useConnectSend(args));

            const outcome = await result.current.sendTo(devices, false);

            expect(outcome.error).toBe('Nothing to play — select a track or start radio first.');
            expect(args.setActive).not.toHaveBeenCalled();
            expect(args.setActiveTargets).not.toHaveBeenCalled();
            expect(args.setStatus).not.toHaveBeenCalled();
            expect(connectFetchMock).not.toHaveBeenCalled();
        });

        it('plays the current track and marks the device active', async () => {
            const args = baseArgs();
            const { result } = renderHook(() => useConnectSend(args));

            const outcome = await result.current.sendTo(devices, false);

            expect(outcome).toEqual({ error: null });
            expect(args.setActive).toHaveBeenCalledWith(devices[0]);
            expect(args.setActiveTargets).toHaveBeenCalledWith(devices);
            expect(args.setStatus).toHaveBeenNthCalledWith(1, 'loading');
            expect(args.setStatus).toHaveBeenNthCalledWith(2, 'success');
            expect(args.mediaPause).toHaveBeenCalledTimes(1);
            expect(args.ensureConfigured).toHaveBeenCalledTimes(1);
            expect(args.lastAutoSentRef.current).toBe('song-1');

            const [path, options] = connectFetchMock.mock.calls[0];
            expect(path).toBe('/play');
            expect(JSON.parse(options.body)).toEqual({
                force: false,
                start_position: 0,
                targets: [{ name: 'Living Room', type: 'sonos' }],
                track_ids: ['track-1'],
            });

            expect(useConnectPlayerStore.getState().isPlaying).toBe(true);
            expect(useConnectPlayerStore.getState().isStreaming).toBe(true);
        });

        it('includes the local playhead position as start_position', async () => {
            useTimestampStoreBase.setState({ timestamp: 42.5 });
            const args = baseArgs();
            const { result } = renderHook(() => useConnectSend(args));

            await result.current.sendTo(devices, false);

            const [, options] = connectFetchMock.mock.calls[0];
            expect(JSON.parse(options.body).start_position).toBe(42.5);
        });

        it('sends radio to /play-url and pauses local radio when radio is active', async () => {
            const args = baseArgs({
                isRadioActive: true,
                radioStationName: 'Cool FM',
                radioStreamUrl: 'https://stream.example/radio',
            });
            const { result } = renderHook(() => useConnectSend(args));

            const outcome = await result.current.sendTo(devices, false);

            expect(outcome).toEqual({ error: null });
            expect(args.pauseRadio).toHaveBeenCalledTimes(1);
            expect(args.mediaPause).not.toHaveBeenCalled();

            const [path, options] = connectFetchMock.mock.calls[0];
            expect(path).toBe('/play-url');
            expect(JSON.parse(options.body)).toEqual({
                force: false,
                targets: [{ name: 'Living Room', type: 'sonos' }],
                title: 'Cool FM',
                url: 'https://stream.example/radio',
            });
            expect(useConnectPlayerStore.getState().isPlaying).toBe(true);
        });

        it('falls back to "Radio" as the title when no station name is given', async () => {
            const args = baseArgs({
                isRadioActive: true,
                radioStationName: null,
                radioStreamUrl: 'https://stream.example/radio',
            });
            const { result } = renderHook(() => useConnectSend(args));

            await result.current.sendTo(devices, false);

            const [, options] = connectFetchMock.mock.calls[0];
            expect(JSON.parse(options.body).title).toBe('Radio');
        });

        it('prefers radio over a queued track when both are present', async () => {
            const args = baseArgs({
                currentTrackId: 'track-1',
                isRadioActive: true,
                radioStreamUrl: 'https://stream.example/radio',
            });
            const { result } = renderHook(() => useConnectSend(args));

            await result.current.sendTo(devices, false);

            const [path] = connectFetchMock.mock.calls[0];
            expect(path).toBe('/play-url');
        });

        it('passes force through to the request body', async () => {
            const args = baseArgs();
            const { result } = renderHook(() => useConnectSend(args));

            await result.current.sendTo(devices, true);

            const [, options] = connectFetchMock.mock.calls[0];
            expect(JSON.parse(options.body).force).toBe(true);
        });

        it('waits for ensureConfigured before sending the request', async () => {
            const order: string[] = [];
            const args = baseArgs({
                ensureConfigured: vi.fn(async () => {
                    order.push('configured');
                }),
            });
            connectFetchMock.mockImplementationOnce(async () => {
                order.push('fetched');
                return new Response('{}');
            });
            const { result } = renderHook(() => useConnectSend(args));

            await result.current.sendTo(devices, false);

            expect(order).toEqual(['configured', 'fetched']);
        });

        it('reverts active state and reports the error on a non-2xx response', async () => {
            connectFetchMock.mockResolvedValueOnce(new Response('{}', { status: 500 }));
            const args = baseArgs();
            const { result } = renderHook(() => useConnectSend(args));

            const outcome = await result.current.sendTo(devices, false);

            expect(outcome.error).toBe('HTTP 500');
            expect(args.setStatus).toHaveBeenLastCalledWith('error');
            expect(args.setActive).toHaveBeenLastCalledWith(null);
            expect(args.setActiveTargets).toHaveBeenLastCalledWith([]);
        });

        it('reverts active state on a logical backend error (200 with {error})', async () => {
            connectFetchMock.mockResolvedValueOnce(
                new Response(JSON.stringify({ error: 'device_in_use' })),
            );
            const args = baseArgs();
            const { result } = renderHook(() => useConnectSend(args));

            const outcome = await result.current.sendTo(devices, false);

            expect(outcome.error).toBe('device_in_use');
            expect(args.setStatus).toHaveBeenLastCalledWith('error');
            expect(args.setActive).toHaveBeenLastCalledWith(null);
        });
    });

    describe('claimOnly', () => {
        it('does nothing and returns no error when the device list is empty', async () => {
            const args = baseArgs();
            const { result } = renderHook(() => useConnectSend(args));

            const outcome = await result.current.claimOnly([], false);

            expect(outcome).toEqual({ error: null });
            expect(connectFetchMock).not.toHaveBeenCalled();
        });

        it('claims the device without starting playback', async () => {
            const args = baseArgs();
            const { result } = renderHook(() => useConnectSend(args));

            const outcome = await result.current.claimOnly(devices, false);

            expect(outcome).toEqual({ error: null });
            expect(args.setActive).toHaveBeenCalledWith(devices[0]);
            expect(args.setActiveTargets).toHaveBeenCalledWith(devices);
            expect(args.setStatus).toHaveBeenNthCalledWith(1, 'loading');
            expect(args.setStatus).toHaveBeenNthCalledWith(2, 'success');

            const [path, options] = connectFetchMock.mock.calls[0];
            expect(path).toBe('/claim');
            expect(JSON.parse(options.body)).toEqual({
                force: false,
                targets: [{ name: 'Living Room', type: 'sonos' }],
            });

            // No play() call attached — the whole point of /claim.
            expect(useConnectPlayerStore.getState().isPlaying).toBe(false);
            expect(useConnectPlayerStore.getState().isStreaming).toBe(false);
        });

        it('passes force through, e.g. for a takeover with an empty queue', async () => {
            const args = baseArgs();
            const { result } = renderHook(() => useConnectSend(args));

            await result.current.claimOnly(devices, true);

            const [, options] = connectFetchMock.mock.calls[0];
            expect(JSON.parse(options.body).force).toBe(true);
        });

        it('reverts active state and reports the error when claiming is refused', async () => {
            connectFetchMock.mockResolvedValueOnce(
                new Response(JSON.stringify({ error: 'device_in_use' })),
            );
            const args = baseArgs();
            const { result } = renderHook(() => useConnectSend(args));

            const outcome = await result.current.claimOnly(devices, false);

            expect(outcome.error).toBe('device_in_use');
            expect(args.setStatus).toHaveBeenLastCalledWith('error');
            expect(args.setActive).toHaveBeenLastCalledWith(null);
            expect(args.setActiveTargets).toHaveBeenLastCalledWith([]);
        });
    });
});
