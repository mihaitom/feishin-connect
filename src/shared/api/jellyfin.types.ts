export enum JFAlbumArtistListSort {
    ALBUM = 'Album,SortName',
    DURATION = 'Runtime,AlbumArtist,Album,SortName',
    NAME = 'SortName,Name',
    RANDOM = 'Random,SortName',
    RECENTLY_ADDED = 'DateCreated,SortName',
    RELEASE_DATE = 'PremiereDate,AlbumArtist,Album,SortName',
}

export enum JFAlbumListSort {
    ALBUM_ARTIST = 'AlbumArtist,SortName',
    COMMUNITY_RATING = 'CommunityRating,SortName',
    CRITIC_RATING = 'CriticRating,SortName',
    NAME = 'SortName',
    PLAY_COUNT = 'PlayCount',
    RANDOM = 'Random,SortName',
    RECENTLY_ADDED = 'DateCreated,SortName',
    RELEASE_DATE = 'ProductionYear,PremiereDate,SortName',
}

export enum JFArtistListSort {
    ALBUM = 'Album,SortName',
    DURATION = 'Runtime,AlbumArtist,Album,SortName',
    NAME = 'SortName,Name',
    RANDOM = 'Random,SortName',
    RECENTLY_ADDED = 'DateCreated,SortName',
    RELEASE_DATE = 'PremiereDate,AlbumArtist,Album,SortName',
}

export enum JFCollectionType {
    MUSIC = 'music',
    PLAYLISTS = 'playlists',
}

export enum JFExternalType {
    MUSICBRAINZ = 'MusicBrainz',
    THEAUDIODB = 'TheAudioDb',
}

export enum JFGenreListSort {
    NAME = 'SortName',
}

export enum JFImageType {
    LOGO = 'Logo',
    PRIMARY = 'Primary',
}

export enum JFItemType {
    AUDIO = 'Audio',
    MUSICALBUM = 'MusicAlbum',
}

export enum JFPlaylistListSort {
    ALBUM_ARTIST = 'AlbumArtist,SortName',
    DURATION = 'Runtime',
    NAME = 'SortName',
    RECENTLY_ADDED = 'DateCreated,SortName',
    SONG_COUNT = 'ChildCount',
}

export enum JFSongListSort {
    ALBUM = 'Album,SortName',
    ALBUM_ARTIST = 'AlbumArtist,Album,SortName',
    ARTIST = 'Artist,Album,SortName',
    COMMUNITY_RATING = 'CommunityRating,SortName',
    DURATION = 'Runtime,AlbumArtist,Album,SortName',
    NAME = 'Name',
    PLAY_COUNT = 'PlayCount,SortName',
    RANDOM = 'Random,SortName',
    RECENTLY_ADDED = 'DateCreated,SortName',
    RECENTLY_PLAYED = 'DatePlayed,SortName',
    RELEASE_DATE = 'PremiereDate,AlbumArtist,Album,SortName',
}

export enum JFSortOrder {
    ASC = 'Ascending',
    DESC = 'Descending',
}

export type JFAddToPlaylist = null;

export type JFAddToPlaylistParams = {
    ids: string[];
    userId: string;
};

export type JFAddToPlaylistResponse = {
    added: number;
};

export type JFAlbum = {
    AlbumArtist: string;
    AlbumArtists: JFGenericItem[];
    AlbumPrimaryImageTag: string;
    ArtistItems: JFGenericItem[];
    Artists: string[];
    ChannelId: null;
    ChildCount?: number;
    DateCreated: string;
    DateLastMediaAdded?: string;
    ExternalUrls: ExternalURL[];
    GenreItems: JFGenericItem[];
    Genres: string[];
    Id: string;
    ImageBlurHashes: ImageBlurHashes;
    ImageTags: ImageTags;
    IsFolder: boolean;
    LocationType: string;
    Name: string;
    ParentLogoImageTag: string;
    ParentLogoItemId: string;
    PremiereDate?: string;
    ProductionYear: number;
    RunTimeTicks: number;
    ServerId: string;
    Type: string;
    UserData?: UserData;
} & {
    songs?: JFSong[];
};

export type JFAlbumArtist = {
    BackdropImageTags: string[];
    ChannelId: null;
    DateCreated: string;
    ExternalUrls: ExternalURL[];
    GenreItems: GenreItem[];
    Genres: string[];
    Id: string;
    ImageBlurHashes: any;
    ImageTags: ImageTags;
    LocationType: string;
    Name: string;
    Overview?: string;
    RunTimeTicks: number;
    ServerId: string;
    Type: string;
    UserData: {
        IsFavorite: boolean;
        Key: string;
        PlaybackPositionTicks: number;
        PlayCount: number;
        Played: boolean;
    };
} & {
    similarArtists: {
        items: JFAlbumArtist[];
    };
};

