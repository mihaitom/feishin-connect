import { useShallow } from 'zustand/shallow';

import { getItemImageUrl } from '/@/renderer/components/item-image/item-image';
import { useMobilePlaylistSearch } from '/@/renderer/features/mobile/hooks/use-mobile-playlist-search';
import { useMobileTrackActions } from '/@/renderer/features/mobile/hooks/use-mobile-track-actions';
import { useConnectPlayerStore } from '/@/renderer/features/player/components/connect/connect.store';
import { connectFetch } from '/@/renderer/features/player/components/connect/types';
import { usePlayer } from '/@/renderer/features/player/context/player-context';
import { usePlayerActions, usePlayerQueue, usePlayerSong } from '/@/renderer/store';
import { ActionIcon } from '/@/shared/components/action-icon/action-icon';
import { Group } from '/@/shared/components/group/group';
import { Icon } from '/@/shared/components/icon/icon';
import { Stack } from '/@/shared/components/stack/stack';
import { Text } from '/@/shared/components/text/text';
import { ListRow } from '/@/shared/mobile-ui/components/list-row';
import { Thumbnail } from '/@/shared/mobile-ui/components/thumbnail';
import { QueuePage as SharedQueuePage } from '/@/shared/mobile-ui/containers/queue-page';
import { MobileQueueItem } from '/@/shared/mobile-ui/types';
import { LibraryItem } from '/@/shared/types/domain-types';

const postJson = (path: string) => connectFetch(path, { method: 'POST' }).catch(() => {});

// Another tab/device owns the queue (see connect.store.ts's ConnectMode) —
// read-only display of what the owner pushed (use-connect-local-queue.ts),
// plus Next/Prev. No reorder/remove/jump-to-arbitrary-track from here: the
// backend only exposes stepping one at a time (POST /next, /prev), not a
// queue-jump for local playback — out of scope for v1 (mobile-view plan,
// Phase 2).
const MirrorQueuePage = () => {
    const { queue, queueIndex } = useConnectPlayerStore(
        useShallow((s) => ({ queue: s.queue, queueIndex: s.queueIndex })),
    );

    return (
        <Stack gap="md" p="md">
            <Group gap="xs" justify="center">
                <ActionIcon
                    icon="mediaPrevious"
                    onClick={() => postJson('/prev')}
                    tooltip={{ label: 'Previous track' }}
                    variant="default"
                />
                <ActionIcon
                    icon="mediaNext"
                    onClick={() => postJson('/next')}
                    tooltip={{ label: 'Next track' }}
                    variant="default"
                />
            </Group>
            {queue.length === 0 && (
                <Text isMuted ta="center">
                    Nothing playing on the other device
                </Text>
            )}
            <Stack gap={4}>
                {queue.map((item, index) => (
                    <ListRow isCurrent={index === queueIndex} key={item.id}>
                        <Thumbnail
                            fallbackIcon={<Icon icon="emptySongImage" size={18} />}
                            src={item.cover_art_url ?? null}
                        />
                        <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                            <Text
                                fw={index === queueIndex ? 700 : 500}
                                isNoSelect
                                style={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {item.title}
                            </Text>
                            <Text
                                isMuted
                                isNoSelect
                                size="sm"
                                style={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {item.artist}
                                {item.album ? ` · ${item.album}` : ''}
                            </Text>
                        </Stack>
                    </ListRow>
                ))}
            </Stack>
        </Stack>
    );
};

const LocalQueuePage = () => {
    const queue = usePlayerQueue();
    const currentSong = usePlayerSong();
    const { mediaPlay } = usePlayerActions();
    const { clearSelected, moveSelectedTo } = usePlayer();
    const { onAddToPlaylist, onPlay, onPlayTrackRadio } = useMobileTrackActions();

    const items: MobileQueueItem[] = queue.map((song) => ({
        album: song.album,
        artistName: song.artistName,
        duration: song.duration,
        id: song.id,
        imageUrl:
            getItemImageUrl({
                id: song.id,
                imageUrl: song.imageUrl,
                itemType: LibraryItem.SONG,
                serverId: song._serverId,
                type: 'itemCard',
                useRemoteUrl: true,
            }) ?? null,
        name: song.name,
        uniqueId: song._uniqueId,
    }));

    return (
        <SharedQueuePage
            currentUniqueId={currentSong?._uniqueId ?? null}
            items={items}
            onAddToPlaylist={onAddToPlaylist}
            onJump={(uniqueId) => mediaPlay(uniqueId)}
            onPlay={onPlay}
            onPlayTrackRadio={onPlayTrackRadio}
            onRemove={(uniqueId) => {
                const song = queue.find((item) => item._uniqueId === uniqueId);
                if (!song) return;
                clearSelected([song]);
            }}
            onReorder={(uniqueId, targetUniqueId, edge) => {
                const movedSong = queue.find((item) => item._uniqueId === uniqueId);
                if (!movedSong) return;
                moveSelectedTo([movedSong], edge, targetUniqueId);
            }}
            usePlaylistSearch={useMobilePlaylistSearch}
        />
    );
};

export const QueuePage = () => {
    const mode = useConnectPlayerStore((s) => s.mode);
    return mode === 'mirror' ? <MirrorQueuePage /> : <LocalQueuePage />;
};
