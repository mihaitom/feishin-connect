import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createSearchParams, generatePath, Link, useParams } from 'react-router';

import styles from './album-artist-detail-content.module.css';

import { DataRow, MemoizedItemCard } from '/@/renderer/components/item-card/item-card';
import { useDefaultItemListControls } from '/@/renderer/components/item-list/helpers/item-list-controls';
import { useGridRows } from '/@/renderer/components/item-list/helpers/use-grid-rows';
import { useItemListColumnReorder } from '/@/renderer/components/item-list/helpers/use-item-list-column-reorder';
import { useItemListColumnResize } from '/@/renderer/components/item-list/helpers/use-item-list-column-resize';
import { SONG_TABLE_COLUMNS } from '/@/renderer/components/item-list/item-table-list/default-columns';
import { ItemTableList } from '/@/renderer/components/item-list/item-table-list/item-table-list';
import { ItemTableListColumn } from '/@/renderer/components/item-list/item-table-list/item-table-list-column';
import { ItemControls } from '/@/renderer/components/item-list/types';
import { albumQueries } from '/@/renderer/features/albums/api/album-api';
import { artistsQueries } from '/@/renderer/features/artists/api/artists-api';
import { AlbumArtistGridCarousel } from '/@/renderer/features/artists/components/album-artist-grid-carousel';
import { usePlayer } from '/@/renderer/features/player/context/player-context';
import { ListConfigMenu } from '/@/renderer/features/shared/components/list-config-menu';
import {
    CLIENT_SIDE_ALBUM_FILTERS,
    ListSortByDropdownControlled,
} from '/@/renderer/features/shared/components/list-sort-by-dropdown';
import { ListSortOrderToggleButtonControlled } from '/@/renderer/features/shared/components/list-sort-order-toggle-button';
import { searchLibraryItems } from '/@/renderer/features/shared/utils';
import { useContainerQuery } from '/@/renderer/hooks';
import { useGenreRoute } from '/@/renderer/hooks/use-genre-route';
import { AppRoute } from '/@/renderer/router/routes';
import {
    ArtistItem,
    useAppStore,
    useCurrentServer,
    useCurrentServerId,
    usePlayerSong,
} from '/@/renderer/store';
import { useGeneralSettings, useSettingsStore } from '/@/renderer/store/settings.store';
import { sanitize } from '/@/renderer/utils/sanitize';
import { sortAlbumList } from '/@/shared/api/utils';
import { ActionIcon } from '/@/shared/components/action-icon/action-icon';
import { Button } from '/@/shared/components/button/button';
import { Grid } from '/@/shared/components/grid/grid';
import { Group } from '/@/shared/components/group/group';
import { Icon } from '/@/shared/components/icon/icon';
import { Spoiler } from '/@/shared/components/spoiler/spoiler';
import { Stack } from '/@/shared/components/stack/stack';
import { TextInput } from '/@/shared/components/text-input/text-input';
import { TextTitle } from '/@/shared/components/text-title/text-title';
import { Text } from '/@/shared/components/text/text';
import { useDebouncedValue } from '/@/shared/hooks/use-debounced-value';
import { useHotkeys } from '/@/shared/hooks/use-hotkeys';
import {
    Album,
    AlbumArtist,
    AlbumArtistDetailResponse,
    AlbumListSort,
    LibraryItem,
    RelatedArtist,
    ServerType,
    Song,
    SortOrder,
} from '/@/shared/types/domain-types';
import { ItemListKey, ListDisplayType, Play } from '/@/shared/types/types';

interface AlbumArtistActionButtonsProps {
    artistDiscographyLink: string;
    artistSongsLink: string;
}

