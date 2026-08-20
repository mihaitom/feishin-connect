import { ListRow } from '/@/remote/components/list-row';
import { Thumbnail } from '/@/remote/components/thumbnail';
import { useLongPress } from '/@/remote/hooks/use-long-press';
import { Group } from '/@/shared/components/group/group';
import { Icon } from '/@/shared/components/icon/icon';
import { Stack } from '/@/shared/components/stack/stack';
import { Text } from '/@/shared/components/text/text';
import { RemoteAlbumItem } from '/@/shared/types/remote-types';

interface AlbumRowProps {
    album: RemoteAlbumItem;
    onLongPress: () => void;
    onPlay: () => void;
}

export const AlbumRow = ({ album, onLongPress, onPlay }: AlbumRowProps) => {
    const longPress = useLongPress({ onClick: onPlay, onLongPress });

    return (
        <ListRow {...longPress}>
            <Thumbnail
                fallbackIcon={<Icon icon="emptyAlbumImage" size={18} />}
                src={album.imageUrl}
            />
            <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                <Text
                    fw={500}
                    isNoSelect
                    style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                    {album.name}
                </Text>
                <Text
                    isMuted
                    isNoSelect
                    size="sm"
                    style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                    {album.albumArtistName}
                </Text>
            </Stack>
            <Group gap={4} style={{ flexShrink: 0 }} wrap="nowrap">
                <Icon color="muted" icon="itemSong" size="sm" />
                <Text isMuted isNoSelect size="sm">
                    {album.songCount ?? 0}
                </Text>
            </Group>
        </ListRow>
    );
};
