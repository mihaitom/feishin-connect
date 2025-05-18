export type SSAlbum = SSAlbumListEntry & {
    song: SSSong[];
};

export type SSAlbumArtistDetail = SSAlbumArtistListEntry & { album: SSAlbumListEntry[] };

export type SSAlbumArtistDetailParams = {
    id: string;
};

export type SSAlbumArtistDetailResponse = {
    artist: SSAlbumArtistListEntry & {
        album: SSAlbumListEntry[];
    };
};

export type SSAlbumArtistList = {
    items: SSAlbumArtistListEntry[];
    startIndex: number;
    totalRecordCount: null | number;
};

export type SSAlbumArtistListEntry = {
    albumCount: string;
    artistImageUrl?: string;
    coverArt?: string;
    id: string;
    name: string;
};

export type SSAlbumArtistListParams = {
    musicFolderId?: string;
};

export type SSAlbumArtistListResponse = {
    artists: {
        ignoredArticles: string;
        index: SSArtistIndex[];
        lastModified: number;
    };
};

export type SSAlbumDetail = Omit<SSAlbum, 'song'> & { songs: SSSong[] };

export type SSAlbumDetailResponse = {
    album: SSAlbum;
};

export type SSAlbumList = {
    items: SSAlbumListEntry[];
    startIndex: number;
    totalRecordCount: null | number;
};

export type SSAlbumListEntry = {
    album: string;
    artist: string;
    artistId: string;
    coverArt: string;
    created: string;
    duration: number;
    genre?: string;
    id: string;
    isDir: boolean;
    isVideo: boolean;
    name: string;
    parent: string;
    songCount: number;
    starred?: boolean;
    title: string;
    userRating?: number;
    year: number;
};

export type SSAlbumListParams = {
    fromYear?: number;
    genre?: string;
    musicFolderId?: string;
    offset?: number;
    size?: number;
    toYear?: number;
    type: string;
};

export type SSAlbumListResponse = {
    albumList2: {
        album: SSAlbumListEntry[];
    };
};

export type SSArtistIndex = {
    artist: SSAlbumArtistListEntry[];
    name: string;
};

export type SSArtistInfo = {
    biography: string;
    largeImageUrl?: string;
    lastFmUrl?: string;
    mediumImageUrl?: string;
    musicBrainzId?: string;
    similarArtist?: {
        albumCount: string;
        artistImageUrl?: string;
        coverArt?: string;
        id: string;
        name: string;
    }[];
    smallImageUrl?: string;
};

export type SSArtistInfoParams = {
    count?: number;
    id: string;
    includeNotPresent?: boolean;
};

export type SSArtistInfoResponse = {
    artistInfo2: SSArtistInfo;
};

export type SSBaseResponse = {
    serverVersion?: 'string';
    status: 'string';
    type?: 'string';
    version: 'string';
};

export type SSFavorite = null;

export type SSFavoriteParams = {
    albumId?: string;
    artistId?: string;
    id?: string;
};

export type SSFavoriteResponse = null;

export type SSGenre = {
    albumCount?: number;
    songCount?: number;
    value: string;
};

export type SSGenreList = SSGenre[];

export type SSGenreListResponse = {
    genres: {
        genre: SSGenre[];
    };
};

export type SSMusicFolder = {
    id: number;
    name: string;
};

export type SSMusicFolderList = SSMusicFolder[];

export type SSMusicFolderListResponse = {
    musicFolders: {
        musicFolder: SSMusicFolder[];
    };
};

export type SSRating = null;

export type SSRatingParams = {
    id: string;
    rating: number;
};

export type SSRatingResponse = null;

export type SSScrobbleParams = {
    id: string;
    submission?: boolean;
    time?: number;
};

export type SSSong = {
    album: string;
    albumId: string;
    artist: string;
    artistId?: string;
    bitRate: number;
    contentType: string;
    coverArt: string;
    created: string;
    discNumber?: number;
    duration: number;
    genre: string;
    id: string;
    isDir: boolean;
    isVideo: boolean;
    parent: string;
    path: string;
    playCount: number;
    size: number;
    starred?: boolean;
    suffix: string;
    title: string;
    track: number;
    type: string;
    userRating?: number;
    year: number;
};

export type SSTopSongList = {
    items: SSSong[];
    startIndex: number;
    totalRecordCount: null | number;
};

export type SSTopSongListParams = {
    artist: string;
    count?: number;
};

export type SSTopSongListResponse = {
    topSongs: {
        song: SSSong[];
    };
};
