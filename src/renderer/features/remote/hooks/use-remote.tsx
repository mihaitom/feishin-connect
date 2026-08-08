import isElectron from 'is-electron';
import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/shallow';

import { getItemImageUrl } from '/@/renderer/components/item-image/item-image';
import {
    useConnectElapsed,
    useConnectPlayerStore,
} from '/@/renderer/features/player/components/connect/connect.store';
import { connectFetch } from '/@/renderer/features/player/components/connect/types';
import { useDeviceVolume } from '/@/renderer/features/player/components/connect/use-device-volume';
import { useRemotePush } from '/@/renderer/features/remote/hooks/use-remote-push';
import { useSetRating } from '/@/renderer/features/shared/hooks/use-set-rating';
import { useCreateFavorite } from '/@/renderer/features/shared/mutations/create-favorite-mutation';
import { useDeleteFavorite } from '/@/renderer/features/shared/mutations/delete-favorite-mutation';
import { usePlayerActions, usePlayerStore, useRemoteSettings } from '/@/renderer/store';
import { usePlayerStoreBase } from '/@/renderer/store/player.store';
import { LogCategory, logFn } from '/@/renderer/utils/logger';
import { logMsg } from '/@/renderer/utils/logger-message';
import { toast } from '/@/shared/components/toast/toast';
import { LibraryItem } from '/@/shared/types/domain-types';
import { PlayerStatus } from '/@/shared/types/types';

const remote = isElectron() ? window.api.remote : null;
const ipc = isElectron() ? window.api.ipc : null;

