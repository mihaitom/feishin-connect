import formatDuration from 'format-duration';
import { RiMusic2Line } from 'react-icons/ri';

import { Thumbnail } from '/@/remote/components/thumbnail';
import { useSend } from '/@/remote/store';
import { useQueueState } from '/@/remote/store/library';
import { Group } from '/@/shared/components/group/group';
import { Stack } from '/@/shared/components/stack/stack';
import { Text } from '/@/shared/components/text/text';

export const QueuePage = () => {
    const send = useSend();
    const { currentUniqueId, items } = useQueueState();

    return (
        <Stack gap="md" p="md">
            {items.length === 0 && (
                <Text isMuted ta="center">
                    Queue is empty
                </Text>
            )}
            <Stack gap={4}>
                {items.map((item) => {
                    const isCurrent = item.uniqueId === currentUniqueId;

                    return (
                        <Group
                            gap="sm"
                            key={item.uniqueId}
                            onClick={() => send({ event: 'queue-jump', uniqueId: item.uniqueId })}
                            style={{
                                background: isCurrent
                                    ? 'var(--theme-colors-primary-transparent)'
                                    : 'transparent',
                                borderRadius: 12,
                                cursor: 'pointer',
                                minHeight: 56,
                                padding: '8px 16px',
                                userSelect: 'none',
                            }}
                            wrap="nowrap"
                        >
                            <Thumbnail
                                fallbackIcon={<RiMusic2Line size={18} />}
                                src={item.imageUrl}
                            />
                            <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                                <Text
                                    fw={isCurrent ? 700 : 500}
                                    style={{
                                        color: isCurrent
                                            ? 'var(--theme-colors-primary)'
                                            : undefined,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {item.name}
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
                                    {item.artistName}
                                    {item.album ? ` · ${item.album}` : ''} ·{' '}
                                    {formatDuration(item.duration)}
                                </Text>
                            </Stack>
                        </Group>
                    );
                })}
            </Stack>
        </Stack>
    );
};
