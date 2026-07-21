import type { QueueSong } from '/@/shared/types/domain-types';
import type { MutableRefObject } from 'react';

import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConnectMode } from '../connect.store';
import type { ConnectDevice, ConnectStatus } from '../types';

import { connectFetch } from '../types';
import { useConnectPlayback } from '../use-connect-playback';

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

// Sets up the REAL local player store's queue/index/status — the reverse-sync
// effect reads these directly via usePlayerStoreBase.getState(), not via
// props, so tests need genuine store state rather than a mock.
const setLocalQueue = (songs: QueueSong[], index: number, status: PlayerStatus) => {
    const ids = songs.map((s) => s._uniqueId);
    usePlayerStoreBase.setState((state) => ({
        player: { ...state.player, index, status },
        queue: {
            ...state.queue,
            default: ids,
            shuffled: [],
            songs: Object.fromEntries(songs.map((s) => [s._uniqueId, s])),
        },
    }));
};

const baseArgs = (overrides: Partial<Parameters<typeof useConnectPlayback>[0]> = {}) => {
    const lastAutoSentRef: MutableRefObject<string> = { current: '' };
    // 0 (well outside the reverse-sync grace period) so existing tests that
    // don't care about it aren't accidentally silenced by it.
    const lastLocalActionAtRef: MutableRefObject<number> = { current: 0 };
    return {
        activeTargets: targets,
        connectStatus: null,
        currentSong: song(),
        ensureConfigured: vi.fn(() => Promise.resolve()),
        forceReconfigure: vi.fn(() => Promise.resolve()),
        isRadioActive: false,
        lastAutoSentRef,
        lastLocalActionAtRef,
        localElapsed: 0,
        mediaNext: vi.fn(),
        mediaPause: vi.fn(),
        mediaPlay: vi.fn(),
        mediaPlayByIndex: vi.fn(),
        mediaSeekToTimestamp: vi.fn(),
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

    describe('reverse-sync (local-owner mode)', () => {
        const status = (overrides: Partial<ConnectStatus> = {}): ConnectStatus =>
            ({
                current_track: null,
                current_track_index: 0,
                elapsed: 0,
                ended: false,
                local_owner_client_id: 'tab-1',
                paused: false,
                queue_track_ids: [],
                radio: null,
                streaming: true,
                targets: [],
                total_tracks: 1,
                ...overrides,
            }) as ConnectStatus;

        const songA = song({ _uniqueId: 'song-a', id: 'track-a' });
        const songB = song({ _uniqueId: 'song-b', id: 'track-b' });

        it('jumps to the backend track index via mediaPlayByIndex when it differs from local', () => {
            setLocalQueue([songA, songB], 0, PlayerStatus.PLAYING);
            const args = baseArgs({
                connectStatus: status({
                    current_track_index: 1,
                    queue_track_ids: ['track-a', 'track-b'],
                }),
                mode: 'local-owner',
            });

            renderHook(() => useConnectPlayback(args));

            expect(args.mediaPlayByIndex).toHaveBeenCalledWith(1);
        });

        it('does nothing when the local index already matches the backend', () => {
            setLocalQueue([songA, songB], 1, PlayerStatus.PLAYING);
            const args = baseArgs({
                connectStatus: status({
                    current_track_index: 1,
                    queue_track_ids: ['track-a', 'track-b'],
                    streaming: true,
                }),
                mode: 'local-owner',
            });

            renderHook(() => useConnectPlayback(args));

            expect(args.mediaPlayByIndex).not.toHaveBeenCalled();
            expect(args.mediaPlay).not.toHaveBeenCalled();
            expect(args.mediaPause).not.toHaveBeenCalled();
        });

        it("does not correct anything within the grace period after this tab's own action", () => {
            setLocalQueue([songA, songB], 0, PlayerStatus.PLAYING);
            const args = baseArgs({
                connectStatus: status({
                    current_track_index: 1,
                    queue_track_ids: ['track-a', 'track-b'],
                }),
                lastLocalActionAtRef: { current: Date.now() },
                mode: 'local-owner',
            });

            renderHook(() => useConnectPlayback(args));

            expect(args.mediaPlayByIndex).not.toHaveBeenCalled();
        });

        it('resumes local playback when the backend says streaming and this tab is paused', () => {
            setLocalQueue([songA], 0, PlayerStatus.PAUSED);
            const args = baseArgs({
                connectStatus: status({ paused: false, streaming: true }),
                mode: 'local-owner',
            });

            renderHook(() => useConnectPlayback(args));

            expect(args.mediaPlay).toHaveBeenCalledTimes(1);
            expect(args.mediaPause).not.toHaveBeenCalled();
        });

        it('pauses local playback when the backend says paused and this tab is playing', () => {
            setLocalQueue([songA], 0, PlayerStatus.PLAYING);
            const args = baseArgs({
                connectStatus: status({ paused: true, streaming: true }),
                mode: 'local-owner',
            });

            renderHook(() => useConnectPlayback(args));

            expect(args.mediaPause).toHaveBeenCalledTimes(1);
            expect(args.mediaPlay).not.toHaveBeenCalled();
        });

        it('corrects local position on a significant divergence from the backend elapsed', () => {
            setLocalQueue([songA], 0, PlayerStatus.PLAYING);
            const args = baseArgs({
                connectStatus: status({ elapsed: 90, paused: false, streaming: true }),
                localElapsed: 10,
                mode: 'local-owner',
            });

            renderHook(() => useConnectPlayback(args));

            expect(args.mediaSeekToTimestamp).toHaveBeenCalledWith(90);
        });

        it('does not correct position for routine drift under the threshold', () => {
            setLocalQueue([songA], 0, PlayerStatus.PLAYING);
            const args = baseArgs({
                connectStatus: status({ elapsed: 11, paused: false, streaming: true }),
                localElapsed: 10,
                mode: 'local-owner',
            });

            renderHook(() => useConnectPlayback(args));

            expect(args.mediaSeekToTimestamp).not.toHaveBeenCalled();
        });

        it('does nothing outside local-owner mode', () => {
            setLocalQueue([songA, songB], 0, PlayerStatus.PLAYING);
            const args = baseArgs({
                connectStatus: status({
                    current_track_index: 1,
                    queue_track_ids: ['track-a', 'track-b'],
                }),
                mode: 'mirror',
            });

            renderHook(() => useConnectPlayback(args));

            expect(args.mediaPlayByIndex).not.toHaveBeenCalled();
            expect(args.mediaPlay).not.toHaveBeenCalled();
            expect(args.mediaPause).not.toHaveBeenCalled();
            expect(args.mediaSeekToTimestamp).not.toHaveBeenCalled();
        });
    });

    describe('local seek push (local-owner mode)', () => {
        it('pushes /seek when the local position jumps significantly on the same track', async () => {
            const args = baseArgs({ localElapsed: 0, mode: 'local-owner' });
            const { rerender } = renderHook((props) => useConnectPlayback(props), {
                initialProps: args,
            });
            // Flush the initial mount's own auto-forward /play before
            // clearing — otherwise its delayed (ensureConfigured-awaited)
            // call lands after the clear and gets mistaken for this test's.
            await Promise.resolve();
            await Promise.resolve();
            connectFetchMock.mockClear();

            rerender({ ...args, localElapsed: 45 });
            await Promise.resolve();
            await Promise.resolve();

            const [path, options] = connectFetchMock.mock.calls[0];
            expect(path).toBe('/seek');
            expect(JSON.parse(options.body)).toEqual({ position: 45 });
        });

        it('does not push for routine playback progression', async () => {
            const args = baseArgs({ localElapsed: 10, mode: 'local-owner' });
            const { rerender } = renderHook((props) => useConnectPlayback(props), {
                initialProps: args,
            });
            // Flush the initial mount's own auto-forward /play before
            // clearing — otherwise its delayed (ensureConfigured-awaited)
            // call lands after the clear and gets mistaken for this test's.
            await Promise.resolve();
            await Promise.resolve();
            connectFetchMock.mockClear();

            rerender({ ...args, localElapsed: 11 });
            await Promise.resolve();
            await Promise.resolve();

            expect(connectFetchMock).not.toHaveBeenCalled();
        });

        it("does not push when the track also changed (that is the auto-forward effect's job)", async () => {
            const args = baseArgs({ localElapsed: 120, mode: 'local-owner' });
            const { rerender } = renderHook((props) => useConnectPlayback(props), {
                initialProps: args,
            });
            // Flush the initial mount's own auto-forward /play before
            // clearing — otherwise its delayed (ensureConfigured-awaited)
            // call lands after the clear and gets mistaken for this test's.
            await Promise.resolve();
            await Promise.resolve();
            connectFetchMock.mockClear();

            rerender({
                ...args,
                currentSong: song({ _uniqueId: 'song-2', id: 'track-2' }),
                localElapsed: 0,
            });
            await Promise.resolve();
            await Promise.resolve();

            const seekCalls = connectFetchMock.mock.calls.filter(([path]) => path === '/seek');
            expect(seekCalls).toHaveLength(0);
        });

        it('does not push outside local-owner mode', async () => {
            const args = baseArgs({ localElapsed: 0, mode: 'cast' });
            const { rerender } = renderHook((props) => useConnectPlayback(props), {
                initialProps: args,
            });
            // Flush the initial mount's own auto-forward /play before
            // clearing — otherwise its delayed (ensureConfigured-awaited)
            // call lands after the clear and gets mistaken for this test's.
            await Promise.resolve();
            await Promise.resolve();
            connectFetchMock.mockClear();

            rerender({ ...args, localElapsed: 45 });
            await Promise.resolve();
            await Promise.resolve();

            const seekCalls = connectFetchMock.mock.calls.filter(([path]) => path === '/seek');
            expect(seekCalls).toHaveLength(0);
        });
    });
});
