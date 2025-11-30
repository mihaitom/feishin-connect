import { useSuspenseQuery } from '@tanstack/react-query';
import { lazy, Suspense, useEffect } from 'react';
import { useParams } from 'react-router';

import { useListContext } from '/@/renderer/context/list-context';
import { playlistsQueries } from '/@/renderer/features/playlists/api/playlists-api';
import { ItemListSettings, useCurrentServer, useListSettings } from '/@/renderer/store';
import { Spinner } from '/@/shared/components/spinner/spinner';
import { PlaylistSongListQuery, PlaylistSongListResponse } from '/@/shared/types/domain-types';
import { ItemListKey, ListDisplayType } from '/@/shared/types/types';

const PlaylistDetailSongListTable = lazy(() =>
    import('/@/renderer/features/playlists/components/playlist-detail-song-list-table').then(
        (module) => ({
            default: module.PlaylistDetailSongListTable,
        }),
    ),
);

export const PlaylistDetailSongListContent = () => {
    const { display, grid, itemsPerPage, pagination, table } = useListSettings(
        ItemListKey.PLAYLIST_SONG,
    );
    const { playlistId } = useParams() as { playlistId: string };
    const server = useCurrentServer();
    const { setItemCount } = useListContext();

    const playlistSongsQuery = useSuspenseQuery(
        playlistsQueries.songList({
            query: {
                id: playlistId,
            },
            serverId: server?.id,
        }),
    );

    useEffect(() => {
        if (
            playlistSongsQuery.data?.totalRecordCount !== undefined &&
            playlistSongsQuery.data.totalRecordCount !== null
        ) {
            setItemCount?.(playlistSongsQuery.data.totalRecordCount);
        }
    }, [playlistSongsQuery.data?.totalRecordCount, setItemCount]);

    return (
        <Suspense fallback={<Spinner container />}>
            <PlaylistDetailSongListView
                data={playlistSongsQuery.data}
                display={display}
                grid={grid}
                itemsPerPage={itemsPerPage}
                pagination={pagination}
                table={table}
            />
        </Suspense>
    );
};

export type OverridePlaylistSongListQuery = Omit<Partial<PlaylistSongListQuery>, 'id'>;

export const PlaylistDetailSongListView = ({
    data,
    display,
    table,
}: ItemListSettings & {
    data: PlaylistSongListResponse;
}) => {
    const server = useCurrentServer();

    switch (display) {
        case ListDisplayType.TABLE: {
            return (
                <PlaylistDetailSongListTable
                    autoFitColumns={table.autoFitColumns}
                    columns={table.columns}
                    data={data}
                    enableAlternateRowColors={table.enableAlternateRowColors}
                    enableHorizontalBorders={table.enableHorizontalBorders}
                    enableRowHoverHighlight={table.enableRowHoverHighlight}
                    enableVerticalBorders={table.enableVerticalBorders}
                    serverId={server.id}
                    size={table.size}
                />
            );
        }
        default:
            return null;
    }
};
