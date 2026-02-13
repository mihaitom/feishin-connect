import { closeAllModals, openModal } from '@mantine/modals';
import { useQuery } from '@tanstack/react-query';
import { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { generatePath, useLocation, useNavigate, useParams } from 'react-router';

import { ListContext, useListContext } from '/@/renderer/context/list-context';
import { playlistsQueries } from '/@/renderer/features/playlists/api/playlists-api';
import { ClientSideSongFilters } from '/@/renderer/features/playlists/components/client-side-song-filters';
import { PlaylistDetailSongListContent } from '/@/renderer/features/playlists/components/playlist-detail-song-list-content';
import { PlaylistDetailSongListHeader } from '/@/renderer/features/playlists/components/playlist-detail-song-list-header';
import {
    PlaylistQueryBuilder,
    PlaylistQueryBuilderRef,
} from '/@/renderer/features/playlists/components/playlist-query-builder';
import { SaveAsPlaylistForm } from '/@/renderer/features/playlists/components/save-as-playlist-form';
import { usePlaylistSongListFilters } from '/@/renderer/features/playlists/hooks/use-playlist-song-list-filters';
import { useCreatePlaylist } from '/@/renderer/features/playlists/mutations/create-playlist-mutation';
import { useDeletePlaylist } from '/@/renderer/features/playlists/mutations/delete-playlist-mutation';
import { convertQueryGroupToNDQuery } from '/@/renderer/features/playlists/utils';
import { AnimatedPage } from '/@/renderer/features/shared/components/animated-page';
import { JsonPreview } from '/@/renderer/features/shared/components/json-preview';
import { ListWithSidebarContainer } from '/@/renderer/features/shared/components/list-with-sidebar-container';
import { PageErrorBoundary } from '/@/renderer/features/shared/components/page-error-boundary';
import { AppRoute } from '/@/renderer/router/routes';
import {
    PlaylistTarget,
    useCurrentServer,
    usePageSidebar,
    usePlaylistTarget,
} from '/@/renderer/store';
import { ActionIcon } from '/@/shared/components/action-icon/action-icon';
import { Button } from '/@/shared/components/button/button';
import { Group } from '/@/shared/components/group/group';
import { Icon } from '/@/shared/components/icon/icon';
import { ConfirmModal } from '/@/shared/components/modal/modal';
import { ScrollArea } from '/@/shared/components/scroll-area/scroll-area';
import { Spinner } from '/@/shared/components/spinner/spinner';
import { Stack } from '/@/shared/components/stack/stack';
import { Text } from '/@/shared/components/text/text';
import { toast } from '/@/shared/components/toast/toast';
import { LibraryItem, ServerType, SongListSort } from '/@/shared/types/domain-types';
import { ItemListKey } from '/@/shared/types/types';

interface PlaylistQueryEditorProps {
    createPlaylistMutation: ReturnType<typeof useCreatePlaylist>;
    detailQuery: ReturnType<typeof useQuery<any>>;
    handleSave: (
        filter: Record<string, any>,
        extraFilters: { limit?: number; sortBy?: string[]; sortOrder?: string },
    ) => void;
    handleSaveAs: (
        filter: Record<string, any>,
        extraFilters: { limit?: number; sortBy?: string[]; sortOrder?: string },
    ) => void;
    isQueryBuilderExpanded: boolean;
    onToggleExpand: () => void;
    playlistId: string;
    queryBuilderRef: React.RefObject<null | PlaylistQueryBuilderRef>;
}

const PlaylistQueryEditor = ({
    createPlaylistMutation,
    detailQuery,
    handleSave,
    handleSaveAs,
    isQueryBuilderExpanded,
    onToggleExpand,
    playlistId,
    queryBuilderRef,
}: PlaylistQueryEditorProps) => {
    const { t } = useTranslation();

    const openPreviewModal = useCallback(() => {
        const filters = queryBuilderRef.current?.getFilters();

        if (!filters) {
            return;
        }

        const queryValue = convertQueryGroupToNDQuery(filters.filters);
        const sortString = filters.extraFilters.sortBy?.[0];

        const previewValue = {
            ...queryValue,
            ...(filters.extraFilters.limit && { limit: filters.extraFilters.limit }),
            ...(sortString && { sort: sortString }),
        };

        openModal({
            children: <JsonPreview value={previewValue} />,
            size: 'xl',
            title: t('common.preview', { postProcess: 'titleCase' }),
        });
    }, [queryBuilderRef, t]);

    const openSaveAndReplaceModal = useCallback(() => {
        if (!isQueryBuilderExpanded) {
            return;
        }

        const filters = queryBuilderRef.current?.getFilters();

        if (!filters) {
            return;
        }

        openModal({
            children: (
                <ConfirmModal
                    onConfirm={() => {
                        handleSave(
                            convertQueryGroupToNDQuery(filters.filters),
                            filters.extraFilters,
                        );
                        closeAllModals();
                    }}
                >
                    <Text>{t('common.areYouSure', { postProcess: 'sentenceCase' })}</Text>
                </ConfirmModal>
            ),
            title: t('common.saveAndReplace', { postProcess: 'sentenceCase' }),
        });
    }, [isQueryBuilderExpanded, queryBuilderRef, handleSave, t]);

    const parseSortBy = useCallback((): string[] => {
        const sort = detailQuery?.data?.rules?.sort;
        // Handle new syntax: comma-separated with +/- prefix
        // e.g., "+album,-year" -> return as single string in array
        if (typeof sort === 'string') {
            // Check if it's new syntax (has +/- prefix or commas)
            if (sort.includes(',') || sort.startsWith('+') || sort.startsWith('-')) {
                return [sort];
            }
            // Old syntax: single field, convert to new format with default order
            const order = detailQuery?.data?.rules?.order || 'asc';
            const prefix = order === 'desc' ? '-' : '+';
            return [`${prefix}${sort}`];
        }
        if (Array.isArray(sort)) {
            // If array, check if first item has +/- prefix
            if (
                sort.length > 0 &&
                typeof sort[0] === 'string' &&
                (sort[0].startsWith('+') || sort[0].startsWith('-'))
            ) {
                return sort;
            }
            // Old array format, convert to new format
            const order = detailQuery?.data?.rules?.order || 'asc';
            const prefix = order === 'desc' ? '-' : '+';
            return sort.map((s) => `${prefix}${s}`);
        }
        return ['+dateAdded'];
    }, [detailQuery?.data?.rules?.order, detailQuery?.data?.rules?.sort]);

    const parseSortOrder = useCallback((): 'asc' | 'desc' => {
        const sort = detailQuery?.data?.rules?.sort;
        if (typeof sort === 'string' && sort.startsWith('-')) {
            return 'desc';
        }
        // Fall back to old order field or default
        return detailQuery?.data?.rules?.order || 'asc';
    }, [detailQuery?.data?.rules?.order, detailQuery?.data?.rules?.sort]);

    return (
        <div
            className="query-editor-container"
            style={{ borderTop: '1px solid var(--theme-colors-border)' }}
        >
            <Stack gap={0} h="100%" mah="30dvh" p="sm" w="100%">
                <Group justify="space-between" wrap="nowrap">
                    <Group gap="sm" wrap="nowrap">
                        <Button
                            leftSection={
                                <Icon
                                    icon={isQueryBuilderExpanded ? 'arrowDownS' : 'arrowUpS'}
                                    size="lg"
                                />
                            }
                            onClick={onToggleExpand}
                            size="sm"
                            variant="subtle"
                        >
                            {t('form.queryEditor.title', {
                                postProcess: 'titleCase',
                            })}
                        </Button>
                    </Group>
                    <Group gap="xs">
                        <Button onClick={openPreviewModal} size="sm" variant="subtle">
                            {t('common.preview', { postProcess: 'titleCase' })}
                        </Button>
                        <Button
                            disabled={!isQueryBuilderExpanded}
                            leftSection={<Icon icon="save" />}
                            loading={createPlaylistMutation?.isPending}
                            onClick={() => {
                                if (!isQueryBuilderExpanded) return;
                                const filters = queryBuilderRef.current?.getFilters();
                                if (filters) {
                                    handleSaveAs(
                                        convertQueryGroupToNDQuery(filters.filters),
                                        filters.extraFilters,
                                    );
                                }
                            }}
                            size="sm"
                            variant="subtle"
                        >
                            {t('common.saveAs', { postProcess: 'titleCase' })}
                        </Button>
                        <Button
                            disabled={!isQueryBuilderExpanded}
                            leftSection={<Icon color="error" icon="save" />}
                            onClick={openSaveAndReplaceModal}
                            size="sm"
                            variant="subtle"
                        >
                            {t('common.saveAndReplace', {
                                postProcess: 'titleCase',
                            })}
                        </Button>
                    </Group>
                </Group>
                <div
                    style={{
                        display: isQueryBuilderExpanded ? 'flex' : 'none',
                        flex: 1,
                        minHeight: 0,
                        overflow: 'hidden',
                    }}
                >
                    <PlaylistQueryBuilder
                        key={JSON.stringify(detailQuery?.data?.rules)}
                        limit={detailQuery?.data?.rules?.limit}
                        playlistId={playlistId}
                        query={detailQuery?.data?.rules}
                        ref={queryBuilderRef}
                        sortBy={parseSortBy() as SongListSort | SongListSort[]}
                        sortOrder={parseSortOrder()}
                    />
                </div>
            </Stack>
        </div>
    );
};

const PlaylistSongListFiltersSidebar = () => {
    const { t } = useTranslation();
    const { setIsSidebarOpen } = useListContext();
    const { clear } = usePlaylistSongListFilters();

    return (
        <Stack h="100%" style={{ minHeight: 0 }}>
            <Group justify="space-between" pb={0} pl="md" pr="md" pt="md">
                <Text fw={500} size="xl">
                    {t('common.filters', { postProcess: 'sentenceCase' })}
                </Text>
                <Group gap="xs">
                    <Button onClick={clear} size="compact-sm" variant="subtle">
                        {t('common.reset', { postProcess: 'sentenceCase' })}
                    </Button>
                    {setIsSidebarOpen && (
                        <ActionIcon
                            icon="unpin"
                            onClick={() => setIsSidebarOpen(false)}
                            size="compact-sm"
                            variant="subtle"
                        />
                    )}
                </Group>
            </Group>
            <ScrollArea style={{ flex: 1, minHeight: 0 }}>
                <ClientSideSongFilters />
            </ScrollArea>
        </Stack>
    );
};

const PlaylistDetailSongListRoute = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { playlistId } = useParams() as { playlistId: string };
    const server = useCurrentServer();

    const detailQuery = useQuery({
        ...playlistsQueries.detail({ query: { id: playlistId }, serverId: server?.id }),
        placeholderData: location.state?.item,
    });
    const createPlaylistMutation = useCreatePlaylist({});
    const deletePlaylistMutation = useDeletePlaylist({});

    const handleSave = (
        filter: Record<string, any>,
        extraFilters: { limit?: number; sortBy?: string[]; sortOrder?: string },
    ) => {
        if (!detailQuery?.data) return;

        // New syntax: sortBy is now a single string with comma-separated fields and +/- prefix
        // e.g., "+album,-year" means sort by album ascending, then year descending
        const sortValue =
            extraFilters.sortBy && extraFilters.sortBy.length > 0
                ? extraFilters.sortBy[0]
                : '+dateAdded';

        const rules = {
            ...filter,
            limit: extraFilters.limit || undefined,
            // order field is now optional - sort direction is embedded in sort field
            sort: sortValue,
        };

        createPlaylistMutation.mutate(
            {
                apiClientProps: { serverId: detailQuery?.data?._serverId },
                body: {
                    comment: detailQuery?.data?.description || '',
                    name: detailQuery?.data?.name,
                    ownerId: detailQuery?.data?.ownerId || '',
                    public: detailQuery?.data?.public || false,
                    queryBuilderRules: rules,
                    sync: detailQuery?.data?.sync || false,
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
        extraFilters: { limit?: number; sortBy?: string[]; sortOrder?: string },
    ) => {
        if (!detailQuery?.data) return;

        const sortValue =
            extraFilters.sortBy && extraFilters.sortBy.length > 0
                ? extraFilters.sortBy[0]
                : '+dateAdded';

        const rules = {
            ...filter,
            limit: extraFilters.limit || undefined,
            sort: sortValue,
        };

        openModal({
            children: (
                <SaveAsPlaylistForm
                    body={{
                        comment: detailQuery?.data?.description || '',
                        name: detailQuery?.data?.name,
                        ownerId: detailQuery?.data?.ownerId || '',
                        public: detailQuery?.data?.public || false,
                        queryBuilderRules: rules,
                        sync: detailQuery?.data?.sync || false,
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

    const openDeletePlaylistModal = () => {
        openModal({
            children: (
                <ConfirmModal
                    onConfirm={() => {
                        if (!detailQuery?.data) return;
                        deletePlaylistMutation?.mutate(
                            {
                                apiClientProps: { serverId: detailQuery.data._serverId },
                                query: { id: detailQuery.data.id },
                            },
                            {
                                onError: (err) => {
                                    toast.error({
                                        message: err.message,
                                        title: t('error.genericError', {
                                            postProcess: 'sentenceCase',
                                        }),
                                    });
                                },
                                onSuccess: () => {
                                    navigate(AppRoute.PLAYLISTS, { replace: true });
                                },
                            },
                        );
                        closeAllModals();
                    }}
                >
                    <Text>Are you sure you want to delete this playlist?</Text>
                </ConfirmModal>
            ),
            title: t('form.deletePlaylist.title', { postProcess: 'sentenceCase' }),
        });
    };

    const isSmartPlaylist = Boolean(
        !detailQuery?.isLoading &&
            detailQuery?.data?.rules &&
            server?.type === ServerType.NAVIDROME,
    );

    const [showQueryBuilder, setShowQueryBuilder] = useState(false);
    const [isQueryBuilderExpanded, setIsQueryBuilderExpanded] = useState(false);
    const queryBuilderRef = useRef<PlaylistQueryBuilderRef>(null);

    const handleToggleExpand = () => {
        setIsQueryBuilderExpanded((prev) => !prev);
    };

    const handleToggleShowQueryBuilder = () => {
        setShowQueryBuilder((prev) => !prev);
        setIsQueryBuilderExpanded(true);
    };

    const playlistTarget = usePlaylistTarget();
    const displayMode: LibraryItem.ALBUM | LibraryItem.SONG =
        playlistTarget === PlaylistTarget.ALBUM ? LibraryItem.ALBUM : LibraryItem.SONG;
    const listKey =
        displayMode === LibraryItem.ALBUM ? ItemListKey.PLAYLIST_ALBUM : ItemListKey.PLAYLIST_SONG;

    const [itemCount, setItemCount] = useState<number | undefined>(undefined);
    const [listData, setListData] = useState<unknown[]>([]);
    const [mode, setMode] = useState<'edit' | 'view'>('view');
    const [isSidebarOpen, setIsSidebarOpen] = usePageSidebar(listKey);

    const providerValue = useMemo(() => {
        return {
            customFilters: undefined,
            displayMode,
            id: playlistId,
            isSidebarOpen,
            isSmartPlaylist,
            itemCount,
            listData,
            listKey,
            mode,
            pageKey: listKey,
            setIsSidebarOpen,
            setItemCount,
            setListData,
            setMode,
        };
    }, [
        playlistId,
        isSmartPlaylist,
        displayMode,
        listKey,
        isSidebarOpen,
        itemCount,
        listData,
        mode,
        setIsSidebarOpen,
    ]);

    return (
        <AnimatedPage key={`playlist-detail-songList-${playlistId}`}>
            <ListContext.Provider value={providerValue}>
                <PlaylistDetailSongListHeader
                    isSmartPlaylist={!!isSmartPlaylist}
                    onConvertToSmart={() => {
                        if (!isSmartPlaylist) {
                            setShowQueryBuilder(true);
                            setIsQueryBuilderExpanded(true);
                        }
                    }}
                    onDelete={() => openDeletePlaylistModal()}
                    onToggleQueryBuilder={handleToggleShowQueryBuilder}
                />

                <ListWithSidebarContainer>
                    <ListWithSidebarContainer.SidebarPortal>
                        <PlaylistSongListFiltersSidebar />
                    </ListWithSidebarContainer.SidebarPortal>
                    <Suspense fallback={<Spinner container />}>
                        <PlaylistDetailSongListContent />
                    </Suspense>
                </ListWithSidebarContainer>
                {(isSmartPlaylist || showQueryBuilder) && (
                    <PlaylistQueryEditor
                        createPlaylistMutation={createPlaylistMutation}
                        detailQuery={detailQuery}
                        handleSave={handleSave}
                        handleSaveAs={handleSaveAs}
                        isQueryBuilderExpanded={isQueryBuilderExpanded}
                        onToggleExpand={handleToggleExpand}
                        playlistId={playlistId}
                        queryBuilderRef={queryBuilderRef}
                    />
                )}
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
