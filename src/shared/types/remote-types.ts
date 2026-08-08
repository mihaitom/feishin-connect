import { QueueSong } from '/@/shared/types/domain-types';
import { PlayerRepeat, PlayerStatus, SongState } from '/@/shared/types/types';

export interface ClientAuth {
    event: 'authenticate';
    header: string;
}

export interface ClientConnectConnect {
    devices: RemoteConnectDeviceRef[];
    event: 'connect-connect';
    force: boolean;
}

export interface ClientConnectDisconnect {
    // Omitted device = disconnect all active targets.
    device?: RemoteConnectDeviceRef;
    event: 'connect-disconnect';
}

export interface ClientConnectDiscover {
    event: 'connect-discover';
    fresh?: boolean;
}

export interface ClientConnectSetVolume {
    device: RemoteConnectDeviceRef;
    event: 'connect-set-volume';
    volume: number;
}

export type ClientEvent =
    | ClientAuth
    | ClientConnectConnect
    | ClientConnectDisconnect
    | ClientConnectDiscover
    | ClientConnectSetVolume
    | ClientFavorite
    | ClientPosition
    | ClientRating
    | ClientSimpleEvent
    | ClientVolume;

export interface ClientFavorite {
    event: 'favorite';
    favorite: boolean;
    id: string;
}

export interface ClientPosition {
    event: 'position';
    position: number;
}

export interface ClientRating {
    event: 'rating';
    id: string;
    rating: number;
}
export interface ClientSimpleEvent {
    event: 'next' | 'pause' | 'play' | 'previous' | 'proxy' | 'repeat' | 'shuffle';
}

export interface ClientVolume {
    event: 'volume';
    volume: number;
}

export interface RemoteConnectDevice {
    claimedByName?: null | string;
    claimedBySessionId?: null | string;
    claimedByTrack?: null | string;
    name: string;
    needsPairing?: boolean;
    type: 'airplay' | 'chromecast' | 'dlna' | 'sonos';
    // Current device volume (Sonos/Chromecast/DLNA only — AirPlay has no
    // volume support in the backend), populated only for active targets.
    volume?: null | number;
}

export type RemoteConnectDeviceRef = Pick<RemoteConnectDevice, 'name' | 'type'>;

export interface ServerConnectDevices {
    data: RemoteConnectDevice[];
    event: 'connect-devices';
}

export interface ServerConnectState {
    data: {
        activeTargets: RemoteConnectDevice[];
        isActive: boolean;
        mySessionId: string;
    };
    event: 'connect-state';
}

export interface ServerError {
    data: string;
    event: 'error';
}

export type ServerEvent =
    | ServerConnectDevices
    | ServerConnectState
    | ServerError
    | ServerFavorite
    | ServerPlayStatus
    | ServerPosition
    | ServerProxy
    | ServerRating
    | ServerRepeat
    | ServerShuffle
    | ServerSong
    | ServerState
    | ServerVolume;

export interface ServerFavorite {
    data: { favorite: boolean; id: string };
    event: 'favorite';
}

export interface ServerPlayStatus {
    data: PlayerStatus;
    event: 'playback';
}

export interface ServerPosition {
    data: number;
    event: 'position';
}

export interface ServerProxy {
    data: string;
    event: 'proxy';
}

export interface ServerRating {
    data: { id: string; rating: number };
    event: 'rating';
}

export interface ServerRepeat {
    data: PlayerRepeat;
    event: 'repeat';
}

export interface ServerShuffle {
    data: boolean;
    event: 'shuffle';
}

export interface ServerSong {
    data: null | QueueSong;
    event: 'song';
}

export interface ServerState {
    data: SongState;
    event: 'state';
}

export interface ServerVolume {
    data: number;
    event: 'volume';
}

export interface SongUpdateSocket extends Omit<SongState, 'song'> {
    position?: number;
    song?: null | QueueSong;
}
