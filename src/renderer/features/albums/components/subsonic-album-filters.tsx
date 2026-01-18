import { useSuspenseQuery } from '@tanstack/react-query';
import { ChangeEvent, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { getItemImageUrl } from '/@/renderer/components/item-image/item-image';
import { useListContext } from '/@/renderer/context/list-context';
import { useAlbumListFilters } from '/@/renderer/features/albums/hooks/use-album-list-filters';
import { artistsQueries } from '/@/renderer/features/artists/api/artists-api';
import { useGenreList } from '/@/renderer/features/genres/api/genres-api';
import {
    ArtistMultiSelectRow,
    GenreMultiSelectRow,
} from '/@/renderer/features/shared/components/multi-select-rows';
import { useCurrentServerId } from '/@/renderer/store';
import { useAppStore, useAppStoreActions } from '/@/renderer/store/app.store';
import { Divider } from '/@/shared/components/divider/divider';
import { Group } from '/@/shared/components/group/group';
import { VirtualMultiSelect } from '/@/shared/components/multi-select/virtual-multi-select';
import { NumberInput } from '/@/shared/components/number-input/number-input';
import { SegmentedControl } from '/@/shared/components/segmented-control/segmented-control';
import { Stack } from '/@/shared/components/stack/stack';
import { Switch } from '/@/shared/components/switch/switch';
import { Text } from '/@/shared/components/text/text';
import { useDebouncedCallback } from '/@/shared/hooks/use-debounced-callback';
import { AlbumArtistListSort, LibraryItem, SortOrder } from '/@/shared/types/domain-types';

interface SubsonicAlbumFiltersProps {
    disableArtistFilter?: boolean;
}

export const SubsonicAlbumFilters = ({ disableArtistFilter }: SubsonicAlbumFiltersProps) => {
    const { t } = useTranslation();

    const serverId = useCurrentServerId();

    const { customFilters } = useListContext();

    const isGenrePage = customFilters?.genreIds !== undefined;

    const { query, setAlbumArtist, setFavorite, setGenreId, setMaxYear, setMinYear } =
        useAlbumListFilters();

    const albumArtistListQuery = useSuspenseQuery(
        artistsQueries.albumArtistList({
            options: {
                gcTime: 1000 * 60 * 2,
                staleTime: 1000 * 60 * 1,
            },
            query: {
                sortBy: AlbumArtistListSort.NAME,
                sortOrder: SortOrder.ASC,
                startIndex: 0,
            },
            serverId,
        }),
    );

    const items = albumArtistListQuery?.data?.items;

    const selectableAlbumArtists = useMemo(() => {
        if (!items) return [];

        return items.map((artist) => ({
            albumCount: artist.albumCount,
            imageUrl: getItemImageUrl({
                id: artist.id,
                itemType: LibraryItem.ARTIST,
                type: 'table',
            }),
            label: artist.name,
            songCount: artist.songCount,
            value: artist.id,
        }));
    }, [items]);

    const handleAlbumArtistFilter = useCallback(
        (e: null | string[]) => {
            setAlbumArtist(e ?? null);
        },
        [setAlbumArtist],
    );

    const genreListQuery = useGenreList();

    const genreList = useMemo(() => {
        if (!genreListQuery?.data) return [];
        return genreListQuery.data.items.map((genre) => ({
            albumCount: genre.albumCount,
            label: genre.name,
            songCount: genre.songCount,
            value: genre.id,
        }));
    }, [genreListQuery.data]);

    const selectedGenreIds = useMemo(() => query.genreIds || [], [query.genreIds]);

    const handleGenresFilter = useCallback(
        (e: null | string[]) => {
            if (e && e.length > 0) {
                setGenreId([e[0]]);
            } else {
                setGenreId(null);
            }
        },
        [setGenreId],
    );

    const genreFilterLabel = useMemo(() => {
        return (
            <Text fw={500} size="sm">
                {t('entity.genre', { count: 1, postProcess: 'sentenceCase' })}
            </Text>
        );
    }, [t]);

    const toggleFilters = useMemo(
        () => [
            {
                label: t('filter.isFavorited', { postProcess: 'sentenceCase' }),
                onChange: (e: ChangeEvent<HTMLInputElement>) => {
                    const favoriteValue = e.target.checked ? true : undefined;
                    setFavorite(favoriteValue ?? null);
                },
                value: query.favorite,
            },
        ],
        [t, query.favorite, setFavorite],
    );

    const handleMinYearFilter = useMemo(
        () => (e: number | string) => {
            // Handle empty string, null, undefined, or invalid numbers as clearing
            if (e === '' || e === null || e === undefined || isNaN(Number(e))) {
                setMinYear(null);
                return;
            }

            const year = typeof e === 'number' ? e : Number(e);
            // If it's a valid number, set it; otherwise clear
            if (!isNaN(year) && isFinite(year) && year > 0) {
                setMinYear(year);
            } else {
                setMinYear(null);
            }
        },
        [setMinYear],
    );

    const handleMaxYearFilter = useMemo(
        () => (e: number | string) => {
            // Handle empty string, null, undefined, or invalid numbers as clearing
            if (e === '' || e === null || e === undefined || isNaN(Number(e))) {
                setMaxYear(null);
                return;
            }

            const year = typeof e === 'number' ? e : Number(e);
            // If it's a valid number, set it; otherwise clear
            if (!isNaN(year) && isFinite(year) && year > 0) {
                setMaxYear(year);
            } else {
                setMaxYear(null);
            }
        },
        [setMaxYear],
    );

    const debouncedHandleMinYearFilter = useDebouncedCallback(handleMinYearFilter, 300);
    const debouncedHandleMaxYearFilter = useDebouncedCallback(handleMaxYearFilter, 300);

    const artistSelectMode = useAppStore((state) => state.artistSelectMode);
    const { setArtistSelectMode } = useAppStoreActions();

    const selectedArtistIds = useMemo(() => query.artistIds || [], [query.artistIds]);

    const handleArtistSelectModeChange = useCallback(
        (value: string) => {
            const newMode = value as 'multi' | 'single';
            setArtistSelectMode(newMode);

            if (newMode === 'single' && selectedArtistIds.length > 1) {
                setAlbumArtist([selectedArtistIds[0]]);
            }
        },
        [selectedArtistIds, setAlbumArtist, setArtistSelectMode],
    );

    const artistFilterLabel = useMemo(() => {
        return (
            <Group gap="xs" justify="space-between" w="100%">
                <Text fw={500} size="sm">
                    {t('entity.artist', { count: 2, postProcess: 'sentenceCase' })}
                </Text>
                <SegmentedControl
                    data={[
                        {
                            label: t('common.filter_single', { postProcess: 'titleCase' }),
                            value: 'single',
                        },
                        {
                            label: t('common.filter_multiple', { postProcess: 'titleCase' }),
                            value: 'multi',
                        },
                    ]}
                    onChange={handleArtistSelectModeChange}
                    size="xs"
                    value={artistSelectMode}
                />
            </Group>
        );
    }, [artistSelectMode, handleArtistSelectModeChange, t]);

    return (
        <Stack px="md" py="md">
            {toggleFilters.map((filter) => (
                <Group justify="space-between" key={`ss-filter-${filter.label}`}>
                    <Text>{filter.label}</Text>
                    <Switch defaultChecked={filter.value ?? false} onChange={filter.onChange} />
                </Group>
            ))}
            {!disableArtistFilter && (
                <>
                    <Divider my="md" />
                    <VirtualMultiSelect
                        displayCountType="album"
                        height={300}
                        label={artistFilterLabel}
                        onChange={handleAlbumArtistFilter}
                        options={selectableAlbumArtists}
                        RowComponent={ArtistMultiSelectRow}
                        singleSelect={artistSelectMode === 'single'}
                        value={selectedArtistIds}
                    />
                </>
            )}
            {!isGenrePage && (
                <>
                    <Divider my="md" />
                    <VirtualMultiSelect
                        displayCountType="album"
                        height={220}
                        label={genreFilterLabel}
                        onChange={handleGenresFilter}
                        options={genreList}
                        RowComponent={GenreMultiSelectRow}
                        singleSelect={true}
                        value={selectedGenreIds}
                    />
                </>
            )}
            <Divider my="md" />
            <Group grow>
                <NumberInput
                    defaultValue={query.minYear ?? undefined}
                    disabled={Boolean(query.genreIds && query.genreIds.length > 0)}
                    hideControls={false}
                    label={t('filter.fromYear', { postProcess: 'sentenceCase' })}
                    max={5000}
                    min={0}
                    onChange={(e) => debouncedHandleMinYearFilter(e)}
                />
                <NumberInput
                    defaultValue={query.maxYear ?? undefined}
                    disabled={Boolean(query.genreIds && query.genreIds.length > 0)}
                    hideControls={false}
                    label={t('filter.toYear', { postProcess: 'sentenceCase' })}
                    max={5000}
                    min={0}
                    onChange={(e) => debouncedHandleMaxYearFilter(e)}
                />
            </Group>
        </Stack>
    );
};
