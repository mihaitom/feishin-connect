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
    | ClientPlaylistsRequest
    | ClientPlayPlaylist
    | ClientPlayRadio
    | ClientPlayTrack
    | ClientPosition
    | ClientQueueJump
    | ClientRadioRequest
    | ClientRating
    | ClientSimpleEvent
    | ClientTracksRequest
    | ClientVolume;

export interface ClientFavorite {
    event: 'favorite';
    favorite: boolean;
    id: string;
}

export interface ClientPlaylistsRequest extends RemoteListRequest {
    event: 'playlists-request';
}

export interface ClientPlayPlaylist {
    event: 'play-playlist';
    id: string;
}

export interface ClientPlayRadio {
    event: 'play-radio';
    id: string;
}

export interface ClientPlayTrack {
    event: 'play-track';
    id: string;
}

export interface ClientPosition {
    event: 'position';
    position: number;
}

export interface ClientQueueJump {
    event: 'queue-jump';
    uniqueId: string;
}

export interface ClientRadioRequest {
    event: 'radio-request';
    requestId: string;
}

export interface ClientRating {
    event: 'rating';
    id: string;
    rating: number;
}

export interface ClientSimpleEvent {
    event: 'next' | 'pause' | 'play' | 'previous' | 'proxy' | 'repeat' | 'shuffle';
}

export interface ClientTracksRequest extends RemoteListRequest {
    event: 'tracks-request';
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

export interface RemoteListRequest {
    limit?: number;
    requestId: string;
    searchTerm?: string;
    startIndex?: number;
}

export interface RemotePlaylistItem {
    duration: null | number;
    id: string;
    imageUrl: null | string;
    name: string;
    songCount: null | number;
}

export interface RemoteQueueItem {
    album: null | string;
    artistName: string;
    duration: number;
    imageUrl: null | string;
    name: string;
    uniqueId: string;
}

export interface RemoteRadioItem {
    homepageUrl: null | string;
    id: string;
    imageUrl: null | string;
    name: string;
}

// Trimmed, phone-specific shapes — deliberately not the full Song/Playlist/
// InternetRadioStation/QueueSong domain types, which carry dozens of fields
// the phone list rows don't need.
export interface RemoteTrackItem {
    album: null | string;
    artistName: string;
    duration: number;
    id: string;
    imageUrl: null | string;
    name: string;
}

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
    | ServerPlaylistsResponse
    | ServerPlayStatus
    | ServerPosition
    | ServerProxy
    | ServerQueueState
    | ServerRadioResponse
    | ServerRadioStatus
    | ServerRating
    | ServerRepeat
    | ServerShuffle
    | ServerSong
    | ServerState
    | ServerTracksResponse
    | ServerVolume;

export interface ServerFavorite {
    data: { favorite: boolean; id: string };
    event: 'favorite';
}

export interface ServerPlaylistsResponse {
    data: { hasMore: boolean; items: RemotePlaylistItem[]; requestId: string };
    event: 'playlists-response';
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

// Cached + broadcast, not request/response — the queue is live desktop-driven
// state, not a one-shot query. Same pattern as ServerConnectDevices above.
export interface ServerQueueState {
    data: { currentUniqueId: null | string; items: RemoteQueueItem[] };
    event: 'queue-state';
}

export interface ServerRadioResponse {
    data: { items: RemoteRadioItem[]; requestId: string };
    event: 'radio-response';
}

export interface ServerRadioStatus {
    data: { imageUrl: null | string; isActive: true; stationName: string } | { isActive: false };
    event: 'radio-status';
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

export interface ServerTracksResponse {
    data: { hasMore: boolean; items: RemoteTrackItem[]; requestId: string };
    event: 'tracks-response';
}

export interface ServerVolume {
    data: number;
    event: 'volume';
}

export interface SongUpdateSocket extends Omit<SongState, 'song'> {
    position?: number;
    song?: null | QueueSong;
}