const AlbumArtistActionButtons = ({
    artistDiscographyLink,
    artistSongsLink,
}: AlbumArtistActionButtonsProps) => {
    const { t } = useTranslation();

    return (
        <>
            <Group gap="lg">
                <Button
                    component={Link}
                    p={0}
                    size="compact-md"
                    to={artistDiscographyLink}
                    variant="transparent"
                >
                    {String(t('page.albumArtistDetail.viewDiscography')).toUpperCase()}
                </Button>
                <Button
                    component={Link}
                    p={0}
                    size="compact-md"
                    to={artistSongsLink}
                    variant="transparent"
                >
                    {String(t('page.albumArtistDetail.viewAllTracks')).toUpperCase()}
                </Button>
            </Group>
        </>
    );
};

interface AlbumArtistMetadataGenresProps {
    genres?: Array<{ id: string; name: string }>;
}

const AlbumArtistMetadataGenres = ({ genres }: AlbumArtistMetadataGenresProps) => {
    const { t } = useTranslation();
    const genrePath = useGenreRoute();

    if (!genres || genres.length === 0) return null;

    return (
        <Stack gap="xs">
            <Text fw={600} isNoSelect size="sm" tt="uppercase">
                {t('entity.genre', {
                    count: genres.length,
                })}
            </Text>
            <Group gap="sm">
                {genres.map((genre) => (
                    <Button
                        component={Link}
                        key={`genre-${genre.id}`}
                        radius="md"
                        size="compact-md"
                        to={generatePath(genrePath, {
                            albumArtistId: null,
                            albumId: null,
                            artistId: null,
                            genreId: genre.id,
                            itemType: null,
                            playlistId: null,
                        })}
                        variant="outline"
                    >
                        {genre.name}
                    </Button>
                ))}
            </Group>
        </Stack>
    );
};

interface AlbumArtistMetadataBiographyProps {
    artistName?: string;
    biography: null | string | undefined;
}

const AlbumArtistMetadataBiography = ({
    artistName,
    biography,
}: AlbumArtistMetadataBiographyProps) => {
    const { t } = useTranslation();

    if (!biography) return null;

    const sanitizedBiography = sanitize(biography);

    return (
        <section style={{ maxWidth: '1280px' }}>
            <TextTitle fw={700} order={3}>
                {t('page.albumArtistDetail.about', {
                    artist: artistName,
                })}
            </TextTitle>
            <Spoiler>
                <Text dangerouslySetInnerHTML={{ __html: sanitizedBiography }} />
            </Spoiler>
        </section>
    );
};

interface AlbumArtistMetadataTopSongsProps {
    detailQuery: ReturnType<typeof useSuspenseQuery<AlbumArtistDetailResponse>>;
    routeId: string;
}

