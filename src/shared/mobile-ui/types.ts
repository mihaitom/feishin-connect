import { Play, PlayerRepeat, PlayerStatus } from '/@/shared/types/types';

export { Play };

// Canonical view-model shapes for the mobile UI (src/shared/mobile-ui/**).
// Deliberately NOT the WS protocol types (RemoteQueueItem etc. in
// remote-types.ts) or the full renderer domain types (Song/QueueSong/...) —
// both the WS-backed Electron remote and the direct-hook-backed web mobile
// view map onto these same trimmed shapes, so the presentational components
// in this directory never need to know which one they're running under.

export interface MobileConnectDevice extends MobileConnectDeviceRef {
    claimedByName?: null | string;
    claimedBySessionId?: null | string;
    volume?: null | number;
}

export interface MobileConnectDeviceRef {
    name: string;
    type: 'airplay' | 'chromecast' | 'dlna' | 'sonos';
}

export interface MobileConnectState {
    activeTargets: MobileConnectDevice[];
    isActive: boolean;
    mySessionId: string;
}

export interface MobileNowPlayingInfo {
    position?: number;
    repeat?: PlayerRepeat;
    shuffle?: boolean;
    song: MobileNowPlayingSong | null;
    status?: PlayerStatus;
    volume?: number;
}

export interface MobileNowPlayingSong {
    _serverType?: string;
    album: null | string;
    artistName: string;
    duration: number;
    id: string;
    imageUrl: null | string;
    name: string;
    playCount?: null | number;
    releaseDate?: null | string;
    userFavorite?: boolean;
    userRating?: null | number;
}

export interface MobilePlaylistItem {
    duration: null | number;
    id: string;
    imageUrl: null | string;
    name: string;
    songCount: null | number;
}

export interface MobileQueueItem {
    album: null | string;
    artistName: string;
    duration: number;
    id: string;
    imageUrl: null | string;
    name: string;
    uniqueId: string;
}

export interface MobileRadioItem {
    homepageUrl: null | string;
    id: string;
    imageUrl: null | string;
    name: string;
}

export interface MobileRadioStatus {
    imageUrl: null | string;
    isActive: boolean;
    stationName: null | string;
}

// Bundle for any searchable, paginated list (Tracks/Playlists/the
// Add-to-Playlist sub-sheet) — the presentational component owns its own
// search-term input state and debouncing, the platform-specific wrapper
// (WS-backed vs. direct-hook-backed) only needs to answer "here are the
// results for this search term."
export interface MobileSearchResult<TItem> {
    hasMore: boolean;
    items: TItem[];
    loadMore: () => void;
}

export interface MobileTrackItem {
    album: null | string;
    artistName: string;
    duration: number;
    id: string;
    imageUrl: null | string;
    name: string;
}

export type UseMobileSearch<TItem> = (searchTerm: string) => MobileSearchResult<TItem>;
