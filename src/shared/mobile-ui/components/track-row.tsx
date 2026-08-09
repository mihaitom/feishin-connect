import formatDuration from 'format-duration';

import { Icon } from '/@/shared/components/icon/icon';
import { Stack } from '/@/shared/components/stack/stack';
import { Text } from '/@/shared/components/text/text';
import { ListRow } from '/@/shared/mobile-ui/components/list-row';
import { Thumbnail } from '/@/shared/mobile-ui/components/thumbnail';
import { useLongPress } from '/@/shared/mobile-ui/hooks/use-long-press';
import { MobileTrackItem } from '/@/shared/mobile-ui/types';

interface TrackRowProps {
    onLongPress: () => void;
    onPlay: () => void;
    track: MobileTrackItem;
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
