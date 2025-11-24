import { QueryClient } from '@tanstack/react-query';

import { PreviousQueryData } from './favorite-optimistic-updates';

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
    LibraryItem,
    SetRatingArgs,
    Song,
    SongDetailResponse,
} from '/@/shared/types/domain-types';

export const applyRatingOptimisticUpdates = (
    queryClient: QueryClient,
    variables: SetRatingArgs,
    rating: number,
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
                        queryClient.setQueryData(
                            queryKey,
                            (prev: AlbumDetailResponse | undefined) => {
                                if (prev && itemIdSet.has(prev.id)) {
                                    return { ...prev, userRating: rating };
                                }
                                return prev;
                            },
                        );
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
                            return {
                                ...prev,
                                items: prev.items.map((item: Album) => {
                                    return itemIdSet.has(item.id)
                                        ? { ...item, userRating: rating }
                                        : item;
                                }),
                            };
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
                                return {
                                    ...prev,
                                    pages: prev.pages.map((page: AlbumListResponse) => {
                                        return {
                                            ...page,
                                            items: page.items.map((item: Album) => {
                                                return itemIdSet.has(item.id)
                                                    ? { ...item, userRating: rating }
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
                        queryClient.setQueryData(
                            queryKey,
                            (prev: AlbumArtistDetailResponse | undefined) => {
                                if (prev && itemIdSet.has(prev.id)) {
                                    return { ...prev, userRating: rating };
                                }
                                return prev;
                            },
                        );
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
                            return {
                                ...prev,
                                items: prev.items.map((item: AlbumArtist) => {
                                    return itemIdSet.has(item.id)
                                        ? { ...item, userRating: rating }
                                        : item;
                                }),
                            };
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
                                                    ? { ...item, userRating: rating }
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
                                        ? { ...item, userRating: rating }
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
                                                    ? { ...item, userRating: rating }
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
                        queryClient.setQueryData(
                            queryKey,
                            (prev: AlbumDetailResponse | undefined) => {
                                if (prev) {
                                    return {
                                        ...prev,
                                        songs: prev.songs?.map((song: Song) => {
                                            return itemIdSet.has(song.id)
                                                ? { ...song, userRating: rating }
                                                : song;
                                        }),
                                    };
                                }
                                return prev;
                            },
                        );
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
                        queryClient.setQueryData(
                            queryKey,
                            (prev: SongDetailResponse | undefined) => {
                                if (prev && itemIdSet.has(prev.id)) {
                                    return { ...prev, userRating: rating };
                                }
                                return prev;
                            },
                        );
                    }
                });
            }

            break;
        }
    }

    return previousQueries;
};

export const restoreRatingQueryData = (
    queryClient: QueryClient,
    previousQueries: PreviousQueryData[],
): void => {
    previousQueries.forEach(({ data, queryKey }) => {
        queryClient.setQueryData(queryKey, data);
    });
};