export type JFAlbumArtistDetail = JFAlbumArtistDetailResponse;

export type JFAlbumArtistDetailResponse = JFAlbumArtist;

export type JFAlbumArtistList = {
    items: JFAlbumArtist[];
    startIndex: number;
    totalRecordCount: number;
};

export type JFAlbumArtistListParams = JFBaseParams &
    JFPaginationParams & {
        filters?: string;
        genres?: string;
        sortBy?: JFAlbumArtistListSort;
        years?: string;
    };

export interface JFAlbumArtistListResponse extends JFBasePaginatedResponse {
    Items: JFAlbumArtist[];
}

export type JFAlbumDetail = JFAlbum & { songs?: JFSong[] };

export type JFAlbumDetailResponse = JFAlbum;

export type JFAlbumList = {
    items: JFAlbum[];
    startIndex: number;
    totalRecordCount: number;
};

export type JFAlbumListParams = JFBaseParams &
    JFPaginationParams & {
        albumArtistIds?: string;
        artistIds?: string;
        filters?: string;
        genreIds?: string;
        genres?: string;
        includeItemTypes: 'MusicAlbum';
        isFavorite?: boolean;
        searchTerm?: string;
        sortBy?: JFAlbumListSort;
        tags?: string;
        years?: string;
    };

export interface JFAlbumListResponse extends JFBasePaginatedResponse {
    Items: JFAlbum[];
}

export type JFArtist = {
    BackdropImageTags: string[];
    ChannelId: null;
    DateCreated: string;
    ExternalUrls: ExternalURL[];
    GenreItems: GenreItem[];
    Genres: string[];
    Id: string;
    ImageBlurHashes: any;
    ImageTags: string[];
    LocationType: string;
    Name: string;
    Overview?: string;
    RunTimeTicks: number;
    ServerId: string;
    Type: string;
};

export type JFArtistList = JFArtistListResponse;

export type JFArtistListParams = JFBaseParams &
    JFPaginationParams & {
        filters?: string;
        genres?: string;
        sortBy?: JFArtistListSort;
        years?: string;
    };

export interface JFArtistListResponse extends JFBasePaginatedResponse {
    Items: JFAlbumArtist[];
}

export interface JFAuthenticate {
    AccessToken: string;
    ServerId: string;
    SessionInfo: SessionInfo;
    User: User;
}

export type JFBasePaginatedResponse = {
    StartIndex: number;
    TotalRecordCount: number;
};

export type JFCreatePlaylist = JFCreatePlaylistResponse;

export type JFCreatePlaylistResponse = {
    Id: string;
};

export type JFGenericItem = {
    Id: string;
    Name: string;
};

export type JFGenre = {
    BackdropImageTags: any[];
    ChannelId: null;
    Id: string;
    ImageBlurHashes: any;
    ImageTags: ImageTags;
    LocationType: string;
    Name: string;
    ServerId: string;
    Type: string;
};

export type JFGenreList = JFGenreListResponse;

export interface JFGenreListResponse extends JFBasePaginatedResponse {
    Items: JFGenre[];
}

export type JFMusicFolder = {
    BackdropImageTags: string[];
    ChannelId: null;
    CollectionType: string;
    Id: string;
    ImageBlurHashes: ImageBlurHashes;
    ImageTags: ImageTags;
    IsFolder: boolean;
    LocationType: string;
    Name: string;
    ServerId: string;
    Type: string;
    UserData: UserData;
};

export type JFMusicFolderList = JFMusicFolder[];

export interface JFMusicFolderListResponse extends JFBasePaginatedResponse {
    Items: JFMusicFolder[];
}

export type JFPlaylist = {
    BackdropImageTags: string[];
    ChannelId: null;
    ChildCount?: number;
    DateCreated: string;
    GenreItems: GenreItem[];
    Genres: string[];
    Id: string;
    ImageBlurHashes: ImageBlurHashes;
    ImageTags: ImageTags;
    IsFolder: boolean;
    LocationType: string;
    MediaType: string;
    Name: string;
    Overview?: string;
    RunTimeTicks: number;
    ServerId: string;
    Type: string;
    UserData: UserData;
};

