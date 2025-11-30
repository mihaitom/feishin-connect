import { useQuery } from '@tanstack/react-query';
import { ChangeEvent, memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
    MultiSelectWithInvalidData,
    SelectWithInvalidData,
} from '/@/renderer/components/select-with-invalid-data';
import { useAlbumListFilters } from '/@/renderer/features/albums/hooks/use-album-list-filters';
import { artistsQueries } from '/@/renderer/features/artists/api/artists-api';
import { useGenreList } from '/@/renderer/features/genres/api/genres-api';
import { sharedQueries } from '/@/renderer/features/shared/api/shared-api';
import { useCurrentServer, useCurrentServerId } from '/@/renderer/store';
import { titleCase } from '/@/renderer/utils';
import { Divider } from '/@/shared/components/divider/divider';
import { Group } from '/@/shared/components/group/group';
import { NumberInput } from '/@/shared/components/number-input/number-input';
import { Spinner, SpinnerIcon } from '/@/shared/components/spinner/spinner';
import { Stack } from '/@/shared/components/stack/stack';
import { Switch } from '/@/shared/components/switch/switch';
import { Text } from '/@/shared/components/text/text';
import { YesNoSelect } from '/@/shared/components/yes-no-select/yes-no-select';
import { AlbumArtistListSort, LibraryItem, SortOrder } from '/@/shared/types/domain-types';

interface NavidromeAlbumFiltersProps {
    disableArtistFilter?: boolean;
}

