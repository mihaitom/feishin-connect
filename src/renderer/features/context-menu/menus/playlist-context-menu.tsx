import { useMemo } from 'react';

import { AddToPlaylistAction } from '/@/renderer/features/context-menu/actions/add-to-playlist-action';
import { DeletePlaylistAction } from '/@/renderer/features/context-menu/actions/delete-playlist-action';
import { EditPlaylistAction } from '/@/renderer/features/context-menu/actions/edit-playlist-action';
import { GetInfoAction } from '/@/renderer/features/context-menu/actions/get-info-action';
import { PlayAction } from '/@/renderer/features/context-menu/actions/play-action';
import { ContextMenu } from '/@/shared/components/context-menu/context-menu';
import { ContextMenuPreview } from '/@/shared/components/context-menu/context-menu-preview';
import { LibraryItem, Playlist } from '/@/shared/types/domain-types';

interface PlaylistContextMenuProps {
    items: Playlist[];
    type: LibraryItem.PLAYLIST;
}

export const PlaylistContextMenu = ({ items, type }: PlaylistContextMenuProps) => {
    const { ids } = useMemo(() => {
        const ids = items.map((item) => item.id);
        return { ids };
    }, [items]);

    return (
        <ContextMenu.Content
            bottomStickyContent={<ContextMenuPreview items={items} itemType={type} />}
        >
            <PlayAction ids={ids} itemType={LibraryItem.ALBUM} />
            <ContextMenu.Divider />
            <AddToPlaylistAction items={ids} itemType={LibraryItem.ALBUM} />
            <ContextMenu.Divider />
            <GetInfoAction disabled={items.length === 0} items={items} />
            <ContextMenu.Divider />
            <EditPlaylistAction items={items} />
            <DeletePlaylistAction items={items} />
        </ContextMenu.Content>
    );
};
