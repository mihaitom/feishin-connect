import { memo } from 'react';

import {
    ItemTableListInnerColumn,
    TableColumnContainer,
} from '/@/renderer/components/item-list/item-table-list/item-table-list-column';
import { ItemListItem } from '/@/renderer/components/item-list/types';
import { ActionIcon } from '/@/shared/components/action-icon/action-icon';

const ActionsColumnBase = (props: ItemTableListInnerColumn) => {
    const row: any = props.getRowItem?.(props.rowIndex) ?? (props.data as any[])[props.rowIndex];

    const handleActionClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        event.preventDefault();
        if (row !== undefined) {
            const item = row as ItemListItem;
            const rowId = props.internalState.extractRowId(item);
            const index = rowId ? props.internalState.findItemIndex(rowId) : -1;
            props.controls.onMore?.({
                event,
                index,
                internalState: props.internalState,
                item,
                itemType: props.itemType,
            });
        }
    };

    const handleActionDoubleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        event.preventDefault();
    };

    if (row !== undefined) {
        return (
            <TableColumnContainer {...props}>
                <ActionIcon
                    className="hover-only"
                    icon="ellipsisHorizontal"
                    iconProps={{
                        color: 'muted',
                        size: 'md',
                    }}
                    onClick={handleActionClick}
                    onDoubleClick={handleActionDoubleClick}
                    size="xs"
                    variant="subtle"
                />
            </TableColumnContainer>
        );
    }

    return <TableColumnContainer {...props}>&nbsp;</TableColumnContainer>;
};

export const ActionsColumn = memo(ActionsColumnBase, (prevProps, nextProps) => {
    const prevItem = prevProps.getRowItem?.(prevProps.rowIndex);
    const nextItem = nextProps.getRowItem?.(nextProps.rowIndex);

    return (
        prevProps.rowIndex === nextProps.rowIndex &&
        prevProps.columnIndex === nextProps.columnIndex &&
        prevProps.data === nextProps.data &&
        prevProps.columns === nextProps.columns &&
        prevItem === nextItem
    );
});
