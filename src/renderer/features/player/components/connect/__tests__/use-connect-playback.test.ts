import type { QueueSong } from '/@/shared/types/domain-types';
import type { MutableRefObject } from 'react';

import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConnectMode } from '../connect.store';
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
        ensureConfigured: vi.fn(() => Promise.resolve()),
        forceReconfigure: vi.fn(() => Promise.resolve()),
        isRadioActive: false,
        lastAutoSentRef,
        mediaNext: vi.fn(),
        mediaPause: vi.fn(),
        mode: 'cast' as ConnectMode,
        pauseRadio: vi.fn(),
        radioStationName: null,
        radioStreamUrl: null,
        setLocalMode: vi.fn(),
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
        it('sends the new track to /play and pauses the local player', async () => {
            const args = baseArgs();

            renderHook(() => useConnectPlayback(args));
            await Promise.resolve();
            await Promise.resolve();

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

        it('registers this tab as the local audio source when inactive (no cast device)', async () => {
            const args = baseArgs({ mode: 'inactive' });

            renderHook(() => useConnectPlayback(args));
            await Promise.resolve();
            await Promise.resolve();

            // Unlike casting, there's no external target — local audio must
            // actually play, so mediaPause() must NOT be called here.
            expect(args.mediaPause).not.toHaveBeenCalled();
            const [path, options] = connectFetchMock.mock.calls[0];
            expect(path).toBe('/play');
            const body = JSON.parse(options.body);
            expect(body.track_ids).toEqual(['track-1']);
            expect(body).toHaveProperty('client_id');
            expect(body.targets).toBeUndefined();
            expect(args.setLocalMode).toHaveBeenCalledWith('local-owner');
        });

        it('keeps pushing as local-owner without re-promoting', async () => {
            const args = baseArgs({ mode: 'local-owner' });

            renderHook(() => useConnectPlayback(args));
            await Promise.resolve();
            await Promise.resolve();

            expect(connectFetchMock).toHaveBeenCalledTimes(1);
            expect(args.setLocalMode).not.toHaveBeenCalled();
        });

        it('does nothing while mirroring another tab/device', () => {
            const args = baseArgs({ mode: 'mirror' });

            renderHook(() => useConnectPlayback(args));

            expect(connectFetchMock).not.toHaveBeenCalled();
            expect(args.mediaPause).not.toHaveBeenCalled();
        });

        it('does nothing while radio is active', () => {
            const args = baseArgs({ isRadioActive: true });

            renderHook(() => useConnectPlayback(args));

            expect(connectFetchMock).not.toHaveBeenCalled();
        });

        it('does not re-send the same track on re-render', async () => {
            const args = baseArgs();
            const { rerender } = renderHook((props) => useConnectPlayback(props), {
                initialProps: args,
            });
            await Promise.resolve();
            await Promise.resolve();

            expect(connectFetchMock).toHaveBeenCalledTimes(1);

            rerender({ ...args });
            await Promise.resolve();
            await Promise.resolve();

            expect(connectFetchMock).toHaveBeenCalledTimes(1);
        });

        it('sends a new request when the track changes', async () => {
            const args = baseArgs();
            const { rerender } = renderHook((props) => useConnectPlayback(props), {
                initialProps: args,
            });
            await Promise.resolve();
            await Promise.resolve();

            expect(connectFetchMock).toHaveBeenCalledTimes(1);

            rerender({ ...args, currentSong: song({ _uniqueId: 'song-2', id: 'track-2' }) });
            await Promise.resolve();
            await Promise.resolve();

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
        it('pauses the local radio and starts streaming the radio URL on the Connect targets', async () => {
            const args = baseArgs({
                isRadioActive: true,
                radioStationName: 'Cool FM',
                radioStreamUrl: 'https://stream.example/radio',
            });

            renderHook(() => useConnectPlayback(args));
            await Promise.resolve();
            await Promise.resolve();

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

        it('falls back to "Radio" as the title when no station name is given', async () => {
            const args = baseArgs({
                currentSong: undefined,
                isRadioActive: true,
                radioStationName: null,
                radioStreamUrl: 'https://stream.example/radio',
            });

            renderHook(() => useConnectPlayback(args));
            await Promise.resolve();
            await Promise.resolve();

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
                local_owner_client_id: null,
                paused: false,
                queue_track_ids: [],
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

        it("does nothing in mirror mode — must not advance this tab's own unrelated local queue", () => {
            const args = baseArgs({
                connectStatus: status({ ended: true, streaming: false }),
                mode: 'mirror',
            });

            renderHook(() => useConnectPlayback(args));

            expect(args.mediaNext).not.toHaveBeenCalled();
        });

        it('does nothing in local-owner mode — natural end is detected locally instead', () => {
            const args = baseArgs({
                connectStatus: status({ ended: true, streaming: false }),
                mode: 'local-owner',
            });

            renderHook(() => useConnectPlayback(args));

            expect(args.mediaNext).not.toHaveBeenCalled();
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
