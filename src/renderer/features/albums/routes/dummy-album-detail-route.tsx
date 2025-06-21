import { Box, Center, Group, Stack } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { RiErrorWarningLine, RiHeartFill, RiHeartLine, RiMoreFill } from 'react-icons/ri';
import { generatePath, useParams } from 'react-router';
import { Link } from 'react-router-dom';
import { styled } from 'styled-components';

import { api } from '/@/renderer/api';
import { queryKeys } from '/@/renderer/api/query-keys';
import { Button, Spoiler, Text } from '/@/renderer/components';
import { useHandleGeneralContextMenu } from '/@/renderer/features/context-menu';
import { SONG_ALBUM_PAGE } from '/@/renderer/features/context-menu/context-menu-items';
import { usePlayQueueAdd } from '/@/renderer/features/player';
import {
    AnimatedPage,
    LibraryHeader,
    PlayButton,
    useCreateFavorite,
    useDeleteFavorite,
} from '/@/renderer/features/shared';
import { useContainerQuery, useFastAverageColor } from '/@/renderer/hooks';
import { queryClient } from '/@/renderer/lib/react-query';
import { AppRoute } from '/@/renderer/router/routes';
import { useCurrentServer } from '/@/renderer/store';
import { usePlayButtonBehavior } from '/@/renderer/store/settings.store';
import { formatDurationString } from '/@/renderer/utils';
import { replaceURLWithHTMLLinks } from '/@/renderer/utils/linkify';
import { LibraryItem, SongDetailResponse } from '/@/shared/types/domain-types';

const DetailContainer = styled.div`
    display: flex;
    flex-direction: column;
    gap: 2rem;
    padding: 1rem 2rem 5rem;
    overflow: hidden;
`;

