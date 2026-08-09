import { ConnectButton } from '/@/remote/components/buttons/connect-button';
import { useInfo, useSend } from '/@/remote/store';
import { useRadioStatus } from '/@/remote/store/library';
import { RemoteContainer as SharedRemoteContainer } from '/@/shared/mobile-ui/containers/remote-container';
import { MobileNowPlayingInfo, MobileRadioStatus } from '/@/shared/mobile-ui/types';

export const RemoteContainer = () => {
    const info = useInfo();
    const send = useSend();
    const radioStatus = useRadioStatus();

    const mappedInfo: MobileNowPlayingInfo = {
        position: info.position,
        repeat: info.repeat,
        shuffle: info.shuffle,
        song: info.song
            ? {
                  _serverType: info.song._serverType,
                  album: info.song.album,
                  artistName: info.song.artistName,
                  duration: info.song.duration,
                  id: info.song.id,
                  imageUrl: info.song.imageUrl,
                  name: info.song.name,
                  playCount: info.song.playCount,
                  releaseDate: info.song.releaseDate,
                  userFavorite: info.song.userFavorite,
                  userRating: info.song.userRating,
              }
            : null,
        status: info.status,
        volume: info.volume,
    };

    const mappedRadioStatus: MobileRadioStatus = radioStatus.isActive
        ? { imageUrl: radioStatus.imageUrl, isActive: true, stationName: radioStatus.stationName }
        : { imageUrl: null, isActive: false, stationName: null };

    return (
        <SharedRemoteContainer
            connectSlot={<ConnectButton />}
            info={mappedInfo}
            onArtworkError={() => send({ event: 'proxy' })}
            onFavorite={(favorite) => {
                if (!info.song?.id) return;
                send({ event: 'favorite', favorite, id: info.song.id });
            }}
            onNext={() => send({ event: 'next' })}
            onPause={() => send({ event: 'pause' })}
            onPlay={() => send({ event: 'play' })}
            onPrevious={() => send({ event: 'previous' })}
            onRating={(rating) => {
                if (!info.song?.id) return;
                send({ event: 'rating', id: info.song.id, rating });
            }}
            onRepeat={() => send({ event: 'repeat' })}
            onSeek={(position) => send({ event: 'position', position })}
            onShuffle={() => send({ event: 'shuffle' })}
            onVolumeChange={(volume) => send({ event: 'volume', volume })}
            radioStatus={mappedRadioStatus}
        />
    );
};
