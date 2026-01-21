import { memo, useMemo } from 'react';

import {
    ColumnNullFallback,
    ColumnSkeletonFixed,
    ItemTableListInnerColumn,
    TableColumnTextContainer,
} from '/@/renderer/components/item-list/item-table-list/item-table-list-column';
import { formatSizeString } from '/@/renderer/utils/format';

const SizeColumnBase = (props: ItemTableListInnerColumn) => {
    const rowItem = props.getRowItem?.(props.rowIndex) ?? (props.data as any[])[props.rowIndex];
    const row: number | undefined = (rowItem as any)?.[props.columns[props.columnIndex].id];

    const formattedSize = useMemo(() => {
        return typeof row === 'number' ? formatSizeString(row) : null;
    }, [row]);

    if (typeof row === 'number') {
        return <TableColumnTextContainer {...props}>{formattedSize}</TableColumnTextContainer>;
    }

    if (row === null) {
        return <ColumnNullFallback {...props} />;
    }

    return <ColumnSkeletonFixed {...props} />;
};

export const SizeColumn = memo(SizeColumnBase, (prevProps, nextProps) => {
    return (
        prevProps.rowIndex === nextProps.rowIndex &&
        prevProps.columnIndex === nextProps.columnIndex &&
        prevProps.data === nextProps.data &&
        prevProps.columns === nextProps.columns
    );
});
