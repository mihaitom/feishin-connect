import { closeAllModals, openModal } from '@mantine/modals';
import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';

import i18n from '/@/i18n/i18n';
import { PLAYLIST_SONG_TABLE_COLUMNS } from '/@/renderer/components/item-list/item-table-list/default-columns';
import { playlistsQueries } from '/@/renderer/features/playlists/api/playlists-api';
import { useDeletePlaylist } from '/@/renderer/features/playlists/mutations/delete-playlist-mutation';
import { ListConfigMenu } from '/@/renderer/features/shared/components/list-config-menu';
import { ListRefreshButton } from '/@/renderer/features/shared/components/list-refresh-button';
import { ListSortByDropdown } from '/@/renderer/features/shared/components/list-sort-by-dropdown';
import { ListSortOrderToggleButton } from '/@/renderer/features/shared/components/list-sort-order-toggle-button';
import { useContainerQuery } from '/@/renderer/hooks';
import { AppRoute } from '/@/renderer/router/routes';
import { useCurrentServerId } from '/@/renderer/store';
import { Divider } from '/@/shared/components/divider/divider';
import { Flex } from '/@/shared/components/flex/flex';
import { Group } from '/@/shared/components/group/group';
import { ConfirmModal } from '/@/shared/components/modal/modal';
import { Text } from '/@/shared/components/text/text';
import { toast } from '/@/shared/components/toast/toast';
import { LibraryItem, SongListSort, SortOrder } from '/@/shared/types/domain-types';
import { ItemListKey, Play } from '/@/shared/types/types';

export const PlaylistDetailSongListHeaderFilters = () => {
    const { t } = useTranslation();
    const { playlistId } = useParams() as { playlistId: string };
    const serverId = useCurrentServerId();

    const navigate = useNavigate();

    const detailQuery = useQuery(playlistsQueries.detail({ query: { id: playlistId }, serverId }));

    const isSmartPlaylist = detailQuery.data?.rules;

    const { ref, ...cq } = useContainerQuery();

    const deletePlaylistMutation = useDeletePlaylist({});

    const handleDeletePlaylist = useCallback(() => {
        if (!detailQuery.data) return;
        deletePlaylistMutation?.mutate(
            {
                apiClientProps: { serverId: detailQuery.data._serverId },
                query: { id: detailQuery.data.id },
            },
            {
                onError: (err) => {
                    toast.error({
                        message: err.message,
                        title: t('error.genericError', { postProcess: 'sentenceCase' }),
                    });
                },
                onSuccess: () => {
                    navigate(AppRoute.PLAYLISTS, { replace: true });
                },
            },
        );
        closeAllModals();
    }, [deletePlaylistMutation, detailQuery.data, navigate, t]);

    const openDeletePlaylistModal = () => {
        openModal({
            children: (
                <ConfirmModal onConfirm={handleDeletePlaylist}>
                    <Text>Are you sure you want to delete this playlist?</Text>
                </ConfirmModal>
            ),
            title: t('form.deletePlaylist.title', { postProcess: 'sentenceCase' }),
        });
    };

    return (
        <Flex justify="space-between">
            <Group gap="sm" ref={ref} w="100%">
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
            </Group>
            <Group gap="sm" wrap="nowrap">
                <ListConfigMenu
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
