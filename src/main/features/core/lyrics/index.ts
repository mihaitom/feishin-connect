import { ipcMain } from 'electron';

import { store } from '../settings/index';
import {
    getLyricsBySongId as getGenius,
    query as queryGenius,
    getSearchResults as searchGenius,
} from './genius';
import {
    getLyricsBySongId as getLrcLib,
    query as queryLrclib,
    getSearchResults as searchLrcLib,
} from './lrclib';
import {
    getLyricsBySongId as getNetease,
    query as queryNetease,
    getSearchResults as searchNetease,
} from './netease';

export enum LyricSource {
    GENIUS = 'Genius',
    LRCLIB = 'lrclib.net',
    NETEASE = 'NetEase',
}

export type FullLyricsMetadata = Omit<InternetProviderLyricResponse, 'id' | 'lyrics' | 'source'> & {
    lyrics: LyricsResponse;
    remote: boolean;
    source: string;
};

export type InternetProviderLyricResponse = {
    artist: string;
    id: string;
    lyrics: string;
    name: string;
    source: LyricSource;
};

export type InternetProviderLyricSearchResponse = {
    artist: string;
    id: string;
    name: string;
    score?: number;
    source: LyricSource;
};

export type LyricGetQuery = {
    remoteSongId: string;
    remoteSource: LyricSource;
    song: Song;
};

export type LyricOverride = Omit<InternetProviderLyricResponse, 'lyrics'>;

export type LyricSearchQuery = {
    album?: string;
    artist?: string;
    duration?: number;
    name?: string;
};

export type LyricsResponse = string | SynchronizedLyricsArray;

export type SynchronizedLyricsArray = Array<[number, string]>;

type CachedLyrics = Record<LyricSource, InternetProviderLyricResponse>;
type GetFetcher = (id: string) => Promise<null | string>;
type SearchFetcher = (
    params: LyricSearchQuery,
) => Promise<InternetProviderLyricSearchResponse[] | null>;

type SongFetcher = (params: LyricSearchQuery) => Promise<InternetProviderLyricResponse | null>;

const FETCHERS: Record<LyricSource, SongFetcher> = {
    [LyricSource.GENIUS]: queryGenius,
    [LyricSource.LRCLIB]: queryLrclib,
    [LyricSource.NETEASE]: queryNetease,
};

const SEARCH_FETCHERS: Record<LyricSource, SearchFetcher> = {
    [LyricSource.GENIUS]: searchGenius,
    [LyricSource.LRCLIB]: searchLrcLib,
    [LyricSource.NETEASE]: searchNetease,
};

const GET_FETCHERS: Record<LyricSource, GetFetcher> = {
    [LyricSource.GENIUS]: getGenius,
    [LyricSource.LRCLIB]: getLrcLib,
    [LyricSource.NETEASE]: getNetease,
};

const MAX_CACHED_ITEMS = 10;

const lyricCache = new Map<string, CachedLyrics>();

const getRemoteLyrics = async (song: any) => {
    const sources = store.get('lyrics', []) as LyricSource[];

    const cached = lyricCache.get(song.id);

    if (cached) {
        for (const source of sources) {
            const data = cached[source];
            if (data) return data;
        }
    }

    let lyricsFromSource = null;

    for (const source of sources) {
        const params = {
            album: song.album || song.name,
            artist: song.artistName,
            duration: song.duration / 1000.0,
            name: song.name,
        };
        const response = await FETCHERS[source](params);

        if (response) {
            const newResult = cached
                ? {
                      ...cached,
                      [source]: response,
                  }
                : ({ [source]: response } as CachedLyrics);

            if (lyricCache.size === MAX_CACHED_ITEMS && cached === undefined) {
                const toRemove = lyricCache.keys().next().value;
                lyricCache.delete(toRemove);
            }

            lyricCache.set(song.id, newResult);

            lyricsFromSource = response;
            break;
        }
    }

    return lyricsFromSource;
};

const searchRemoteLyrics = async (params: LyricSearchQuery) => {
    const sources = store.get('lyrics', []) as LyricSource[];

    const results: Record<LyricSource, InternetProviderLyricSearchResponse[]> = {
        [LyricSource.GENIUS]: [],
        [LyricSource.LRCLIB]: [],
        [LyricSource.NETEASE]: [],
    };

    for (const source of sources) {
        const response = await SEARCH_FETCHERS[source](params);

        if (response) {
            response.forEach((result) => {
                results[source].push(result);
            });
        }
    }

    return results;
};

const getRemoteLyricsById = async (params: LyricGetQuery): Promise<null | string> => {
    const { remoteSongId, remoteSource } = params;
    const response = await GET_FETCHERS[remoteSource](remoteSongId);

    if (!response) {
        return null;
    }

    return response;
};

ipcMain.handle('lyric-by-song', async (_event, song: any) => {
    const lyric = await getRemoteLyrics(song);
    return lyric;
});

ipcMain.handle('lyric-search', async (_event, params: LyricSearchQuery) => {
    const lyricResults = await searchRemoteLyrics(params);
    return lyricResults;
});

ipcMain.handle('lyric-by-remote-id', async (_event, params: LyricGetQuery) => {
    const lyricResults = await getRemoteLyricsById(params);
    return lyricResults;
});
