import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Suspense, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createSearchParams, generatePath, Link, useParams } from 'react-router';

import styles from './album-artist-detail-content.module.css';

import { AlbumInfiniteCarousel } from '/@/renderer/features/albums/components/album-infinite-carousel';
import { artistsQueries } from '/@/renderer/features/artists/api/artists-api';
import { AlbumArtistGridCarousel } from '/@/renderer/features/artists/components/album-artist-grid-carousel';
import { ContextMenuController } from '/@/renderer/features/context-menu/context-menu-controller';
import { usePlayer } from '/@/renderer/features/player/context/player-context';
import { DefaultPlayButton } from '/@/renderer/features/shared/components/play-button';
import { useContainerQuery } from '/@/renderer/hooks';
import { useGenreRoute } from '/@/renderer/hooks/use-genre-route';
import { AppRoute } from '/@/renderer/router/routes';
import { ArtistItem, useCurrentServer } from '/@/renderer/store';
import { useGeneralSettings, usePlayButtonBehavior } from '/@/renderer/store/settings.store';
import { sanitize } from '/@/renderer/utils/sanitize';
import { ActionIcon } from '/@/shared/components/action-icon/action-icon';
import { Button } from '/@/shared/components/button/button';
import { Grid } from '/@/shared/components/grid/grid';
import { Group } from '/@/shared/components/group/group';
import { Spinner } from '/@/shared/components/spinner/spinner';
import { Spoiler } from '/@/shared/components/spoiler/spoiler';
import { Stack } from '/@/shared/components/stack/stack';
import { TextTitle } from '/@/shared/components/text-title/text-title';
import { Text } from '/@/shared/components/text/text';
import {
    AlbumArtist,
    AlbumListSort,
    LibraryItem,
    ServerType,
    SortOrder,
    TopSongListResponse,
} from '/@/shared/types/domain-types';
import { Play } from '/@/shared/types/types';

interface AlbumArtistActionButtonsProps {
    albumCount: null | number | undefined;
    artistDiscographyLink: string;
    artistSongsLink: string;
    onFavorite: () => void;
    onMoreOptions: (e: React.MouseEvent<HTMLButtonElement>) => void;
    onPlay: () => void;
    userFavorite?: boolean;
}

const AlbumArtistActionButtons = ({
    albumCount,
    artistDiscographyLink,
    artistSongsLink,
    onFavorite,
    onMoreOptions,
    onPlay,
    userFavorite,
}: AlbumArtistActionButtonsProps) => {
    const { t } = useTranslation();

    return (
        <>
            <Group gap="md">
                <DefaultPlayButton disabled={albumCount === 0} onClick={onPlay} />
                <Group gap="xs">
                    <ActionIcon
                        icon="favorite"
                        iconProps={{
                            fill: userFavorite ? 'primary' : undefined,
                        }}
                        onClick={onFavorite}
                        size="lg"
                        variant="transparent"
                    />
                    <ActionIcon
                        icon="ellipsisHorizontal"
                        onClick={onMoreOptions}
                        size="lg"
                        variant="transparent"
                    />
                </Group>
            </Group>
            <Group gap="md">
                <Button
                    component={Link}
                    size="compact-md"
                    to={artistDiscographyLink}
                    variant="subtle"
                >
                    {String(t('page.albumArtistDetail.viewDiscography')).toUpperCase()}
                </Button>
                <Button component={Link} size="compact-md" to={artistSongsLink} variant="subtle">
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
            <TextTitle fw={700} order={2}>
                {t('page.albumArtistDetail.about', {
                    artist: artistName,
                })}
            </TextTitle>
            <Spoiler dangerouslySetInnerHTML={{ __html: sanitizedBiography }} />
        </section>
    );
};

interface AlbumArtistMetadataTopSongsProps {
    routeId: string;
    topSongsQuery: ReturnType<typeof useQuery<TopSongListResponse>>;
}