export const useRemote = () => {
    const { mediaSkipForward, setVolume } = usePlayerActions();
    const player = usePlayerStore();

    const remoteSettings = useRemoteSettings();
    const setRating = useSetRating();
    const addToFavoritesMutation = useCreateFavorite({});
    const removeFromFavoritesMutation = useDeleteFavorite({});

    const isRemoteEnabled = remoteSettings.enabled;

    const { activeTargets, connectActive, connectIsPlaying } = useConnectPlayerStore(
        useShallow((s) => ({
            activeTargets: s.activeTargets,
            connectActive: s.isActive,
            connectIsPlaying: s.isPlaying,
        })),
    );
    // Device volume only applies with exactly one active target — same rule
    // right-controls.tsx's ConnectVolumeButton uses, so the phone's single
    // slider isn't ambiguous about which device it's moving.
    const singleTarget = connectActive && activeTargets.length === 1 ? activeTargets[0] : undefined;
    const { setDeviceVolume, supported: deviceVolumeSupported } = useDeviceVolume(
        singleTarget?.type,
        singleTarget?.name,
    );
    const connectElapsedTime = useConnectElapsed();

    // Initialize the remote
    useEffect(() => {
        // we must send this EVEN IF the remote is disabled, as this is what
        // makes sure that the main process gets the port/username/password on startup

        logFn.debug(logMsg[LogCategory.REMOTE].initializingRemoteSettings, {
            category: LogCategory.REMOTE,
            meta: {
                enabled: remoteSettings.enabled,
                port: remoteSettings.port,
                username: remoteSettings.username,
            },
        });

        remote
            ?.updateSetting(
                remoteSettings.enabled,
                remoteSettings.port,
                remoteSettings.username,
                remoteSettings.password,
            )
            .catch((error) => {
                logFn.error(logMsg[LogCategory.REMOTE].failedToEnableRemote, {
                    category: LogCategory.REMOTE,
                    meta: { error },
                });
                toast.warn({ message: error, title: 'Failed to enable remote' });
            });
        // We only want to fire this once
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!isRemoteEnabled || !remote) {
            return;
        }

        remote.requestPosition((data: { position: number }) => {
            logFn.debug(logMsg[LogCategory.REMOTE].requestPositionReceived, {
                category: LogCategory.REMOTE,
                meta: { position: data.position },
            });
            if (connectActive) {
                // Optimistic — otherwise useConnectElapsed keeps animating from
                // the pre-seek baseline until the next SSE status arrives,
                // making the phone's slider jump back briefly after release.
                useConnectPlayerStore.getState().set({
                    elapsed: data.position,
                    syncTime: Date.now(),
                });
                connectFetch(`/seek`, {
                    body: JSON.stringify({ position: data.position }),
                    headers: { 'Content-Type': 'application/json' },
                    method: 'POST',
                }).catch(() => {});
                return;
            }
            player.mediaSeekToTimestamp(data.position);
        });

        remote.requestSeek((data: { offset: number }) => {
            logFn.debug(logMsg[LogCategory.REMOTE].requestSeekReceived, {
                category: LogCategory.REMOTE,
                meta: { offset: data.offset },
            });
            mediaSkipForward(data.offset);
        });

        remote.requestRating((data: { id: string; rating: number; serverId: string }) => {
            logFn.debug(logMsg[LogCategory.REMOTE].requestRatingReceived, {
                category: LogCategory.REMOTE,
                meta: { id: data.id, rating: data.rating, serverId: data.serverId },
            });
            setRating(data.serverId, [data.id], LibraryItem.SONG, data.rating);
        });

        remote.requestVolume((data: { volume: number }) => {
            logFn.debug(logMsg[LogCategory.REMOTE].requestVolumeReceived, {
                category: LogCategory.REMOTE,
                meta: { volume: data.volume },
            });
            if (connectActive && singleTarget && deviceVolumeSupported) {
                setDeviceVolume(data.volume);
                return;
            }
            setVolume(data.volume);
        });

        remote.requestFavorite((data: { favorite: boolean; id: string; serverId: string }) => {
            logFn.debug(logMsg[LogCategory.REMOTE].requestFavoriteReceived, {
                category: LogCategory.REMOTE,
                meta: { favorite: data.favorite, id: data.id, serverId: data.serverId },
            });
            const mutator = data.favorite ? addToFavoritesMutation : removeFromFavoritesMutation;
            mutator.mutate({
                apiClientProps: { serverId: data.serverId },
                query: {
                    id: [data.id],
                    type: LibraryItem.SONG,
                },
            });
        });

        return () => {
            ipc?.removeAllListeners('request-position');
            ipc?.removeAllListeners('request-seek');
            ipc?.removeAllListeners('request-volume');
            ipc?.removeAllListeners('request-favorite');
            ipc?.removeAllListeners('request-rating');
        };
    }, [
        addToFavoritesMutation,
        connectActive,
        deviceVolumeSupported,
        isRemoteEnabled,
        mediaSkipForward,
        player,
        removeFromFavoritesMutation,
        setDeviceVolume,
        setVolume,
        setRating,
        singleTarget,
    ]);

    // Send initial song if one is already playing
    const isInitializedRef = useRef(false);
    useEffect(() => {
        if (isInitializedRef.current || !isRemoteEnabled || !remote) {
            return;
        }

        isInitializedRef.current = true;

        const currentSong = player.getCurrentSong();

        if (currentSong) {
            logFn.debug(logMsg[LogCategory.REMOTE].sendingInitialSong, {
                category: LogCategory.REMOTE,
                meta: {
                    artistName: currentSong.artistName,
                    id: currentSong.id,
                    name: currentSong.name,
                },
            });

            const imageUrl =
                getItemImageUrl({
                    id: currentSong.id,
                    imageUrl: currentSong.imageUrl,
                    itemType: LibraryItem.SONG,
                    serverId: currentSong._serverId,
                    type: 'itemCard',
                    useRemoteUrl: true,
                }) || null;

            remote.updateSong(currentSong, imageUrl);
        }
    }, [isRemoteEnabled, player]);

    // Local PlayerStatus is meaningless while Connect is active — the local
    // player stays paused the whole time (see use-connect-controls.ts's
    // safety net) while the cast device does the actual playing. Push the
    // Connect-derived status instead so the phone's play/pause icon reflects
    // the cast device, not the (permanently paused) local player.
    const wasConnectActiveRef = useRef(false);
    useEffect(() => {
        if (!isRemoteEnabled || !remote) return;

        if (connectActive) {
            remote.updatePlayback(connectIsPlaying ? PlayerStatus.PLAYING : PlayerStatus.PAUSED);
        } else if (wasConnectActiveRef.current) {
            // Just deactivated — resync with the real local status immediately.
            // use-remote-push.tsx's own push skips while Connect is active and
            // won't fire again until the next local status change, which could
            // otherwise leave the phone showing a stale Connect-derived status.
            remote.updatePlayback(usePlayerStoreBase.getState().player.status);
        }
        wasConnectActiveRef.current = connectActive;
    }, [isRemoteEnabled, connectActive, connectIsPlaying]);

    // Local playback position is frozen while Connect is active (the local
    // player never advances — see use-remote-push.tsx's onPlayerProgress,
    // which skips its own push for the same reason). Push Connect's own
    // elapsed time instead, so the phone's progress bar actually advances.
    useEffect(() => {
        if (!isRemoteEnabled || !remote || !connectActive) return;
        remote.updatePosition(connectElapsedTime);
    }, [isRemoteEnabled, connectActive, connectElapsedTime]);
};

export const RemoteHook = () => {
    useRemote();
    useRemotePush();
    return null;
};
