import clsx from 'clsx';
import { CSSProperties, useMemo } from 'react';
import { generatePath, Link } from 'react-router';

import styles from './title-combined-column.module.css';

import { getTitlePath } from '/@/renderer/components/item-list/helpers/get-title-path';
import {
    ColumnNullFallback,
    ColumnSkeletonVariable,
    ItemTableListInnerColumn,
    TableColumnContainer,
} from '/@/renderer/components/item-list/item-table-list/item-table-list-column';
import { AppRoute } from '/@/renderer/router/routes';
import { Image } from '/@/shared/components/image/image';
import { Text } from '/@/shared/components/text/text';
import { LibraryItem, QueueSong, RelatedAlbumArtist } from '/@/shared/types/domain-types';

export const DefaultTitleCombinedColumn = (props: ItemTableListInnerColumn) => {
    const row: object | undefined = (props.data as (any | undefined)[])[props.rowIndex];

    const artists = useMemo(() => {
        if (row && 'artists' in row && Array.isArray(row.artists)) {
            return (row.artists as RelatedAlbumArtist[]).map((artist) => {
                const path = generatePath(AppRoute.LIBRARY_ARTISTS_DETAIL, {
                    artistId: artist.id,
                });
                return { ...artist, path };
            });
        }
        return [];
    }, [row]);

    if (row && 'name' in row && 'imageUrl' in row && 'artists' in row) {
        const rowHeight = props.getRowHeight(props.rowIndex, props);
        const path = getTitlePath(props.itemType, (props.data[props.rowIndex] as any).id as string);

        const item = props.data[props.rowIndex] as any;
        const titleLinkProps = path
            ? {
                  component: Link,
                  isLink: true,
                  state: { item },
                  to: path,
              }
            : {};

        return (
            <TableColumnContainer
                className={styles.titleCombined}
                containerStyle={{ '--row-height': `${rowHeight}px` } as CSSProperties}
                {...props}
            >
                <Image containerClassName={styles.image} src={row.imageUrl as string} />
                <div className={styles.textContainer}>
                    <Text className={styles.title} isNoSelect size="md" {...titleLinkProps}>
                        {row.name as string}
                    </Text>
                    <div className={styles.artists}>
                        {artists.map((artist, index) => (
                            <span key={artist.id}>
                                <Text
                                    component={Link}
                                    isLink
                                    isMuted
                                    isNoSelect
                                    size="sm"
                                    state={{ item: artist }}
                                    to={artist.path}
                                >
                                    {artist.name}
                                </Text>
                                {index < artists.length - 1 && ', '}
                            </span>
                        ))}
                    </div>
                </div>
            </TableColumnContainer>
        );
    }

    if (row === null) {
        return <ColumnNullFallback {...props} />;
    }

    return <ColumnSkeletonVariable {...props} />;
};

export const QueueSongTitleCombinedColumn = (props: ItemTableListInnerColumn) => {
    const row: object | undefined = (props.data as (any | undefined)[])[props.rowIndex];

    const song = props.data[props.rowIndex] as QueueSong;
    const isActive =
        !!props.activeRowId &&
        (props.activeRowId === song?.id || props.activeRowId === song?._uniqueId);

    const artists = useMemo(() => {
        if (row && 'artists' in row && Array.isArray(row.artists)) {
            return (row.artists as RelatedAlbumArtist[]).map((artist) => {
                const path = generatePath(AppRoute.LIBRARY_ARTISTS_DETAIL, {
                    artistId: artist.id,
                });
                return { ...artist, path };
            });
        }
        return [];
    }, [row]);

    if (row && 'name' in row && 'imageUrl' in row && 'artists' in row) {
        const rowHeight = props.getRowHeight(props.rowIndex, props);
        const path = getTitlePath(props.itemType, (props.data[props.rowIndex] as any).id as string);

        const item = props.data[props.rowIndex] as any;
        const textStyles = isActive ? { color: 'var(--theme-colors-primary)' } : {};

        const titleLinkProps = path
            ? {
                  component: Link,
                  isLink: true,
                  state: { item },
                  to: path,
              }
            : {};

        return (
            <TableColumnContainer
                className={styles.titleCombined}
                containerStyle={{ '--row-height': `${rowHeight}px` } as CSSProperties}
                {...props}
            >
                <Image containerClassName={styles.image} src={row.imageUrl as string} />
                <div
                    className={clsx(styles.textContainer, {
                        [styles.compact]: props.size === 'compact',
                    })}
                >
                    <Text
                        className={styles.title}
                        isNoSelect
                        size="md"
                        {...titleLinkProps}
                        style={textStyles}
                    >
                        {row.name as string}
                    </Text>
                    <div className={styles.artists}>
                        {artists.map((artist, index) => (
                            <span key={artist.id}>
                                <Text
                                    component={Link}
                                    isLink
                                    isMuted
                                    isNoSelect
                                    size="sm"
                                    state={{ item: artist }}
                                    to={artist.path}
                                >
                                    {artist.name}
                                </Text>
                                {index < artists.length - 1 && ', '}
                            </span>
                        ))}
                    </div>
                </div>
            </TableColumnContainer>
        );
    }

    if (row === null) {
        return <ColumnNullFallback {...props} />;
    }

    return <ColumnSkeletonVariable {...props} />;
};

export const TitleCombinedColumn = (props: ItemTableListInnerColumn) => {
    const { itemType } = props;

    switch (itemType) {
        case LibraryItem.PLAYLIST_SONG:
        case LibraryItem.QUEUE_SONG:
        case LibraryItem.SONG:
            return <QueueSongTitleCombinedColumn {...props} />;
        default:
            return <DefaultTitleCombinedColumn {...props} />;
    }
};
