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

const baseArgs = (
    overrides: Partial<{ connectStatus: ConnectStatus | null; mode: ConnectMode }> = {},
) => ({
    connectStatus: null as ConnectStatus | null,
    ensureConfigured: vi.fn(() => Promise.resolve()),
    forceReconfigure: vi.fn(() => Promise.resolve()),
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
});
