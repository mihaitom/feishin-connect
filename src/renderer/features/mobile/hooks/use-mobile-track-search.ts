import { useCallback, useEffect, useRef, useState } from 'react';

import { getItemImageUrl } from '/@/renderer/components/item-image/item-image';
import { cacheTrack } from '/@/renderer/features/mobile/lib/track-cache';
import { fetchTrackPage } from '/@/renderer/features/shared/api/library-fetchers';
import { useAuthStore } from '/@/renderer/store/auth.store';
import { MobileTrackItem } from '/@/shared/mobile-ui/types';
import { LibraryItem, Song } from '/@/shared/types/domain-types';

const PAGE_SIZE = 30;

const toMobileTrackItem = (song: Song): MobileTrackItem => ({
    album: song.album,
    artistName: song.artistName,
    duration: song.duration,
    id: song.id,
    imageUrl:
        getItemImageUrl({
            id: song.id,
            imageUrl: song.imageUrl,
            itemType: LibraryItem.SONG,
            serverId: song._serverId,
            type: 'itemCard',
            useRemoteUrl: true,
        }) ?? null,
    name: song.name,
});

const cacheAndMapTracks = (songs: Song[]): MobileTrackItem[] =>
    songs.map((song) => {
        cacheTrack(song);
        return toMobileTrackItem(song);
    });

// Wraps fetchTrackPage (shared with use-remote-library.tsx's requestTracks
// handler) in React state instead of the phone-remote's IPC request/response
// envelope, called directly on search-term change / "load more".
export function useMobileTrackSearch(searchTerm: string) {
    const [items, setItems] = useState<MobileTrackItem[]>([]);
    const [hasMore, setHasMore] = useState(false);
    const requestSeqRef = useRef(0);

    const fetchPage = useCallback(
        async (startIndex: number, append: boolean) => {
            const server = useAuthStore.getState().currentServer;
            if (!server) {
                setItems([]);
                setHasMore(false);
                return;
            }

            const seq = ++requestSeqRef.current;
            try {
                const {
                    hasMore: more,
                    items: songs,
                    paginable,
                } = await fetchTrackPage(server.id, server.type, {
                    pageSize: PAGE_SIZE,
                    searchTerm,
                    startIndex,
                });
                if (seq !== requestSeqRef.current) return;
                const mapped = cacheAndMapTracks(songs);
                setItems((prev) => (append && paginable ? [...prev, ...mapped] : mapped));
                setHasMore(more);
            } catch {
                if (seq !== requestSeqRef.current) return;
                setItems([]);
                setHasMore(false);
            }
        },
        [searchTerm],
    );

    useEffect(() => {
        fetchPage(0, false).catch(() => {});
    }, [fetchPage]);

    const loadMore = useCallback(() => {
        fetchPage(items.length, true).catch(() => {});
    }, [fetchPage, items.length]);

    return { hasMore, items, loadMore };
}
