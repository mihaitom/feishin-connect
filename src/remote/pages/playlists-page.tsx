import formatDuration from 'format-duration';
import { useState } from 'react';
import { RiPlayListLine } from 'react-icons/ri';

import { Thumbnail } from '/@/remote/components/thumbnail';
import { useRemoteQuery } from '/@/remote/hooks/use-remote-query';
import { useSend } from '/@/remote/store';
import { usePlaylistsResponse } from '/@/remote/store/library';
import { Button } from '/@/shared/components/button/button';
import { Group } from '/@/shared/components/group/group';
import { Stack } from '/@/shared/components/stack/stack';
import { TextInput } from '/@/shared/components/text-input/text-input';
import { Text } from '/@/shared/components/text/text';
import { useDebouncedValue } from '/@/shared/hooks/use-debounced-value';
import { RemotePlaylistItem } from '/@/shared/types/remote-types';

export const PlaylistsPage = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm] = useDebouncedValue(searchTerm, 300);
    const send = useSend();
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
            <Stack gap={4}>
                {items.map((playlist) => (
                    <Group
                        gap="sm"
                        key={playlist.id}
                        onClick={() => send({ event: 'play-playlist', id: playlist.id })}
                        style={{
                            borderRadius: 12,
                            cursor: 'pointer',
                            minHeight: 56,
                            padding: '8px 16px',
                            userSelect: 'none',
                        }}
                        wrap="nowrap"
                    >
                        <Thumbnail
                            fallbackIcon={<RiPlayListLine size={18} />}
                            src={playlist.imageUrl}
                        />
                        <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                            <Text
                                fw={500}
                                style={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {playlist.name}
                            </Text>
                            <Text isMuted size="sm">
                                {playlist.songCount ?? 0} songs
                                {playlist.duration ? ` · ${formatDuration(playlist.duration)}` : ''}
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
