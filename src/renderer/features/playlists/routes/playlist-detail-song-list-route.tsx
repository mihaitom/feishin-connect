import { closeAllModals, openModal } from '@mantine/modals';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { generatePath, useNavigate, useParams } from 'react-router';

import { ItemListHandle } from '/@/renderer/components/item-list/types';
import { ListContext } from '/@/renderer/context/list-context';
import { playlistsQueries } from '/@/renderer/features/playlists/api/playlists-api';
import { PlaylistDetailSongListContent } from '/@/renderer/features/playlists/components/playlist-detail-song-list-content';
import { PlaylistDetailSongListHeader } from '/@/renderer/features/playlists/components/playlist-detail-song-list-header';
import { PlaylistQueryBuilder } from '/@/renderer/features/playlists/components/playlist-query-builder';
import { SaveAsPlaylistForm } from '/@/renderer/features/playlists/components/save-as-playlist-form';
import { useCreatePlaylist } from '/@/renderer/features/playlists/mutations/create-playlist-mutation';
import { useDeletePlaylist } from '/@/renderer/features/playlists/mutations/delete-playlist-mutation';
import { AnimatedPage } from '/@/renderer/features/shared/components/animated-page';
import { LibraryContainer } from '/@/renderer/features/shared/components/library-container';
import { PageErrorBoundary } from '/@/renderer/features/shared/components/page-error-boundary';
import { AppRoute } from '/@/renderer/router/routes';
import { useCurrentServer } from '/@/renderer/store';
import { ActionIcon } from '/@/shared/components/action-icon/action-icon';
import { Box } from '/@/shared/components/box/box';
import { Group } from '/@/shared/components/group/group';
import { Text } from '/@/shared/components/text/text';
import { toast } from '/@/shared/components/toast/toast';
import { ServerType, SongListSort } from '/@/shared/types/domain-types';
import { ItemListKey, Play } from '/@/shared/types/types';

