import { QueryClient } from '@tanstack/react-query';

import { queryKeys } from '/@/renderer/api/query-keys';
import {
    Album,
    AlbumArtist,
    AlbumArtistDetailResponse,
    AlbumArtistListResponse,
    AlbumDetailResponse,
    AlbumListResponse,
    Artist,
    ArtistListResponse,
    FavoriteArgs,
    LibraryItem,
    Song,
    SongDetailResponse,
} from '/@/shared/types/domain-types';

export interface PreviousQueryData {
    data: unknown;
    queryKey: readonly unknown[];
}

export const applyFavoriteOptimisticUpdates = (
    queryClient: QueryClient,
    variables: FavoriteArgs,
    isFavorite: boolean,
): PreviousQueryData[] => {
    const previousQueries: PreviousQueryData[] = [];
    const itemIdSet = new Set<string>();

    if (Array.isArray(variables.query.id)) {
        variables.query.id.forEach((id) => {
            itemIdSet.add(id);
        });
    } else {
        itemIdSet.add(variables.query.id);
    }

    switch (variables.query.type) {
        case LibraryItem.ALBUM: {
            const detailQueryKey = queryKeys.albums.detail(variables.apiClientProps.serverId);

            const detailQueries = queryClient.getQueriesData({
                exact: false,
                queryKey: detailQueryKey,
            });

            if (detailQueries.length) {
                detailQueries.forEach(([queryKey, data]) => {
                    if (data) {
                        previousQueries.push({ data, queryKey });
                        queryClient.setQueryData(queryKey, (prev: AlbumDetailResponse) => {
                            if (prev && itemIdSet.has(prev.id)) {
                                return {
                                    ...prev,
                                    userFavorite: isFavorite,
                                };
                            }

                            return prev;
                        });
                    }
                });
            }

            const listQueryKey = queryKeys.albums.list(variables.apiClientProps.serverId);

            const listQueries = queryClient.getQueriesData({
                exact: false,
                queryKey: listQueryKey,
            });

            if (listQueries.length) {
                listQueries.forEach(([queryKey, data]) => {
                    if (data) {
                        previousQueries.push({ data, queryKey });
                        queryClient.setQueryData(queryKey, (prev: AlbumListResponse) => {
                            if (prev) {
                                return {
                                    ...prev,
                                    items: prev.items.map((item: Album) => {
                                        return itemIdSet.has(item.id)
                                            ? { ...item, userFavorite: isFavorite }
                                            : item;
                                    }),
                                };
                            }

                            return prev;
                        });
                    }
                });
            }

            const infiniteListQueryKey = queryKeys.albums.infiniteList(
                variables.apiClientProps.serverId,
            );

            const infiniteListQueries = queryClient.getQueriesData({
                exact: false,
                queryKey: infiniteListQueryKey,
            });

            if (infiniteListQueries.length) {
                infiniteListQueries.forEach(([queryKey, data]) => {
                    if (data) {
                        previousQueries.push({ data, queryKey });
                        queryClient.setQueryData(
                            queryKey,
                            (prev: { pageParams: string[]; pages: AlbumListResponse[] }) => {
                                if (prev) {
                                    return {
                                        ...prev,
                                        pages: prev.pages.map((page: AlbumListResponse) => {
                                            return {
                                                ...page,
                                                items: page.items.map((item: Album) => {
                                                    return itemIdSet.has(item.id)
                                                        ? { ...item, userFavorite: isFavorite }
                                                        : item;
                                                }),
                                            };
                                        }),
                                    };
                                }

                                return prev;
                            },
                        );
                    }
                });
            }

            break;
        }
        case LibraryItem.ALBUM_ARTIST: {
            const detailQueryKey = queryKeys.albumArtists.detail(variables.apiClientProps.serverId);

            const detailQueries = queryClient.getQueriesData({
                exact: false,
                queryKey: detailQueryKey,
            });

            if (detailQueries.length) {
                detailQueries.forEach(([queryKey, data]) => {
                    if (data) {
                        previousQueries.push({ data, queryKey });
                        queryClient.setQueryData(queryKey, (prev: AlbumArtistDetailResponse) => {
                            if (prev && itemIdSet.has(prev.id)) {
                                return {
                                    ...prev,
                                    userFavorite: isFavorite,
                                };
                            }

                            return prev;
                        });
                    }
                });
            }
            const listQueryKey = queryKeys.albumArtists.list(variables.apiClientProps.serverId);

            const listQueries = queryClient.getQueriesData({
                exact: false,
                queryKey: listQueryKey,
            });

            if (listQueries.length) {
                listQueries.forEach(([queryKey, data]) => {
                    if (data) {
                        previousQueries.push({ data, queryKey });
                        queryClient.setQueryData(queryKey, (prev: AlbumArtistListResponse) => {
                            if (prev) {
                                return {
                                    ...prev,
                                    items: prev.items.map((item: AlbumArtist) => {
                                        return itemIdSet.has(item.id)
                                            ? { ...item, userFavorite: isFavorite }
                                            : item;
                                    }),
                                };
                            }

                            return prev;
                        });
                    }
                });
            }

            const infiniteListQueryKey = queryKeys.albumArtists.infiniteList(
                variables.apiClientProps.serverId,
            );

            const infiniteListQueries = queryClient.getQueriesData({
                exact: false,
                queryKey: infiniteListQueryKey,
            });

            if (infiniteListQueries.length) {
                infiniteListQueries.forEach(([queryKey, data]) => {
                    if (data) {
                        previousQueries.push({ data, queryKey });
                        queryClient.setQueryData(
                            queryKey,
                            (prev: { pageParams: string[]; pages: AlbumArtistListResponse[] }) => {
                                return {
                                    ...prev,
                                    pages: prev.pages.map((page: AlbumArtistListResponse) => {
                                        return {
                                            ...page,
                                            items: page.items.map((item: AlbumArtist) => {
                                                return itemIdSet.has(item.id)
                                                    ? {
                                                          ...item,
                                                          userFavorite: isFavorite,
                                                      }
                                                    : item;
                                            }),
                                        };
                                    }),
                                };
                            },
                        );
                    }
                });
            }

            break;
        }
        case LibraryItem.ARTIST: {
            const detailQueryKey = queryKeys.artists.detail(variables.apiClientProps.serverId);

            const detailQueries = queryClient.getQueriesData({
                exact: false,
                queryKey: detailQueryKey,
            });

            if (detailQueries.length) {
                detailQueries.forEach(([queryKey, data]) => {
                    if (data) {
                        previousQueries.push({ data, queryKey });
                        queryClient.setQueryData(queryKey, (prev: AlbumArtistDetailResponse) => {
                            if (prev && itemIdSet.has(prev.id)) {
                                return {
                                    ...prev,
                                    userFavorite: isFavorite,
                                };
                            }

                            return prev;
                        });
                    }
                });
            }

            const listQueryKey = queryKeys.artists.list(variables.apiClientProps.serverId);

            const listQueries = queryClient.getQueriesData({
                exact: false,
                queryKey: listQueryKey,
            });

            if (listQueries.length) {
                listQueries.forEach(([queryKey, data]) => {
                    if (data) {
                        previousQueries.push({ data, queryKey });
                        queryClient.setQueryData(queryKey, (prev: ArtistListResponse) => {
                            return {
                                ...prev,
                                items: prev.items.map((item: Artist) => {
                                    return itemIdSet.has(item.id)
                                        ? { ...item, userFavorite: isFavorite }
                                        : item;
                                }),
                            };
                        });
                    }
                });
            }

            const infiniteListQueryKey = queryKeys.artists.infiniteList(
                variables.apiClientProps.serverId,
            );

            const infiniteListQueries = queryClient.getQueriesData({
                exact: false,
                queryKey: infiniteListQueryKey,
            });

            if (infiniteListQueries.length) {
                infiniteListQueries.forEach(([queryKey, data]) => {
                    if (data) {
                        previousQueries.push({ data, queryKey });
                        queryClient.setQueryData(
                            queryKey,
                            (prev: { pageParams: string[]; pages: ArtistListResponse[] }) => {
                                return {
                                    ...prev,
                                    pages: prev.pages.map((page: ArtistListResponse) => {
                                        return {
                                            ...page,
                                            items: page.items.map((item: Artist) => {
                                                return itemIdSet.has(item.id)
                                                    ? { ...item, userFavorite: isFavorite }
                                                    : item;
                                            }),
                                        };
                                    }),
                                };
                            },
                        );
                    }
                });
            }

            break;
        }
        case LibraryItem.PLAYLIST_SONG:
        case LibraryItem.QUEUE_SONG:
        case LibraryItem.SONG: {
            const albumDetailQueryKey = queryKeys.albums.detail(variables.apiClientProps.serverId);

            const albumDetailQueries = queryClient.getQueriesData({
                exact: false,
                queryKey: albumDetailQueryKey,
            });

            if (albumDetailQueries.length) {
                albumDetailQueries.forEach(([queryKey, data]) => {
                    if (data) {
                        previousQueries.push({ data, queryKey });
                        queryClient.setQueryData(queryKey, (prev: AlbumDetailResponse) => {
                            if (prev) {
                                return {
                                    ...prev,
                                    songs: prev.songs?.map((song: Song) => {
                                        return itemIdSet.has(song.id)
                                            ? { ...song, userFavorite: isFavorite }
                                            : song;
                                    }),
                                };
                            }

                            return prev;
                        });
                    }
                });
            }

            const detailQueryKey = queryKeys.songs.detail(variables.apiClientProps.serverId);

            const detailQueries = queryClient.getQueriesData({
                exact: false,
                queryKey: detailQueryKey,
            });

            if (detailQueries.length) {
                detailQueries.forEach(([queryKey, data]) => {
                    if (data) {
                        previousQueries.push({ data, queryKey });
                        queryClient.setQueryData(queryKey, (prev: SongDetailResponse) => {
                            if (prev && itemIdSet.has(prev.id)) {
                                return {
                                    ...prev,
                                    userFavorite: isFavorite,
                                };
                            }

                            return prev;
                        });
                    }
                });
            }
            break;
        }
    }

    return previousQueries;
};

export const restoreFavoriteQueryData = (
    queryClient: QueryClient,
    previousQueries: PreviousQueryData[],
): void => {
    previousQueries.forEach(({ data, queryKey }) => {
        queryClient.setQueryData(queryKey, data);
    });
};
