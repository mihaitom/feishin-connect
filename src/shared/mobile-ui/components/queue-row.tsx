import formatDuration from 'format-duration';
import { animate, motion, PanInfo, Reorder, useDragControls, useMotionValue } from 'motion/react';

import styles from './queue-row.module.css';

import { Icon } from '/@/shared/components/icon/icon';
import { Stack } from '/@/shared/components/stack/stack';
import { Text } from '/@/shared/components/text/text';
import { ListRow } from '/@/shared/mobile-ui/components/list-row';
import { Thumbnail } from '/@/shared/mobile-ui/components/thumbnail';
import { useLongPress } from '/@/shared/mobile-ui/hooks/use-long-press';
import { MobileQueueItem } from '/@/shared/mobile-ui/types';

const SWIPE_DELETE_THRESHOLD = -80;

interface QueueRowProps {
    index: number;
    isCurrent: boolean;
    item: MobileQueueItem;
    onJump: () => void;
    onLongPress: () => void;
    onRemove: () => void;
    onReorderDragEnd: () => void;
    onReorderDragStart: () => void;
}

export const QueueRow = ({
    index,
    isCurrent,
    item,
    onJump,
    onLongPress,
    onRemove,
    onReorderDragEnd,
    onReorderDragStart,
}: QueueRowProps) => {
    const dragControls = useDragControls();
    const x = useMotionValue(0);
    const longPress = useLongPress({ onClick: onJump, onLongPress });

    const handleSwipeEnd = (_event: PointerEvent, info: PanInfo) => {
        if (info.offset.x < SWIPE_DELETE_THRESHOLD) {
            onRemove();
        } else {
            animate(x, 0, { damping: 40, stiffness: 500, type: 'spring' });
        }
    };

    return (
        <Reorder.Item
            as="div"
            className={styles.wrapper}
            dragControls={dragControls}
            dragListener={false}
            exit={{ height: 0, opacity: 0 }}
            layout="position"
            onDragEnd={onReorderDragEnd}
            onDragStart={onReorderDragStart}
            value={item.uniqueId}
        >
            <div className={styles['delete-background']}>
                <Icon icon="delete" />
            </div>
            <motion.div
                className={styles.foreground}
                drag="x"
                dragConstraints={{ left: -140, right: 0 }}
                dragElastic={{ left: 0.2, right: 0 }}
                onDragEnd={handleSwipeEnd}
                style={{ x }}
            >
                <ListRow isCurrent={isCurrent} {...longPress}>
                    <div
                        className={styles['drag-handle']}
                        // Capture phase, not bubble: motion's own drag="x"
                        // listener on the foreground wrapper is attached
                        // natively and fires during the browser's normal
                        // bubble-up before a same-phase React handler here
                        // would even run, so stopping propagation from a
                        // regular onPointerDown is too late — it still reads
                        // any diagonal movement during the reorder drag as a
                        // horizontal swipe, revealing the delete background
                        // behind a purely vertical gesture. Capture runs
                        // first, before that listener ever sees the event.
                        onPointerDownCapture={(e) => {
                            e.stopPropagation();
                            dragControls.start(e);
                        }}
                    >
                        <Icon icon="dragVertical" />
                    </div>
                    <div className={styles.index}>
                        {isCurrent ? (
                            <Icon color="primary" icon="mediaPlay" size="sm" />
                        ) : (
                            <Text isMuted isNoSelect size="sm">
                                {index}
                            </Text>
                        )}
                    </div>
                    <Thumbnail
                        fallbackIcon={<Icon icon="emptySongImage" size={18} />}
                        src={item.imageUrl}
                    />
                    <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                        <Text
                            fw={isCurrent ? 700 : 500}
                            isNoSelect
                            style={{
                                color: isCurrent ? 'var(--theme-colors-primary)' : undefined,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {item.name}
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
                            {item.artistName}
                            {item.album ? ` · ${item.album}` : ''}
                        </Text>
                    </Stack>
                    <Text className={styles.duration} isMuted isNoSelect size="sm">
                        {formatDuration(item.duration)}
                    </Text>
                </ListRow>
            </motion.div>
        </Reorder.Item>
    );
};
