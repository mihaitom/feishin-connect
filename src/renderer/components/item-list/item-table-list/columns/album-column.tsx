import clsx from 'clsx';
import { useMemo } from 'react';
import { generatePath, Link } from 'react-router';

import styles from './album-column.module.css';

import {
    ColumnNullFallback,
    ColumnSkeletonVariable,
    ItemTableListInnerColumn,
    TableColumnContainer,
} from '/@/renderer/components/item-list/item-table-list/item-table-list-column';
import { AppRoute } from '/@/renderer/router/routes';
import { Text } from '/@/shared/components/text/text';
import { Song } from '/@/shared/types/domain-types';

const AlbumColumn = (props: ItemTableListInnerColumn) => {
    const rowItem = props.getRowItem?.(props.rowIndex) ?? (props.data as any[])[props.rowIndex];
    const row: null | string | undefined = rowItem?.[props.columns[props.columnIndex].id];

    const song = rowItem as Song | undefined;
    const albumId = song?.albumId;

    const albumPath = useMemo(() => {
        if (!albumId) return null;
        return generatePath(AppRoute.LIBRARY_ALBUMS_DETAIL, { albumId });
    }, [albumId]);

    if (typeof row === 'string') {
        if (albumId && albumPath) {
            return (
                <TableColumnContainer {...props}>
                    <div
                        className={clsx(styles.albumContainer, {
                            [styles.compact]: props.size === 'compact',
                            [styles.large]: props.size === 'large',
                        })}
                    >
                        <Text
                            className={styles.albumLink}
                            component={Link}
                            isLink
                            isMuted
                            isNoSelect
                            state={{ item: song }}
                            to={albumPath}
                        >
                            {row}
                        </Text>
                    </div>
                </TableColumnContainer>
            );
        }

        return (
            <TableColumnContainer {...props}>
                <Text
                    className={clsx(styles.albumContainer, {
                        [styles.compact]: props.size === 'compact',
                        [styles.large]: props.size === 'large',
                    })}
                    isMuted
                    isNoSelect
                >
                    {row}
                </Text>
            </TableColumnContainer>
        );
    }

    if (row === null) {
        return <ColumnNullFallback {...props} />;
    }

    return <ColumnSkeletonVariable {...props} />;
};

export { AlbumColumn };