export type JFPlaylistDetail = JFPlaylist & { songs?: JFSong[] };

export type JFPlaylistDetailResponse = JFPlaylist;

export type JFPlaylistList = {
    items: JFPlaylist[];
    startIndex: number;
    totalRecordCount: number;
};

export interface JFPlaylistListResponse extends JFBasePaginatedResponse {
    Items: JFPlaylist[];
}

export type JFRemoveFromPlaylist = null;

export type JFRemoveFromPlaylistParams = {
    entryIds: string[];
};

export type JFRemoveFromPlaylistResponse = null;

export type JFRequestParams = {
    albumArtistIds?: string;
    artistIds?: string;
    enableImageTypes?: string;
    enableTotalRecordCount?: boolean;
    enableUserData?: boolean;
    excludeItemTypes?: string;
    fields?: string;
    imageTypeLimit?: number;
    includeItemTypes?: string;
    isFavorite?: boolean;
    limit?: number;
    parentId?: string;
    recursive?: boolean;
    searchTerm?: string;
    sortBy?: string;
    sortOrder?: 'Ascending' | 'Descending';
    startIndex?: number;
    userId?: string;
};

export type JFSong = {
    Album: string;
    AlbumArtist: string;
    AlbumArtists: JFGenericItem[];
    AlbumId: string;
    AlbumPrimaryImageTag: string;
    ArtistItems: JFGenericItem[];
    Artists: string[];
    BackdropImageTags: string[];
    ChannelId: null;
    DateCreated: string;
    ExternalUrls: ExternalURL[];
    GenreItems: JFGenericItem[];
    Genres: string[];
    Id: string;
    ImageBlurHashes: ImageBlurHashes;
    ImageTags: ImageTags;
    IndexNumber: number;
    IsFolder: boolean;
    LocationType: string;
    MediaSources: MediaSources[];
    MediaType: string;
    Name: string;
    ParentIndexNumber: number;
    PlaylistItemId?: string;
    PremiereDate?: string;
    ProductionYear: number;
    RunTimeTicks: number;
    ServerId: string;
    SortName: string;
    Type: string;
    UserData?: UserData;
};

export type JFSongList = {
    items: JFSong[];
    startIndex: number;
    totalRecordCount: number;
};

export type JFSongListParams = JFBaseParams &
    JFPaginationParams & {
        albumArtistIds?: string;
        albumIds?: string;
        artistIds?: string;
        contributingArtistIds?: string;
        filters?: string;
        genreIds?: string;
        genres?: string;
        ids?: string;
        includeItemTypes: 'Audio';
        searchTerm?: string;
        sortBy?: JFSongListSort;
        years?: string;
    };

export interface JFSongListResponse extends JFBasePaginatedResponse {
    Items: JFSong[];
}

type Capabilities = {
    PlayableMediaTypes: any[];
    SupportedCommands: any[];
    SupportsContentUploading: boolean;
    SupportsMediaControl: boolean;
    SupportsPersistentIdentifier: boolean;
    SupportsSync: boolean;
};

type Configuration = {
    DisplayCollectionsView: boolean;
    DisplayMissingEpisodes: boolean;
    EnableLocalPassword: boolean;
    EnableNextEpisodeAutoPlay: boolean;
    GroupedFolders: any[];
    HidePlayedInLatest: boolean;
    LatestItemsExcludes: any[];
    MyMediaExcludes: any[];
    OrderedViews: any[];
    PlayDefaultAudioTrack: boolean;
    RememberAudioSelections: boolean;
    RememberSubtitleSelections: boolean;
    SubtitleLanguagePreference: string;
    SubtitleMode: string;
};

type ExternalURL = {
    Name: string;
    Url: string;
};

type GenreItem = {
    Id: string;
    Name: string;
};

type ImageBlurHashes = {
    Backdrop?: any;
    Logo?: any;
    Primary?: any;
};

type ImageTags = {
    Logo?: string;
    Primary?: string;
};

type JFBaseParams = {
    enableImageTypes?: JFImageType[];
    fields?: string;
    imageTypeLimit?: number;
    parentId?: string;
    recursive?: boolean;
    searchTerm?: string;
    userId?: string;
};

type JFPaginationParams = {
    limit?: number;
    nameStartsWith?: string;
    sortOrder?: JFSortOrder;
    startIndex?: number;
};

