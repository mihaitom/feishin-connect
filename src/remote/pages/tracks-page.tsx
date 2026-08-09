import { useState } from 'react';

import { FadeIn } from '/@/remote/components/fade-in';
import { TrackActionSheet } from '/@/remote/components/menus/track-action-sheet';
import { TrackRow } from '/@/remote/components/track-row';
import { useRemoteQuery } from '/@/remote/hooks/use-remote-query';
import { useSend } from '/@/remote/store';
import { useTracksResponse } from '/@/remote/store/library';
import { Button } from '/@/shared/components/button/button';
import { Stack } from '/@/shared/components/stack/stack';
import { TextInput } from '/@/shared/components/text-input/text-input';
import { Text } from '/@/shared/components/text/text';
import { useDebouncedValue } from '/@/shared/hooks/use-debounced-value';
import { RemoteTrackItem } from '/@/shared/types/remote-types';

export const TracksPage = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm] = useDebouncedValue(searchTerm, 300);
    const [activeTrack, setActiveTrack] = useState<null | RemoteTrackItem>(null);
    const send = useSend();
    const response = useTracksResponse();

    const { hasMore, items, loadMore } = useRemoteQuery<RemoteTrackItem>({
        event: 'tracks-request',
        response,
        searchTerm: debouncedSearchTerm || undefined,
    });

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
                            onPlay={() => send({ event: 'play-track', id: track.id })}
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
            <TrackActionSheet onClose={() => setActiveTrack(null)} track={activeTrack} />
        </Stack>
    );
};
