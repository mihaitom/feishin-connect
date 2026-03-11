import { ListSearchInput } from '/@/renderer/features/shared/components/list-search-input';
import {
    CLIENT_SIDE_SONG_FILTERS,
    ListSortByDropdownControlled,
} from '/@/renderer/features/shared/components/list-sort-by-dropdown';
import { ListSortOrderToggleButtonControlled } from '/@/renderer/features/shared/components/list-sort-order-toggle-button';
import { useAppStore } from '/@/renderer/store/app.store';
import { Divider } from '/@/shared/components/divider/divider';
import { Flex } from '/@/shared/components/flex/flex';
import { Group } from '/@/shared/components/group/group';
import { LibraryItem, SongListSort, SortOrder } from '/@/shared/types/domain-types';

export const AlbumArtistDetailFavoriteSongsListHeaderFilters = () => {
    const albumArtistDetailFavoriteSongsSort = useAppStore(
        (state) => state.albumArtistDetailFavoriteSongsSort,
    );
    const setAlbumArtistDetailFavoriteSongsSort = useAppStore(
        (state) => state.actions.setAlbumArtistDetailFavoriteSongsSort,
    );
    const sortBy = albumArtistDetailFavoriteSongsSort.sortBy;
    const sortOrder = albumArtistDetailFavoriteSongsSort.sortOrder;

    return (
        <Flex justify="space-between">
            <Group gap="sm" w="100%">
                <ListSortByDropdownControlled
                    filters={CLIENT_SIDE_SONG_FILTERS}
                    itemType={LibraryItem.SONG}
                    setSortBy={(value) =>
                        setAlbumArtistDetailFavoriteSongsSort(value as SongListSort, sortOrder)
                    }
                    sortBy={sortBy}
                />
                <Divider orientation="vertical" />
                <ListSortOrderToggleButtonControlled
                    setSortOrder={(value) =>
                        setAlbumArtistDetailFavoriteSongsSort(sortBy, value as SortOrder)
                    }
                    sortOrder={sortOrder}
                />
                <Divider orientation="vertical" />
                <ListSearchInput />
            </Group>
        </Flex>
    );
};
