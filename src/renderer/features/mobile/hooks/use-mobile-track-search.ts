import { useCallback, useEffect, useRef, useState } from 'react';

import { getItemImageUrl } from '/@/renderer/components/item-image/item-image';
import { cacheTrack } from '/@/renderer/features/mobile/lib/track-cache';
import { songsQueries } from '/@/renderer/features/songs/api/songs-api';
import { queryClient } from '/@/renderer/lib/react-query';
import { useAuthStore } from '/@/renderer/store/auth.store';
import { MobileTrackItem } from '/@/shared/mobile-ui/types';
import {
    LibraryItem,
    Played,
    ServerType,
    Song,
    SongListSort,
    SortOrder,
} from '/@/shared/types/domain-types';

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

// Mirrors use-remote-library.tsx's requestTracks handler, minus the WS
// request/response envelope — this is the same react-query fetch, called
// directly on search-term change / "load more" instead of on an IPC event.
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
                // Plain Subsonic has no generic "list all songs" endpoint — a
                // filterless list falls through to an empty search3 query,
                // not a reliable browse. Navidrome/Jellyfin both have real
                // generic listings and work fine filterless.
                if (server.type === ServerType.SUBSONIC && !searchTerm) {
                    const { items: songs } = await queryClient.fetchQuery(
                        songsQueries.random({
                            query: { limit: PAGE_SIZE, played: Played.All },
                            serverId: server.id,
                        }),
                    );
                    if (seq !== requestSeqRef.current) return;
                    setItems(cacheAndMapTracks(songs));
                    // RandomSongListQuery has no startIndex — not paginable,
                    // so "load more" just returns another random batch.
                    setHasMore(true);
                    return;
                }

                const { items: songs } = await queryClient.fetchQuery(
                    songsQueries.list({
                        query: {
                            limit: PAGE_SIZE,
                            searchTerm: searchTerm || undefined,
                            sortBy: SongListSort.NAME,
                            sortOrder: SortOrder.ASC,
                            startIndex,
                        },
                        serverId: server.id,
                    }),
                );
                if (seq !== requestSeqRef.current) return;
                const mapped = cacheAndMapTracks(songs);
                setItems((prev) => (append ? [...prev, ...mapped] : mapped));
                setHasMore(songs.length === PAGE_SIZE);
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
