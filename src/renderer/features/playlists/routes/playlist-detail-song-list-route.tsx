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
import { Box } from '/@/shared/components/box/box';
import { Button } from '/@/shared/components/button/button';
import { Flex } from '/@/shared/components/flex/flex';
import { Group } from '/@/shared/components/group/group';
import { Icon } from '/@/shared/components/icon/icon';
import { JsonInput } from '/@/shared/components/json-input/json-input';
import { ConfirmModal } from '/@/shared/components/modal/modal';
import { ScrollArea } from '/@/shared/components/scroll-area/scroll-area';
import { SegmentedControl } from '/@/shared/components/segmented-control/segmented-control';
import { Spinner } from '/@/shared/components/spinner/spinner';
import { Stack } from '/@/shared/components/stack/stack';
import { Text } from '/@/shared/components/text/text';
import { toast } from '/@/shared/components/toast/toast';
import { LibraryItem, ServerType, SongListSort } from '/@/shared/types/domain-types';
import { ItemListKey } from '/@/shared/types/types';

type AppliedJsonState = {
    limit?: number;
    query: Record<string, any>;
    sort?: string;
};

type EditorMode = 'builder' | 'json';

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

const serializeFiltersToRulesJson = (filters: {
    extraFilters: { limit?: number; sortBy?: string[] };
    filters: any;
}): Record<string, any> => {
    const queryValue = convertQueryGroupToNDQuery(filters.filters);
    const sortString = filters.extraFilters.sortBy?.[0];
    return {
        ...queryValue,
        ...(filters.extraFilters.limit != null && { limit: filters.extraFilters.limit }),
        ...(sortString && { sort: sortString }),
    };
};