const AlbumArtistMetadataTopSongs = ({
    routeId,
    topSongsQuery,
}: AlbumArtistMetadataTopSongsProps) => {
    const { t } = useTranslation();

    if (!topSongsQuery?.data?.items?.length) return null;

    return (
        <section>
            <Group justify="space-between" wrap="nowrap">
                <Group align="flex-end" wrap="nowrap">
                    <TextTitle fw={700} order={2}>
                        {t('page.albumArtistDetail.topSongs', {
                            postProcess: 'sentenceCase',
                        })}
                    </TextTitle>
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
                </Group>
            </Group>
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

export const AlbumArtistDetailContent = () => {
    const { t } = useTranslation();
    const { artistItems, externalLinks, lastFM, musicBrainz } = useGeneralSettings();
    const { albumArtistId, artistId } = useParams() as {
        albumArtistId?: string;
        artistId?: string;
    };
    const routeId = (artistId || albumArtistId) as string;
    const { ref, ...cq } = useContainerQuery();
    const { addToQueueByFetch, setFavorite } = usePlayer();
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

    const artistDiscographyLink = `${generatePath(
        AppRoute.LIBRARY_ALBUM_ARTISTS_DETAIL_DISCOGRAPHY,
        {
            albumArtistId: routeId,
        },
    )}?${createSearchParams({
        artistId: routeId,
        artistName: detailQuery.data?.name || '',
    })}`;

    const artistSongsLink = `${generatePath(AppRoute.LIBRARY_ALBUM_ARTISTS_DETAIL_SONGS, {
        albumArtistId: routeId,
    })}?${createSearchParams({
        artistId: routeId,
        artistName: detailQuery.data?.name || '',
    })}`;

    const topSongsQuery = useQuery(
        artistsQueries.topSongs({
            options: {
                enabled: !!detailQuery.data?.name && enabledItem.topSongs,
            },
            query: {
                artist: detailQuery.data?.name || '',
                artistId: routeId,
            },
            serverId: server?.id,
        }),
    );

    const carousels = useMemo(() => {
        return [
            {
                isHidden: !enabledItem.recentAlbums || !routeId,
                itemType: LibraryItem.ALBUM,
                order: itemOrder.recentAlbums,
                query: {
                    artistIds: routeId ? [routeId] : undefined,
                    compilation: false,
                },
                rowCount: 2,
                sortBy: AlbumListSort.RELEASE_DATE,
                sortOrder: SortOrder.DESC,
                title: (
                    <Group align="flex-end">
                        <TextTitle fw={700} order={2}>
                            {t('page.albumArtistDetail.recentReleases', {
                                postProcess: 'sentenceCase',
                            })}
                        </TextTitle>
                        <Button
                            component={Link}
                            size="compact-md"
                            to={artistDiscographyLink}
                            variant="subtle"
                        >
                            {String(t('page.albumArtistDetail.viewDiscography')).toUpperCase()}
                        </Button>
                    </Group>
                ),
                uniqueId: 'recentReleases',
            },
            {
                isHidden:
                    !enabledItem.compilations || server?.type === ServerType.SUBSONIC || !routeId,
                itemType: LibraryItem.ALBUM,
                order: itemOrder.compilations,
                query: {
                    artistIds: routeId ? [routeId] : undefined,
                    compilation: true,
                },
                rowCount: 1,
                sortBy: AlbumListSort.RELEASE_DATE,
                sortOrder: SortOrder.DESC,
                title: (
                    <TextTitle fw={700} order={2}>
                        {t('page.albumArtistDetail.appearsOn', { postProcess: 'sentenceCase' })}
                    </TextTitle>
                ),
                uniqueId: 'compilationAlbums',
            },
            {
                data: (detailQuery.data?.similarArtists || []) as AlbumArtist[],
                isHidden: !detailQuery.data?.similarArtists || !enabledItem.similarArtists,
                itemType: LibraryItem.ALBUM_ARTIST,
                order: itemOrder.similarArtists,
                rowCount: 1,
                title: (
                    <TextTitle fw={700} order={2}>
                        {t('page.albumArtistDetail.relatedArtists', {
                            postProcess: 'sentenceCase',
                        })}
                    </TextTitle>
                ),
                uniqueId: 'similarArtists',
            },
        ];
    }, [
        artistDiscographyLink,
        detailQuery.data?.similarArtists,
        enabledItem.compilations,
        enabledItem.recentAlbums,
        enabledItem.similarArtists,
        itemOrder.compilations,
        itemOrder.recentAlbums,
        itemOrder.similarArtists,
        routeId,
        server?.type,
        t,
    ]);

    const playButtonBehavior = usePlayButtonBehavior();

    const handlePlay = async (playType?: Play) => {
        if (!server?.id) return;
        addToQueueByFetch(
            server.id,
            [routeId],
            albumArtistId ? LibraryItem.ALBUM_ARTIST : LibraryItem.ARTIST,
            playType || playButtonBehavior,
        );
    };

    const handleFavorite = () => {
        if (!detailQuery.data) return;
        setFavorite(
            detailQuery.data._serverId,
            [detailQuery.data.id],
            LibraryItem.ALBUM_ARTIST,
            !detailQuery.data.userFavorite,
        );
    };

    const handleMoreOptions = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (!detailQuery.data) return;
        ContextMenuController.call({
            cmd: { items: [detailQuery.data], type: LibraryItem.ALBUM_ARTIST },
            event: e,
        });
    };

    const albumCount = detailQuery.data?.albumCount;
    const biography =
        detailQuery.data?.biography && enabledItem.biography ? detailQuery.data.biography : null;
    const showGenres = detailQuery.data?.genres ? detailQuery.data.genres.length !== 0 : false;
    const mbzId = detailQuery.data?.mbz;

    // Calculate order for genres and external links (show before other sections)
    // Use a very low order number to ensure they appear first
    const genresOrder = 0;
    const externalLinksOrder = 0.5;

    return (
        <div className={styles.contentContainer} ref={ref}>
            <div className={styles.detailContainer}>
                <AlbumArtistActionButtons
                    albumCount={albumCount}
                    artistDiscographyLink={artistDiscographyLink}
                    artistSongsLink={artistSongsLink}
                    onFavorite={handleFavorite}
                    onMoreOptions={handleMoreOptions}
                    onPlay={() => handlePlay(playButtonBehavior)}
                    userFavorite={detailQuery.data?.userFavorite}
                />
                <Grid gutter="xl">
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
                    {Boolean(topSongsQuery?.data?.items?.length) && enabledItem.topSongs && (
                        <Grid.Col order={itemOrder.topSongs} span={12}>
                            <AlbumArtistMetadataTopSongs
                                routeId={routeId}
                                topSongsQuery={topSongsQuery}
                            />
                        </Grid.Col>
                    )}
                    {cq.height || cq.width
                        ? carousels
                              .filter((c) => !c.isHidden)
                              .map((carousel) => (
                                  <Grid.Col
                                      key={`carousel-${carousel.uniqueId}`}
                                      order={carousel.order}
                                      span={12}
                                  >
                                      <Suspense fallback={<Spinner container />}>
                                          {carousel.itemType === LibraryItem.ALBUM ? (
                                              'query' in carousel &&
                                              carousel.query &&
                                              carousel.sortBy &&
                                              carousel.sortOrder ? (
                                                  <AlbumInfiniteCarousel
                                                      query={carousel.query}
                                                      rowCount={carousel.rowCount}
                                                      sortBy={carousel.sortBy}
                                                      sortOrder={carousel.sortOrder}
                                                      title={carousel.title}
                                                  />
                                              ) : null
                                          ) : carousel.itemType === LibraryItem.ALBUM_ARTIST ? (
                                              'data' in carousel && carousel.data ? (
                                                  <AlbumArtistGridCarousel
                                                      data={carousel.data}
                                                      rowCount={carousel.rowCount}
                                                      title={carousel.title}
                                                  />
                                              ) : null
                                          ) : null}
                                      </Suspense>
                                  </Grid.Col>
                              ))
                        : null}
                </Grid>
            </div>
        </div>
    );
};
