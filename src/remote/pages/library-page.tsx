import { useState } from 'react';

import { AlbumRow } from '/@/remote/components/album-row';
import { FadeIn } from '/@/remote/components/fade-in';
import { AlbumActionSheet } from '/@/remote/components/menus/album-action-sheet';
import { TrackActionSheet } from '/@/remote/components/menus/track-action-sheet';
import { TrackRow } from '/@/remote/components/track-row';
import { useRemoteQuery } from '/@/remote/hooks/use-remote-query';
import { useSend } from '/@/remote/store';
import { useAlbumsResponse, useTracksResponse } from '/@/remote/store/library';
import { Button } from '/@/shared/components/button/button';
import { SegmentedControl } from '/@/shared/components/segmented-control/segmented-control';
import { Stack } from '/@/shared/components/stack/stack';
import { TextInput } from '/@/shared/components/text-input/text-input';
import { Text } from '/@/shared/components/text/text';
import { useDebouncedValue } from '/@/shared/hooks/use-debounced-value';
import { RemoteAlbumItem, RemoteTrackItem } from '/@/shared/types/remote-types';

type LibraryView = 'albums' | 'tracks';

export const LibraryPage = () => {
    const [view, setView] = useState<LibraryView>('tracks');
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm] = useDebouncedValue(searchTerm, 300);
    const [activeTrack, setActiveTrack] = useState<null | RemoteTrackItem>(null);
    const [activeAlbum, setActiveAlbum] = useState<null | RemoteAlbumItem>(null);
    const send = useSend();
    const tracksResponse = useTracksResponse();
    const albumsResponse = useAlbumsResponse();

    // A single `useRemoteQuery` call, switching its `event`/`response` with
    // `view` rather than calling the hook once per view — the hook already
    // resets and refetches whenever `event` changes, so flipping the toggle
    // naturally issues exactly one fresh request for the newly selected type
    // instead of both views fetching in parallel on every mount.
    const { hasMore, items, loadMore } = useRemoteQuery<RemoteAlbumItem | RemoteTrackItem>({
        event: view === 'tracks' ? 'tracks-request' : 'albums-request',
        response: view === 'tracks' ? tracksResponse : albumsResponse,
        searchTerm: debouncedSearchTerm || undefined,
    });

    return (
        <Stack gap="md" p="md">
            <SegmentedControl
                data={[
                    { label: 'Tracks', value: 'tracks' },
                    { label: 'Albums', value: 'albums' },
                ]}
                onChange={(value) => setView(value as LibraryView)}
                value={view}
            />
            <TextInput
                onChange={(e) => setSearchTerm(e.currentTarget.value)}
                placeholder={view === 'tracks' ? 'Search tracks…' : 'Search albums…'}
                value={searchTerm}
            />
            {items.length === 0 && (
                <Text isMuted ta="center">
                    {view === 'tracks' ? 'No tracks found' : 'No albums found'}
                </Text>
            )}
            <FadeIn>
                <Stack gap={4}>
                    {view === 'tracks'
                        ? // `items` always matches `view` — both come from the same
                          // request cycle above, keyed by the same `event` switch.
                          (items as RemoteTrackItem[]).map((track) => (
                              <TrackRow
                                  key={track.id}
                                  onLongPress={() => setActiveTrack(track)}
                                  onPlay={() => send({ event: 'play-track', id: track.id })}
                                  track={track}
                              />
                          ))
                        : (items as RemoteAlbumItem[]).map((album) => (
                              <AlbumRow
                                  album={album}
                                  key={album.id}
                                  onLongPress={() => setActiveAlbum(album)}
                                  onPlay={() => send({ event: 'play-album', id: album.id })}
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
            <AlbumActionSheet album={activeAlbum} onClose={() => setActiveAlbum(null)} />
        </Stack>
    );
};
