import { useEffect, useMemo } from 'react';

import { useListContext } from '/@/renderer/context/list-context';
import { usePlaylistSongListFilters } from '/@/renderer/features/playlists/hooks/use-playlist-song-list-filters';
import { useSearchTermFilter } from '/@/renderer/features/shared/hooks/use-search-term-filter';
import { searchLibraryItems } from '/@/renderer/features/shared/utils';
import { sortSongList } from '/@/shared/api/utils';
import { LibraryItem, PlaylistSongListResponse, Song } from '/@/shared/types/domain-types';

export function usePlaylistTrackList(data: PlaylistSongListResponse | undefined): {
    sortedAndFilteredSongs: Song[];
    totalCount: number;
} {
    const { setItemCount, setListData } = useListContext();
    const { searchTerm } = useSearchTermFilter();
    const { query } = usePlaylistSongListFilters();

    const sortedAndFilteredSongs = useMemo(() => {
        const raw = data?.items ?? [];

        if (searchTerm) {
            return searchLibraryItems(raw, searchTerm, LibraryItem.SONG);
        }

        return sortSongList(raw, query.sortBy, query.sortOrder);
    }, [data?.items, searchTerm, query.sortBy, query.sortOrder]);

    const totalCount = sortedAndFilteredSongs.length;

    useEffect(() => {
        setListData?.(sortedAndFilteredSongs);
        setItemCount?.(totalCount);
    }, [sortedAndFilteredSongs, totalCount, setListData, setItemCount]);

    return { sortedAndFilteredSongs, totalCount };
}