const DummyAlbumDetailRoute = () => {
    const cq = useContainerQuery();
    const { t } = useTranslation();

    const { albumId } = useParams() as { albumId: string };
    const server = useCurrentServer();
    const queryKey = queryKeys.songs.detail(server?.id || '', albumId);
    const detailQuery = useQuery({
        queryFn: ({ signal }) => {
            if (!server) throw new Error('Server not found');
            return api.controller.getSongDetail({
                apiClientProps: { server, signal },
                query: { id: albumId },
            });
        },
        queryKey,
    });

    const { background, colorId } = useFastAverageColor({
        id: albumId,
        src: detailQuery.data?.imageUrl,
        srcLoaded: !detailQuery.isLoading,
    });
    const handlePlayQueueAdd = usePlayQueueAdd();
    const playButtonBehavior = usePlayButtonBehavior();

    const createFavoriteMutation = useCreateFavorite({});
    const deleteFavoriteMutation = useDeleteFavorite({});

    const handleFavorite = async () => {
        if (!detailQuery?.data) return;

        const wasFavorite = detailQuery.data.userFavorite;

        try {
            if (wasFavorite) {
                await deleteFavoriteMutation.mutateAsync({
                    query: {
                        id: [detailQuery.data.id],
                        type: LibraryItem.SONG,
                    },
                    serverId: detailQuery.data.serverId,
                });
            } else {
                await createFavoriteMutation.mutateAsync({
                    query: {
                        id: [detailQuery.data.id],
                        type: LibraryItem.SONG,
                    },
                    serverId: detailQuery.data.serverId,
                });
            }

            queryClient.setQueryData<SongDetailResponse>(queryKey, {
                ...detailQuery.data,
                userFavorite: !wasFavorite,
            });
        } catch (error) {
            console.error(error);
        }
    };

    const showGenres = detailQuery?.data?.genres ? detailQuery?.data?.genres.length !== 0 : false;
    const comment = detailQuery?.data?.comment;

    const handleGeneralContextMenu = useHandleGeneralContextMenu(LibraryItem.SONG, SONG_ALBUM_PAGE);

    const handlePlay = () => {
        handlePlayQueueAdd?.({
            byItemType: {
                id: [albumId],
                type: LibraryItem.SONG,
            },
            playType: playButtonBehavior,
        });
    };

    const metadataItems = [
        {
            id: 'releaseYear',
            secondary: false,
            value: detailQuery?.data?.releaseYear,
        },
        {
            id: 'duration',
            secondary: false,
            value: detailQuery?.data?.duration && formatDurationString(detailQuery.data.duration),
        },
    ];

    return (
        <AnimatedPage key={`dummy-album-detail-${albumId}`}>
            <Stack ref={cq.ref}>
                <LibraryHeader
                    background={background}
                    imageUrl={detailQuery?.data?.imageUrl}
                    item={{ route: AppRoute.LIBRARY_SONGS, type: LibraryItem.SONG }}
                    loading={!background || colorId !== albumId}
                    title={detailQuery?.data?.name || ''}
                >
                    <Stack spacing="sm">
                        <Group spacing="sm">
                            {metadataItems.map((item, index) => (
                                <Fragment key={`item-${item.id}-${index}`}>
                                    {index > 0 && <Text $noSelect>•</Text>}
                                    <Text $secondary={item.secondary}>{item.value}</Text>
                                </Fragment>
                            ))}
                        </Group>
                        <Group
                            mah="4rem"
                            spacing="md"
                            sx={{
                                overflow: 'hidden',
                                WebkitBoxOrient: 'vertical',
                                WebkitLineClamp: 2,
                            }}
                        >
                            {detailQuery?.data?.albumArtists.map((artist) => (
                                <Text
                                    $link
                                    component={Link}
                                    fw={600}
                                    key={`artist-${artist.id}`}
                                    size="md"
                                    to={generatePath(AppRoute.LIBRARY_ALBUM_ARTISTS_DETAIL, {
                                        albumArtistId: artist.id,
                                    })}
                                    variant="subtle"
                                >
                                    {artist.name}
                                </Text>
                            ))}
                        </Group>
                    </Stack>
                </LibraryHeader>
            </Stack>
            <DetailContainer>
                <Box component="section">
                    <Group
                        position="apart"
                        spacing="sm"
                    >
                        <Group>
                            <PlayButton onClick={() => handlePlay()} />
                            <Button
                                compact
                                loading={
                                    createFavoriteMutation.isLoading ||
                                    deleteFavoriteMutation.isLoading
                                }
                                onClick={handleFavorite}
                                variant="subtle"
                            >
                                {detailQuery?.data?.userFavorite ? (
                                    <RiHeartFill
                                        color="red"
                                        size={20}
                                    />
                                ) : (
                                    <RiHeartLine size={20} />
                                )}
                            </Button>
                            <Button
                                compact
                                onClick={(e) => {
                                    if (!detailQuery?.data) return;
                                    handleGeneralContextMenu(e, [detailQuery.data!]);
                                }}
                                variant="subtle"
                            >
                                <RiMoreFill size={20} />
                            </Button>
                        </Group>
                    </Group>
                </Box>
                {showGenres && (
                    <Box component="section">
                        <Group spacing="sm">
                            {detailQuery?.data?.genres?.map((genre) => (
                                <Button
                                    compact
                                    component={Link}
                                    key={`genre-${genre.id}`}
                                    radius={0}
                                    size="md"
                                    to={generatePath(AppRoute.LIBRARY_GENRES_SONGS, {
                                        genreId: genre.id,
                                    })}
                                    variant="outline"
                                >
                                    {genre.name}
                                </Button>
                            ))}
                        </Group>
                    </Box>
                )}
                {comment && (
                    <Box component="section">
                        <Spoiler maxHeight={75}>{replaceURLWithHTMLLinks(comment)}</Spoiler>
                    </Box>
                )}
                <Box component="section">
                    <Center>
                        <Group mr={5}>
                            <RiErrorWarningLine
                                color="var(--danger-color)"
                                size={30}
                            />
                        </Group>
                        <h2>{t('error.badAlbum', { postProcess: 'sentenceCase' })}</h2>
                    </Center>
                </Box>
            </DetailContainer>
        </AnimatedPage>
    );
};

export default DummyAlbumDetailRoute;
