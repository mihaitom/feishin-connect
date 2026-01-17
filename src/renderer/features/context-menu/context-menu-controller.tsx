import { useQueryClient } from '@tanstack/react-query';
import { lazy, Suspense, useEffect, useRef } from 'react';
import { createCallable } from 'react-call';
import { useParams } from 'react-router';

import { ContextMenu } from '/@/shared/components/context-menu/context-menu';

const AlbumArtistContextMenu = lazy(() =>
    import('/@/renderer/features/context-menu/menus/album-artist-context-menu').then((module) => ({
        default: module.AlbumArtistContextMenu,
    })),
);

const AlbumContextMenu = lazy(() =>
    import('/@/renderer/features/context-menu/menus/album-context-menu').then((module) => ({
        default: module.AlbumContextMenu,
    })),
);

const ArtistContextMenu = lazy(() =>
    import('/@/renderer/features/context-menu/menus/artist-context-menu').then((module) => ({
        default: module.ArtistContextMenu,
    })),
);

const FolderContextMenu = lazy(() =>
    import('/@/renderer/features/context-menu/menus/folder-context-menu').then((module) => ({
        default: module.FolderContextMenu,
    })),
);

const GenreContextMenu = lazy(() =>
    import('/@/renderer/features/context-menu/menus/genre-context-menu').then((module) => ({
        default: module.GenreContextMenu,
    })),
);

const PlaylistContextMenu = lazy(() =>
    import('/@/renderer/features/context-menu/menus/playlist-context-menu').then((module) => ({
        default: module.PlaylistContextMenu,
    })),
);

const PlaylistSongContextMenu = lazy(() =>
    import('/@/renderer/features/context-menu/menus/playlist-song-context-menu').then((module) => ({
        default: module.PlaylistSongContextMenu,
    })),
);

const QueueContextMenu = lazy(() =>
    import('/@/renderer/features/context-menu/menus/queue-context-menu').then((module) => ({
        default: module.QueueContextMenu,
    })),
);

const SongContextMenu = lazy(() =>
    import('/@/renderer/features/context-menu/menus/song-context-menu').then((module) => ({
        default: module.SongContextMenu,
    })),
);
import {
    Album,
    AlbumArtist,
    Artist,
    Folder,
    Genre,
    LibraryItem,
    Playlist,
    QueueSong,
    Song,
} from '/@/shared/types/domain-types';

interface ContextMenuControllerProps {
    cmd: ContextMenuCommand;
    event: React.MouseEvent<unknown>;
}

export const ContextMenuController = createCallable<ContextMenuControllerProps, void>(
    ({ call, cmd, event }) => {
        const { libraryId } = useParams() as { libraryId: string };
        const queryClient = useQueryClient();

        const triggerRef = useRef<HTMLDivElement>(null);
        const isExecuted = useRef<boolean>(false);

        useEffect(() => {
            if (isExecuted.current) {
                return;
            }

            if (!triggerRef.current) {
                return;
            }

            const handleContextMenu = () => {
                event.preventDefault();

                triggerRef.current?.dispatchEvent(
                    new MouseEvent('contextmenu', {
                        bubbles: true,
                        clientX: event.clientX,
                        clientY: event.clientY,
                    }),
                );
            };

            isExecuted.current = true;

            handleContextMenu();
        }, [call, cmd, event, event.clientX, event.clientY, libraryId, queryClient]);

        return (
            <ContextMenu>
                <ContextMenu.Target>
                    <div
                        ref={triggerRef}
                        style={{
                            height: 0,
                            left: 0,
                            pointerEvents: 'none',
                            position: 'absolute',
                            top: 0,
                            userSelect: 'none',
                            width: 0,
                        }}
                    />
                </ContextMenu.Target>
                <Suspense fallback={null}>
                    {cmd.type === LibraryItem.QUEUE_SONG && <QueueContextMenu {...cmd} />}
                    {cmd.type === LibraryItem.ALBUM && <AlbumContextMenu {...cmd} />}
                    {cmd.type === LibraryItem.ALBUM_ARTIST && <AlbumArtistContextMenu {...cmd} />}
                    {cmd.type === LibraryItem.ARTIST && <ArtistContextMenu {...cmd} />}
                    {cmd.type === LibraryItem.FOLDER && <FolderContextMenu {...cmd} />}
                    {cmd.type === LibraryItem.GENRE && <GenreContextMenu {...cmd} />}
                    {cmd.type === LibraryItem.PLAYLIST && <PlaylistContextMenu {...cmd} />}
                    {cmd.type === LibraryItem.PLAYLIST_SONG && <PlaylistSongContextMenu {...cmd} />}
                    {cmd.type === LibraryItem.SONG && <SongContextMenu {...cmd} />}
                </Suspense>
            </ContextMenu>
        );
    },
);

export type ContextMenuCommand =
    | AlbumArtistContextMenuProps
    | AlbumContextMenuProps
    | ArtistContextMenuProps
    | FolderContextMenuProps
    | GenreContextMenuProps
    | PlaylistContextMenuProps
    | PlaylistSongContextMenuProps
    | QueueSongContextMenuProps
    | SongContextMenuProps;

type AlbumArtistContextMenuProps = {
    items: AlbumArtist[];
    type: LibraryItem.ALBUM_ARTIST;
};

type AlbumContextMenuProps = {
    items: Album[];
    type: LibraryItem.ALBUM;
};

type ArtistContextMenuProps = {
    items: Artist[];
    type: LibraryItem.ARTIST;
};

type FolderContextMenuProps = {
    items: Folder[];
    type: LibraryItem.FOLDER;
};

type GenreContextMenuProps = {
    items: Genre[];
    type: LibraryItem.GENRE;
};

type PlaylistContextMenuProps = {
    items: Playlist[];
    type: LibraryItem.PLAYLIST;
};

type PlaylistSongContextMenuProps = {
    items: Song[];
    type: LibraryItem.PLAYLIST_SONG;
};

type QueueSongContextMenuProps = {
    items: QueueSong[];
    type: LibraryItem.QUEUE_SONG;
};

type SongContextMenuProps = {
    items: Song[];
    type: LibraryItem.SONG;
};
