import { useShallow } from 'zustand/shallow';

import { getItemImageUrl } from '/@/renderer/components/item-image/item-image';
import { ConnectButton } from '/@/renderer/features/mobile/components/connect-button';
import {
    useConnectElapsed,
    useConnectPlayerStore,
} from '/@/renderer/features/player/components/connect/connect.store';
import { connectFetch } from '/@/renderer/features/player/components/connect/types';
import { useDeviceVolume } from '/@/renderer/features/player/components/connect/use-device-volume';
import { useIsRadioActive, useRadioStore } from '/@/renderer/features/radio/hooks/use-radio-player';
import { useSetRating } from '/@/renderer/features/shared/hooks/use-set-rating';
import { useCreateFavorite } from '/@/renderer/features/shared/mutations/create-favorite-mutation';
import { useDeleteFavorite } from '/@/renderer/features/shared/mutations/delete-favorite-mutation';
import {
    usePlayerActions,
    usePlayerProperties,
    usePlayerSong,
    usePlayerTimestamp,
} from '/@/renderer/store';
import { RemoteContainer as SharedRemoteContainer } from '/@/shared/mobile-ui/containers/remote-container';
import { MobileNowPlayingInfo, MobileRadioStatus } from '/@/shared/mobile-ui/types';
import { LibraryItem } from '/@/shared/types/domain-types';
import { PlayerShuffle, PlayerStatus } from '/@/shared/types/types';

const postJson = (path: string, body?: unknown) =>
    connectFetch(path, {
        body: body ? JSON.stringify(body) : undefined,
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
    }).catch(() => {});

// Another tab/device owns playback (see connect.store.ts's ConnectMode) —
// this screen only displays it (from the shared queue the owner pushes, see
// use-connect-local-queue.ts) and forwards transport taps to the backend.
// No favorite/rating/shuffle/repeat/volume: ConnectQueueItem doesn't carry
// enough metadata for the first two, and the others have no clear meaning
// for a tab that isn't actually producing any audio itself — out of scope
// for v1 (mobile-view plan, Phase 2 — "nur Transport-Controls").
const MirrorRemoteContainer = () => {
    const { isPlaying, queue, queueIndex } = useConnectPlayerStore(
        useShallow((s) => ({ isPlaying: s.isPlaying, queue: s.queue, queueIndex: s.queueIndex })),
    );
    const elapsed = useConnectElapsed();
    const track = queue[queueIndex];

    const info: MobileNowPlayingInfo = {
        position: elapsed,
        song: track
            ? {
                  album: track.album ?? null,
                  artistName: track.artist ?? '',
                  duration: (track.duration ?? 0) * 1000,
                  id: track.id,
                  imageUrl: track.cover_art_url ?? null,
                  name: track.title,
              }
            : null,
        status: isPlaying ? PlayerStatus.PLAYING : PlayerStatus.PAUSED,
    };

    return (
        <SharedRemoteContainer
            info={info}
            onFavorite={() => {}}
            onNext={() => postJson('/next')}
            onPause={() => postJson('/pause')}
            onPlay={() => postJson('/resume')}
            onPrevious={() => postJson('/prev')}
            onRating={() => {}}
            onRepeat={() => {}}
            onSeek={(position) => postJson('/seek', { position })}
            onShuffle={() => {}}
            onVolumeChange={() => {}}
            radioStatus={{ imageUrl: null, isActive: false, stationName: null }}
        />
    );
};