const PlaylistDetailSongListRoute = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const tableRef = useRef<ItemListHandle | null>(null);
    const { playlistId } = useParams() as { playlistId: string };
    const server = useCurrentServer();

    const detailQuery = useQuery(
        playlistsQueries.detail({ query: { id: playlistId }, serverId: server?.id }),
    );
    const createPlaylistMutation = useCreatePlaylist({});
    const deletePlaylistMutation = useDeletePlaylist({});

    const handleSave = (
        filter: Record<string, any>,
        extraFilters: { limit?: number; sortBy?: string; sortOrder?: string },
    ) => {
        const rules = {
            ...filter,
            limit: extraFilters.limit || undefined,
            order: extraFilters.sortOrder || 'desc',
            sort: extraFilters.sortBy || 'dateAdded',
        };

        if (!detailQuery?.data) return;

        createPlaylistMutation.mutate(
            {
                apiClientProps: { serverId: detailQuery?.data?._serverId },
                body: {
                    _custom: {
                        navidrome: {
                            owner: detailQuery?.data?.owner || '',
                            ownerId: detailQuery?.data?.ownerId || '',
                            rules,
                            sync: detailQuery?.data?.sync || false,
                        },
                    },
                    comment: detailQuery?.data?.description || '',
                    name: detailQuery?.data?.name,
                    public: detailQuery?.data?.public || false,
                },
            },
            {
                onSuccess: (data) => {
                    toast.success({ message: 'Playlist has been saved' });
                    navigate(
                        generatePath(AppRoute.PLAYLISTS_DETAIL_SONGS, {
                            playlistId: data?.id || '',
                        }),
                        {
                            replace: true,
                        },
                    );
                    deletePlaylistMutation.mutate({
                        apiClientProps: { serverId: detailQuery?.data?._serverId },
                        query: { id: playlistId },
                    });
                },
            },
        );
    };

    const handleSaveAs = (
        filter: Record<string, any>,
        extraFilters: { limit?: number; sortBy?: string; sortOrder?: string },
    ) => {
        openModal({
            children: (
                <SaveAsPlaylistForm
                    body={{
                        _custom: {
                            navidrome: {
                                owner: detailQuery?.data?.owner || '',
                                ownerId: detailQuery?.data?.ownerId || '',
                                rules: {
                                    ...filter,
                                    limit: extraFilters.limit || undefined,
                                    order: extraFilters.sortOrder || 'desc',
                                    sort: extraFilters.sortBy || 'dateAdded',
                                },
                                sync: detailQuery?.data?.sync || false,
                            },
                        },
                        comment: detailQuery?.data?.description || '',
                        name: detailQuery?.data?.name,
                        public: detailQuery?.data?.public || false,
                    }}
                    onCancel={closeAllModals}
                    onSuccess={(data) =>
                        navigate(
                            generatePath(AppRoute.PLAYLISTS_DETAIL_SONGS, {
                                playlistId: data?.id || '',
                            }),
                        )
                    }
                    serverId={detailQuery?.data?._serverId || ''}
                />
            ),
            title: t('common.saveAs', { postProcess: 'sentenceCase' }),
        });
    };

    const isSmartPlaylist =
        !detailQuery?.isLoading &&
        detailQuery?.data?.rules &&
        server?.type === ServerType.NAVIDROME;

    const [showQueryBuilder, setShowQueryBuilder] = useState(false);
    const [isQueryBuilderExpanded, setIsQueryBuilderExpanded] = useState(false);

    const handleToggleExpand = () => {
        setIsQueryBuilderExpanded((prev) => !prev);
    };

    const handleToggleShowQueryBuilder = () => {
        setShowQueryBuilder((prev) => !prev);
        setIsQueryBuilderExpanded(true);
    };

    const playlistSongs = useQuery(
        playlistsQueries.songList({
            query: {
                id: playlistId,
            },
            serverId: server?.id,
        }),
    );

    const [itemCount, setItemCount] = useState<number | undefined>(undefined);

    const handlePlay = (_play: Play) => {
        // handlePlayQueueAdd?.({
        //     byData: filterSortedSongs,
        //     playType: play,
        // });
    };

    const providerValue = useMemo(() => {
        return {
            customFilters: undefined,
            id: playlistId,
            itemCount,
            pageKey: ItemListKey.PLAYLIST_SONG,
            setItemCount,
        };
    }, [playlistId, itemCount]);

    // Update item count when playlist songs are loaded
    useEffect(() => {
        if (
            playlistSongs.data?.totalRecordCount !== undefined &&
            playlistSongs.data.totalRecordCount !== null
        ) {
            setItemCount(playlistSongs.data.totalRecordCount);
        }
    }, [playlistSongs.data?.totalRecordCount]);

    return (
        <AnimatedPage key={`playlist-detail-songList-${playlistId}`}>
            <ListContext.Provider value={providerValue}>
                <LibraryContainer>
                    <PlaylistDetailSongListHeader
                        handlePlay={handlePlay}
                        handleToggleShowQueryBuilder={handleToggleShowQueryBuilder}
                        itemCount={itemCount}
                        tableRef={tableRef}
                    />

                    {(isSmartPlaylist || showQueryBuilder) && (
                        <motion.div>
                            <Box h="100%" mah="35vh" p="md" w="100%">
                                <Group pb="md">
                                    <ActionIcon
                                        icon={isQueryBuilderExpanded ? 'arrowUpS' : 'arrowDownS'}
                                        iconProps={{
                                            size: 'md',
                                        }}
                                        onClick={handleToggleExpand}
                                        size="xs"
                                    />
                                    <Text>
                                        {t('form.queryEditor.title', { postProcess: 'titleCase' })}
                                    </Text>
                                </Group>
                                {isQueryBuilderExpanded && (
                                    <PlaylistQueryBuilder
                                        isSaving={createPlaylistMutation?.isPending}
                                        key={JSON.stringify(detailQuery?.data?.rules)}
                                        limit={detailQuery?.data?.rules?.limit}
                                        onSave={handleSave}
                                        onSaveAs={handleSaveAs}
                                        playlistId={playlistId}
                                        query={detailQuery?.data?.rules}
                                        sortBy={
                                            detailQuery?.data?.rules?.sort || SongListSort.ALBUM
                                        }
                                        sortOrder={detailQuery?.data?.rules?.order || 'asc'}
                                    />
                                )}
                            </Box>
                        </motion.div>
                    )}
                    <PlaylistDetailSongListContent />
                </LibraryContainer>
            </ListContext.Provider>
        </AnimatedPage>
    );
};

const PlaylistDetailSongListRouteWithBoundary = () => {
    return (
        <PageErrorBoundary>
            <PlaylistDetailSongListRoute />
        </PageErrorBoundary>
    );
};

export default PlaylistDetailSongListRouteWithBoundary;
