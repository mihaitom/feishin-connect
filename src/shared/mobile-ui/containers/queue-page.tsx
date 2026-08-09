import { AnimatePresence, Reorder } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

import { Stack } from '/@/shared/components/stack/stack';
import { Text } from '/@/shared/components/text/text';
import { FadeIn } from '/@/shared/mobile-ui/components/fade-in';
import { QueueRow } from '/@/shared/mobile-ui/components/queue-row';
import { TrackActionSheet } from '/@/shared/mobile-ui/containers/menus/track-action-sheet';
import {
    MobilePlaylistItem,
    MobileQueueItem,
    Play,
    UseMobileSearch,
} from '/@/shared/mobile-ui/types';

interface QueuePageProps {
    currentUniqueId: null | string;
    items: MobileQueueItem[];
    onAddToPlaylist: (playlistId: string, songId: string) => void;
    onJump: (uniqueId: string) => void;
    onPlay: (songId: string, playType: Play) => void;
    onPlayTrackRadio: (songId: string, playType: Play) => void;
    onRemove: (uniqueId: string) => void;
    onReorder: (movedUniqueId: string, targetUniqueId: string, edge: 'bottom' | 'top') => void;
    usePlaylistSearch: UseMobileSearch<MobilePlaylistItem>;
}

export const QueuePage = ({
    currentUniqueId,
    items,
    onAddToPlaylist,
    onJump,
    onPlay,
    onPlayTrackRadio,
    onRemove,
    onReorder,
    usePlaylistSearch,
}: QueuePageProps) => {
    const [activeTrack, setActiveTrack] = useState<null | { id: string; name: string }>(null);
    const [localOrder, setLocalOrder] = useState<string[]>(() => items.map((i) => i.uniqueId));
    const isDraggingRef = useRef(false);

    // The authoritative order is pushed on every queue change — resync
    // unless a drag is in flight, so a push mid-gesture can't yank the item
    // out from under the user's finger.
    useEffect(() => {
        if (isDraggingRef.current) return;
        setLocalOrder(items.map((i) => i.uniqueId));
    }, [items]);

    const orderedItems = localOrder
        .map((uniqueId) => items.find((i) => i.uniqueId === uniqueId))
        .filter((i): i is MobileQueueItem => !!i);

    const handleRemove = (uniqueId: string) => {
        setLocalOrder((prev) => prev.filter((id) => id !== uniqueId));
        onRemove(uniqueId);
    };

    const handleReorderDragEnd = (movedUniqueId: string) => {
        isDraggingRef.current = false;

        const index = localOrder.indexOf(movedUniqueId);
        if (index === -1) return;

        const after = localOrder[index + 1];
        const before = localOrder[index - 1];

        if (after) {
            onReorder(movedUniqueId, after, 'top');
        } else if (before) {
            onReorder(movedUniqueId, before, 'bottom');
        }
    };

    return (
        <Stack gap="md" p="md">
            {items.length === 0 && (
                <Text isMuted ta="center">
                    Queue is empty
                </Text>
            )}
            <FadeIn>
                <Reorder.Group
                    as="div"
                    axis="y"
                    onReorder={setLocalOrder}
                    style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
                    values={localOrder}
                >
                    <AnimatePresence initial={false}>
                        {orderedItems.map((item, index) => (
                            <QueueRow
                                index={index + 1}
                                isCurrent={item.uniqueId === currentUniqueId}
                                item={item}
                                key={item.uniqueId}
                                onJump={() => onJump(item.uniqueId)}
                                onLongPress={() => setActiveTrack({ id: item.id, name: item.name })}
                                onRemove={() => handleRemove(item.uniqueId)}
                                onReorderDragEnd={() => handleReorderDragEnd(item.uniqueId)}
                                onReorderDragStart={() => {
                                    isDraggingRef.current = true;
                                }}
                            />
                        ))}
                    </AnimatePresence>
                </Reorder.Group>
            </FadeIn>
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
