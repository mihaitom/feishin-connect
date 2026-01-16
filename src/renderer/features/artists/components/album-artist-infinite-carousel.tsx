import { QueryFunctionContext, useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { Suspense, useCallback, useMemo } from 'react';

import { api } from '/@/renderer/api';
import { queryKeys } from '/@/renderer/api/query-keys';
import {
    GridCarousel,
    GridCarouselSkeletonFallback,
    useGridCarouselContainerQuery,
} from '/@/renderer/components/grid-carousel/grid-carousel-v2';
import { DataRow, MemoizedItemCard } from '/@/renderer/components/item-card/item-card';
import { useDefaultItemListControls } from '/@/renderer/components/item-list/helpers/item-list-controls';
import { useGridRows } from '/@/renderer/components/item-list/helpers/use-grid-rows';
import { useCurrentServerId } from '/@/renderer/store';
import {
    AlbumArtist,
    AlbumArtistListQuery,
    AlbumArtistListResponse,
    AlbumArtistListSort,
    LibraryItem,
    SortOrder,
} from '/@/shared/types/domain-types';
import { ItemListKey } from '/@/shared/types/types';

interface AlbumArtistCarouselProps {
    containerQuery?: ReturnType<typeof useGridCarouselContainerQuery>;
    excludeIds?: string[];
    query?: Partial<Omit<AlbumArtistListQuery, 'startIndex'>>;
    queryKey?: QueryFunctionContext['queryKey'];
    rowCount?: number;
    sortBy: AlbumArtistListSort;
    sortOrder: SortOrder;
    title: React.ReactNode | string;
}

const BaseAlbumArtistInfiniteCarousel = (props: AlbumArtistCarouselProps & { rows: DataRow[] }) => {
    const {
        containerQuery,
        excludeIds,
        query: additionalQuery,
        queryKey,
        rowCount = 1,
        rows,
        sortBy,
        sortOrder,
        title,
    } = props;
    const {
        data: albumArtists,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        refetch,
    } = useAlbumArtistListInfinite(sortBy, sortOrder, 20, additionalQuery, queryKey);

    const controls = useDefaultItemListControls();

    const cards = useMemo(() => {
        // Flatten all pages and filter excluded IDs
        const allItems =
            albumArtists?.pages.flatMap((page: AlbumArtistListResponse) => page.items) || [];
        const filteredItems = excludeIds
            ? allItems.filter((albumArtist) => !excludeIds.includes(albumArtist.id))
            : allItems;

        return filteredItems.map((albumArtist: AlbumArtist) => ({
            content: (
                <MemoizedItemCard
                    controls={controls}
                    data={albumArtist}
                    enableDrag
                    itemType={LibraryItem.ALBUM_ARTIST}
                    rows={rows}
                    type="poster"
                    withControls
                />
            ),
            id: albumArtist.id,
        }));
    }, [albumArtists, controls, excludeIds, rows]);

    const handleNextPage = useCallback(() => {}, []);

    const handlePrevPage = useCallback(() => {}, []);

    const handleRefresh = useCallback(() => {
        refetch();
    }, [refetch]);

    const firstPageItems = excludeIds
        ? albumArtists?.pages[0]?.items.filter(
              (albumArtist) => !excludeIds.includes(albumArtist.id),
          ) || []
        : albumArtists?.pages[0]?.items || [];

    if (firstPageItems.length === 0) {
        return null;
    }

    return (
        <GridCarousel
            cards={cards}
            containerQuery={containerQuery}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            loadNextPage={fetchNextPage}
            onNextPage={handleNextPage}
            onPrevPage={handlePrevPage}
            onRefresh={handleRefresh}
            placeholderItemType={LibraryItem.ALBUM_ARTIST}
            placeholderRows={rows}
            rowCount={rowCount}
            title={title}
        />
    );
};

export const AlbumArtistInfiniteCarousel = (props: AlbumArtistCarouselProps) => {
    const rows = useGridRows(LibraryItem.ALBUM_ARTIST, ItemListKey.ALBUM_ARTIST);

    return (
        <Suspense
            fallback={
                <GridCarouselSkeletonFallback
                    containerQuery={props.containerQuery}
                    placeholderItemType={LibraryItem.ALBUM_ARTIST}
                    placeholderRows={rows}
                    title={props.title}
                />
            }
        >
            <BaseAlbumArtistInfiniteCarousel {...props} rows={rows} />
        </Suspense>
    );
};

function useAlbumArtistListInfinite(
    sortBy: AlbumArtistListSort,
    sortOrder: SortOrder,
    itemLimit: number,
    additionalQuery?: Partial<Omit<AlbumArtistListQuery, 'startIndex'>>,
    overrideQueryKey?: QueryFunctionContext['queryKey'],
) {
    const serverId = useCurrentServerId();

    const defaultQueryKey = queryKeys.albumArtists.infiniteList(serverId, {
        sortBy,
        sortOrder,
        ...additionalQuery,
    });

    const query = useSuspenseInfiniteQuery<AlbumArtistListResponse>({
        getNextPageParam: (lastPage, _allPages, lastPageParam) => {
            if (lastPage.items.length < itemLimit) {
                return undefined;
            }

            const nextPageParam = Number(lastPageParam) + itemLimit;

            return String(nextPageParam);
        },
        initialPageParam: '0',
        queryFn: ({ pageParam, signal }) => {
            return api.controller.getAlbumArtistList({
                apiClientProps: { serverId, signal },
                query: {
                    limit: itemLimit,
                    sortBy,
                    sortOrder,
                    startIndex: Number(pageParam),
                    ...additionalQuery,
                },
            });
        },
        queryKey: overrideQueryKey || defaultQueryKey,
    });

    return query;
}
