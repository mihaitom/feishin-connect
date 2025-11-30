import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';

import { PLAYLIST_SONG_TABLE_COLUMNS } from '/@/renderer/components/item-list/item-table-list/default-columns';
import { ContextMenuController } from '/@/renderer/features/context-menu/context-menu-controller';
import { playlistsQueries } from '/@/renderer/features/playlists/api/playlists-api';
import { ListConfigMenu } from '/@/renderer/features/shared/components/list-config-menu';
import { ListRefreshButton } from '/@/renderer/features/shared/components/list-refresh-button';
import { ListSortByDropdown } from '/@/renderer/features/shared/components/list-sort-by-dropdown';
import { ListSortOrderToggleButton } from '/@/renderer/features/shared/components/list-sort-order-toggle-button';
import { MoreButton } from '/@/renderer/features/shared/components/more-button';
import { useCurrentServerId } from '/@/renderer/store';
import { Divider } from '/@/shared/components/divider/divider';
import { Flex } from '/@/shared/components/flex/flex';
import { Group } from '/@/shared/components/group/group';
import { LibraryItem, SongListSort, SortOrder } from '/@/shared/types/domain-types';
import { ItemListKey, ListDisplayType } from '/@/shared/types/types';

export const PlaylistDetailSongListHeaderFilters = () => {
    const { playlistId } = useParams() as { playlistId: string };
    const serverId = useCurrentServerId();

    const detailQuery = useQuery(playlistsQueries.detail({ query: { id: playlistId }, serverId }));

    const handleMore = (event: React.MouseEvent<HTMLButtonElement>) => {
        if (!detailQuery.data) return;

        ContextMenuController.call({
            cmd: {
                items: [detailQuery.data],
                type: LibraryItem.PLAYLIST,
            },
            event,
        });
    };

    return (
        <Flex justify="space-between">
            <Group gap="sm" w="100%">
                <ListSortByDropdown
                    defaultSortByValue={SongListSort.ID}
                    itemType={LibraryItem.PLAYLIST_SONG}
                    listKey={ItemListKey.PLAYLIST_SONG}
                />
                <Divider orientation="vertical" />
                <ListSortOrderToggleButton
                    defaultSortOrder={SortOrder.ASC}
                    listKey={ItemListKey.PLAYLIST_SONG}
                />
                <ListRefreshButton listKey={ItemListKey.PLAYLIST_SONG} />
                <MoreButton onClick={handleMore} />
            </Group>
            <Group gap="sm" wrap="nowrap">
                <ListConfigMenu
                    displayTypes={[
                        {
                            hidden: true,
                            value: ListDisplayType.GRID,
                        },
                    ]}
                    listKey={ItemListKey.PLAYLIST_SONG}
                    tableColumnsData={PLAYLIST_SONG_TABLE_COLUMNS}
                />
            </Group>
        </Flex>
    );
};

// const GenreFilterSelection = () => {
//     const { t } = useTranslation();
//     const { playlistId } = useParams() as { playlistId: string };
//     const serverId = useCurrentServerId();

//     const { data } = useQuery(playlistsQueries.songList({ query: { id: playlistId }, serverId }));

//     const genres = useMemo(() => {
//         const uniqueGenres = new Map<string, string>();

//         data?.items.forEach((song) => {
//             song.genres.forEach((genre) => {
//                 if (genre.id) {
//                     uniqueGenres.set(genre.id, genre.name);
//                 }
//             });
//         });

//         return Array.from(uniqueGenres.entries()).map(([id, name]) => ({
//             label: name,
//             value: id,
//         }));
//     }, [data?.items]);

//     return (
//         <Stack p="md" style={{ background: 'var(--theme-colors-surface)', height: '12rem' }}>
//             <Text>{t('filter.genre', { postProcess: 'titleCase' })}</Text>
//             <ScrollArea>
//                 <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
//                     {genres.map((genre) => (
//                         <li key={genre.value}>{genre.label}</li>
//                     ))}
//                 </ul>
//             </ScrollArea>
//         </Stack>
//     );
// };

// const ArtistFilterSelection = () => {
//     const { t } = useTranslation();
//     const { playlistId } = useParams() as { playlistId: string };
//     const serverId = useCurrentServerId();

//     const { data } = useQuery(playlistsQueries.songList({ query: { id: playlistId }, serverId }));

//     const artists = useMemo(() => {
//         const uniqueArtists = new Map<string, string>();

//         data?.items.forEach((song) => {
//             song.artists.forEach((artist) => {
//                 if (artist.id) {
//                     uniqueArtists.set(artist.id, artist.name);
//                 }
//             });
//         });

//         return Array.from(uniqueArtists.entries()).map(([id, name]) => ({
//             label: name,
//             value: id,
//         }));
//     }, [data?.items]);

//     return (
//         <Stack style={{ height: '12rem' }}>
//             <Text>{t('filter.artist', { postProcess: 'titleCase' })}</Text>
//             <ScrollArea>
//                 <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
//                     {artists.map((artist) => (
//                         <li key={artist.value}>{artist.label}</li>
//                     ))}
//                 </ul>
//             </ScrollArea>
//         </Stack>
//     );
// };
