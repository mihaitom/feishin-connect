import type { MutableRefObject } from 'react';

import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConnectMode } from '../connect.store';
import type { ConnectStatus } from '../types';

import { connectFetchEnsured } from '../connect-request';
import { useConnectLocalQueue } from '../use-connect-local-queue';

import { PlayerStatus } from '/@/shared/types/types';

vi.mock('../connect-request', () => ({
    connectFetchEnsured: vi.fn(() => Promise.resolve(new Response('{}'))),
}));

const mediaPause = vi.fn();
const mediaPlay = vi.fn();
const mediaPlayByIndex = vi.fn();
const mediaSeekToTimestamp = vi.fn();

vi.mock('/@/renderer/features/player/context/player-context', () => ({
    usePlayer: () => ({ mediaPause, mediaPlay, mediaPlayByIndex, mediaSeekToTimestamp }),
}));

let mockQueue: any[] = [];
let mockCurrentSong: any;
let mockStatus: PlayerStatus = PlayerStatus.PAUSED;
let mockPosition = 0;

vi.mock('/@/renderer/store', async (importOriginal) => {
    const actual = await importOriginal<typeof import('/@/renderer/store')>();
    return {
        ...actual,
        usePlayerQueue: () => mockQueue,
        usePlayerSong: () => mockCurrentSong,
        usePlayerStatus: () => mockStatus,
        usePlayerTimestamp: () => mockPosition,
    };
});

const connectFetchEnsuredMock = connectFetchEnsured as unknown as ReturnType<typeof vi.fn>;

const song = (id: string, uniqueId: string) => ({
    _serverId: 'server-1',
    _uniqueId: uniqueId,
    album: 'Album',
    artistName: 'Artist',
    duration: 180,
    id,
    imageUrl: 'https://example.com/art.jpg',
    name: `Song ${id}`,
});

const connectStatus = (overrides: Partial<ConnectStatus> = {}): ConnectStatus =>
    ({
        current_track: null,
        current_track_index: 0,
        elapsed: 0,
        ended: false,
        local_owner_client_id: null,
        paused: false,
        queue: [],
        queue_index: 0,
        radio: null,
        streaming: false,
        targets: [],
        total_tracks: 0,
        ...overrides,
    }) as ConnectStatus;

const baseArgs = (
    overrides: Partial<{ connectStatus: ConnectStatus | null; mode: ConnectMode }> = {},
) => ({
    connectStatus: null as ConnectStatus | null,
    ensureConfigured: vi.fn(() => Promise.resolve()),
    forceReconfigure: vi.fn(() => Promise.resolve()),
    lastAutoSentRef: { current: '' } as MutableRefObject<string>,
    mode: 'inactive' as ConnectMode,
    ...overrides,
});

