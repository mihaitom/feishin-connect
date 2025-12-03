import { QueryClient } from '@tanstack/react-query';

import { api } from '/@/renderer/api';
import { queryKeys } from '/@/renderer/api/query-keys';
import { folderQueries } from '/@/renderer/features/folders/api/folder-api';
import { sortSongList } from '/@/shared/api/utils';
import {
    PlaylistSongListQuery,
    PlaylistSongListQueryClientSide,
    Song,
    SongDetailQuery,
    SongListQuery,
    SongListResponse,
    SongListSort,
    SortOrder,
} from '/@/shared/types/domain-types';

export const getPlaylistSongsById = async (args: {
    id: string;
    query?: Partial<PlaylistSongListQueryClientSide>;
    queryClient: QueryClient;
    serverId: string;
}) => {
    const { id, query, queryClient, serverId } = args;

    const queryFilter: PlaylistSongListQuery = {
        id,
    };

    const queryKey = queryKeys.playlists.songList(serverId, id);

    const res = await queryClient.fetchQuery({
        gcTime: 1000 * 60,
        queryFn: async ({ signal }) =>
            api.controller.getPlaylistSongList({
                apiClientProps: {
                    serverId,
                    signal,
                },
                query: queryFilter,
            }),
        queryKey,
        staleTime: 1000 * 60,
    });

    if (res) {
        res.items = sortSongList(
            res.items,
            query?.sortBy || SongListSort.ID,
            query?.sortOrder || SortOrder.ASC,
        );
    }

    return res;
};

export const getAlbumSongsById = async (args: {
    id: string[];
    orderByIds?: boolean;
    query?: Partial<SongListQuery>;
    queryClient: QueryClient;
    serverId: string;
}) => {
    const { id, query, queryClient, serverId } = args;

    const queryFilter: SongListQuery = {
        albumIds: id,
        sortBy: SongListSort.ALBUM,
        sortOrder: SortOrder.ASC,
        startIndex: 0,
        ...query,
    };

    const queryKey = queryKeys.songs.list(serverId, queryFilter);

    const res = await queryClient.fetchQuery({
        gcTime: 1000 * 60,
        queryFn: async ({ signal }) =>
            api.controller.getSongList({
                apiClientProps: {
                    serverId,
                    signal,
                },
                query: queryFilter,
            }),
        queryKey,
        staleTime: 1000 * 60,
    });

    return res;
};

export const getGenreSongsById = async (args: {
    id: string[];
    orderByIds?: boolean;
    query?: Partial<SongListQuery>;
    queryClient: QueryClient;
    serverId: string;
}) => {
    const { id, query, queryClient, serverId } = args;

    const data: SongListResponse = {
        items: [],
        startIndex: 0,
        totalRecordCount: 0,
    };
    for (const genreId of id) {
        const queryFilter: SongListQuery = {
            genreIds: [genreId],
            sortBy: SongListSort.GENRE,
            sortOrder: SortOrder.ASC,
            startIndex: 0,
            ...query,
        };

        const queryKey = queryKeys.songs.list(serverId, queryFilter);

        const res = await queryClient.fetchQuery({
            gcTime: 1000 * 60,
            queryFn: async ({ signal }) =>
                api.controller.getSongList({
                    apiClientProps: {
                        serverId,
                        signal,
                    },
                    query: queryFilter,
                }),
            queryKey,
            staleTime: 1000 * 60,
        });

        data.items.push(...res!.items);
        if (data.totalRecordCount) {
            data.totalRecordCount += res!.totalRecordCount || 0;
        }
    }

    return data;
};

export const getAlbumArtistSongsById = async (args: {
    id: string[];
    orderByIds?: boolean;
    query?: Partial<SongListQuery>;
    queryClient: QueryClient;
    serverId: string;
}) => {
    const { id, query, queryClient, serverId } = args;

    const queryFilter: SongListQuery = {
        albumArtistIds: id || [],
        sortBy: SongListSort.ALBUM_ARTIST,
        sortOrder: SortOrder.ASC,
        startIndex: 0,
        ...query,
    };

    const queryKey = queryKeys.songs.list(serverId, queryFilter);

    const res = await queryClient.fetchQuery({
        gcTime: 1000 * 60,
        queryFn: async ({ signal }) =>
            api.controller.getSongList({
                apiClientProps: {
                    serverId,
                    signal,
                },
                query: queryFilter,
            }),
        queryKey,
        staleTime: 1000 * 60,
    });

    return res;
};

