import { QueueSong } from '/@/shared/types/domain-types';
import { PlayerRepeat, PlayerStatus, SongState } from '/@/shared/types/types';

export interface ClientAuth {
    event: 'authenticate';
    header: string;
}

export type ClientEvent =
    | ClientAuth
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

export interface ServerError {
    data: string;
    event: 'error';
}

export type ServerEvent =
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