const AlbumArtistMetadataTopSongs = ({
    detailQuery,
    routeId,
}: AlbumArtistMetadataTopSongsProps) => {
    const { t } = useTranslation();
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm] = useDebouncedValue(searchTerm, 300);
    const [showAll, setShowAll] = useState(false);
    const tableConfig = useSettingsStore((state) => state.lists[ItemListKey.SONG]?.table);
    const currentSong = usePlayerSong();
    const player = usePlayer();
    const serverId = useCurrentServerId();

    const topSongsQuery = useQuery(
        artistsQueries.topSongs({
            query: { artist: detailQuery.data?.name || '', artistId: routeId },
            serverId: serverId,
        }),
    );

    const songs = useMemo(() => topSongsQuery?.data?.items || [], [topSongsQuery?.data?.items]);

    const columns = useMemo(() => {
        return tableConfig?.columns || [];
    }, [tableConfig?.columns]);

    const filteredSongs = useMemo(() => {
        const filtered = searchLibraryItems(songs, debouncedSearchTerm, LibraryItem.SONG);
        // When searching, show all results. Otherwise, limit to 5 if not showing all
        if (debouncedSearchTerm.trim() || showAll) {
            return filtered;
        }
        return filtered.slice(0, 5);
    }, [songs, debouncedSearchTerm, showAll]);

    const { handleColumnReordered } = useItemListColumnReorder({
        itemListKey: ItemListKey.SONG,
    });

    const { handleColumnResized } = useItemListColumnResize({
        itemListKey: ItemListKey.SONG,
    });

    const overrideControls: Partial<ItemControls> = useMemo(() => {
        return {
            onDoubleClick: ({ index, internalState, item, meta }) => {
                if (!item) {
                    return;
                }

                const playType = (meta?.playType as Play) || Play.NOW;
                const items = internalState?.getData() as Song[];

                if (index !== undefined) {
                    player.addToQueueByData(items, playType, item.id);
                }
            },
        };
    }, [player]);

    if (!topSongsQuery?.data?.items?.length) return null;

    if (!tableConfig || columns.length === 0) {
        return (
            <section>
                <div className={styles.albumSectionTitle}>
                    <TextTitle fw={700} order={3}>
                        {t('page.albumArtistDetail.topSongs', {
                            postProcess: 'sentenceCase',
                        })}
                    </TextTitle>
                    <div className={styles.albumSectionDividerContainer}>
                        <div className={styles.albumSectionDivider} />
                        <Button
                            component={Link}
                            size="compact-md"
                            to={generatePath(AppRoute.LIBRARY_ALBUM_ARTISTS_DETAIL_TOP_SONGS, {
                                albumArtistId: routeId,
                            })}
                            uppercase
                            variant="subtle"
                        >
                            {t('page.albumArtistDetail.viewAll', {
                                postProcess: 'sentenceCase',
                            })}
                        </Button>
                    </div>
                </div>
            </section>
        );
    }

    const currentSongId = currentSong?.id;

    return (
        <section>
            <Stack gap="md">
                <div className={styles.albumSectionTitle}>
                    <TextTitle fw={700} order={3}>
                        {t('page.albumArtistDetail.topSongs', {
                            postProcess: 'sentenceCase',
                        })}
                    </TextTitle>
                    <div className={styles.albumSectionDividerContainer}>
                        <div className={styles.albumSectionDivider} />
                        <Button
                            component={Link}
                            size="compact-md"
                            to={generatePath(AppRoute.LIBRARY_ALBUM_ARTISTS_DETAIL_TOP_SONGS, {
                                albumArtistId: routeId,
                            })}
                            uppercase
                            variant="subtle"
                        >
                            {t('page.albumArtistDetail.viewAll', {
                                postProcess: 'sentenceCase',
                            })}
                        </Button>
                    </div>
                </div>
                <Group gap="sm" w="100%">
                    <TextInput
                        flex={1}
                        leftSection={<Icon icon="search" />}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={t('common.search', { postProcess: 'sentenceCase' })}
                        radius="xl"
                        rightSection={
                            searchTerm ? (
                                <ActionIcon
                                    icon="x"
                                    onClick={() => setSearchTerm('')}
                                    size="sm"
                                    variant="transparent"
                                />
                            ) : null
                        }
                        styles={{
                            input: {
                                background: 'transparent',
                                border: '1px solid rgba(255, 255, 255, 0.05)',
                            },
                        }}
                        value={searchTerm}
                    />
                    <ListConfigMenu
                        displayTypes={[{ hidden: true, value: ListDisplayType.GRID }]}
                        listKey={ItemListKey.SONG}
                        optionsConfig={{
                            table: {
                                itemsPerPage: { hidden: true },
                                pagination: { hidden: true },
                            },
                        }}
                        tableColumnsData={SONG_TABLE_COLUMNS}
                    />
                </Group>
                <ItemTableList
                    activeRowId={currentSongId}
                    autoFitColumns={tableConfig.autoFitColumns}
                    CellComponent={ItemTableListColumn}
                    columns={columns}
                    data={filteredSongs}
                    enableAlternateRowColors={tableConfig.enableAlternateRowColors}
                    enableDrag
                    enableExpansion={false}
                    enableHeader
                    enableHorizontalBorders={tableConfig.enableHorizontalBorders}
                    enableRowHoverHighlight={tableConfig.enableRowHoverHighlight}
                    enableSelection
                    enableSelectionDialog={false}
                    enableVerticalBorders={tableConfig.enableVerticalBorders}
                    itemType={LibraryItem.SONG}
                    onColumnReordered={handleColumnReordered}
                    onColumnResized={handleColumnResized}
                    overrideControls={overrideControls}
                    size={tableConfig.size}
                />
                {!searchTerm.trim() && songs.length > 5 && !showAll && (
                    <Group justify="center" w="100%">
                        <Button onClick={() => setShowAll(true)} variant="subtle">
                            {t('action.viewMore', { postProcess: 'sentenceCase' })}
                        </Button>
                    </Group>
                )}
            </Stack>
        </section>
    );
};