export const getArtistSongsById = async (args: {
    id: string[];
    query?: Partial<SongListQuery>;
    queryClient: QueryClient;
    serverId: string;
}) => {
    const { id, query, queryClient, serverId } = args;

    const queryFilter: SongListQuery = {
        artistIds: id,
        sortBy: SongListSort.ALBUM,
        sortOrder: SortOrder.ASC,
        startIndex: 0,
        ...query,
    };

    const queryKey = queryKeys.songs.list(serverId, queryFilter);

    const res = await queryClient.fetchQuery({
        gcTime: 1000 * 60,
        queryFn: async ({ signal }) =>
            api.controller.getSongList({
                apiClientProps: {
                    serverId,
                    signal,
                },
                query: queryFilter,
            }),
        queryKey,
        staleTime: 1000 * 60,
    });

    return res;
};

export const getSongsByQuery = async (args: {
    query?: Partial<SongListQuery>;
    queryClient: QueryClient;
    serverId: string;
}) => {
    const { query, queryClient, serverId } = args;

    const queryFilter: SongListQuery = {
        sortBy: SongListSort.ALBUM,
        sortOrder: SortOrder.ASC,
        startIndex: 0,
        ...query,
    };

    const queryKey = queryKeys.songs.list(serverId, queryFilter);

    const res = await queryClient.fetchQuery({
        gcTime: 1000 * 60,
        queryFn: async ({ signal }) => {
            return api.controller.getSongList({
                apiClientProps: {
                    serverId,
                    signal,
                },
                query: queryFilter,
            });
        },
        queryKey,
        staleTime: 1000 * 60,
    });

    return res;
};

export const getSongsByFolder = async (args: {
    id: string[];
    orderByIds?: boolean;
    query?: Partial<SongListQuery>;
    queryClient: QueryClient;
    serverId: string;
}) => {
    const { id, queryClient, serverId } = args;

    const collectSongsFromFolder = async (folderId: string): Promise<Song[]> => {
        const folderSongs: Song[] = [];
        const folder = await queryClient.fetchQuery({
            ...folderQueries.folder({
                query: {
                    id: folderId,
                    sortBy: SongListSort.ID,
                    sortOrder: SortOrder.ASC,
                },
                serverId,
            }),
            gcTime: 0,
            staleTime: 0,
        });

        if (folder.children?.songs) {
            folderSongs.push(...folder.children.songs);
        }

        if (folder.children?.folders) {
            for (const subFolder of folder.children.folders) {
                const subFolderSongs = await collectSongsFromFolder(subFolder.id);
                folderSongs.push(...subFolderSongs);
            }
        }

        return folderSongs;
    };

    const data: SongListResponse = {
        items: [],
        startIndex: 0,
        totalRecordCount: 0,
    };

    // Process folders sequentially to maintain order
    for (const folderId of id) {
        const folderSongs = await collectSongsFromFolder(folderId);
        data.items.push(...folderSongs);
        data.totalRecordCount = (data.totalRecordCount || 0) + folderSongs.length;
    }

    return data;
};

export const getSongById = async (args: {
    id: string;
    queryClient: QueryClient;
    serverId: string;
}): Promise<SongListResponse> => {
    const { id, queryClient, serverId } = args;

    const queryFilter: SongDetailQuery = { id };

    const queryKey = queryKeys.songs.detail(serverId, queryFilter);

    const res = await queryClient.fetchQuery({
        gcTime: 1000 * 60,
        queryFn: async ({ signal }) =>
            api.controller.getSongDetail({
                apiClientProps: {
                    serverId,
                    signal,
                },
                query: queryFilter,
            }),
        queryKey,
        staleTime: 1000 * 60,
    });

    if (!res) throw new Error('Song not found');

    return {
        items: [res],
        startIndex: 0,
        totalRecordCount: 1,
    };
};
