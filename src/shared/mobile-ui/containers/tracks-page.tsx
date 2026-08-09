import { useState } from 'react';

import { Button } from '/@/shared/components/button/button';
import { Stack } from '/@/shared/components/stack/stack';
import { TextInput } from '/@/shared/components/text-input/text-input';
import { Text } from '/@/shared/components/text/text';
import { useDebouncedValue } from '/@/shared/hooks/use-debounced-value';
import { FadeIn } from '/@/shared/mobile-ui/components/fade-in';
import { TrackRow } from '/@/shared/mobile-ui/components/track-row';
import { TrackActionSheet } from '/@/shared/mobile-ui/containers/menus/track-action-sheet';
import {
    MobilePlaylistItem,
    MobileTrackItem,
    Play,
    UseMobileSearch,
} from '/@/shared/mobile-ui/types';

interface TracksPageProps {
    onAddToPlaylist: (playlistId: string, songId: string) => void;
    onPlay: (songId: string, playType?: Play) => void;
    onPlayTrackRadio: (songId: string, playType: Play) => void;
    usePlaylistSearch: UseMobileSearch<MobilePlaylistItem>;
    useTrackSearch: UseMobileSearch<MobileTrackItem>;
}

export const TracksPage = ({
    onAddToPlaylist,
    onPlay,
    onPlayTrackRadio,
    usePlaylistSearch,
    useTrackSearch,
}: TracksPageProps) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm] = useDebouncedValue(searchTerm, 300);
    const [activeTrack, setActiveTrack] = useState<MobileTrackItem | null>(null);

    const { hasMore, items, loadMore } = useTrackSearch(debouncedSearchTerm ?? '');

    return (
        <Stack gap="md" p="md">
            <TextInput
                onChange={(e) => setSearchTerm(e.currentTarget.value)}
                placeholder="Search tracks…"
                value={searchTerm}
            />
            {items.length === 0 && (
                <Text isMuted ta="center">
                    No tracks found
                </Text>
            )}
            <FadeIn>
                <Stack gap={4}>
                    {items.map((track) => (
                        <TrackRow
                            key={track.id}
                            onLongPress={() => setActiveTrack(track)}
                            onPlay={() => onPlay(track.id)}
                            track={track}
                        />
                    ))}
                </Stack>
            </FadeIn>
            {hasMore && (
                <Button onClick={loadMore} variant="default">
                    Load more
                </Button>
            )}
            <TrackActionSheet
                onAddToPlaylist={onAddToPlaylist}
                onClose={() => setActiveTrack(null)}
                onPlay={onPlay}
                onPlayTrackRadio={onPlayTrackRadio}
                track={activeTrack}
                usePlaylistSearch={usePlaylistSearch}
            />
        </Stack>
    );
};
