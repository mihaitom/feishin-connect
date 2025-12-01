import { useQuery } from '@tanstack/react-query';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
    MultiSelectWithInvalidData,
    SelectWithInvalidData,
} from '/@/renderer/components/select-with-invalid-data';
import { useGenreList } from '/@/renderer/features/genres/api/genres-api';
import { sharedQueries } from '/@/renderer/features/shared/api/shared-api';
import { useSongListFilters } from '/@/renderer/features/songs/hooks/use-song-list-filters';
import { useCurrentServerId } from '/@/renderer/store';
import { titleCase } from '/@/renderer/utils';
import { Divider } from '/@/shared/components/divider/divider';
import { NumberInput } from '/@/shared/components/number-input/number-input';
import { Spinner } from '/@/shared/components/spinner/spinner';
import { Stack } from '/@/shared/components/stack/stack';
import { YesNoSelect } from '/@/shared/components/yes-no-select/yes-no-select';
import { LibraryItem } from '/@/shared/types/domain-types';

export const NavidromeSongFilters = () => {
    const { t } = useTranslation();

    const { query, setFavorite, setGenreId, setMaxYear, setMinYear } = useSongListFilters();

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
        ],
        [t, query.favorite, setFavorite],
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
                defaultValue={query.genreId}
                label={t('entity.genre', { count: 2, postProcess: 'sentenceCase' })}
                onChange={(e) => (e && e.length > 0 ? setGenreId(e) : setGenreId(null))}
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
    const { query, setCustom } = useSongListFilters();

    const serverId = useCurrentServerId();

    const tagsQuery = useQuery(
        sharedQueries.tags({
            options: {
                gcTime: 1000 * 60 * 60,
                staleTime: 1000 * 60 * 60,
            },
            query: {
                type: LibraryItem.SONG,
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
