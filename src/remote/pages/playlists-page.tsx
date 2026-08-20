import { useState } from 'react';

import { FadeIn } from '/@/remote/components/fade-in';
import { PlaylistActionSheet } from '/@/remote/components/menus/playlist-action-sheet';
import { PlaylistRow } from '/@/remote/components/playlist-row';
import { useConfirmedSend } from '/@/remote/hooks/use-confirmed-send';
import { useRemoteQuery } from '/@/remote/hooks/use-remote-query';
import { usePlaylistsResponse } from '/@/remote/store/library';
import { Button } from '/@/shared/components/button/button';
import { Stack } from '/@/shared/components/stack/stack';
import { TextInput } from '/@/shared/components/text-input/text-input';
import { Text } from '/@/shared/components/text/text';
import { useDebouncedValue } from '/@/shared/hooks/use-debounced-value';
import { RemotePlaylistItem } from '/@/shared/types/remote-types';

export const PlaylistsPage = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm] = useDebouncedValue(searchTerm, 300);
    const [activePlaylist, setActivePlaylist] = useState<null | RemotePlaylistItem>(null);
    const confirmedSend = useConfirmedSend();
    const response = usePlaylistsResponse();

    const { hasMore, items, loadMore } = useRemoteQuery<RemotePlaylistItem>({
        event: 'playlists-request',
        response,
        searchTerm: debouncedSearchTerm || undefined,
    });

    return (
        <Stack gap="md" p="md">
            <TextInput
                onChange={(e) => setSearchTerm(e.currentTarget.value)}
                placeholder="Search playlists…"
                value={searchTerm}
            />
            {items.length === 0 && (
                <Text isMuted ta="center">
                    No playlists found
                </Text>
            )}
            <FadeIn>
                <Stack gap={4}>
                    {items.map((playlist) => (
                        <PlaylistRow
                            key={playlist.id}
                            onLongPress={() => setActivePlaylist(playlist)}
                            onPlay={() =>
                                confirmedSend({ event: 'play-playlist', id: playlist.id })
                            }
                            playlist={playlist}
                        />
                    ))}
                </Stack>
            </FadeIn>
            {hasMore && (
                <Button onClick={loadMore} variant="default">
                    Load more
                </Button>
            )}
            <PlaylistActionSheet
                onClose={() => setActivePlaylist(null)}
                playlist={activePlaylist}
            />
        </Stack>
    );
};
