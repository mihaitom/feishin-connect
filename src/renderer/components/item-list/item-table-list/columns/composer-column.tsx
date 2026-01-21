import clsx from 'clsx';
import { memo } from 'react';

import styles from './composer-column.module.css';

import {
    ColumnNullFallback,
    ColumnSkeletonVariable,
    ItemTableListInnerColumn,
    TableColumnContainer,
} from '/@/renderer/components/item-list/item-table-list/item-table-list-column';
import { JoinedArtists } from '/@/renderer/features/albums/components/joined-artists';
import { Album, RelatedArtist, Song } from '/@/shared/types/domain-types';

const ComposerColumn = (props: ItemTableListInnerColumn) => {
    const rowItem = props.getRowItem?.(props.rowIndex) ?? (props.data as any[])[props.rowIndex];
    const item = rowItem as Album | Song | undefined;

    const composers = item?.participants?.composer || [];

    if (composers && Array.isArray(composers) && composers.length > 0) {
        return (
            <TableColumnContainer {...props}>
                <div
                    className={clsx(styles.composersContainer, {
                        [styles.compact]: props.size === 'compact',
                        [styles.large]: props.size === 'large',
                    })}
                >
                    <JoinedArtists
                        artistName=""
                        artists={composers as RelatedArtist[]}
                        linkProps={{ fw: 400, isMuted: true }}
                        rootTextProps={{ fw: 400, isMuted: true, size: 'sm' }}
                    />
                </div>
            </TableColumnContainer>
        );
    }

    if (composers?.length === 0 || item === null || item === undefined) {
        return <ColumnNullFallback {...props} />;
    }

    return <ColumnSkeletonVariable {...props} />;
};

export const ComposerColumnMemo = memo(ComposerColumn, (prevProps, nextProps) => {
    const prevItem = prevProps.getRowItem?.(prevProps.rowIndex);
    const nextItem = nextProps.getRowItem?.(nextProps.rowIndex);

    return (
        prevProps.rowIndex === nextProps.rowIndex &&
        prevProps.columnIndex === nextProps.columnIndex &&
        prevProps.data === nextProps.data &&
        prevProps.columns === nextProps.columns &&
        prevProps.size === nextProps.size &&
        prevItem === nextItem
    );
});

export { ComposerColumnMemo as ComposerColumn };