interface AlbumArtistMetadataExternalLinksProps {
    artistName?: string;
    externalLinks: boolean;
    lastFM: boolean;
    mbzId?: null | string;
    musicBrainz: boolean;
}

const AlbumArtistMetadataExternalLinks = ({
    artistName,
    externalLinks,
    lastFM,
    mbzId,
    musicBrainz,
}: AlbumArtistMetadataExternalLinksProps) => {
    const { t } = useTranslation();

    if (!externalLinks || (!lastFM && !musicBrainz)) return null;

    return (
        <Stack gap="xs">
            <Text fw={600} isNoSelect size="sm" tt="uppercase">
                {t('common.externalLinks', {
                    postProcess: 'sentenceCase',
                })}
            </Text>
            <Group gap="sm">
                {lastFM && (
                    <ActionIcon
                        component="a"
                        href={`https://www.last.fm/music/${encodeURIComponent(artistName || '')}`}
                        icon="brandLastfm"
                        iconProps={{
                            fill: 'default',
                            size: 'xl',
                        }}
                        rel="noopener noreferrer"
                        target="_blank"
                        tooltip={{
                            label: t('action.openIn.lastfm'),
                        }}
                        variant="subtle"
                    />
                )}
                {mbzId && musicBrainz ? (
                    <ActionIcon
                        component="a"
                        href={`https://musicbrainz.org/artist/${mbzId}`}
                        icon="brandMusicBrainz"
                        iconProps={{
                            fill: 'default',
                            size: 'xl',
                        }}
                        rel="noopener noreferrer"
                        target="_blank"
                        tooltip={{
                            label: t('action.openIn.musicbrainz'),
                        }}
                        variant="subtle"
                    />
                ) : null}
            </Group>
        </Stack>
    );
};

interface AlbumArtistMetadataSimilarArtistsProps {
    detailQuery: ReturnType<typeof useSuspenseQuery<AlbumArtistDetailResponse>>;
    routeId: string;
}

const AlbumArtistMetadataSimilarArtists = ({
    detailQuery,
    routeId,
}: AlbumArtistMetadataSimilarArtistsProps) => {
    const { t } = useTranslation();
    const server = useCurrentServer();
    const serverId = useCurrentServerId();

    const similarArtists = useMemo(() => {
        const relatedArtists = detailQuery.data?.similarArtists;
        if (!relatedArtists || relatedArtists.length === 0) {
            return [];
        }

        return relatedArtists.map(
            (relatedArtist: RelatedArtist): AlbumArtist => ({
                _itemType: LibraryItem.ALBUM_ARTIST,
                _serverId: serverId || '',
                _serverType: (server?.type as ServerType) || ServerType.JELLYFIN,
                albumCount: null,
                biography: null,
                duration: null,
                genres: [],
                id: relatedArtist.id,
                imageId: relatedArtist.imageId,
                imageUrl: relatedArtist.imageUrl,
                lastPlayedAt: null,
                mbz: null,
                name: relatedArtist.name,
                playCount: null,
                similarArtists: null,
                songCount: null,
                userFavorite: false,
                userRating: null,
            }),
        );
    }, [detailQuery.data?.similarArtists, server?.type, serverId]);

    const carouselTitle = useMemo(
        () => (
            <div className={styles.similarArtistsTitle}>
                <TextTitle fw={700} order={3}>
                    {t('page.albumArtistDetail.relatedArtists', {
                        postProcess: 'sentenceCase',
                    })}
                </TextTitle>
                <div className={styles.albumSectionDividerContainer}>
                    <div className={styles.albumSectionDivider} />
                </div>
            </div>
        ),
        [t],
    );

    if (similarArtists.length === 0) {
        return null;
    }

    return (
        <AlbumArtistGridCarousel
            data={similarArtists}
            excludeIds={[routeId]}
            rowCount={1}
            title={carouselTitle}
        />
    );
};

