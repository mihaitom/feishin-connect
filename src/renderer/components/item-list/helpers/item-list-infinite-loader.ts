import {
    useQuery,
    useQueryClient,
    useSuspenseQuery,
    UseSuspenseQueryOptions,
} from '@tanstack/react-query';
import throttle from 'lodash/throttle';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { queryKeys } from '/@/renderer/api/query-keys';
import { useListContext } from '/@/renderer/context/list-context';
import { eventEmitter } from '/@/renderer/events/event-emitter';
import { UserFavoriteEventPayload, UserRatingEventPayload } from '/@/renderer/events/events';
import { LibraryItem } from '/@/shared/types/domain-types';

const getQueryKeyName = (itemType: LibraryItem): string => {
    switch (itemType) {
        case LibraryItem.ALBUM:
            return 'albums';
        case LibraryItem.ALBUM_ARTIST:
            return 'albumArtists';
        case LibraryItem.ARTIST:
            return 'artists';
        case LibraryItem.GENRE:
            return 'genres';
        case LibraryItem.PLAYLIST:
            return 'playlists';
        case LibraryItem.SONG:
            return 'songs';
        default:
            return 'albums';
    }
};

interface UseItemListInfiniteLoaderProps {
    eventKey: string;
    fetchThreshold?: number;
    itemsPerPage: number;
    itemType: LibraryItem;
    listCountQuery: UseSuspenseQueryOptions<number, Error, number, readonly unknown[]>;
    listQueryFn: (args: { apiClientProps: any; query: any }) => Promise<{ items: unknown[] }>;
    query: Record<string, any>;
    serverId: string;
}

function getInitialData(itemCount: number) {
    return {
        data: Array.from({ length: itemCount }, () => undefined),
        pagesLoaded: {},
    };
}

