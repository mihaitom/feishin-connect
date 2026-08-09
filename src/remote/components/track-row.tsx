import formatDuration from 'format-duration';

import { ListRow } from '/@/remote/components/list-row';
import { Thumbnail } from '/@/remote/components/thumbnail';
import { useLongPress } from '/@/remote/hooks/use-long-press';
import { Icon } from '/@/shared/components/icon/icon';
import { Stack } from '/@/shared/components/stack/stack';
import { Text } from '/@/shared/components/text/text';
import { RemoteTrackItem } from '/@/shared/types/remote-types';

interface TrackRowProps {
    onLongPress: () => void;
    onPlay: () => void;
    track: RemoteTrackItem;
}

export const TrackRow = ({ onLongPress, onPlay, track }: TrackRowProps) => {
    const longPress = useLongPress({ onClick: onPlay, onLongPress });

    return (
        <ListRow {...longPress}>
            <Thumbnail
                fallbackIcon={<Icon icon="emptySongImage" size={18} />}
                src={track.imageUrl}
            />
            <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                <Text
                    fw={500}
                    isNoSelect
                    style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                    {track.name}
                </Text>
                <Text
                    isMuted
                    isNoSelect
                    size="sm"
                    style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                    {track.artistName}
                    {track.album ? ` · ${track.album}` : ''}
                </Text>
            </Stack>
            <Text
                isMuted
                isNoSelect
                size="sm"
                style={{ flexShrink: 0, minWidth: 38, textAlign: 'right' }}
            >
                {formatDuration(track.duration)}
            </Text>
        </ListRow>
    );
};
