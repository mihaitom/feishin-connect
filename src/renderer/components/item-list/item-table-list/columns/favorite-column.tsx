import { memo } from 'react';

import {
    ItemTableListInnerColumn,
    TableColumnContainer,
} from '/@/renderer/components/item-list/item-table-list/item-table-list-column';
import { ItemListItem } from '/@/renderer/components/item-list/types';
import { useIsMutatingCreateFavorite } from '/@/renderer/features/shared/mutations/create-favorite-mutation';
import { useIsMutatingDeleteFavorite } from '/@/renderer/features/shared/mutations/delete-favorite-mutation';
import { ActionIcon } from '/@/shared/components/action-icon/action-icon';

const FavoriteColumnBase = (props: ItemTableListInnerColumn) => {
    const rowItem = props.getRowItem?.(props.rowIndex) ?? (props.data as any[])[props.rowIndex];
    const row: boolean | undefined = rowItem?.[props.columns[props.columnIndex].id];

    const isMutatingCreateFavorite = useIsMutatingCreateFavorite();
    const isMutatingDeleteFavorite = useIsMutatingDeleteFavorite();
    const isMutatingFavorite = isMutatingCreateFavorite || isMutatingDeleteFavorite;

    if (typeof row === 'boolean') {
        return (
            <TableColumnContainer {...props}>
                <ActionIcon
                    className={row ? undefined : 'hover-only'}
                    disabled={isMutatingFavorite}
                    icon="favorite"
                    iconProps={{
                        color: row ? 'primary' : 'muted',
                        fill: row ? 'primary' : undefined,
                        size: 'md',
                    }}
                    onClick={(event) => {
                        event.stopPropagation();
                        event.preventDefault();
                        const item = rowItem as ItemListItem;
                        const rowId = props.internalState.extractRowId(item);
                        const index = rowId ? props.internalState.findItemIndex(rowId) : -1;
                        props.controls.onFavorite?.({
                            event,
                            favorite: !row,
                            index,
                            internalState: props.internalState,
                            item,
                            itemType: props.itemType,
                        });
                    }}
                    onDoubleClick={(event) => {
                        event.stopPropagation();
                        event.preventDefault();
                    }}
                    size="xs"
                    variant="subtle"
                />
            </TableColumnContainer>
        );
    }

    return <TableColumnContainer {...props}>&nbsp;</TableColumnContainer>;
};

export const FavoriteColumn = memo(FavoriteColumnBase, (prevProps, nextProps) => {
    const prevItem = prevProps.getRowItem?.(prevProps.rowIndex);
    const nextItem = nextProps.getRowItem?.(nextProps.rowIndex);
    const prevFavorite = prevItem?.[prevProps.columns[prevProps.columnIndex].id];
    const nextFavorite = nextItem?.[nextProps.columns[nextProps.columnIndex].id];

    return (
        prevProps.rowIndex === nextProps.rowIndex &&
        prevProps.columnIndex === nextProps.columnIndex &&
        prevProps.data === nextProps.data &&
        prevProps.columns === nextProps.columns &&
        prevItem === nextItem &&
        prevFavorite === nextFavorite
    );
});