type MediaSources = {
    Bitrate: number;
    Container: string;
    DefaultAudioStreamIndex: number;
    ETag: string;
    Formats: any[];
    GenPtsInput: boolean;
    Id: string;
    IgnoreDts: boolean;
    IgnoreIndex: boolean;
    IsInfiniteStream: boolean;
    IsRemote: boolean;
    MediaAttachments: any[];
    MediaStreams: MediaStream[];
    Name: string;
    Path: string;
    Protocol: string;
    ReadAtNativeFramerate: boolean;
    RequiredHttpHeaders: any;
    RequiresClosing: boolean;
    RequiresLooping: boolean;
    RequiresOpening: boolean;
    RunTimeTicks: number;
    Size: number;
    SupportsDirectPlay: boolean;
    SupportsDirectStream: boolean;
    SupportsProbing: boolean;
    SupportsTranscoding: boolean;
    Type: string;
};

type MediaStream = {
    AspectRatio?: string;
    BitDepth?: number;
    BitRate?: number;
    ChannelLayout?: string;
    Channels?: number;
    Codec: string;
    CodecTimeBase: string;
    ColorSpace?: string;
    Comment?: string;
    DisplayTitle?: string;
    Height?: number;
    Index: number;
    IsDefault: boolean;
    IsExternal: boolean;
    IsForced: boolean;
    IsInterlaced: boolean;
    IsTextSubtitleStream: boolean;
    Level: number;
    PixelFormat?: string;
    Profile?: string;
    RealFrameRate?: number;
    RefFrames?: number;
    SampleRate?: number;
    SupportsExternalStream: boolean;
    TimeBase: string;
    Type: string;
    Width?: number;
};

type PlayState = {
    CanSeek: boolean;
    IsMuted: boolean;
    IsPaused: boolean;
    RepeatMode: string;
};

type Policy = {
    AccessSchedules: any[];
    AuthenticationProviderId: string;
    BlockedChannels: any[];
    BlockedMediaFolders: any[];
    BlockedTags: any[];
    BlockUnratedItems: any[];
    EnableAllChannels: boolean;
    EnableAllDevices: boolean;
    EnableAllFolders: boolean;
    EnableAudioPlaybackTranscoding: boolean;
    EnableContentDeletion: boolean;
    EnableContentDeletionFromFolders: any[];
    EnableContentDownloading: boolean;
    EnabledChannels: any[];
    EnabledDevices: any[];
    EnabledFolders: any[];
    EnableLiveTvAccess: boolean;
    EnableLiveTvManagement: boolean;
    EnableMediaConversion: boolean;
    EnableMediaPlayback: boolean;
    EnablePlaybackRemuxing: boolean;
    EnablePublicSharing: boolean;
    EnableRemoteAccess: boolean;
    EnableRemoteControlOfOtherUsers: boolean;
    EnableSharedDeviceControl: boolean;
    EnableSyncTranscoding: boolean;
    EnableUserPreferenceAccess: boolean;
    EnableVideoPlaybackTranscoding: boolean;
    ForceRemoteSourceTranscoding: boolean;
    InvalidLoginAttemptCount: number;
    IsAdministrator: boolean;
    IsDisabled: boolean;
    IsHidden: boolean;
    LoginAttemptsBeforeLockout: number;
    MaxActiveSessions: number;
    PasswordResetProviderId: string;
    RemoteClientBitrateLimit: number;
    SyncPlayAccess: string;
};

type SessionInfo = {
    AdditionalUsers: any[];
    ApplicationVersion: string;
    Capabilities: Capabilities;
    Client: string;
    DeviceId: string;
    DeviceName: string;
    HasCustomDeviceName: boolean;
    Id: string;
    IsActive: boolean;
    LastActivityDate: string;
    LastPlaybackCheckIn: string;
    NowPlayingQueue: any[];
    NowPlayingQueueFullItems: any[];
    PlayableMediaTypes: any[];
    PlayState: PlayState;
    RemoteEndPoint: string;
    ServerId: string;
    SupportedCommands: any[];
    SupportsMediaControl: boolean;
    SupportsRemoteControl: boolean;
    UserId: string;
    UserName: string;
};

type User = {
    Configuration: Configuration;
    EnableAutoLogin: boolean;
    HasConfiguredEasyPassword: boolean;
    HasConfiguredPassword: boolean;
    HasPassword: boolean;
    Id: string;
    LastActivityDate: string;
    LastLoginDate: string;
    Name: string;
    Policy: Policy;
    ServerId: string;
};

type UserData = {
    IsFavorite: boolean;
    Key: string;
    PlaybackPositionTicks: number;
    PlayCount: number;
    Played: boolean;
};