describe('useConnectLocalQueue', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        connectFetchEnsuredMock.mockClear();
        mediaPause.mockClear();
        mediaPlay.mockClear();
        mediaPlayByIndex.mockClear();
        mediaSeekToTimestamp.mockClear();
        mockQueue = [song('1', 'a'), song('2', 'b')];
        mockCurrentSong = mockQueue[0];
        mockStatus = PlayerStatus.PLAYING;
        mockPosition = 0;
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    describe('forward queue push', () => {
        it('pushes the queue while local-owner', async () => {
            renderHook((props) => useConnectLocalQueue(props), {
                initialProps: baseArgs({ mode: 'local-owner' }),
            });
            await vi.advanceTimersByTimeAsync(400);

            const queueCall = connectFetchEnsuredMock.mock.calls.find(
                (call) => call[0] === '/queue',
            );
            expect(queueCall).toBeDefined();
            const body = JSON.parse(queueCall![1].body);
            expect(body.index).toBe(0);
            expect(body.items).toHaveLength(2);
        });

        // The point of this: casting has no server-side notion of "what's
        // next" unless the queue is pushed the same way local-owner mirroring
        // already does — see routes/stream.py's _fire_track_end, which relies
        // on this to auto-advance without the frontend having to be active.
        it('also pushes the queue while casting', async () => {
            renderHook((props) => useConnectLocalQueue(props), {
                initialProps: baseArgs({ mode: 'cast' }),
            });
            await vi.advanceTimersByTimeAsync(400);

            const queueCall = connectFetchEnsuredMock.mock.calls.find(
                (call) => call[0] === '/queue',
            );
            expect(queueCall).toBeDefined();
            const body = JSON.parse(queueCall![1].body);
            expect(body.index).toBe(0);
            expect(body.items[0].id).toBe('1');
            expect(body.items[1].id).toBe('2');
        });

        it('does not push the queue while inactive', async () => {
            renderHook((props) => useConnectLocalQueue(props), {
                initialProps: baseArgs({ mode: 'inactive' }),
            });
            await vi.advanceTimersByTimeAsync(400);

            expect(
                connectFetchEnsuredMock.mock.calls.find((call) => call[0] === '/queue'),
            ).toBeUndefined();
        });

        it('does not push the queue while mirroring', async () => {
            renderHook((props) => useConnectLocalQueue(props), {
                initialProps: baseArgs({ mode: 'mirror' }),
            });
            await vi.advanceTimersByTimeAsync(400);

            expect(
                connectFetchEnsuredMock.mock.calls.find((call) => call[0] === '/queue'),
            ).toBeUndefined();
        });
    });

    describe('forward play/pause push', () => {
        it('pushes play/pause status while local-owner', () => {
            renderHook((props) => useConnectLocalQueue(props), {
                initialProps: baseArgs({ mode: 'local-owner' }),
            });

            expect(
                connectFetchEnsuredMock.mock.calls.find((call) => call[0] === '/resume'),
            ).toBeDefined();
        });

        // Casting already has its own pause/resume path (the player-bar
        // buttons, via use-connect-controls.ts) — the local player is
        // deliberately kept paused for the whole duration of a cast session,
        // so forwarding *that* status here would wrongly pause the cast
        // target every time this effect re-ran.
        it('does not push play/pause status while casting', () => {
            renderHook((props) => useConnectLocalQueue(props), {
                initialProps: baseArgs({ mode: 'cast' }),
            });

            expect(
                connectFetchEnsuredMock.mock.calls.find(
                    (call) => call[0] === '/pause' || call[0] === '/resume',
                ),
            ).toBeUndefined();
        });
    });

    describe('cast reverse-sync', () => {
        // The scenario this covers: the backend auto-advanced the queue on
        // its own (routes/stream.py's _fire_track_end, e.g. because the
        // phone was locked when the track ended) — this tab's local queue
        // pointer must catch up so the now-playing display doesn't stay
        // stuck on the old track once the phone is unlocked again.
        it('moves the local queue pointer to match a server-side auto-advance', async () => {
            const queueSnapshot = [
                { id: '1', title: 'Song 1' },
                { id: '2', title: 'Song 2' },
            ];
            const args = baseArgs({
                connectStatus: connectStatus({
                    queue: queueSnapshot,
                    queue_index: 0,
                    streaming: true,
                }),
                mode: 'cast',
            });
            const { rerender } = renderHook((props) => useConnectLocalQueue(props), {
                initialProps: args,
            });
            // Past REVERSE_SYNC_GRACE_MS, so the mount-time forward push
            // (which also refreshes the grace timer in cast mode) doesn't
            // suppress the next check.
            await vi.advanceTimersByTimeAsync(1500);

            // A fresh connectStatus object, same as a real SSE tick would
            // deliver — the auto-advance itself, discovered on the next
            // status update after the grace window has passed.
            rerender({
                ...args,
                connectStatus: connectStatus({
                    queue: queueSnapshot,
                    queue_index: 1,
                    streaming: true,
                }),
            });

            expect(mediaPlayByIndex).toHaveBeenCalledWith(1);
            expect(mediaPause).toHaveBeenCalled();
            expect(args.lastAutoSentRef.current).toBe('b');
        });

        it('does nothing when the local pointer already matches', async () => {
            const args = baseArgs({
                connectStatus: connectStatus({
                    queue: [{ id: '1', title: 'Song 1' }],
                    queue_index: 0,
                    streaming: true,
                }),
                mode: 'cast',
            });
            renderHook((props) => useConnectLocalQueue(props), { initialProps: args });
            await vi.advanceTimersByTimeAsync(1500);

            expect(mediaPlayByIndex).not.toHaveBeenCalled();
            expect(mediaPause).not.toHaveBeenCalled();
        });

        // Play/pause and seek stay entirely off the local player while
        // casting — the player-bar's own controls target the device
        // directly (use-connect-controls.ts), and the displayed position
        // comes from connectStatus, not the local player's timestamp.
        it('does not sync play/pause or seek while casting', async () => {
            mockStatus = PlayerStatus.PAUSED;
            mockPosition = 0;
            const args = baseArgs({
                connectStatus: connectStatus({
                    elapsed: 120,
                    paused: false,
                    queue: [{ id: '1', title: 'Song 1' }],
                    queue_index: 0,
                    streaming: true,
                }),
                mode: 'cast',
            });
            renderHook((props) => useConnectLocalQueue(props), { initialProps: args });
            await vi.advanceTimersByTimeAsync(1500);

            expect(mediaPlay).not.toHaveBeenCalled();
            expect(mediaPause).not.toHaveBeenCalled();
            expect(mediaSeekToTimestamp).not.toHaveBeenCalled();
        });
    });
});
