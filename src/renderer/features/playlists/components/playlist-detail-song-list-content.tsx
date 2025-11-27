import { lazy, Suspense } from 'react';
import { useParams } from 'react-router';

import { ItemListSettings, useCurrentServer, useListSettings } from '/@/renderer/store';
import { Spinner } from '/@/shared/components/spinner/spinner';
import { PlaylistSongListQuery } from '/@/shared/types/domain-types';
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

    return (
        <Suspense fallback={<Spinner container />}>
            <PlaylistDetailSongListView
                display={display}
                grid={grid}
                itemsPerPage={itemsPerPage}
                pagination={pagination}
                playlistId={playlistId}
                table={table}
            />
        </Suspense>
    );
};

export type OverridePlaylistSongListQuery = Omit<Partial<PlaylistSongListQuery>, 'id'>;

export const PlaylistDetailSongListView = ({
    display,
    playlistId,
    table,
}: ItemListSettings & {
    playlistId: string;
}) => {
    const server = useCurrentServer();

    switch (display) {
        case ListDisplayType.TABLE: {
            return (
                <PlaylistDetailSongListTable
                    autoFitColumns={table.autoFitColumns}
                    columns={table.columns}
                    enableAlternateRowColors={table.enableAlternateRowColors}
                    enableHorizontalBorders={table.enableHorizontalBorders}
                    enableRowHoverHighlight={table.enableRowHoverHighlight}
                    enableVerticalBorders={table.enableVerticalBorders}
                    playlistId={playlistId}
                    serverId={server.id}
                    size={table.size}
                />
            );
        }
        default:
            return null;
    }
};