export const NavidromeAlbumFilters = ({ disableArtistFilter }: NavidromeAlbumFiltersProps) => {
    const { t } = useTranslation();
    const server = useCurrentServer();
    const serverId = server.id;

    const {
        query,
        setAlbumArtist,
        setCompilation,
        setFavorite,
        setGenreId,
        setHasRating,
        setMaxYear,
        setMinYear,
        setRecentlyPlayed,
    } = useAlbumListFilters();

    const genreListQuery = useGenreList();

    const genreList = useMemo(() => {
        if (!genreListQuery?.data) return [];
        return genreListQuery.data.items.map((genre) => ({
            label: genre.name,
            value: genre.id,
        }));
    }, [genreListQuery.data]);

    const yesNoUndefinedFilters = useMemo(
        () => [
            {
                label: t('filter.isFavorited', { postProcess: 'sentenceCase' }),
                onChange: (favorite?: boolean) => {
                    setFavorite(favorite ?? null);
                },
                value: query.favorite,
            },
            {
                label: t('filter.isCompilation', { postProcess: 'sentenceCase' }),
                onChange: (compilation?: boolean) => {
                    setCompilation(compilation ?? null);
                },
                value: query.compilation,
            },
        ],
        [t, query.favorite, query.compilation, setFavorite, setCompilation],
    );

    const toggleFilters = useMemo(
        () => [
            {
                label: t('filter.isRated', { postProcess: 'sentenceCase' }),
                onChange: (e: ChangeEvent<HTMLInputElement>) => {
                    const hasRating = e.currentTarget.checked ? true : undefined;
                    setHasRating(hasRating ?? null);
                },
                value: query.hasRating,
            },
            {
                label: t('filter.isRecentlyPlayed', { postProcess: 'sentenceCase' }),
                onChange: (e: ChangeEvent<HTMLInputElement>) => {
                    const recentlyPlayed = e.currentTarget.checked ? true : undefined;
                    setRecentlyPlayed(recentlyPlayed ?? null);
                },
                value: query.recentlyPlayed,
            },
        ],
        [t, query.hasRating, query.recentlyPlayed, setHasRating, setRecentlyPlayed],
    );

    const handleYearFilter = useMemo(
        () => (e: number | string) => {
            // Handle empty string, null, undefined, or invalid numbers as clearing

            if (e === '' || e === null || e === undefined) {
                setMinYear(null);
                setMaxYear(null);
                return;
            }

            const year = typeof e === 'number' ? e : Number(e);
            // If it's a valid number, set it; otherwise clear
            if (!isNaN(year) && isFinite(year) && year > 0) {
                setMinYear(year);
                setMaxYear(year);
            } else {
                setMinYear(null);
                setMaxYear(null);
            }
        },
        [setMinYear, setMaxYear],
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

    return (
        <Stack p="0.8rem">
            {yesNoUndefinedFilters.map((filter) => (
                <YesNoSelect
                    key={`nd-filter-${filter.label}`}
                    label={filter.label}
                    onChange={filter.onChange}
                    value={filter.value ?? undefined}
                />
            ))}
            {toggleFilters.map((filter) => (
                <Group justify="space-between" key={`nd-filter-${filter.label}`}>
                    <Text>{filter.label}</Text>
                    <Switch checked={filter?.value ?? false} onChange={filter.onChange} />
                </Group>
            ))}
            <Divider my="0.5rem" />
            <NumberInput
                defaultValue={query.minYear ?? undefined}
                hideControls={false}
                label={t('common.year', { postProcess: 'titleCase' })}
                max={5000}
                min={0}
                onBlur={(e) => handleYearFilter(e.currentTarget.value)}
            />
            <MultiSelectWithInvalidData
                clearable
                data={genreList}
                defaultValue={query.genreIds}
                label={t('entity.genre', { count: 2, postProcess: 'sentenceCase' })}
                onChange={(e) => (e && e.length > 0 ? setGenreId(e) : setGenreId(null))}
                searchable
            />
            <SelectWithInvalidData
                clearable
                data={selectableAlbumArtists}
                defaultValue={query.artistIds ? query.artistIds[0] : undefined}
                disabled={disableArtistFilter}
                label={t('entity.artist', { count: 1, postProcess: 'titleCase' })}
                limit={300}
                onChange={(e) => setAlbumArtist(e ? [e] : null)}
                rightSection={albumArtistListQuery.isFetching ? <SpinnerIcon /> : undefined}
                searchable
            />
            <TagFilters />
        </Stack>
    );
};

interface TagFilterItemProps {
    label: string;
    onChange: (value: null | string) => void;
    options: string[];
    tagValue: string;
    value: string | undefined;
}

const TagFilterItem = memo(
    ({ label, onChange, options, tagValue, value }: TagFilterItemProps) => {
        return (
            <SelectWithInvalidData
                clearable
                data={options}
                defaultValue={value}
                key={tagValue}
                label={label}
                limit={100}
                onChange={onChange}
                searchable
            />
        );
    },
    (prevProps, nextProps) => {
        // Only re-render if the specific tag's value or options change
        // We don't compare onChange since it's a stable wrapper around handleTagFilter
        // and handleTagFilter itself is memoized and stable
        return (
            prevProps.tagValue === nextProps.tagValue &&
            prevProps.label === nextProps.label &&
            prevProps.value === nextProps.value &&
            prevProps.options === nextProps.options
        );
    },
);

TagFilterItem.displayName = 'TagFilterItem';

const TagFilters = () => {
    const { query, setCustom } = useAlbumListFilters();

    const serverId = useCurrentServerId();

    const tagsQuery = useQuery(
        sharedQueries.tags({
            options: {
                gcTime: 1000 * 60 * 60,
                staleTime: 1000 * 60 * 60,
            },
            query: {
                type: LibraryItem.ALBUM,
            },
            serverId,
        }),
    );

    const handleTagFilter = useMemo(
        () => (tag: string, e: null | string) => {
            setCustom((prev) => {
                if (!prev) {
                    return e ? { [tag]: e } : null;
                }

                if (e === null) {
                    const rest = Object.fromEntries(
                        Object.entries(prev).filter(([key]) => key !== tag),
                    );

                    return Object.keys(rest).length === 0 ? null : rest;
                }

                return {
                    ...prev,
                    [tag]: e,
                };
            });
        },
        [setCustom],
    );

    const tags = useMemo(() => {
        return (
            tagsQuery.data?.enumTags?.map((tag) => ({
                label: titleCase(tag.name),
                options: tag.options,
                value: tag.name,
            })) || []
        );
    }, [tagsQuery.data?.enumTags]);

    // Create stable onChange handlers for each tag using useMemo
    const tagHandlers = useMemo(() => {
        const handlers = new Map<string, (value: null | string) => void>();
        tags.forEach((tag) => {
            handlers.set(tag.value, (value: null | string) => handleTagFilter(tag.value, value));
        });
        return handlers;
    }, [tags, handleTagFilter]);

    if (tagsQuery.isLoading) {
        return <Spinner container />;
    }

    return (
        <>
            {tags.map((tag) => (
                <TagFilterItem
                    key={tag.value}
                    label={tag.label}
                    onChange={tagHandlers.get(tag.value)!}
                    options={tag.options}
                    tagValue={tag.value}
                    value={query._custom?.[tag.value] as string | undefined}
                />
            ))}
        </>
    );
};
