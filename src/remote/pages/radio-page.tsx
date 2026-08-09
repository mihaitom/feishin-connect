import { FadeIn } from '/@/remote/components/fade-in';
import { ListRow } from '/@/remote/components/list-row';
import { Thumbnail } from '/@/remote/components/thumbnail';
import { useRemoteQuery } from '/@/remote/hooks/use-remote-query';
import { useSend } from '/@/remote/store';
import { useRadioResponse } from '/@/remote/store/library';
import { Icon } from '/@/shared/components/icon/icon';
import { Stack } from '/@/shared/components/stack/stack';
import { Text } from '/@/shared/components/text/text';
import { RemoteRadioItem } from '/@/shared/types/remote-types';

export const RadioPage = () => {
    const send = useSend();
    const response = useRadioResponse();

    const { items } = useRemoteQuery<RemoteRadioItem>({
        event: 'radio-request',
        paginated: false,
        response,
    });

    return (
        <Stack gap="md" p="md">
            {items.length === 0 && (
                <Text isMuted ta="center">
                    No radio stations found
                </Text>
            )}
            <FadeIn>
                <Stack gap={4}>
                    {items.map((station) => (
                        <ListRow
                            key={station.id}
                            onClick={() => send({ event: 'play-radio', id: station.id })}
                        >
                            <Thumbnail
                                fallbackIcon={<Icon icon="emptyImage" size={18} />}
                                src={station.imageUrl}
                            />
                            <Text
                                fw={500}
                                style={{
                                    flex: 1,
                                    minWidth: 0,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {station.name}
                            </Text>
                        </ListRow>
                    ))}
                </Stack>
            </FadeIn>
        </Stack>
    );
};
