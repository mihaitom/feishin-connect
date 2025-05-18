import type { AgGridReact as AgGridReactType } from '@ag-grid-community/react/lib/agGridReact';

import { Flex, Group, Stack } from '@mantine/core';
import debounce from 'lodash/debounce';
import { ChangeEvent, MutableRefObject, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { LibraryItem, SongListQuery } from '/@/renderer/api/types';
import { PageHeader, SearchInput } from '/@/renderer/components';
import { VirtualInfiniteGridRef } from '/@/renderer/components/virtual-grid';
import { FilterBar, LibraryHeaderBar } from '/@/renderer/features/shared';
import { SongListHeaderFilters } from '/@/renderer/features/songs/components/song-list-header-filters';
import { useContainerQuery } from '/@/renderer/hooks';
import { useDisplayRefresh } from '/@/renderer/hooks/use-display-refresh';
import { SongListFilter, useCurrentServer } from '/@/renderer/store';
import { usePlayButtonBehavior } from '/@/renderer/store/settings.store';

interface SongListHeaderProps {
    genreId?: string;
    gridRef: MutableRefObject<null | VirtualInfiniteGridRef>;
    itemCount?: number;
    tableRef: MutableRefObject<AgGridReactType | null>;
    title?: string;
}

export const SongListHeader = ({
    genreId,
    gridRef,
    itemCount,
    tableRef,
    title,
}: SongListHeaderProps) => {
    const { t } = useTranslation();
    const server = useCurrentServer();
    const cq = useContainerQuery();
    const genreRef = useRef<string>();

    const { customFilters, filter, handlePlay, refresh, search } = useDisplayRefresh<SongListQuery>(
        {
            gridRef,
            itemCount,
            itemType: LibraryItem.SONG,
            server,
            tableRef,
        },
    );

    const handleSearch = debounce((e: ChangeEvent<HTMLInputElement>) => {
        const updatedFilters = search(e) as SongListFilter;

        const filterWithCustom = {
            ...updatedFilters,
            ...customFilters,
        };

        refresh(filterWithCustom);
    }, 500);

    useEffect(() => {
        if (genreRef.current && genreRef.current !== genreId) {
            refresh(customFilters);
        }

        genreRef.current = genreId;
    }, [customFilters, genreId, refresh, tableRef]);

    const playButtonBehavior = usePlayButtonBehavior();

    return (
        <Stack
            ref={cq.ref}
            spacing={0}
        >
            <PageHeader backgroundColor="var(--titlebar-bg)">
                <Flex
                    justify="space-between"
                    w="100%"
                >
                    <LibraryHeaderBar>
                        <LibraryHeaderBar.PlayButton
                            onClick={() => handlePlay?.({ playType: playButtonBehavior })}
                        />
                        <LibraryHeaderBar.Title>
                            {title || t('page.trackList.title', { postProcess: 'titleCase' })}
                        </LibraryHeaderBar.Title>
                        <LibraryHeaderBar.Badge
                            isLoading={itemCount === null || itemCount === undefined}
                        >
                            {itemCount}
                        </LibraryHeaderBar.Badge>
                    </LibraryHeaderBar>
                    <Group>
                        <SearchInput
                            defaultValue={filter.searchTerm}
                            onChange={handleSearch}
                            openedWidth={cq.isMd ? 250 : cq.isSm ? 200 : 150}
                        />
                    </Group>
                </Flex>
            </PageHeader>
            <FilterBar>
                <SongListHeaderFilters
                    gridRef={gridRef}
                    itemCount={itemCount}
                    tableRef={tableRef}
                />
            </FilterBar>
        </Stack>
    );
};
