import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { MultiSelectWithInvalidData } from '/@/renderer/components/select-with-invalid-data';
import { useAlbumListFilters } from '/@/renderer/features/albums/hooks/use-album-list-filters';
import { artistsQueries } from '/@/renderer/features/artists/api/artists-api';
import { genresQueries } from '/@/renderer/features/genres/api/genres-api';
import { sharedQueries } from '/@/renderer/features/shared/api/shared-api';
import { AlbumListFilter, useCurrentServerId } from '/@/renderer/store';
import { Divider } from '/@/shared/components/divider/divider';
import { Group } from '/@/shared/components/group/group';
import { NumberInput } from '/@/shared/components/number-input/number-input';
import { SpinnerIcon } from '/@/shared/components/spinner/spinner';
import { Stack } from '/@/shared/components/stack/stack';
import { YesNoSelect } from '/@/shared/components/yes-no-select/yes-no-select';
import {
    AlbumArtistListSort,
    GenreListSort,
    LibraryItem,
    SortOrder,
} from '/@/shared/types/domain-types';

interface JellyfinAlbumFiltersProps {
    customFilters?: Partial<AlbumListFilter>;
    disableArtistFilter?: boolean;
    onFilterChange: (filters: AlbumListFilter) => void;
}

export const JellyfinAlbumFilters = ({ disableArtistFilter }: JellyfinAlbumFiltersProps) => {
    const { t } = useTranslation();
    const serverId = useCurrentServerId();

    const {
        query,
        setAlbumArtist,
        setCompilation,
        setCustom,
        setFavorite,
        setGenreId,
        setMaxYear,
        setMinYear,
    } = useAlbumListFilters();

    // TODO - eventually replace with /items/filters endpoint to fetch genres and tags specific to the selected library
    const genreListQuery = useQuery(
        genresQueries.list({
            query: {
                sortBy: GenreListSort.NAME,
                sortOrder: SortOrder.ASC,
                startIndex: 0,
            },
            serverId,
        }),
    );

    const genreList = useMemo(() => {
        if (!genreListQuery?.data) return [];
        return genreListQuery.data.items.map((genre) => ({
            label: genre.name,
            value: genre.id,
        }));
    }, [genreListQuery.data]);

    const tagsQuery = useQuery(
        sharedQueries.tags({
            options: {
                gcTime: 1000 * 60 * 2,
                staleTime: 1000 * 60 * 1,
            },
            query: {
                type: LibraryItem.ALBUM,
            },
            serverId,
        }),
    );

    const yesNoFilter = useMemo(() => {
        const filters = [
            {
                label: t('filter.isFavorited', { postProcess: 'sentenceCase' }),
                onChange: (favoriteValue?: boolean) => {
                    setFavorite(favoriteValue ?? null);
                },
                value: query.favorite,
            },
        ];

        if (query.artistIds?.length) {
            filters.push({
                label: t('filter.isCompilation', { postProcess: 'sentenceCase' }),
                onChange: (compilationValue?: boolean) => {
                    setCompilation(compilationValue ?? null);
                },
                value: query.compilation,
            });
        }
        return filters;
    }, [
        t,
        query.favorite,
        query.artistIds?.length,
        query.compilation,
        setFavorite,
        setCompilation,
    ]);

    const handleMinYearFilter = useMemo(
        () => (e: number | string) => {
            // Handle empty string, null, undefined, or invalid numbers as clearing
            if (e === '' || e === null || e === undefined || isNaN(Number(e))) {
                setMinYear(null);
                return;
            }

            const year = typeof e === 'number' ? e : Number(e);
            // If it's a valid number within range, set it; otherwise clear
            if (!isNaN(year) && isFinite(year) && year >= 1700 && year <= 2300) {
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
            // If it's a valid number within range, set it; otherwise clear
            if (!isNaN(year) && isFinite(year) && year >= 1700 && year <= 2300) {
                setMaxYear(year);
            } else {
                setMaxYear(null);
            }
        },
        [setMaxYear],
    );

    const handleGenresFilter = useMemo(
        () => (e: string[] | undefined) => {
            setGenreId(e && e.length > 0 ? e : null);
        },
        [setGenreId],
    );

    const albumArtistListQuery = useQuery(
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

    const selectableAlbumArtists = useMemo(() => {
        if (!albumArtistListQuery?.data?.items) return [];

        return albumArtistListQuery?.data?.items?.map((artist) => ({
            label: artist.name,
            value: artist.id,
        }));
    }, [albumArtistListQuery.data?.items]);

    const handleAlbumArtistFilter = (e: null | string[]) => {
        setAlbumArtist(e ?? null);
    };

    const handleTagFilter = useMemo(
        () => (e: string[] | undefined) => {
            setCustom((prev) => {
                if (!prev) {
                    return e && e.length > 0 ? { [e.join('|')]: e.join('|') } : null;
                }

                if (!e || e.length === 0) {
                    // Remove all tag-related properties (they use '|' joined keys)
                    const rest = Object.fromEntries(
                        Object.entries(prev).filter(([key]) => !key.includes('|')),
                    );

                    return Object.keys(rest).length === 0 ? null : rest;
                }

                // Remove old tag entries and add new one
                const rest = Object.fromEntries(
                    Object.entries(prev).filter(([key]) => !key.includes('|')),
                );
                const tagKey = e.join('|');

                return {
                    ...rest,
                    [tagKey]: tagKey,
                };
            });
        },
        [setCustom],
    );

    return (
        <Stack p="0.8rem">
            {yesNoFilter.map((filter) => (
                <YesNoSelect
                    key={`jf-filter-${filter.label}`}
                    label={filter.label}
                    onChange={filter.onChange}
                    value={filter.value ?? undefined}
                />
            ))}
            <Divider my="0.5rem" />
            <Group grow>
                <NumberInput
                    defaultValue={query.minYear ?? undefined}
                    hideControls={false}
                    label={t('filter.fromYear', { postProcess: 'sentenceCase' })}
                    max={2300}
                    min={1700}
                    onBlur={(e) => handleMinYearFilter(e.currentTarget.value)}
                    required={!!query.minYear}
                />
                <NumberInput
                    defaultValue={query.maxYear ?? undefined}
                    hideControls={false}
                    label={t('filter.toYear', { postProcess: 'sentenceCase' })}
                    max={2300}
                    min={1700}
                    onBlur={(e) => handleMaxYearFilter(e.currentTarget.value)}
                    required={!!query.minYear}
                />
            </Group>
            <MultiSelectWithInvalidData
                clearable
                data={genreList}
                defaultValue={query.genreIds ?? undefined}
                label={t('entity.genre', { count: 2, postProcess: 'sentenceCase' })}
                onChange={(e) => handleGenresFilter(e)}
                searchable
            />

            <MultiSelectWithInvalidData
                clearable
                data={selectableAlbumArtists}
                defaultValue={query.artistIds ?? undefined}
                disabled={disableArtistFilter}
                label={t('entity.artist', { count: 2, postProcess: 'sentenceCase' })}
                limit={300}
                onChange={handleAlbumArtistFilter}
                rightSection={albumArtistListQuery.isFetching ? <SpinnerIcon /> : undefined}
                searchable
            />
            {tagsQuery.data?.boolTags && tagsQuery.data.boolTags.length > 0 && (
                <MultiSelectWithInvalidData
                    clearable
                    data={tagsQuery.data.boolTags}
                    defaultValue={query._custom?.[tagsQuery.data.boolTags.join('|')] ?? undefined}
                    label={t('common.tags', { postProcess: 'sentenceCase' })}
                    onChange={handleTagFilter}
                    searchable
                    width={250}
                />
            )}
        </Stack>
    );
};
