import { useCallback } from 'react';

import { api } from '/@/renderer/api';
import { cacheTrack, getCachedTrack } from '/@/renderer/features/mobile/lib/track-cache';
import { usePlayer } from '/@/renderer/features/player/context/player-context';
import {
    addSongToPlaylist,
    fetchSimilarSongs,
} from '/@/renderer/features/shared/api/library-fetchers';
import { queryClient } from '/@/renderer/lib/react-query';
import { useArtistRadioCount } from '/@/renderer/store';
import { useAuthStore } from '/@/renderer/store/auth.store';
import { Play } from '/@/shared/mobile-ui/types';

// Mirrors use-remote-library.tsx's requestPlayTrack/requestPlayTrackRadio/
// requestAddToPlaylist handlers — same react-query fetches, called directly
// instead of over the WS/IPC bridge. Shared by the Tracks page and the
// Queue page, both of which mount a TrackActionSheet.
export function useMobileTrackActions() {
    const { addToQueueByData } = usePlayer();
    const radioCount = useArtistRadioCount();

    const onPlay = useCallback(
        async (id: string, playType: Play = Play.NOW) => {
            const server = useAuthStore.getState().currentServer;
            if (!server) return;

            let song = getCachedTrack(id);
            if (!song) {
                try {
                    song = await queryClient.fetchQuery({
                        queryFn: () =>
                            api.controller.getSongDetail({
                                apiClientProps: { serverId: server.id },
                                query: { id },
                            }),
                        queryKey: ['mobile-song-detail', server.id, id],
                    });
                } catch {
                    return;
                }
            }
            if (!song) return;

            cacheTrack(song);
            addToQueueByData([song], playType, song.id);
        },
        [addToQueueByData],
    );

    const onPlayTrackRadio = useCallback(
        async (id: string, playType: Play) => {
            const server = useAuthStore.getState().currentServer;
            if (!server) return;

            let song = getCachedTrack(id);
            if (!song) {
                try {
                    song = await queryClient.fetchQuery({
                        queryFn: () =>
                            api.controller.getSongDetail({
                                apiClientProps: { serverId: server.id },
                                query: { id },
                            }),
                        queryKey: ['mobile-song-detail', server.id, id],
                    });
                } catch {
                    return;
                }
            }
            if (!song) return;

            const similarSongs = await fetchSimilarSongs(server.id, song.id, radioCount);
            if (similarSongs.length > 0) {
                addToQueueByData([song, ...similarSongs], playType, song.id);
            }
        },
        [addToQueueByData, radioCount],
    );

    const onAddToPlaylist = useCallback(async (playlistId: string, songId: string) => {
        const server = useAuthStore.getState().currentServer;
        if (!server) return;
        await addSongToPlaylist(server.id, playlistId, songId);
    }, []);

    return { onAddToPlaylist, onPlay, onPlayTrackRadio };
}
