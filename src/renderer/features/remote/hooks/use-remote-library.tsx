import isElectron from 'is-electron';
import { useEffect } from 'react';

import { api } from '/@/renderer/api';
import { getItemImageUrl } from '/@/renderer/components/item-image/item-image';
import { usePlayer } from '/@/renderer/features/player/context/player-context';
import { playlistsQueries } from '/@/renderer/features/playlists/api/playlists-api';
import { radioQueries } from '/@/renderer/features/radio/api/radio-api';
import { useRadioStore } from '/@/renderer/features/radio/hooks/use-radio-player';
import { songsQueries } from '/@/renderer/features/songs/api/songs-api';
import { queryClient } from '/@/renderer/lib/react-query';
import { useAuthStore } from '/@/renderer/store/auth.store';
import { usePlayerStoreBase } from '/@/renderer/store/player.store';
import { useRemoteSettings } from '/@/renderer/store/settings.store';
import {
    LibraryItem,
    Played,
    Playlist,
    PlaylistListSort,
    ServerType,
    Song,
    SongListSort,
    SortOrder,
} from '/@/shared/types/domain-types';
import { RemotePlaylistItem, RemoteRadioItem, RemoteTrackItem } from '/@/shared/types/remote-types';
import { Play } from '/@/shared/types/types';

const remote = isElectron() ? window.api.remote : null;
const ipc = isElectron() ? window.api.ipc : null;

const DEFAULT_PAGE_SIZE = 30;

// fetchSongsByItemType() (player-context.tsx) has no LibraryItem.SONG case —
// it only handles ALBUM/ALBUM_ARTIST/ARTIST/FOLDER/GENRE/PLAYLIST, so
// addToQueueByFetch(..., LibraryItem.SONG, ...) silently resolves an empty
// song list and plays nothing. Cache the full Song objects we already fetched
// for the tracks list and hand them to addToQueueByData() directly instead,
// which needs no further lookup. Falls back to a single-song detail fetch for
// the rare case a track is played without ever having been listed first.
const trackCache = new Map<string, Song>();

