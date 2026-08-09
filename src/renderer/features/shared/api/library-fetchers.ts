import { api } from '/@/renderer/api';
import { queryKeys } from '/@/renderer/api/query-keys';
import { playlistsQueries } from '/@/renderer/features/playlists/api/playlists-api';
import { songsQueries } from '/@/renderer/features/songs/api/songs-api';
import { queryClient } from '/@/renderer/lib/react-query';
import {
    Played,
    Playlist,
    PlaylistListSort,
    ServerType,
    Song,
    SongListSort,
    SortOrder,
} from '/@/shared/types/domain-types';

interface PageArgs {
    pageSize: number;
    searchTerm?: string;
    startIndex: number;
}

export async function addSongToPlaylist(
    serverId: string,
    playlistId: string,
    songId: string,
): Promise<boolean> {
    try {
        await api.controller.addToPlaylist({
            apiClientProps: { serverId },
            body: { songId: [songId] },
            query: { id: playlistId },
        });
        queryClient.invalidateQueries({
            exact: false,
            queryKey: queryKeys.playlists.list(serverId),
        });
        queryClient.invalidateQueries({
            queryKey: queryKeys.playlists.detail(serverId, playlistId),
        });
        queryClient.invalidateQueries({
            queryKey: queryKeys.playlists.songList(serverId, playlistId),
        });
        return true;
    } catch {
        return false;
    }
}

export async function fetchPlaylistPage(
    serverId: string,
    { pageSize, searchTerm, startIndex }: PageArgs,
): Promise<{ hasMore: boolean; items: Playlist[] }> {
    const { items } = await queryClient.fetchQuery(
        playlistsQueries.list({
            query: {
                limit: pageSize,
                searchTerm: searchTerm || undefined,
                sortBy: PlaylistListSort.NAME,
                sortOrder: SortOrder.ASC,
                startIndex,
            },
            serverId,
        }),
    );
    return { hasMore: items.length === pageSize, items };
}

// Empty array on failure or no results, never throws — both callers treat
// "nothing to radio-seed with" the same way.
export async function fetchSimilarSongs(
    serverId: string,
    songId: string,
    count: number,
): Promise<Song[]> {
    try {
        const similarSongs = await queryClient.fetchQuery({
            ...songsQueries.similar({ query: { count, songId }, serverId }),
            queryKey: queryKeys.player.fetch({ similarSongs: songId }),
        });
        return similarSongs ?? [];
    } catch {
        return [];
    }
}

/**
 * Track/playlist search + play-support fetches shared by the Electron
 * phone-remote bridge (use-remote-library.tsx) and the mobile web view's own
 * hooks (use-mobile-track-search.ts, use-mobile-playlist-search.ts,
 * use-mobile-track-actions.ts) — same underlying react-query calls and
 * Subsonic random-fallback branch, wired to two different presentation
 * layers (IPC request/response vs. React state) that stay separate.
 */
export async function fetchTrackPage(
    serverId: string,
    serverType: ServerType,
    { pageSize, searchTerm, startIndex }: PageArgs,
): Promise<{ hasMore: boolean; items: Song[]; paginable: boolean }> {
    // Plain Subsonic has no generic "list all songs" endpoint — a filterless
    // list falls through to an empty search3 query, not a reliable browse.
    // Navidrome/Jellyfin both have real generic listings and work fine
    // filterless.
    if (serverType === ServerType.SUBSONIC && !searchTerm) {
        const { items } = await queryClient.fetchQuery(
            songsQueries.random({ query: { limit: pageSize, played: Played.All }, serverId }),
        );
        // RandomSongListQuery has no startIndex — not paginable, so "load
        // more" just returns another random batch (paginable: false lets a
        // React-state caller know to replace rather than append it).
        return { hasMore: true, items, paginable: false };
    }

    const { items } = await queryClient.fetchQuery(
        songsQueries.list({
            query: {
                limit: pageSize,
                searchTerm: searchTerm || undefined,
                sortBy: SongListSort.NAME,
                sortOrder: SortOrder.ASC,
                startIndex,
            },
            serverId,
        }),
    );
    return { hasMore: items.length === pageSize, items, paginable: true };
}
