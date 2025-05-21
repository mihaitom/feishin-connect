import type { ListChildComponentProps } from 'react-window';

import { memo } from 'react';
import { areEqual } from 'react-window';

import { DefaultCard } from '/@/renderer/components/virtual-grid/grid-card/default-card';
import { PosterCard } from '/@/renderer/components/virtual-grid/grid-card/poster-card';
import { CardRow, GridCardData, ListDisplayType } from '/@/shared/types/types';

export const GridCard = memo(({ data, index, style }: ListChildComponentProps) => {
    const {
        cardRows,
        columnCount,
        display,
        handleFavorite,
        handlePlayQueueAdd,
        itemCount,
        itemData,
        itemGap,
        itemType,
        playButtonBehavior,
        resetInfiniteLoaderCache,
        route,
    } = data as GridCardData;

    const cards: React.ReactNode[] = [];
    const startIndex = index * columnCount;
    const stopIndex = Math.min(itemCount - 1, startIndex + columnCount - 1);

    const columnCountInRow = stopIndex - startIndex + 1;
    let columnCountToAdd = 0;
    if (columnCountInRow !== columnCount) {
        columnCountToAdd = columnCount - columnCountInRow;
    }
    const View = display === ListDisplayType.CARD ? DefaultCard : PosterCard;

    for (let i = startIndex; i <= stopIndex + columnCountToAdd; i += 1) {
        cards.push(
            <View
                columnIndex={i}
                controls={{
                    cardRows: cardRows as CardRow<any>[],
                    handleFavorite,
                    handlePlayQueueAdd,
                    itemGap,
                    itemType,
                    playButtonBehavior,
                    resetInfiniteLoaderCache,
                    route,
                }}
                data={itemData[i]}
                isHidden={i > stopIndex}
                key={`card-${i}-${index}`}
                listChildProps={{ index }}
            />,
        );
    }

    return (
        <div
            style={{
                ...style,
                display: 'flex',
            }}
        >
            {cards}
        </div>
    );
}, areEqual);