export const useItemListInfiniteLoader = ({
    eventKey,
    fetchThreshold = 0.2,
    itemsPerPage = 100,
    itemType,
    listCountQuery,
    listQueryFn,
    query = {},
    serverId,
}: UseItemListInfiniteLoaderProps) => {
    const queryClient = useQueryClient();
    const lastFetchedPageRef = useRef<number>(-1);
    const currentVisibleRangeRef = useRef<null | { startIndex: number; stopIndex: number }>(null);

    const { data: totalItemCount } = useSuspenseQuery<number, any, number, any>(listCountQuery);

    const { setItemCount } = useListContext();

    useEffect(() => {
        if (!totalItemCount || !setItemCount) {
            return;
        }

        setItemCount(totalItemCount);
    }, [setItemCount, totalItemCount]);

    const dataQueryKey = useMemo(
        () => [serverId, 'item-list-infinite-loader', itemType, query],
        [serverId, itemType, query],
    );

    // Reset the loaded pages when the query changes
    useEffect(() => {
        queryClient.setQueryData(dataQueryKey, (oldData: any) => {
            if (!oldData) return oldData;
            return {
                ...oldData,
                pagesLoaded: {},
            };
        });
        lastFetchedPageRef.current = -1;
        currentVisibleRangeRef.current = null;
    }, [query, queryClient, dataQueryKey]);

    const { data } = useQuery<{ data: unknown[]; pagesLoaded: Record<string, boolean> }>({
        enabled: false,
        initialData: getInitialData(totalItemCount),
        queryFn: () => {
            return getInitialData(totalItemCount);
        },
        queryKey: dataQueryKey,
    });

    const fetchPage = useCallback(
        async (pageNumber: number) => {
            const startIndex = pageNumber * itemsPerPage;
            const queryParams = {
                limit: itemsPerPage,
                startIndex,
                ...query,
            };

            const result = await queryClient.ensureQueryData({
                gcTime: 1000 * 15,
                queryFn: async ({ signal }) => {
                    const result = await listQueryFn({
                        apiClientProps: { serverId, signal },
                        query: queryParams,
                    });

                    return result;
                },
                queryKey: queryKeys[getQueryKeyName(itemType)].list(serverId, queryParams),
                staleTime: 1000 * 15,
            });

            const endIndex = startIndex + itemsPerPage;

            // Update the query data with the fetched page
            queryClient.setQueryData(
                dataQueryKey,
                (oldData: { data: unknown[]; pagesLoaded: Record<string, boolean> }) => {
                    const newData = [
                        ...oldData.data.slice(0, startIndex),
                        ...result.items,
                        ...oldData.data.slice(endIndex),
                    ];
                    const newPagesLoaded = {
                        ...oldData.pagesLoaded,
                        [pageNumber]: true,
                    };

                    return {
                        data: newData,
                        pagesLoaded: newPagesLoaded,
                    };
                },
            );

            // Track the last fetched page
            lastFetchedPageRef.current = Math.max(lastFetchedPageRef.current, pageNumber);
        },
        [itemsPerPage, query, queryClient, serverId, dataQueryKey, listQueryFn, itemType],
    );

    const onRangeChangedBase = useCallback(
        async (range: { startIndex: number; stopIndex: number }) => {
            // Track the current visible range
            currentVisibleRangeRef.current = range;

            const pageNumber = Math.floor(range.startIndex / itemsPerPage);

            const currentData = queryClient.getQueryData<{
                data: unknown[];
                pagesLoaded: Record<string, boolean>;
            }>(dataQueryKey);

            const startPageBoundary = pageNumber * itemsPerPage;
            const endPageBoundary = (pageNumber + 1) * itemsPerPage;

            const distanceFromStartBoundary = range.startIndex - startPageBoundary;
            const distanceToEndBoundary = endPageBoundary - range.stopIndex;

            const thresholdDistance = Math.floor(itemsPerPage * fetchThreshold);

            const isCurrentPageLoaded = currentData?.pagesLoaded[pageNumber] ?? false;

            // Fetch current page if not loaded
            if (!isCurrentPageLoaded) {
                await fetchPage(pageNumber);
            }

            // If current page is loaded, check if we should prefetch adjacent pages
            if (isCurrentPageLoaded) {
                if (
                    distanceFromStartBoundary <= thresholdDistance &&
                    pageNumber > 0 &&
                    !currentData?.pagesLoaded[pageNumber - 1]
                ) {
                    await fetchPage(pageNumber - 1);
                }

                if (
                    distanceToEndBoundary <= thresholdDistance &&
                    !currentData?.pagesLoaded[pageNumber + 1]
                ) {
                    await fetchPage(pageNumber + 1);
                }
            }
        },
        [itemsPerPage, fetchThreshold, queryClient, dataQueryKey, fetchPage],
    );

    const onRangeChanged = useMemo(
        () =>
            throttle(onRangeChangedBase, 150, {
                leading: true,
                trailing: true,
            }),
        [onRangeChangedBase],
    );

    const refresh = useCallback(
        async (force?: boolean) => {
            // Invalidate all queries to ensure fresh data
            await queryClient.invalidateQueries();

            // Reset the infinite list data
            const currentData = queryClient.getQueryData<{
                data: unknown[];
                pagesLoaded: Record<string, boolean>;
            }>(dataQueryKey);

            if (force || currentData) {
                // Reset data to initial state and clear all loaded pages
                await queryClient.setQueryData(dataQueryKey, (oldData: any) => {
                    if (!oldData) return getInitialData(totalItemCount);
                    return {
                        ...oldData,
                        data: Array.from({ length: totalItemCount }, () => undefined),
                        pagesLoaded: {},
                    };
                });
                lastFetchedPageRef.current = -1;
            }

            // Add a delay to make the refresh visually clear
            await new Promise((resolve) => setTimeout(resolve, 150));

            // Determine which page to refetch based on current visible range
            let pageToFetch = 0;
            if (currentVisibleRangeRef.current) {
                // Calculate the page from the current visible range
                pageToFetch = Math.floor(currentVisibleRangeRef.current.startIndex / itemsPerPage);
            } else if (lastFetchedPageRef.current >= 0) {
                // Fallback to last fetched page if no visible range is tracked
                pageToFetch = lastFetchedPageRef.current;
            }

            // Refetch the current page
            await fetchPage(pageToFetch);

            // Trigger range changed to ensure adjacent pages are prefetched if needed
            const startIndex = pageToFetch * itemsPerPage;
            const stopIndex = Math.min((pageToFetch + 1) * itemsPerPage, totalItemCount);

            await onRangeChangedBase({
                startIndex,
                stopIndex,
            });
        },
        [queryClient, itemsPerPage, onRangeChangedBase, dataQueryKey, totalItemCount, fetchPage],
    );

    const updateItems = useCallback(
        (indexes: number[], value: object) => {
            queryClient.setQueryData(
                dataQueryKey,
                (prev: { data: unknown[]; pagesLoaded: Record<string, boolean> }) => {
                    return {
                        ...prev,
                        data: prev.data.map((item: any, index) => {
                            if (!item) {
                                return item;
                            }

                            if (!indexes.includes(index)) {
                                return item;
                            }

                            return {
                                ...item,
                                ...value,
                            };
                        }),
                    };
                },
            );
        },
        [queryClient, dataQueryKey],
    );

    useEffect(() => {
        const handleRefresh = (payload: { key: string }) => {
            if (!eventKey || eventKey !== payload.key) {
                return;
            }

            return refresh(true);
        };

        eventEmitter.on('ITEM_LIST_REFRESH', handleRefresh);

        return () => {
            eventEmitter.off('ITEM_LIST_REFRESH', handleRefresh);
        };
    }, [eventKey, refresh]);

    useEffect(() => {
        const handleFavorite = (payload: UserFavoriteEventPayload) => {
            if (payload.itemType !== itemType || payload.serverId !== serverId) {
                return;
            }

            const idToIndexMap = data.data
                .filter(Boolean)
                .reduce((acc: Record<string, number>, item: any, index: number) => {
                    acc[item.id] = index;
                    return acc;
                }, {});

            const dataIndexes = payload.id
                .map((id: string) => idToIndexMap[id])
                .filter((idx) => idx !== undefined);

            if (dataIndexes.length === 0) {
                return;
            }

            return updateItems(dataIndexes, { userFavorite: payload.favorite });
        };

        const handleRating = (payload: UserRatingEventPayload) => {
            if (payload.itemType !== itemType || payload.serverId !== serverId) {
                return;
            }

            const idToIndexMap = data.data
                .filter(Boolean)
                .reduce((acc: Record<string, number>, item: any, index: number) => {
                    acc[item.id] = index;
                    return acc;
                }, {});

            const dataIndexes = payload.id
                .map((id: string) => idToIndexMap[id])
                .filter((idx) => idx !== undefined);

            if (dataIndexes.length === 0) {
                return;
            }

            return updateItems(dataIndexes, { userRating: payload.rating });
        };

        eventEmitter.on('USER_FAVORITE', handleFavorite);
        eventEmitter.on('USER_RATING', handleRating);

        return () => {
            eventEmitter.off('USER_FAVORITE', handleFavorite);
            eventEmitter.off('USER_RATING', handleRating);
        };
    }, [data, eventKey, itemType, serverId, updateItems]);

    return { data: data.data, onRangeChanged, refresh, updateItems };
};

export const parseListCountQuery = (query: any) => {
    return {
        ...query,
        limit: 1,
        startIndex: 0,
    };
};
