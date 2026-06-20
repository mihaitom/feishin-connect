import type { QueueSong } from '/@/shared/types/domain-types';
import type { MutableRefObject } from 'react';

import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConnectDevice, ConnectStatus } from '../types';

import { connectFetch } from '../types';
import { useConnectPlayback } from '../use-connect-playback';

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

const baseArgs = (overrides: Partial<Parameters<typeof useConnectPlayback>[0]> = {}) => {
    const lastAutoSentRef: MutableRefObject<string> = { current: '' };
    return {
        activeTargets: targets,
        connectStatus: null,
        currentSong: song(),
        isActive: true,
        isRadioActive: false,
        lastAutoSentRef,
        mediaNext: vi.fn(),
        mediaPause: vi.fn(),
        pauseRadio: vi.fn(),
        radioStationName: null,
        radioStreamUrl: null,
        ...overrides,
    };
};

describe('useConnectPlayback', () => {
    beforeEach(() => {
        connectFetchMock.mockClear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('auto-forward on track change', () => {
        it('sends the new track to /play and pauses the local player', () => {
            const args = baseArgs();

            renderHook(() => useConnectPlayback(args));

            expect(args.mediaPause).toHaveBeenCalledTimes(1);
            expect(connectFetchMock).toHaveBeenCalledTimes(1);
            const [path, options] = connectFetchMock.mock.calls[0];
            expect(path).toBe('/play');
            expect(JSON.parse(options.body)).toEqual({
                gain: 1,
                targets: [{ name: 'Living Room', type: 'sonos' }],
                track_ids: ['track-1'],
            });
            expect(args.lastAutoSentRef.current).toBe('song-1');
        });

        it('does nothing when Connect is inactive', () => {
            const args = baseArgs({ isActive: false });

            renderHook(() => useConnectPlayback(args));

            expect(connectFetchMock).not.toHaveBeenCalled();
            expect(args.mediaPause).not.toHaveBeenCalled();
        });

        it('does nothing while radio is active', () => {
            const args = baseArgs({ isRadioActive: true });

            renderHook(() => useConnectPlayback(args));

            expect(connectFetchMock).not.toHaveBeenCalled();
        });

        it('does not re-send the same track on re-render', () => {
            const args = baseArgs();
            const { rerender } = renderHook((props) => useConnectPlayback(props), {
                initialProps: args,
            });

            expect(connectFetchMock).toHaveBeenCalledTimes(1);

            rerender({ ...args });

            expect(connectFetchMock).toHaveBeenCalledTimes(1);
        });

        it('sends a new request when the track changes', () => {
            const args = baseArgs();
            const { rerender } = renderHook((props) => useConnectPlayback(props), {
                initialProps: args,
            });

            expect(connectFetchMock).toHaveBeenCalledTimes(1);

            rerender({ ...args, currentSong: song({ _uniqueId: 'song-2', id: 'track-2' }) });

            expect(connectFetchMock).toHaveBeenCalledTimes(2);
            const [, options] = connectFetchMock.mock.calls[1];
            expect(JSON.parse(options.body)).toEqual({
                gain: 1,
                targets: [{ name: 'Living Room', type: 'sonos' }],
                track_ids: ['track-2'],
            });
        });

        it('marks the track as sent but skips the request when there is no track id', () => {
            const args = baseArgs({ currentSong: song({ _uniqueId: 'song-3', id: undefined }) });

            renderHook(() => useConnectPlayback(args));

            expect(connectFetchMock).not.toHaveBeenCalled();
            expect(args.mediaPause).not.toHaveBeenCalled();
            expect(args.lastAutoSentRef.current).toBe('song-3');
        });
    });

    describe('auto-forward on radio switch', () => {
        it('pauses the local radio and starts streaming the radio URL on the Connect targets', () => {
            const args = baseArgs({
                isRadioActive: true,
                radioStationName: 'Cool FM',
                radioStreamUrl: 'https://stream.example/radio',
            });

            renderHook(() => useConnectPlayback(args));

            expect(args.pauseRadio).toHaveBeenCalledTimes(1);
            expect(connectFetchMock).toHaveBeenCalledTimes(1);
            const [path, options] = connectFetchMock.mock.calls[0];
            expect(path).toBe('/play-url');
            expect(JSON.parse(options.body)).toEqual({
                targets: [{ name: 'Living Room', type: 'sonos' }],
                title: 'Cool FM',
                url: 'https://stream.example/radio',
            });
            expect(args.lastAutoSentRef.current).toBe('song-1');
        });

        it('falls back to "Radio" as the title when no station name is given', () => {
            const args = baseArgs({
                currentSong: undefined,
                isRadioActive: true,
                radioStationName: null,
                radioStreamUrl: 'https://stream.example/radio',
            });

            renderHook(() => useConnectPlayback(args));

            const [, options] = connectFetchMock.mock.calls[0];
            expect(JSON.parse(options.body).title).toBe('Radio');
            expect(args.lastAutoSentRef.current).toBe('radio');
        });

        it('does nothing when there is no radio stream url', () => {
            const args = baseArgs({ isRadioActive: true, radioStreamUrl: null });

            renderHook(() => useConnectPlayback(args));

            expect(connectFetchMock).not.toHaveBeenCalled();
            expect(args.pauseRadio).not.toHaveBeenCalled();
        });
    });

    describe('track-ended detection', () => {
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

        it('advances to the next track and pauses locally when playback has ended', () => {
            const args = baseArgs({ connectStatus: status({ ended: true, streaming: false }) });
            // Avoid the track-change effect also firing mediaPause for this song.
            args.lastAutoSentRef.current = args.currentSong!._uniqueId;

            renderHook(() => useConnectPlayback(args));

            expect(args.mediaNext).toHaveBeenCalledTimes(1);
            expect(args.mediaPause).toHaveBeenCalledTimes(1);
            expect(args.lastAutoSentRef.current).toBe('');
        });

        it('does nothing while still streaming, even if ended is set', () => {
            const args = baseArgs({ connectStatus: status({ ended: true, streaming: true }) });

            renderHook(() => useConnectPlayback(args));

            expect(args.mediaNext).not.toHaveBeenCalled();
        });

        it('does nothing while a radio stream is active', () => {
            const args = baseArgs({
                connectStatus: status({
                    ended: true,
                    radio: { title: 'Radio', url: 'x' },
                    streaming: false,
                }),
            });

            renderHook(() => useConnectPlayback(args));

            expect(args.mediaNext).not.toHaveBeenCalled();
        });

        it('does not advance twice for the same ended state', () => {
            const args = baseArgs({ connectStatus: status({ ended: true, streaming: false }) });
            const { rerender } = renderHook((props) => useConnectPlayback(props), {
                initialProps: args,
            });

            expect(args.mediaNext).toHaveBeenCalledTimes(1);

            rerender({ ...args, connectStatus: status({ ended: true, streaming: false }) });

            expect(args.mediaNext).toHaveBeenCalledTimes(1);
        });

        it('re-arms once streaming resumes', () => {
            const args = baseArgs({ connectStatus: status({ ended: true, streaming: false }) });
            const { rerender } = renderHook((props) => useConnectPlayback(props), {
                initialProps: args,
            });

            expect(args.mediaNext).toHaveBeenCalledTimes(1);

            rerender({ ...args, connectStatus: status({ ended: false, streaming: true }) });
            rerender({ ...args, connectStatus: status({ ended: true, streaming: false }) });

            expect(args.mediaNext).toHaveBeenCalledTimes(2);
        });
    });
});
