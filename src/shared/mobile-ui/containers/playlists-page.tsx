import { useState } from 'react';

import { Button } from '/@/shared/components/button/button';
import { Stack } from '/@/shared/components/stack/stack';
import { TextInput } from '/@/shared/components/text-input/text-input';
import { Text } from '/@/shared/components/text/text';
import { useDebouncedValue } from '/@/shared/hooks/use-debounced-value';
import { FadeIn } from '/@/shared/mobile-ui/components/fade-in';
import { PlaylistRow } from '/@/shared/mobile-ui/components/playlist-row';
import { PlaylistActionSheet } from '/@/shared/mobile-ui/containers/menus/playlist-action-sheet';
import { MobilePlaylistItem, Play, UseMobileSearch } from '/@/shared/mobile-ui/types';

interface PlaylistsPageProps {
    onPlay: (playlistId: string, playType?: Play) => void;
    usePlaylistSearch: UseMobileSearch<MobilePlaylistItem>;
}

export const PlaylistsPage = ({ onPlay, usePlaylistSearch }: PlaylistsPageProps) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm] = useDebouncedValue(searchTerm, 300);
    const [activePlaylist, setActivePlaylist] = useState<MobilePlaylistItem | null>(null);

    const { hasMore, items, loadMore } = usePlaylistSearch(debouncedSearchTerm ?? '');

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
                            onPlay={() => onPlay(playlist.id)}
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
                onPlay={onPlay}
                playlist={activePlaylist}
            />
        </Stack>
    );
};
