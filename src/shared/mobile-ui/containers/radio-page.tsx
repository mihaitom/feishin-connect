import { Icon } from '/@/shared/components/icon/icon';
import { Stack } from '/@/shared/components/stack/stack';
import { Text } from '/@/shared/components/text/text';
import { FadeIn } from '/@/shared/mobile-ui/components/fade-in';
import { ListRow } from '/@/shared/mobile-ui/components/list-row';
import { Thumbnail } from '/@/shared/mobile-ui/components/thumbnail';
import { MobileRadioItem } from '/@/shared/mobile-ui/types';

interface RadioPageProps {
    items: MobileRadioItem[];
    onPlay: (stationId: string) => void;
}

export const RadioPage = ({ items, onPlay }: RadioPageProps) => {
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
                        <ListRow key={station.id} onClick={() => onPlay(station.id)}>
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
