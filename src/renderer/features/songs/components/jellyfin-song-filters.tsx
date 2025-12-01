import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { MultiSelectWithInvalidData } from '/@/renderer/components/select-with-invalid-data';
import { useGenreList } from '/@/renderer/features/genres/api/genres-api';
import { sharedQueries } from '/@/renderer/features/shared/api/shared-api';
import { useSongListFilters } from '/@/renderer/features/songs/hooks/use-song-list-filters';
import { SongListFilter, useCurrentServerId } from '/@/renderer/store';
import { Divider } from '/@/shared/components/divider/divider';
import { Group } from '/@/shared/components/group/group';
import { NumberInput } from '/@/shared/components/number-input/number-input';
import { Stack } from '/@/shared/components/stack/stack';
import { Text } from '/@/shared/components/text/text';
import { YesNoSelect } from '/@/shared/components/yes-no-select/yes-no-select';
import { LibraryItem } from '/@/shared/types/domain-types';

interface JellyfinSongFiltersProps {
    customFilters?: Partial<SongListFilter>;
}

export const JellyfinSongFilters = ({ customFilters }: JellyfinSongFiltersProps) => {
    const serverId = useCurrentServerId();
    const { t } = useTranslation();
    const { query, setCustom, setFavorite, setMaxYear, setMinYear } = useSongListFilters();

    const isGenrePage = customFilters?.genreIds !== undefined;

    // Despite the fact that getTags returns genres, it only returns genre names.
    // We prefer using IDs, hence the double query
    const genreListQuery = useGenreList();

    const genreList = useMemo(() => {
        if (!genreListQuery.data) return [];
        return genreListQuery.data.items.map((genre) => ({
            label: genre.name,
            value: genre.id,
        }));
    }, [genreListQuery.data]);

    const tagsQuery = useQuery(
        sharedQueries.tags({
            query: {
                type: LibraryItem.SONG,
            },
            serverId,
        }),
    );

    const selectedGenres = useMemo(() => {
        return query._custom?.GenreIds?.split(',');
    }, [query._custom?.GenreIds]);

    const selectedTags = useMemo(() => {
        return query._custom?.Tags?.split('|');
    }, [query._custom?.Tags]);

    const yesNoFilters = [
        {
            label: t('filter.isFavorited', { postProcess: 'sentenceCase' }),
            onChange: (favorite: boolean | undefined) => {
                setFavorite(favorite ?? null);
            },
            value: query.favorite,
        },
    ];

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
            setCustom((prev) => {
                if (!e || e.length === 0) {
                    // Remove GenreIds and IncludeItemTypes if genres are cleared
                    const rest = { ...prev };
                    delete rest.GenreIds;
                    delete rest.IncludeItemTypes;
                    // Keep jellyfin-specific properties
                    return Object.keys(rest).length === 0 ? null : rest;
                }

                return {
                    ...prev,
                    GenreIds: e.join(','),
                    IncludeItemTypes: 'Audio',
                    ...prev?.jellyfin,
                };
            });
        },
        [setCustom],
    );

    const handleTagFilter = useMemo(
        () => (e: string[] | undefined) => {
            setCustom((prev) => {
                if (!e || e.length === 0) {
                    // Remove Tags if cleared
                    const rest = { ...prev };
                    delete rest.Tags;
                    // Keep IncludeItemTypes and jellyfin-specific properties
                    if (rest.IncludeItemTypes) {
                        return rest;
                    }
                    return Object.keys(rest).length === 0 ? null : rest;
                }

                return {
                    ...prev,
                    IncludeItemTypes: 'Audio',
                    Tags: e.join('|'),
                    ...prev?.jellyfin,
                };
            });
        },
        [setCustom],
    );

    return (
        <Stack p="0.8rem">
            {yesNoFilters.map((filter) => (
                <Group justify="space-between" key={`nd-filter-${filter.label}`}>
                    <Text>{filter.label}</Text>
                    <YesNoSelect onChange={filter.onChange} size="xs" value={filter.value} />
                </Group>
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
            {!isGenrePage && (
                <Group grow>
                    <MultiSelectWithInvalidData
                        clearable
                        data={genreList}
                        defaultValue={selectedGenres}
                        label={t('entity.genre', { count: 1, postProcess: 'sentenceCase' })}
                        onChange={(e) => handleGenresFilter(e)}
                        searchable
                        width={250}
                    />
                </Group>
            )}
            {tagsQuery.data?.boolTags && tagsQuery.data.boolTags.length > 0 && (
                <Group grow>
                    <MultiSelectWithInvalidData
                        clearable
                        data={tagsQuery.data.boolTags}
                        defaultValue={selectedTags}
                        label={t('common.tags', { postProcess: 'sentenceCase' })}
                        onChange={(e) => handleTagFilter(e)}
                        searchable
                        width={250}
                    />
                </Group>
            )}
        </Stack>
    );
};
