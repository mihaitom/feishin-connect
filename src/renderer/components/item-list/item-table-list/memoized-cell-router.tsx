import React, { memo, useMemo } from 'react';
import { CellComponentProps } from 'react-window-v2';

import { createColumnCellComponents } from './cell-component-factory';
import { TableItemProps } from './item-table-list';
import { ItemTableListColumn } from './item-table-list-column';

import { LibraryItem } from '/@/shared/types/domain-types';
import { TableColumn } from '/@/shared/types/types';

interface MemoizedCellRouterProps extends CellComponentProps<TableItemProps> {
    columnCellComponents: Map<TableColumn, React.ComponentType<CellComponentProps<TableItemProps>>>;
}

const MemoizedCellRouterBase = (props: MemoizedCellRouterProps) => {
    const columnType = props.columns[props.columnIndex]?.id as TableColumn;
    const ColumnComponent = props.columnCellComponents.get(columnType);

    if (ColumnComponent) {
        // eslint-disable-next-line react-hooks/static-components
        return <ColumnComponent {...props} />;
    }

    return <ItemTableListColumn {...props} />;
};

export const MemoizedCellRouter = memo(MemoizedCellRouterBase, (prevProps, nextProps) => {
    return (
        prevProps.rowIndex === nextProps.rowIndex &&
        prevProps.columnIndex === nextProps.columnIndex &&
        prevProps.data === nextProps.data &&
        prevProps.columns === nextProps.columns &&
        prevProps.columnCellComponents === nextProps.columnCellComponents &&
        prevProps.size === nextProps.size &&
        prevProps.enableAlternateRowColors === nextProps.enableAlternateRowColors &&
        prevProps.enableHorizontalBorders === nextProps.enableHorizontalBorders &&
        prevProps.enableVerticalBorders === nextProps.enableVerticalBorders &&
        prevProps.enableRowHoverHighlight === nextProps.enableRowHoverHighlight &&
        prevProps.enableSelection === nextProps.enableSelection &&
        prevProps.enableColumnResize === nextProps.enableColumnResize &&
        prevProps.enableColumnReorder === nextProps.enableColumnReorder &&
        prevProps.cellPadding === nextProps.cellPadding
    );
});

export const useColumnCellComponents = (
    columns: TableColumn[],
    itemType: LibraryItem,
): Map<TableColumn, React.ComponentType<CellComponentProps<TableItemProps>>> => {
    const columnsKey = useMemo(() => columns.join(','), [columns]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    return useMemo(() => createColumnCellComponents(columns, itemType), [columnsKey, itemType]);
};
