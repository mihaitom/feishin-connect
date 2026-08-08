import formatDuration from 'format-duration';
import { useState } from 'react';
import { RiMusic2Line } from 'react-icons/ri';

import { Thumbnail } from '/@/remote/components/thumbnail';
import { useRemoteQuery } from '/@/remote/hooks/use-remote-query';
import { useSend } from '/@/remote/store';
import { useTracksResponse } from '/@/remote/store/library';
import { Button } from '/@/shared/components/button/button';
import { Group } from '/@/shared/components/group/group';
import { Stack } from '/@/shared/components/stack/stack';
import { TextInput } from '/@/shared/components/text-input/text-input';
import { Text } from '/@/shared/components/text/text';
import { useDebouncedValue } from '/@/shared/hooks/use-debounced-value';
import { RemoteTrackItem } from '/@/shared/types/remote-types';

export const TracksPage = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm] = useDebouncedValue(searchTerm, 300);
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
            <Stack gap={4}>
                {items.map((track) => (
                    <Group
                        gap="sm"
                        key={track.id}
                        onClick={() => send({ event: 'play-track', id: track.id })}
                        style={{
                            borderRadius: 12,
                            cursor: 'pointer',
                            minHeight: 56,
                            padding: '8px 16px',
                            userSelect: 'none',
                        }}
                        wrap="nowrap"
                    >
                        <Thumbnail fallbackIcon={<RiMusic2Line size={18} />} src={track.imageUrl} />
                        <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                            <Text
                                fw={500}
                                style={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {track.name}
                            </Text>
                            <Text
                                isMuted
                                size="sm"
                                style={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {track.artistName}
                                {track.album ? ` · ${track.album}` : ''} ·{' '}
                                {formatDuration(track.duration)}
                            </Text>
                        </Stack>
                    </Group>
                ))}
            </Stack>
            {hasMore && (
                <Button onClick={loadMore} variant="default">
                    Load more
                </Button>
            )}
        </Stack>
    );
};
