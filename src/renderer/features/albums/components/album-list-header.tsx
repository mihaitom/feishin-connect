import type { AgGridReact as AgGridReactType } from '@ag-grid-community/react/lib/agGridReact';

import { Flex, Group, Stack } from '@mantine/core';
import debounce from 'lodash/debounce';
import { type ChangeEvent, type MutableRefObject, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { PageHeader, SearchInput } from '/@/renderer/components';
import { VirtualInfiniteGridRef } from '/@/renderer/components/virtual-grid';
import { AlbumListHeaderFilters } from '/@/renderer/features/albums/components/album-list-header-filters';
import { FilterBar, LibraryHeaderBar } from '/@/renderer/features/shared';
import { useContainerQuery } from '/@/renderer/hooks';
import { useDisplayRefresh } from '/@/renderer/hooks/use-display-refresh';
import { AlbumListFilter, useCurrentServer, usePlayButtonBehavior } from '/@/renderer/store';
import { titleCase } from '/@/renderer/utils';
import { AlbumListQuery, LibraryItem } from '/@/shared/types/domain-types';

interface AlbumListHeaderProps {
    genreId?: string;
    gridRef: MutableRefObject<null | VirtualInfiniteGridRef>;
    itemCount?: number;
    tableRef: MutableRefObject<AgGridReactType | null>;
    title?: string;
}

export const AlbumListHeader = ({
    genreId,
    gridRef,
    itemCount,
    tableRef,
    title,
}: AlbumListHeaderProps) => {
    const { t } = useTranslation();
    const server = useCurrentServer();
    const cq = useContainerQuery();
    const playButtonBehavior = usePlayButtonBehavior();
    const genreRef = useRef<string | undefined>(undefined);
    const { filter, handlePlay, refresh, search } = useDisplayRefresh<AlbumListQuery>({
        gridRef,
        itemCount,
        itemType: LibraryItem.ALBUM,
        server,
        tableRef,
    });

    const handleSearch = debounce((e: ChangeEvent<HTMLInputElement>) => {
        const updatedFilters = search(e) as AlbumListFilter;

        refresh(updatedFilters);
    }, 500);

    useEffect(() => {
        if (genreRef.current && genreRef.current !== genreId) {
            refresh(filter);
        }

        genreRef.current = genreId;
    }, [filter, genreId, refresh, tableRef]);

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
                            {title ||
                                titleCase(t('page.albumList.title', { postProcess: 'titleCase' }))}
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
                <AlbumListHeaderFilters
                    gridRef={gridRef}
                    itemCount={itemCount}
                    tableRef={tableRef}
                />
            </FilterBar>
        </Stack>
    );
};