const toRemoteTrackItem = (song: Song): RemoteTrackItem => ({
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

const cacheAndMapTracks = (songs: Song[]): RemoteTrackItem[] =>
    songs.map((song) => {
        trackCache.set(song.id, song);
        return toRemoteTrackItem(song);
    });

const toRemotePlaylistItem = (playlist: Playlist): RemotePlaylistItem => ({
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

/**
 * Bridges phone-remote library-browsing requests (tracks/playlists/radio
 * search + play, queue jump) to the real, authenticated media-server session.
 * Unlike Connect's use-remote-connect.tsx, this needs no Context-free store
 * escape hatch — AudioPlayers (where this hook mounts) is a child of
 * PlayerProvider, so usePlayer() is directly available here.
 */
export const useRemoteLibrary = () => {
    const isRemoteEnabled = useRemoteSettings().enabled;
    const { addToQueueByData, addToQueueByFetch } = usePlayer();

    useEffect(() => {
        if (!isRemoteEnabled || !remote) return;

        remote.requestTracks(async ({ limit, requestId, searchTerm, startIndex }) => {
            const server = useAuthStore.getState().currentServer;
            if (!server) {
                remote?.respondTracks(requestId, false, []);
                return;
            }

            const pageSize = limit ?? DEFAULT_PAGE_SIZE;
            try {
                // Plain Subsonic has no generic "list all songs" endpoint —
                // a filterless getSongList falls through to an empty search3
                // query, which isn't a reliable browse. Navidrome/Jellyfin
                // both have real generic listings and work fine filterless.
                if (server.type === ServerType.SUBSONIC && !searchTerm) {
                    const { items } = await queryClient.fetchQuery(
                        songsQueries.random({
                            query: { limit: pageSize, played: Played.All },
                            serverId: server.id,
                        }),
                    );
                    // RandomSongListQuery has no startIndex — not paginable,
                    // so "load more" just returns another random batch.
                    remote?.respondTracks(requestId, true, cacheAndMapTracks(items));
                    return;
                }

                const { items } = await queryClient.fetchQuery(
                    songsQueries.list({
                        query: {
                            limit: pageSize,
                            searchTerm,
                            sortBy: SongListSort.NAME,
                            sortOrder: SortOrder.ASC,
                            startIndex: startIndex ?? 0,
                        },
                        serverId: server.id,
                    }),
                );
                remote?.respondTracks(
                    requestId,
                    items.length === pageSize,
                    cacheAndMapTracks(items),
                );
            } catch {
                remote?.respondTracks(requestId, false, []);
            }
        });

        remote.requestPlaylists(async ({ limit, requestId, searchTerm, startIndex }) => {
            const server = useAuthStore.getState().currentServer;
            if (!server) {
                remote?.respondPlaylists(requestId, false, []);
                return;
            }

            const pageSize = limit ?? DEFAULT_PAGE_SIZE;
            try {
                const { items } = await queryClient.fetchQuery(
                    playlistsQueries.list({
                        query: {
                            limit: pageSize,
                            searchTerm,
                            sortBy: PlaylistListSort.NAME,
                            sortOrder: SortOrder.ASC,
                            startIndex: startIndex ?? 0,
                        },
                        serverId: server.id,
                    }),
                );
                remote?.respondPlaylists(
                    requestId,
                    items.length === pageSize,
                    items.map(toRemotePlaylistItem),
                );
            } catch {
                remote?.respondPlaylists(requestId, false, []);
            }
        });

        remote.requestRadio(async ({ requestId }) => {
            const server = useAuthStore.getState().currentServer;
            if (!server) {
                remote?.respondRadio(requestId, []);
                return;
            }

            try {
                const stations = await queryClient.fetchQuery(
                    radioQueries.list({ query: undefined, serverId: server.id }),
                );
                const items: RemoteRadioItem[] = stations.map((station) => ({
                    homepageUrl: station.homepageUrl,
                    id: station.id,
                    imageUrl: station.imageUrl ?? null,
                    name: station.name,
                }));
                remote?.respondRadio(requestId, items);
            } catch {
                remote?.respondRadio(requestId, []);
            }
        });

        remote.requestPlayTrack(async ({ id }) => {
            const server = useAuthStore.getState().currentServer;
            if (!server) return;

            let song = trackCache.get(id);
            if (!song) {
                try {
                    song = await queryClient.fetchQuery({
                        queryFn: () =>
                            api.controller.getSongDetail({
                                apiClientProps: { serverId: server.id },
                                query: { id },
                            }),
                        queryKey: ['remote-song-detail', server.id, id],
                    });
                } catch {
                    return;
                }
            }
            if (!song) return;

            addToQueueByData([song], Play.NOW, song.id);
        });

        remote.requestPlayPlaylist(({ id }) => {
            const server = useAuthStore.getState().currentServer;
            if (!server) return;
            addToQueueByFetch(server.id, [id], LibraryItem.PLAYLIST, Play.NOW);
        });

        remote.requestPlayRadio(async ({ id }) => {
            const server = useAuthStore.getState().currentServer;
            if (!server) return;

            try {
                const stations = await queryClient.fetchQuery(
                    radioQueries.list({ query: undefined, serverId: server.id }),
                );
                const station = stations.find((s) => s.id === id);
                if (!station) return;

                useRadioStore.getState().actions.play(station.streamUrl, station.name, {
                    id: station.id,
                    imageId: station.imageId,
                    imageUrl: station.imageUrl,
                    serverId: server.id,
                });
            } catch {
                // Nothing to do — station list fetch failed, no station to play.
            }
        });

        remote.requestQueueJump(({ uniqueId }) => {
            usePlayerStoreBase.getState().mediaPlay(uniqueId);
        });

        return () => {
            ipc?.removeAllListeners('request-tracks');
            ipc?.removeAllListeners('request-playlists');
            ipc?.removeAllListeners('request-radio');
            ipc?.removeAllListeners('request-play-track');
            ipc?.removeAllListeners('request-play-playlist');
            ipc?.removeAllListeners('request-play-radio');
            ipc?.removeAllListeners('request-queue-jump');
        };
    }, [isRemoteEnabled, addToQueueByData, addToQueueByFetch]);
};

export const RemoteLibraryHook = () => {
    useRemoteLibrary();
    return null;
};
