import clsx from 'clsx';
import { memo } from 'react';

import styles from './album-artists-column.module.css';

import {
    ColumnNullFallback,
    ColumnSkeletonVariable,
    ItemTableListInnerColumn,
    TableColumnContainer,
} from '/@/renderer/components/item-list/item-table-list/item-table-list-column';
import { JoinedArtists } from '/@/renderer/features/albums/components/joined-artists';
import { Album, RelatedAlbumArtist, Song } from '/@/shared/types/domain-types';

const AlbumArtistsColumn = (props: ItemTableListInnerColumn) => {
    const rowItem = props.getRowItem?.(props.rowIndex) ?? (props.data as any[])[props.rowIndex];
    const row: RelatedAlbumArtist[] | undefined = rowItem?.[props.columns[props.columnIndex].id];

    const item = rowItem as Album | Song | undefined;
    const albumArtistString = item && 'albumArtistName' in item ? item.albumArtistName : '';

    if (Array.isArray(row)) {
        return (
            <TableColumnContainer {...props}>
                <div
                    className={clsx(styles.artistsContainer, {
                        [styles.compact]: props.size === 'compact',
                        [styles.large]: props.size === 'large',
                    })}
                >
                    <JoinedArtists
                        artistName={albumArtistString}
                        artists={row}
                        linkProps={{ fw: 400, isMuted: true }}
                        rootTextProps={{
                            className: clsx(styles.artistsContainer, {
                                [styles.compact]: props.size === 'compact',
                                [styles.large]: props.size === 'large',
                            }),
                            fw: 400,
                            isMuted: true,
                            size: 'sm',
                        }}
                    />
                </div>
            </TableColumnContainer>
        );
    }

    if (row === null) {
        return <ColumnNullFallback {...props} />;
    }

    return <ColumnSkeletonVariable {...props} />;
};

export const AlbumArtistsColumnMemo = memo(AlbumArtistsColumn, (prevProps, nextProps) => {
    return (
        prevProps.rowIndex === nextProps.rowIndex &&
        prevProps.columnIndex === nextProps.columnIndex &&
        prevProps.data === nextProps.data &&
        prevProps.columns === nextProps.columns &&
        prevProps.size === nextProps.size
    );
});

export { AlbumArtistsColumnMemo as AlbumArtistsColumn };
