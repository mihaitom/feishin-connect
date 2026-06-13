import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LyricSource } from '/@/shared/types/domain-types';
import type { QueueSong } from '/@/shared/types/domain-types';

const mocks = vi.hoisted(() => ({
    connectFetch: vi.fn(),
    lyricsSettings: {
        fetch: true,
        preferLocalLyrics: false,
        sources: ['lrclib.net'],
    },
}));

vi.mock('/@/renderer/features/player/components/connect/types', () => ({
    connectFetch: mocks.connectFetch,
}));

vi.mock('/@/renderer/store', () => ({
    getServerById: vi.fn(),
    useSettingsStore: {
        getState: () => ({ lyrics: mocks.lyricsSettings }),
    },
}));

vi.mock('/@/renderer/api', () => ({
    api: { controller: {} },
}));

vi.mock('/@/renderer/lib/react-query', () => ({
    queryClient: { getQueryData: vi.fn(), setQueryData: vi.fn() },
}));

// `lyricsIpc` is resolved at module load from `isElectron()`. jsdom is not
// Electron, so this exercises the Connect-backend fallback path used by the
// web/Docker build — the actual fork-specific behavior worth pinning down.
import { fetchRemoteLyricsAuto, fetchRemoteLyricsById, lyricsQueries } from '../lyrics-api';

const song = (overrides: Partial<QueueSong> = {}): QueueSong =>
    ({
        album: 'Greatest Hits',
        artists: [{ name: 'Some Artist' }],
        duration: 200000,
        name: 'Some Song',
        ...overrides,
    }) as unknown as QueueSong;

const jsonResponse = (body: unknown, ok = true) =>
    new Response(JSON.stringify(body), { status: ok ? 200 : 404 });

describe('lyrics-api (Connect backend fallback)', () => {
    beforeEach(() => {
        mocks.connectFetch.mockReset();
        mocks.lyricsSettings.fetch = true;
        mocks.lyricsSettings.preferLocalLyrics = false;
        mocks.lyricsSettings.sources = ['lrclib.net'];
    });

    describe('fetchRemoteLyricsAuto', () => {
        it('returns null without calling Connect when remote fetching is disabled', async () => {
            mocks.lyricsSettings.fetch = false;

            const result = await fetchRemoteLyricsAuto(song());

            expect(result).toBeNull();
            expect(mocks.connectFetch).not.toHaveBeenCalled();
        });

        it('queries /lyrics/auto with the song metadata and formats the result', async () => {
            mocks.connectFetch.mockResolvedValue(
                jsonResponse({
                    artist: 'Some Artist',
                    id: 'lrc-1',
                    lyrics: '[00:01.00]Hello\n[00:02.00]World',
                    name: 'Some Song',
                    source: LyricSource.LRCLIB,
                }),
            );

            const result = await fetchRemoteLyricsAuto(song());

            expect(mocks.connectFetch).toHaveBeenCalledTimes(1);
            const [url] = mocks.connectFetch.mock.calls[0];
            expect(url).toContain('/lyrics/auto?');
            expect(url).toContain('artist=Some+Artist');
            expect(url).toContain('name=Some+Song');
            expect(url).toContain('sources=lrclib.net');

            expect(result?.remote).toBe(true);
            expect(result?.lyrics).toEqual([
                [1000, 'Hello'],
                [2000, 'World'],
            ]);
        });

        it('returns null when Connect has no result', async () => {
            mocks.connectFetch.mockResolvedValue(jsonResponse(null, false));

            const result = await fetchRemoteLyricsAuto(song());

            expect(result).toBeNull();
        });
    });

    describe('fetchRemoteLyricsById', () => {
        it('queries /lyrics/by-remote-id with id and source, and formats the lyrics', async () => {
            mocks.connectFetch.mockResolvedValue(jsonResponse('[00:05.00]Some line'));

            const result = await fetchRemoteLyricsById({
                remoteSongId: 'abc123',
                remoteSource: LyricSource.LRCLIB,
            });

            const [url] = mocks.connectFetch.mock.calls[0];
            expect(url).toContain('/lyrics/by-remote-id?');
            expect(url).toContain('id=abc123');
            expect(url).toContain('source=lrclib.net');

            expect(result).toEqual([[5000, 'Some line']]);
        });

        it('returns null when Connect cannot find the lyrics', async () => {
            mocks.connectFetch.mockResolvedValue(jsonResponse(null, false));

            const result = await fetchRemoteLyricsById({
                remoteSongId: 'missing',
                remoteSource: LyricSource.LRCLIB,
            });

            expect(result).toBeNull();
        });
    });

    describe('lyricsQueries.search', () => {
        it('queries /lyrics/search with the search args via Connect', async () => {
            const searchResult = { [LyricSource.LRCLIB]: [] };
            mocks.connectFetch.mockResolvedValue(jsonResponse(searchResult));

            const options = lyricsQueries.search({
                query: { album: 'Album', artist: 'Artist', duration: 200, name: 'Name' },
            });
            const result = await (options.queryFn as () => Promise<unknown>)();

            const [url] = mocks.connectFetch.mock.calls[0];
            expect(url).toContain('/lyrics/search?');
            expect(url).toContain('artist=Artist');
            expect(result).toEqual(searchResult);
        });

        it('falls back to an empty object when Connect is unreachable', async () => {
            mocks.connectFetch.mockResolvedValue(jsonResponse(null, false));

            const options = lyricsQueries.search({
                query: { album: 'Album', artist: 'Artist', duration: 200, name: 'Name' },
            });
            const result = await (options.queryFn as () => Promise<unknown>)();

            expect(result).toEqual({});
        });
    });

    describe('lyricsQueries.songLyrics staleTime (not-found retry)', () => {
        const options = lyricsQueries.songLyrics({ query: {}, serverId: 'server-1' }, undefined);
        const staleTime = options.staleTime as (query: {
            state: { data: unknown };
        }) => number;

        it('never goes stale once lyrics were found', () => {
            const result = staleTime({ state: { data: { selected: { lyrics: 'x' } } } });

            expect(result).toBe(Infinity);
        });

        it('allows a retry 24h after a "not found" result', () => {
            const result = staleTime({ state: { data: { selected: null } } });

            expect(result).toBe(1000 * 60 * 60 * 24);
        });

        it('is not stale (Infinity) when there is no cached data yet', () => {
            const result = staleTime({ state: { data: undefined } });

            expect(result).toBe(Infinity);
        });
    });
});
