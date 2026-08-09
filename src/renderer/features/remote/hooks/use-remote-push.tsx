import isElectron from 'is-electron';

import { getItemImageUrl } from '/@/renderer/components/item-image/item-image';
import { usePlayerEvents } from '/@/renderer/features/player/audio-player/hooks/use-player-events';
import { useConnectPlayerStore } from '/@/renderer/features/player/components/connect/connect.store';
import { useRemoteSettings } from '/@/renderer/store';
import { LogCategory, logFn } from '/@/renderer/utils/logger';
import { logMsg } from '/@/renderer/utils/logger-message';
import { LibraryItem } from '/@/shared/types/domain-types';
import { PlayerShuffle } from '/@/shared/types/types';

const remote = isElectron() ? window.api.remote : null;

/**
 * Outbound state push: local player events → remote WS clients. Split out of
 * use-remote.tsx to keep that file under the repo's file-size convention.
 */
export const useRemotePush = () => {
    const remoteSettings = useRemoteSettings();
    const isRemoteEnabled = remoteSettings.enabled;

    usePlayerEvents(
        {
            onCurrentSongChange: (properties) => {
                if (!isRemoteEnabled || !remote) {
                    return;
                }

                logFn.debug(logMsg[LogCategory.REMOTE].updateSongSent, {
                    category: LogCategory.REMOTE,
                    meta: {
                        artistName: properties.song?.artistName,
                        id: properties.song?.id,
                        index: properties.index,
                        name: properties.song?.name,
                    },
                });
                if (properties.song) {
                    const song = properties.song;
                    const imageUrl =
                        getItemImageUrl({
                            id: song.id,
                            imageUrl: song.imageUrl,
                            itemType: LibraryItem.SONG,
                            serverId: song._serverId,
                            type: 'itemCard',
                            useRemoteUrl: true,
                        }) || null;

                    remote.updateSong(song, imageUrl);
                } else {
                    remote.updateSong(undefined);
                }
            },
            onPlayerProgress: (properties) => {
                if (!isRemoteEnabled || !remote) {
                    return;
                }

                // Local playback position is frozen while Connect is active
                // (see onPlayerStatus below) — use-remote.tsx pushes Connect's
                // own elapsed time instead. Skip here to avoid both writers
                // racing on the same 'update-position' IPC message.
                if (useConnectPlayerStore.getState().isActive) {
                    return;
                }

                logFn.debug(logMsg[LogCategory.REMOTE].updatePositionSent, {
                    category: LogCategory.REMOTE,
                    meta: { timestamp: properties.timestamp },
                });
                remote.updatePosition(properties.timestamp);
            },
            onPlayerRepeat: (properties) => {
                if (!isRemoteEnabled || !remote) {
                    return;
                }

                logFn.debug(logMsg[LogCategory.REMOTE].updateRepeatSent, {
                    category: LogCategory.REMOTE,
                    meta: { repeat: properties.repeat },
                });
                remote.updateRepeat(properties.repeat);
            },
            onPlayerShuffle: (properties) => {
                if (!isRemoteEnabled || !remote) {
                    return;
                }

                const isShuffleEnabled = properties.shuffle !== PlayerShuffle.NONE;
                logFn.debug(logMsg[LogCategory.REMOTE].updateShuffleSent, {
                    category: LogCategory.REMOTE,
                    meta: { isShuffleEnabled, shuffle: properties.shuffle },
                });
                remote.updateShuffle(isShuffleEnabled);
            },
            onPlayerStatus: (properties) => {
                if (!isRemoteEnabled || !remote) {
                    return;
                }

                // While Connect is active, use-remote.tsx's own effect owns this
                // channel (local player status is meaningless — it's paused the
                // whole time Connect is playing). Skip here to avoid both writers
                // racing on the same 'update-playback' IPC message.
                if (useConnectPlayerStore.getState().isActive) {
                    return;
                }

                logFn.debug(logMsg[LogCategory.REMOTE].updatePlaybackSent, {
                    category: LogCategory.REMOTE,
                    meta: { status: properties.status },
                });
                remote.updatePlayback(properties.status);
            },
            onPlayerVolume: (properties) => {
                if (!isRemoteEnabled || !remote) {
                    return;
                }

                // Local volume is meaningless while Connect is active — the
                // cast device has its own independent volume, and the phone's
                // slider is rerouted to control that instead (see
                // use-remote.tsx's requestVolume handler). Pushing the local
                // value here would make the slider show a number that isn't
                // actually what dragging it controls. use-remote.tsx pushes
                // the device's real volume in its place.
                if (useConnectPlayerStore.getState().isActive) {
                    return;
                }

                logFn.debug(logMsg[LogCategory.REMOTE].updateVolumeSent, {
                    category: LogCategory.REMOTE,
                    meta: { volume: properties.volume },
                });
                remote.updateVolume(properties.volume);
            },
            onUserFavorite: (properties) => {
                if (!isRemoteEnabled || !remote) {
                    return;
                }

                logFn.debug(logMsg[LogCategory.REMOTE].updateFavoriteSent, {
                    category: LogCategory.REMOTE,
                    meta: {
                        favorite: properties.favorite,
                        id: properties.id,
                        serverId: properties.serverId,
                    },
                });
                remote.updateFavorite(properties.favorite, properties.serverId, properties.id);
            },
            onUserRating: (properties) => {
                if (!isRemoteEnabled || !remote) {
                    return;
                }

                logFn.debug(logMsg[LogCategory.REMOTE].updateRatingSent, {
                    category: LogCategory.REMOTE,
                    meta: {
                        id: properties.id,
                        rating: properties.rating || 0,
                        serverId: properties.serverId,
                    },
                });
                remote.updateRating(properties.rating || 0, properties.serverId, properties.id);
            },
        },
        // isRemoteEnabled is read inside every callback above via closure —
        // an empty deps array would freeze that read at whatever it was on
        // first mount, so toggling Remote Control on later (without an app
        // restart) would never resume these pushes.
        [isRemoteEnabled],
    );
};

export const RemotePushHook = () => {
    useRemotePush();
    return null;
};
