import { useCallback, useEffect, useRef, useState } from 'react';

import { getItemImageUrl } from '/@/renderer/components/item-image/item-image';
import { fetchPlaylistPage } from '/@/renderer/features/shared/api/library-fetchers';
import { useAuthStore } from '/@/renderer/store/auth.store';
import { MobilePlaylistItem } from '/@/shared/mobile-ui/types';
import { LibraryItem, Playlist } from '/@/shared/types/domain-types';

const PAGE_SIZE = 30;

const toMobilePlaylistItem = (playlist: Playlist): MobilePlaylistItem => ({
    duration: playlist.duration,
    id: playlist.id,
    imageUrl:
        getItemImageUrl({
            id: playlist.id,
            imageUrl: playlist.imageUrl,
            itemType: LibraryItem.PLAYLIST,
            serverId: playlist._serverId,
            type: 'itemCard',
            useRemoteUrl: true,
        }) ?? null,
    name: playlist.name,
    songCount: playlist.songCount,
});

// Wraps fetchPlaylistPage (shared with use-remote-library.tsx's
// requestPlaylists handler) in React state instead of the phone-remote's IPC
// request/response envelope.
export function useMobilePlaylistSearch(searchTerm: string) {
    const [items, setItems] = useState<MobilePlaylistItem[]>([]);
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
                const { hasMore: more, items: playlists } = await fetchPlaylistPage(server.id, {
                    pageSize: PAGE_SIZE,
                    searchTerm,
                    startIndex,
                });
                if (seq !== requestSeqRef.current) return;
                const mapped = playlists.map(toMobilePlaylistItem);
                setItems((prev) => (append ? [...prev, ...mapped] : mapped));
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