export const AlbumArtistDetailContent = () => {
    const { artistItems, externalLinks, lastFM, musicBrainz } = useGeneralSettings();
    const { albumArtistId, artistId } = useParams() as {
        albumArtistId?: string;
        artistId?: string;
    };
    const routeId = (artistId || albumArtistId) as string;
    const server = useCurrentServer();

    const [enabledItem, itemOrder] = useMemo(() => {
        const enabled: { [key in ArtistItem]?: boolean } = {};
        const order: { [key in ArtistItem]?: number } = {};

        for (const [idx, item] of artistItems.entries()) {
            enabled[item.id] = !item.disabled;
            order[item.id] = idx + 1;
        }

        return [enabled, order];
    }, [artistItems]);

    const detailQuery = useSuspenseQuery(
        artistsQueries.albumArtistDetail({
            query: { id: routeId },
            serverId: server?.id,
        }),
    );

    const artistDiscographyLink = useMemo(
        () =>
            `${generatePath(AppRoute.LIBRARY_ALBUM_ARTISTS_DETAIL_DISCOGRAPHY, {
                albumArtistId: routeId,
            })}?${createSearchParams({
                artistId: routeId,
                artistName: detailQuery.data?.name || '',
            })}`,
        [routeId, detailQuery.data?.name],
    );

    const artistSongsLink = useMemo(
        () =>
            `${generatePath(AppRoute.LIBRARY_ALBUM_ARTISTS_DETAIL_SONGS, {
                albumArtistId: routeId,
            })}?${createSearchParams({
                artistId: routeId,
                artistName: detailQuery.data?.name || '',
            })}`,
        [routeId, detailQuery.data?.name],
    );

    const biography =
        detailQuery.data?.biography && enabledItem.biography ? detailQuery.data.biography : null;
    const showGenres = detailQuery.data?.genres ? detailQuery.data.genres.length !== 0 : false;
    const mbzId = detailQuery.data?.mbz;

    // Calculate order for genres and external links (show before other sections)
    // Use a very low order number to ensure they appear first
    const genresOrder = 0;
    const externalLinksOrder = 0.5;

    return (
        <div className={styles.contentContainer}>
            <div className={styles.detailContainer}>
                <AlbumArtistActionButtons
                    artistDiscographyLink={artistDiscographyLink}
                    artistSongsLink={artistSongsLink}
                />
                <Grid gutter="2xl">
                    {showGenres && (
                        <Grid.Col order={genresOrder} span={12}>
                            <AlbumArtistMetadataGenres genres={detailQuery.data?.genres} />
                        </Grid.Col>
                    )}
                    {externalLinks && (lastFM || musicBrainz) && (
                        <Grid.Col order={externalLinksOrder} span={12}>
                            <AlbumArtistMetadataExternalLinks
                                artistName={detailQuery.data?.name}
                                externalLinks={externalLinks}
                                lastFM={lastFM}
                                mbzId={mbzId}
                                musicBrainz={musicBrainz}
                            />
                        </Grid.Col>
                    )}
                    {biography && (
                        <Grid.Col order={itemOrder.biography} span={12}>
                            <AlbumArtistMetadataBiography
                                artistName={detailQuery.data?.name}
                                biography={biography}
                            />
                        </Grid.Col>
                    )}
                    <Grid.Col order={itemOrder.recentAlbums} span={12}>
                        <ArtistAlbums />
                    </Grid.Col>
                    {enabledItem.similarArtists && (
                        <Grid.Col order={itemOrder.similarArtists} span={12}>
                            <AlbumArtistMetadataSimilarArtists
                                detailQuery={detailQuery}
                                routeId={routeId}
                            />
                        </Grid.Col>
                    )}
                    {enabledItem.topSongs && (
                        <Grid.Col order={itemOrder.topSongs} span={12}>
                            <AlbumArtistMetadataTopSongs
                                detailQuery={detailQuery}
                                routeId={routeId}
                            />
                        </Grid.Col>
                    )}
                </Grid>
            </div>
        </div>
    );
};