const LocalOrCastRemoteContainer = () => {
    const song = usePlayerSong();
    const { repeat, shuffle, status, volume } = usePlayerProperties();
    const localPosition = usePlayerTimestamp();
    const {
        mediaNext,
        mediaPause,
        mediaPlay,
        mediaPrevious,
        mediaSeekToTimestamp,
        setVolume,
        toggleRepeat,
        toggleShuffle,
    } = usePlayerActions();
    const setRating = useSetRating();
    const addToFavoritesMutation = useCreateFavorite({});
    const removeFromFavoritesMutation = useDeleteFavorite({});

    const isRadioActive = useIsRadioActive();
    const stationName = useRadioStore((s) => s.stationName);
    const currentStationArt = useRadioStore((s) => s.currentStationArt);

    const {
        activeTargets,
        handlers: connectHandlers,
        isActive: connectActive,
        isPlaying: connectIsPlaying,
    } = useConnectPlayerStore(
        useShallow((s) => ({
            activeTargets: s.activeTargets,
            handlers: s.handlers,
            isActive: s.isActive,
            isPlaying: s.isPlaying,
        })),
    );
    const connectElapsed = useConnectElapsed();
    const singleTarget = connectActive && activeTargets.length === 1 ? activeTargets[0] : undefined;
    const {
        setDeviceVolume,
        supported: deviceVolumeSupported,
        volume: deviceVolume,
    } = useDeviceVolume(singleTarget?.type, singleTarget?.name);

    const imageUrl = song
        ? (getItemImageUrl({
              id: song.id,
              imageUrl: song.imageUrl,
              itemType: LibraryItem.SONG,
              serverId: song._serverId,
              type: 'itemCard',
              useRemoteUrl: true,
          }) ?? null)
        : null;

    const info: MobileNowPlayingInfo = {
        position: connectActive ? connectElapsed : localPosition,
        repeat,
        shuffle: shuffle !== PlayerShuffle.NONE,
        song: song
            ? {
                  _serverType: song._serverType,
                  album: song.album,
                  artistName: song.artistName,
                  duration: song.duration,
                  id: song.id,
                  imageUrl,
                  name: song.name,
                  playCount: song.playCount,
                  releaseDate: song.releaseDate,
                  userFavorite: song.userFavorite,
                  userRating: song.userRating,
              }
            : null,
        status: connectActive
            ? connectIsPlaying
                ? PlayerStatus.PLAYING
                : PlayerStatus.PAUSED
            : status,
        volume:
            connectActive && singleTarget && deviceVolumeSupported ? (deviceVolume ?? 0) : volume,
    };

    const radioStatus: MobileRadioStatus = isRadioActive
        ? {
              imageUrl: currentStationArt?.imageUrl ?? null,
              isActive: true,
              stationName: stationName ?? '',
          }
        : { imageUrl: null, isActive: false, stationName: null };

    // Same "route through Connect's handlers while active, otherwise the
    // local player" pattern desktop's own center-controls.tsx uses.
    const handlePlayPause = (isPlaying: boolean) => {
        if (connectActive && connectHandlers) {
            connectHandlers.onPlayPause();
            return;
        }
        if (isPlaying) mediaPause();
        else mediaPlay();
    };

    return (
        <SharedRemoteContainer
            connectSlot={<ConnectButton />}
            info={info}
            onFavorite={(favorite) => {
                if (!song?._serverId || !song?.id) return;
                const mutator = favorite ? addToFavoritesMutation : removeFromFavoritesMutation;
                mutator.mutate({
                    apiClientProps: { serverId: song._serverId },
                    query: { id: [song.id], type: LibraryItem.SONG },
                });
            }}
            onNext={() => mediaNext(false)}
            onPause={() => handlePlayPause(true)}
            onPlay={() => handlePlayPause(false)}
            onPrevious={() => mediaPrevious(false)}
            onRating={(rating) => {
                if (!song?._serverId || !song?.id) return;
                setRating(song._serverId, [song.id], LibraryItem.SONG, rating);
            }}
            onRepeat={toggleRepeat}
            onSeek={(position) => {
                if (connectActive) {
                    // Optimistic — otherwise useConnectElapsed keeps animating
                    // from the pre-seek baseline until the next status poll,
                    // making the slider jump back briefly after release.
                    useConnectPlayerStore
                        .getState()
                        .set({ elapsed: position, syncTime: Date.now() });
                    postJson('/seek', { position });
                    return;
                }
                mediaSeekToTimestamp(position);
            }}
            onShuffle={toggleShuffle}
            onVolumeChange={(v) => {
                if (connectActive && singleTarget && deviceVolumeSupported) {
                    setDeviceVolume(v);
                    return;
                }
                setVolume(v);
            }}
            radioStatus={radioStatus}
        />
    );
};

export const RemoteContainer = () => {
    const mode = useConnectPlayerStore((s) => s.mode);
    return mode === 'mirror' ? <MirrorRemoteContainer /> : <LocalOrCastRemoteContainer />;
};
