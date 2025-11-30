import { forwardRef, useMemo } from 'react';

import { useItemListColumnReorder } from '/@/renderer/components/item-list/helpers/use-item-list-column-reorder';
import { useItemListColumnResize } from '/@/renderer/components/item-list/helpers/use-item-list-column-resize';
import { useItemListScrollPersist } from '/@/renderer/components/item-list/helpers/use-item-list-scroll-persist';
import { ItemTableList } from '/@/renderer/components/item-list/item-table-list/item-table-list';
import { ItemTableListColumn } from '/@/renderer/components/item-list/item-table-list/item-table-list-column';
import { ItemControls, ItemListTableComponentProps } from '/@/renderer/components/item-list/types';
import { usePlayer } from '/@/renderer/features/player/context/player-context';
import { usePlaylistSongListFilters } from '/@/renderer/features/playlists/hooks/use-playlist-song-list-filters';
import { useSearchTermFilter } from '/@/renderer/features/shared/hooks/use-search-term-filter';
import { searchLibraryItems } from '/@/renderer/features/shared/utils';
import { usePlayerSong } from '/@/renderer/store';
import { sortSongList } from '/@/shared/api/utils';
import {
    LibraryItem,
    PlaylistSongListQuery,
    PlaylistSongListResponse,
    Song,
} from '/@/shared/types/domain-types';
import { ItemListKey, Play } from '/@/shared/types/types';

interface PlaylistDetailSongListTableProps
    extends Omit<ItemListTableComponentProps<PlaylistSongListQuery>, 'query'> {
    data: PlaylistSongListResponse;
}

export const PlaylistDetailSongListTable = forwardRef<any, PlaylistDetailSongListTableProps>(
    (
        {
            autoFitColumns = false,
            columns,
            data,
            enableAlternateRowColors = false,
            enableHorizontalBorders = false,
            enableRowHoverHighlight = true,
            enableSelection = true,
            enableVerticalBorders = false,
            saveScrollOffset = true,
            size = 'default',
        },
        ref,
    ) => {
        const { handleOnScrollEnd, scrollOffset } = useItemListScrollPersist({
            enabled: saveScrollOffset,
        });

        const { handleColumnReordered } = useItemListColumnReorder({
            itemListKey: ItemListKey.PLAYLIST_SONG,
        });

        const { handleColumnResized } = useItemListColumnResize({
            itemListKey: ItemListKey.PLAYLIST_SONG,
        });

        const { searchTerm } = useSearchTermFilter();
        const { query } = usePlaylistSongListFilters();

        const filterSortedSongs = useMemo(() => {
            let items = data?.items || [];

            if (searchTerm) {
                if (searchTerm) {
                    items = searchLibraryItems(items, searchTerm, LibraryItem.SONG);
                }

                return sortSongList(items, query.sortBy, query.sortOrder);
            }

            return sortSongList(items, query.sortBy, query.sortOrder);
        }, [data?.items, searchTerm, query.sortBy, query.sortOrder]);

        const player = usePlayer();

        const currentSong = usePlayerSong();

        const overrideControls: Partial<ItemControls> = useMemo(() => {
            return {
                onDoubleClick: ({ index, internalState, item }) => {
                    if (!item) {
                        return;
                    }

                    const items = internalState?.getData() as Song[];

                    if (index !== undefined) {
                        player.addToQueueByData(items, Play.NOW);
                        player.mediaPlayByIndex(index);
                    }
                },
            };
        }, [player]);

        return (
            <ItemTableList
                activeRowId={currentSong?.id}
                autoFitColumns={autoFitColumns}
                CellComponent={ItemTableListColumn}
                columns={columns}
                data={filterSortedSongs}
                enableAlternateRowColors={enableAlternateRowColors}
                enableExpansion={false}
                enableHorizontalBorders={enableHorizontalBorders}
                enableRowHoverHighlight={enableRowHoverHighlight}
                enableSelection={enableSelection}
                enableVerticalBorders={enableVerticalBorders}
                getRowId="playlistItemId"
                initialTop={{
                    to: scrollOffset ?? 0,
                    type: 'offset',
                }}
                itemType={LibraryItem.PLAYLIST_SONG}
                onColumnReordered={handleColumnReordered}
                onColumnResized={handleColumnResized}
                onScrollEnd={handleOnScrollEnd}
                overrideControls={overrideControls}
                ref={ref}
                size={size}
            />
        );
    },
);