interface AlbumSectionProps {
    albums: Album[];
    controls: ItemControls;
    cq: ReturnType<typeof useContainerQuery>;
    rows: DataRow[] | undefined;
    title: string;
}

const AlbumSection = ({ albums, controls, cq, rows, title }: AlbumSectionProps) => {
    const span = cq.isXl ? 3 : cq.isLg ? 4 : cq.isMd ? 6 : cq.isSm ? 8 : cq.isXs ? 12 : 12;

    return (
        <Stack gap="md">
            <div className={styles.albumSectionTitle}>
                <TextTitle fw={700} order={3}>
                    {title}
                </TextTitle>
                <div className={styles.albumSectionDividerContainer}>
                    <div className={styles.albumSectionDivider} />
                </div>
            </div>
            <Grid columns={24} gutter="md" type="container">
                {albums.map((album) => (
                    <Grid.Col key={album.id} span={span}>
                        <MemoizedItemCard
                            controls={controls}
                            data={album}
                            enableDrag
                            itemType={LibraryItem.ALBUM}
                            rows={rows}
                            type="poster"
                            withControls
                        />
                    </Grid.Col>
                ))}
            </Grid>
        </Stack>
    );
};

const ArtistAlbums = () => {
    const { t } = useTranslation();
    const serverId = useCurrentServerId();
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm] = useDebouncedValue(searchTerm, 300);
    const albumArtistDetailSort = useAppStore((state) => state.albumArtistDetailSort);
    const setAlbumArtistDetailSort = useAppStore((state) => state.actions.setAlbumArtistDetailSort);
    const sortBy = albumArtistDetailSort.sortBy;
    const sortOrder = albumArtistDetailSort.sortOrder;

    const { albumArtistId, artistId } = useParams() as {
        albumArtistId?: string;
        artistId?: string;
    };
    const routeId = (artistId || albumArtistId) as string;

    const albumsQuery = useSuspenseQuery(
        albumQueries.list({
            query: {
                artistIds: [routeId],
                limit: -1,
                sortBy: AlbumListSort.RELEASE_DATE,
                sortOrder: SortOrder.DESC,
                startIndex: 0,
            },
            serverId,
        }),
    );

    const rows = useGridRows(LibraryItem.ALBUM, ItemListKey.ALBUM);
    const controls = useDefaultItemListControls();

    const filteredAndSortedAlbums = useMemo(() => {
        const albums = albumsQuery.data?.items || [];
        const searched = searchLibraryItems(albums, debouncedSearchTerm, LibraryItem.ALBUM);
        return sortAlbumList(searched, sortBy, sortOrder);
    }, [albumsQuery.data?.items, debouncedSearchTerm, sortBy, sortOrder]);

    const albumsByReleaseType = useMemo(() => {
        const albums = filteredAndSortedAlbums;

        const grouped = albums.reduce(
            (acc, album) => {
                // Priority 1: Appears on - artist is not an album artist
                const isAlbumArtist = album.albumArtists?.some((artist) => artist.id === routeId);
                if (!isAlbumArtist) {
                    const appearsOnKey = 'appears-on';
                    if (!acc[appearsOnKey]) {
                        acc[appearsOnKey] = [];
                    }
                    acc[appearsOnKey].push(album);
                    return acc;
                }

                // Priority 2: Compilations
                if (album.isCompilation) {
                    const compilationKey = 'compilation';
                    if (!acc[compilationKey]) {
                        acc[compilationKey] = [];
                    }
                    acc[compilationKey].push(album);
                    return acc;
                }

                // Priority 3: Single (includes EP and other non-album types)
                const hasAlbumType = album.releaseTypes?.some(
                    (type) => type.toLowerCase() === 'album',
                );
                if (!hasAlbumType) {
                    const singleKey = 'single';
                    if (!acc[singleKey]) {
                        acc[singleKey] = [];
                    }
                    acc[singleKey].push(album);
                    return acc;
                }

                // Priority 4: Album
                const albumKey = 'album';
                if (!acc[albumKey]) {
                    acc[albumKey] = [];
                }
                acc[albumKey].push(album);
                return acc;
            },
            {} as Record<string, Album[]>,
        );

        return grouped;
    }, [filteredAndSortedAlbums, routeId]);

    const releaseTypeEntries = useMemo(() => {
        const priorityOrder = ['album', 'single', 'compilation', 'appears-on'];
        const getPriority = (releaseType: string) => {
            const index = priorityOrder.indexOf(releaseType);
            return index === -1 ? 999 : index;
        };

        return Object.entries(albumsByReleaseType)
            .map(([releaseType, albums]) => {
                let displayName: string;
                switch (releaseType) {
                    case 'album':
                        displayName = t('releaseType.primary.album', {
                            postProcess: 'sentenceCase',
                        });
                        break;
                    case 'appears-on':
                        displayName = t('page.albumArtistDetail.appearsOn', {
                            postProcess: 'sentenceCase',
                        });
                        break;
                    case 'compilation':
                        displayName = t('releaseType.secondary.compilation', {
                            postProcess: 'sentenceCase',
                        });
                        break;
                    case 'single':
                        displayName = t('releaseType.primary.single', {
                            postProcess: 'sentenceCase',
                        });
                        break;
                    default:
                        displayName = releaseType;
                }
                return { albums, displayName, releaseType };
            })
            .sort((a, b) => getPriority(a.releaseType) - getPriority(b.releaseType));
    }, [albumsByReleaseType, t]);

    const cq = useContainerQuery();

    const binding = useSettingsStore((state) => state.hotkeys.bindings.localSearch);
    const searchInputRef = useRef<HTMLInputElement>(null);

    useHotkeys([
        [
            binding.hotkey,
            () => {
                searchInputRef.current?.focus();
            },
        ],
    ]);

    if (releaseTypeEntries.length === 0) {
        return null;
    }

    return (
        <Stack gap="md">
            <Group gap="sm" w="100%">
                <TextInput
                    flex={1}
                    leftSection={<Icon icon="search" />}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={t('common.search', { postProcess: 'sentenceCase' })}
                    radius="xl"
                    ref={searchInputRef}
                    rightSection={
                        searchTerm ? (
                            <ActionIcon
                                icon="x"
                                onClick={() => setSearchTerm('')}
                                size="sm"
                                variant="transparent"
                            />
                        ) : null
                    }
                    styles={{
                        input: {
                            background: 'transparent',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                        },
                    }}
                    value={searchTerm}
                />
                <ListSortByDropdownControlled
                    filters={CLIENT_SIDE_ALBUM_FILTERS}
                    itemType={LibraryItem.ALBUM}
                    setSortBy={(value) =>
                        setAlbumArtistDetailSort(value as AlbumListSort, sortOrder)
                    }
                    sortBy={sortBy}
                />
                <ListSortOrderToggleButtonControlled
                    setSortOrder={(value) => setAlbumArtistDetailSort(sortBy, value as SortOrder)}
                    sortOrder={sortOrder}
                />
            </Group>
            <div className={styles.albumSectionContainer} ref={cq.ref}>
                {cq.isCalculated &&
                    releaseTypeEntries.map(({ albums, displayName, releaseType }) => (
                        <AlbumSection
                            albums={albums}
                            controls={controls}
                            cq={cq}
                            key={releaseType}
                            rows={rows}
                            title={displayName}
                        />
                    ))}
            </div>
        </Stack>
    );
};
