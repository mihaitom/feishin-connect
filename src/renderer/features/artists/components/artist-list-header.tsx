import type { AgGridReact as AgGridReactType } from '@ag-grid-community/react/lib/agGridReact';
import type { ChangeEvent, MutableRefObject } from 'react';

import { Flex, Group, Stack } from '@mantine/core';
import debounce from 'lodash/debounce';
import { useTranslation } from 'react-i18next';

import { FilterBar } from '../../shared/components/filter-bar';

import { ArtistListQuery, LibraryItem } from '/@/renderer/api/types';
import { PageHeader, SearchInput } from '/@/renderer/components';
import { VirtualInfiniteGridRef } from '/@/renderer/components/virtual-grid';
import { ArtistListHeaderFilters } from '/@/renderer/features/artists/components/artist-list-header-filters';
import { LibraryHeaderBar } from '/@/renderer/features/shared';
import { useContainerQuery } from '/@/renderer/hooks';
import { useDisplayRefresh } from '/@/renderer/hooks/use-display-refresh';
import { ArtistListFilter, useCurrentServer } from '/@/renderer/store';

interface ArtistListHeaderProps {
    gridRef: MutableRefObject<null | VirtualInfiniteGridRef>;
    itemCount?: number;
    tableRef: MutableRefObject<AgGridReactType | null>;
}

export const ArtistListHeader = ({ gridRef, itemCount, tableRef }: ArtistListHeaderProps) => {
    const { t } = useTranslation();
    const server = useCurrentServer();
    const cq = useContainerQuery();

    const { filter, refresh, search } = useDisplayRefresh<ArtistListQuery>({
        gridRef,
        itemCount,
        itemType: LibraryItem.ARTIST,
        server,
        tableRef,
    });

    const handleSearch = debounce((e: ChangeEvent<HTMLInputElement>) => {
        const updatedFilters = search(e) as ArtistListFilter;
        refresh(updatedFilters);
    }, 500);

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
                        <LibraryHeaderBar.Title>
                            {t('entity.artist_other', { postProcess: 'titleCase' })}
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
                <ArtistListHeaderFilters
                    gridRef={gridRef}
                    tableRef={tableRef}
                />
            </FilterBar>
        </Stack>
    );
};