const parseRulesJsonToSaveArgs = (
    parsed: Record<string, any>,
): { extraFilters: { limit?: number; sortBy?: string[] }; filter: Record<string, any> } => {
    const rootKey = parsed.all ? 'all' : 'any';
    const filter = rootKey in parsed ? { [rootKey]: parsed[rootKey] } : { all: [] };
    return {
        extraFilters: {
            ...(parsed.limit != null && { limit: parsed.limit }),
            ...(parsed.sort != null && { sortBy: [parsed.sort] }),
        },
        filter,
    };
};

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

    const [editorMode, setEditorMode] = useState<EditorMode>('builder');
    const [jsonText, setJsonText] = useState('');
    const [appliedJsonState, setAppliedJsonState] = useState<AppliedJsonState | null>(null);

    const getFiltersForSave = useCallback((): null | {
        extraFilters: { limit?: number; sortBy?: string[]; sortOrder?: string };
        filter: Record<string, any>;
    } => {
        if (editorMode === 'json') {
            try {
                const parsed = JSON.parse(jsonText) as Record<string, any>;
                const { extraFilters, filter } = parseRulesJsonToSaveArgs(parsed);
                return { extraFilters, filter };
            } catch {
                return null;
            }
        }
        const filters = queryBuilderRef.current?.getFilters();
        if (!filters) return null;
        return {
            extraFilters: filters.extraFilters,
            filter: convertQueryGroupToNDQuery(filters.filters),
        };
    }, [editorMode, jsonText, queryBuilderRef]);

    const openPreviewModal = useCallback(() => {
        const payload = getFiltersForSave();
        if (!payload) {
            if (editorMode === 'json') {
                toast.error({ message: t('error.invalidJson', { postProcess: 'sentenceCase' }) });
            }
            return;
        }
        const previewValue = {
            ...payload.filter,
            ...(payload.extraFilters.limit != null && { limit: payload.extraFilters.limit }),
            ...(payload.extraFilters.sortBy?.[0] && { sort: payload.extraFilters.sortBy[0] }),
        };
        openModal({
            children: <JsonPreview value={previewValue} />,
            size: 'xl',
            title: t('common.preview', { postProcess: 'titleCase' }),
        });
    }, [editorMode, getFiltersForSave, t]);

    const openSaveAndReplaceModal = useCallback(() => {
        if (!isQueryBuilderExpanded) return;
        const payload = getFiltersForSave();
        if (!payload) {
            if (editorMode === 'json') {
                toast.error({ message: t('error.invalidJson', { postProcess: 'sentenceCase' }) });
            }
            return;
        }
        openModal({
            children: (
                <ConfirmModal
                    onConfirm={() => {
                        handleSave(payload.filter, payload.extraFilters);
                        closeAllModals();
                    }}
                >
                    <Text>{t('common.areYouSure', { postProcess: 'sentenceCase' })}</Text>
                </ConfirmModal>
            ),
            title: t('common.saveAndReplace', { postProcess: 'titleCase' }),
        });
    }, [editorMode, getFiltersForSave, handleSave, isQueryBuilderExpanded, t]);

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

    const effectiveQuery = useMemo(
        () =>
            appliedJsonState?.query ??
            (detailQuery?.data?.rules?.all
                ? { all: detailQuery.data.rules.all }
                : detailQuery?.data?.rules?.any
                  ? { any: detailQuery.data.rules.any }
                  : detailQuery?.data?.rules),
        [appliedJsonState?.query, detailQuery?.data?.rules],
    );
    const effectiveLimit = appliedJsonState?.limit ?? detailQuery?.data?.rules?.limit;
    const effectiveSortBy = useMemo(
        () =>
            (appliedJsonState?.sort ? [appliedJsonState.sort] : parseSortBy()) as
                | SongListSort
                | SongListSort[],
        [appliedJsonState?.sort, parseSortBy],
    );
    const effectiveSortOrder = appliedJsonState?.sort
        ? appliedJsonState.sort.startsWith('-')
            ? 'desc'
            : 'asc'
        : parseSortOrder();

    const handleEditorModeChange = useCallback(
        (value: string) => {
            const nextMode = value as EditorMode;
            if (nextMode === 'json') {
                const filters = queryBuilderRef.current?.getFilters();
                if (filters) {
                    setJsonText(JSON.stringify(serializeFiltersToRulesJson(filters), null, 2));
                } else {
                    const fallback: Record<string, any> = effectiveQuery
                        ? { ...effectiveQuery }
                        : { all: [] };
                    if (effectiveLimit != null) fallback.limit = effectiveLimit;
                    if (effectiveSortBy?.[0]) fallback.sort = effectiveSortBy[0];
                    if (!fallback.sort) fallback.sort = '+dateAdded';
                    setJsonText(JSON.stringify(fallback, null, 2));
                }
                setEditorMode('json');
            } else {
                if (editorMode === 'json') {
                    try {
                        const parsed = JSON.parse(jsonText) as Record<string, any>;
                        const rootKey = parsed.all ? 'all' : 'any';
                        if (!parsed[rootKey] || !Array.isArray(parsed[rootKey])) {
                            throw new Error('Invalid rules structure');
                        }
                        setAppliedJsonState({
                            limit: parsed.limit,
                            query: { [rootKey]: parsed[rootKey] },
                            sort: parsed.sort,
                        });
                    } catch {
                        toast.error({
                            message: t('error.invalidJson', {
                                postProcess: 'sentenceCase',
                            }),
                        });
                        return;
                    }
                }
                setEditorMode('builder');
            }
        },
        [editorMode, effectiveLimit, effectiveQuery, effectiveSortBy, jsonText, queryBuilderRef, t],
    );

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
                        {isQueryBuilderExpanded && (
                            <SegmentedControl
                                data={[
                                    {
                                        label: (
                                            <Flex>
                                                <Icon icon="queryBuilder" />
                                            </Flex>
                                        ),
                                        value: 'builder',
                                    },
                                    {
                                        label: (
                                            <Flex>
                                                <Icon icon="json" />
                                            </Flex>
                                        ),
                                        value: 'json',
                                    },
                                ]}
                                onChange={handleEditorModeChange}
                                size="xs"
                                value={editorMode}
                            />
                        )}
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
                                const payload = getFiltersForSave();
                                if (payload) {
                                    handleSaveAs(payload.filter, payload.extraFilters);
                                } else if (editorMode === 'json') {
                                    toast.error({
                                        message: t('error.invalidJson', {
                                            postProcess: 'sentenceCase',
                                        }),
                                    });
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
                <Box
                    py="md"
                    style={{
                        display: isQueryBuilderExpanded ? 'flex' : 'none',
                        flex: 1,
                        minHeight: 0,
                        overflow: 'hidden',
                    }}
                >
                    {editorMode === 'builder' ? (
                        <PlaylistQueryBuilder
                            key={JSON.stringify(appliedJsonState ?? detailQuery?.data?.rules)}
                            limit={effectiveLimit}
                            playlistId={playlistId}
                            query={effectiveQuery}
                            ref={queryBuilderRef}
                            sortBy={effectiveSortBy}
                            sortOrder={effectiveSortOrder}
                        />
                    ) : (
                        <JsonInput
                            autosize
                            minRows={8}
                            onChange={(value) => setJsonText(value)}
                            placeholder='{ "all": [], "limit": 100, "sort": "+dateAdded" }'
                            style={{ flex: 1, minHeight: 0 }}
                            value={jsonText}
                        />
                    )}
                </Box>
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
