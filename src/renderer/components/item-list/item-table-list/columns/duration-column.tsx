import formatDuration from 'format-duration';
import { useMemo } from 'react';

import {
    ColumnNullFallback,
    ColumnSkeletonFixed,
    ItemTableListInnerColumn,
    TableColumnTextContainer,
} from '/@/renderer/components/item-list/item-table-list/item-table-list-column';

const DurationColumnBase = (props: ItemTableListInnerColumn) => {
    const rowItem = props.getRowItem?.(props.rowIndex) ?? (props.data as any[])[props.rowIndex];
    const row: number | undefined = (rowItem as any)?.[props.columns[props.columnIndex].id];

    const formattedDuration = useMemo(() => {
        return typeof row === 'number' ? formatDuration(row) : null;
    }, [row]);

    if (typeof row === 'number') {
        return <TableColumnTextContainer {...props}>{formattedDuration}</TableColumnTextContainer>;
    }

    if (row === null) {
        return <ColumnNullFallback {...props} />;
    }

    return <ColumnSkeletonFixed {...props} />;
};

export const DurationColumn = DurationColumnBase;
