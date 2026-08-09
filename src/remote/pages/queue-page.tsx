import { AnimatePresence, Reorder } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

import { FadeIn } from '/@/remote/components/fade-in';
import { TrackActionSheet } from '/@/remote/components/menus/track-action-sheet';
import { QueueRow } from '/@/remote/components/queue-row';
import { useSend } from '/@/remote/store';
import { useQueueState } from '/@/remote/store/library';
import { Stack } from '/@/shared/components/stack/stack';
import { Text } from '/@/shared/components/text/text';
import { RemoteQueueItem } from '/@/shared/types/remote-types';

export const QueuePage = () => {
    const send = useSend();
    const { currentUniqueId, items } = useQueueState();
    const [activeTrack, setActiveTrack] = useState<null | { id: string; name: string }>(null);
    const [localOrder, setLocalOrder] = useState<string[]>(() => items.map((i) => i.uniqueId));
    const isDraggingRef = useRef(false);

    // The server broadcasts the authoritative order on every queue change —
    // resync unless a drag is in flight, so a push mid-gesture can't yank the
    // item out from under the user's finger.
    useEffect(() => {
        if (isDraggingRef.current) return;
        setLocalOrder(items.map((i) => i.uniqueId));
    }, [items]);

    const orderedItems = localOrder
        .map((uniqueId) => items.find((i) => i.uniqueId === uniqueId))
        .filter((i): i is RemoteQueueItem => !!i);

    const handleRemove = (uniqueId: string) => {
        setLocalOrder((prev) => prev.filter((id) => id !== uniqueId));
        send({ event: 'remove-from-queue', uniqueId });
    };

    const handleReorderDragEnd = (movedUniqueId: string) => {
        isDraggingRef.current = false;

        const index = localOrder.indexOf(movedUniqueId);
        if (index === -1) return;

        const after = localOrder[index + 1];
        const before = localOrder[index - 1];

        if (after) {
            send({
                edge: 'top',
                event: 'reorder-queue',
                targetUniqueId: after,
                uniqueId: movedUniqueId,
            });
        } else if (before) {
            send({
                edge: 'bottom',
                event: 'reorder-queue',
                targetUniqueId: before,
                uniqueId: movedUniqueId,
            });
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
                                onJump={() =>
                                    send({ event: 'queue-jump', uniqueId: item.uniqueId })
                                }
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
            <TrackActionSheet onClose={() => setActiveTrack(null)} track={activeTrack} />
        </Stack>
    );
};
