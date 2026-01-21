import { memo } from 'react';

import {
    ColumnNullFallback,
    ColumnSkeletonVariable,
    ItemTableListInnerColumn,
    TableColumnTextContainer,
} from '/@/renderer/components/item-list/item-table-list/item-table-list-column';

const PathColumnBase = (props: ItemTableListInnerColumn) => {
    const rowItem = props.getRowItem?.(props.rowIndex) ?? (props.data as any[])[props.rowIndex];
    const row: string | undefined = (rowItem as any)?.[props.columns[props.columnIndex].id];

    if (typeof row === 'string' && row) {
        return (
            <TableColumnTextContainer {...props}>
                <span>{row}</span>
            </TableColumnTextContainer>
        );
    }

    if (row === null) {
        return <ColumnNullFallback {...props} />;
    }

    return <ColumnSkeletonVariable {...props} />;
};

export const PathColumn = memo(PathColumnBase, (prevProps, nextProps) => {
    return (
        prevProps.rowIndex === nextProps.rowIndex &&
        prevProps.columnIndex === nextProps.columnIndex &&
        prevProps.data === nextProps.data &&
        prevProps.columns === nextProps.columns
    );
});
