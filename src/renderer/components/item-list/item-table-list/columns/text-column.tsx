import clsx from 'clsx';

import styles from './text-column.module.css';

import {
    ColumnNullFallback,
    ColumnSkeletonVariable,
    ItemTableListInnerColumn,
    TableColumnTextContainer,
} from '/@/renderer/components/item-list/item-table-list/item-table-list-column';

export const TextColumn = (props: ItemTableListInnerColumn) => {
    const rowItem = props.getRowItem?.(props.rowIndex) ?? (props.data as any[])[props.rowIndex];
    const row: string | undefined = (rowItem as any)?.[props.columns[props.columnIndex].id];

    if (typeof row === 'string' && row) {
        return (
            <TableColumnTextContainer
                className={clsx(styles.textContainer, {
                    [styles.compact]: props.size === 'compact',
                    [styles.large]: props.size === 'large',
                })}
                {...props}
            >
                {row}
            </TableColumnTextContainer>
        );
    }

    if (row === null) {
        return <ColumnNullFallback {...props} />;
    }

    return <ColumnSkeletonVariable {...props} />;
};
