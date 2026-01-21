import { memo } from 'react';

import {
    ItemTableListInnerColumn,
    TableColumnContainer,
} from '/@/renderer/components/item-list/item-table-list/item-table-list-column';
import { ItemListItem } from '/@/renderer/components/item-list/types';
import { useIsMutatingRating } from '/@/renderer/features/shared/mutations/set-rating-mutation';
import { Rating } from '/@/shared/components/rating/rating';

const RatingColumnBase = (props: ItemTableListInnerColumn) => {
    const rowItem = props.getRowItem?.(props.rowIndex) ?? (props.data as any[])[props.rowIndex];
    const row: null | number | undefined = rowItem?.[props.columns[props.columnIndex].id];

    const isMutatingRating = useIsMutatingRating();

    if (typeof row === 'number' || row === null) {
        return (
            <TableColumnContainer {...props}>
                <Rating
                    className={row ? undefined : 'hover-only-flex'}
                    onChange={(rating) => {
                        const item = rowItem as ItemListItem;
                        const rowId = props.internalState.extractRowId(item);
                        const index = rowId ? props.internalState.findItemIndex(rowId) : -1;
                        props.controls.onRating?.({
                            event: null,
                            index,
                            internalState: props.internalState,
                            item,
                            itemType: props.itemType,
                            rating,
                        });
                    }}
                    readOnly={isMutatingRating}
                    size="xs"
                    value={row || 0}
                />
            </TableColumnContainer>
        );
    }

    return <TableColumnContainer {...props}>&nbsp;</TableColumnContainer>;
};

export const RatingColumn = memo(RatingColumnBase, (prevProps, nextProps) => {
    const prevItem = prevProps.getRowItem?.(prevProps.rowIndex);
    const nextItem = nextProps.getRowItem?.(nextProps.rowIndex);
    const prevRating = prevItem?.[prevProps.columns[prevProps.columnIndex].id];
    const nextRating = nextItem?.[nextProps.columns[nextProps.columnIndex].id];

    return (
        prevProps.rowIndex === nextProps.rowIndex &&
        prevProps.columnIndex === nextProps.columnIndex &&
        prevProps.data === nextProps.data &&
        prevProps.columns === nextProps.columns &&
        prevItem === nextItem &&
        prevRating === nextRating
    );
});
