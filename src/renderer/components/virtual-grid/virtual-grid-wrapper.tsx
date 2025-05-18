import type { CardRoute, CardRow, ListDisplayType, PlayQueueAddOptions } from '/@/renderer/types';
import type { Ref } from 'react';
import type { FixedSizeListProps } from 'react-window';

import debounce from 'lodash/debounce';
import memoize from 'memoize-one';
import { FixedSizeList } from 'react-window';
import styled from 'styled-components';

import { Album, AlbumArtist, Artist, LibraryItem } from '/@/renderer/api/types';
import { GridCard } from '/@/renderer/components/virtual-grid/grid-card';

const createItemData = memoize(
    (
        cardRows,
        columnCount,
        display,
        itemCount,
        itemData,
        itemGap,
        itemHeight,
        itemType,
        itemWidth,
        route,
        handlePlayQueueAdd,
        handleFavorite,
        resetInfiniteLoaderCache,
    ) => ({
        cardRows,
        columnCount,
        display,
        handleFavorite,
        handlePlayQueueAdd,
        itemCount,
        itemData,
        itemGap,
        itemHeight,
        itemType,
        itemWidth,
        resetInfiniteLoaderCache,
        route,
    }),
);

const createScrollHandler = memoize((onScroll) => debounce(onScroll, 250));

export const VirtualGridWrapper = ({
    cardRows,
    columnCount,
    display,
    handleFavorite,
    handlePlayQueueAdd,
    height,
    initialScrollOffset,
    itemCount,
    itemData,
    itemGap,
    itemHeight,
    itemType,
    itemWidth,
    onScroll,
    refInstance,
    resetInfiniteLoaderCache,
    route,
    rowCount,
    width,
    ...rest
}: Omit<FixedSizeListProps, 'children' | 'height' | 'itemSize' | 'ref' | 'width'> & {
    cardRows: CardRow<Album | AlbumArtist | Artist>[];
    columnCount: number;
    display: ListDisplayType;
    handleFavorite?: (options: {
        id: string[];
        isFavorite: boolean;
        itemType: LibraryItem;
    }) => void;
    handlePlayQueueAdd?: (options: PlayQueueAddOptions) => void;
    height?: number;
    itemData: any[];
    itemGap: number;
    itemHeight: number;
    itemType: LibraryItem;
    itemWidth: number;
    refInstance: Ref<any>;
    resetInfiniteLoaderCache: () => void;
    route?: CardRoute;
    rowCount: number;
    width?: number;
}) => {
    const memoizedItemData = createItemData(
        cardRows,
        columnCount,
        display,
        itemCount,
        itemData,
        itemGap,
        itemHeight,
        itemType,
        itemWidth,
        route,
        handlePlayQueueAdd,
        handleFavorite,
        resetInfiniteLoaderCache,
    );

    const memoizedOnScroll = createScrollHandler(onScroll);

    return (
        <FixedSizeList
            ref={refInstance}
            {...rest}
            height={(height && Number(height)) || 0}
            initialScrollOffset={initialScrollOffset}
            itemCount={rowCount}
            itemData={memoizedItemData}
            itemSize={itemHeight}
            onScroll={memoizedOnScroll}
            overscanCount={5}
            width={(width && Number(width)) || 0}
        >
            {GridCard}
        </FixedSizeList>
    );
};

VirtualGridWrapper.defaultProps = {
    route: undefined,
};

export const VirtualGridContainer = styled.div`
    display: flex;
    flex-direction: column;
    height: 100%;
`;

export const VirtualGridAutoSizerContainer = styled.div`
    flex: 1;
`;
