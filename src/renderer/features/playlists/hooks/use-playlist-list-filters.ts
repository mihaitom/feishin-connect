import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { useSearchTermFilter } from '/@/renderer/features/shared/hooks/use-search-term-filter';
import { useSortByFilter } from '/@/renderer/features/shared/hooks/use-sort-by-filter';
import { useSortOrderFilter } from '/@/renderer/features/shared/hooks/use-sort-order-filter';
import { FILTER_KEYS } from '/@/renderer/features/shared/utils';
import { parseCustomFiltersParam, setJsonSearchParam } from '/@/renderer/utils/query-params';
import { PlaylistListSort } from '/@/shared/types/domain-types';
import { ItemListKey } from '/@/shared/types/types';

export const usePlaylistListFilters = () => {
    const sortByFilter = useSortByFilter<PlaylistListSort>(null, ItemListKey.PLAYLIST);
    const sortOrderFilter = useSortOrderFilter(null, ItemListKey.PLAYLIST);

    const { searchTerm, setSearchTerm } = useSearchTermFilter('');

    const [searchParams, setSearchParams] = useSearchParams();

    const custom = useMemo(
        () => parseCustomFiltersParam(searchParams, FILTER_KEYS.PLAYLIST.CUSTOM),
        [searchParams],
    );

    const setCustom = useCallback(
        (
            value:
                | ((prev: null | Record<string, any>) => null | Record<string, any>)
                | null
                | Record<string, any>,
        ) => {
            setSearchParams(
                (prev) => {
                    const currentCustom = parseCustomFiltersParam(
                        prev,
                        FILTER_KEYS.PLAYLIST.CUSTOM,
                    );
                    let newValue =
                        typeof value === 'function' ? value(currentCustom ?? null) : value;
                    // Convert empty objects to null to clear them from URL
                    if (
                        newValue &&
                        typeof newValue === 'object' &&
                        Object.keys(newValue).length === 0
                    ) {
                        newValue = null;
                    }
                    return setJsonSearchParam(prev, FILTER_KEYS.PLAYLIST.CUSTOM, newValue);
                },
                { replace: true },
            );
        },
        [setSearchParams],
    );

    const query = useMemo(
        () => ({
            _custom: custom ?? undefined,
            searchTerm: searchTerm ?? undefined,
            sortBy: sortByFilter.sortBy ?? undefined,
            sortOrder: sortOrderFilter.sortOrder ?? undefined,
        }),
        [custom, searchTerm, sortByFilter.sortBy, sortOrderFilter.sortOrder],
    );

    return {
        query,
        setCustom,
        setSearchTerm,
    };
};
