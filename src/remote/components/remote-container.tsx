import formatDuration from 'format-duration';
import debounce from 'lodash/debounce';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ArtworkFullscreen } from '/@/remote/components/artwork-fullscreen';
import { ConnectButton } from '/@/remote/components/buttons/connect-button';
import { Thumbnail } from '/@/remote/components/thumbnail';
import { WrappedSlider } from '/@/remote/components/wrapped-slider';
import { useInfo, useSend } from '/@/remote/store';
import { useRadioStatus } from '/@/remote/store/library';
import { ActionIcon } from '/@/shared/components/action-icon/action-icon';
import { animationVariants } from '/@/shared/components/animations/animation-variants';
import { Group } from '/@/shared/components/group/group';
import { Icon } from '/@/shared/components/icon/icon';
import { Rating } from '/@/shared/components/rating/rating';
import { Stack } from '/@/shared/components/stack/stack';
import { Text } from '/@/shared/components/text/text';
import { Tooltip } from '/@/shared/components/tooltip/tooltip';
import { PlayerRepeat, PlayerStatus } from '/@/shared/types/types';

export const RemoteContainer = () => {
    const { position, repeat, shuffle, song, status, volume } = useInfo();
    const send = useSend();
    const radioStatus = useRadioStatus();
    const [isArtworkOpen, setIsArtworkOpen] = useState(false);

    const id = song?.id;
    const artworkSrc = radioStatus.isActive ? radioStatus.imageUrl : (song?.imageUrl ?? null);

    // The remote protocol only carries a single numeric volume, no separate
    // mute flag (same constraint desktop's Connect devices have, since Sonos/
    // Chromecast/DLNA don't expose native mute either) — remembering the
    // last non-zero volume client-side is what `useDeviceVolume` does there,
    // so clicking the icon again restores where it was rather than some
    // fixed default.
    const preMuteVolumeRef = useRef(30);
    useEffect(() => {
        if (volume) preMuteVolumeRef.current = volume;
    }, [volume]);

    const handleToggleMute = useCallback(() => {
        send({ event: 'volume', volume: volume ? 0 : preMuteVolumeRef.current });
    }, [send, volume]);

    const setRating = useCallback(
        (rating: number) => {
            send({ event: 'rating', id: id!, rating });
        },
        [send, id],
    );

    const debouncedSetRating = debounce(setRating, 400);

    return (
        <Stack gap="md" h="100dvh" p="md" w="100%">
            <Group align="center" gap="sm" wrap="nowrap">
                <button
                    aria-label="Show full artwork"
                    disabled={!artworkSrc}
                    onClick={() => setIsArtworkOpen(true)}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: artworkSrc ? 'pointer' : 'default',
                        flexShrink: 0,
                        padding: 0,
                    }}
                    type="button"
                >
                    <Thumbnail
                        fallbackIcon={
                            <Icon
                                icon={radioStatus.isActive ? 'emptyImage' : 'emptySongImage'}
                                size={20}
                            />
                        }
                        // Safe here specifically because this thumbnail always
                        // shows the current song/radio's art — the server's
                        // 'proxy' relay always answers with currentState.song's
                        // image, so it can't be wired up generically on every
                        // Thumbnail (track/queue/playlist/radio list rows show
                        // arbitrary items, not the current one).
                        onError={() => send({ event: 'proxy' })}
                        size={64}
                        src={artworkSrc}
                    />
                </button>
                <AnimatePresence mode="wait">
                    {radioStatus.isActive ? (
                        <motion.div
                            animate="show"
                            exit="hidden"
                            initial="hidden"
                            key="radio"
                            style={{ flex: 1, minWidth: 0 }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                            variants={animationVariants.fadeInUp}
                        >
                            <Stack gap={0}>
                                <Text isMuted size="sm">
                                    Radio
                                </Text>
                                <Text
                                    fw={700}
                                    size="lg"
                                    style={{
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {radioStatus.stationName}
                                </Text>
                            </Stack>
                        </motion.div>
                    ) : (
                        id && (
                            <motion.div
                                animate="show"
                                exit="hidden"
                                initial="hidden"
                                key={id}
                                style={{ flex: 1, minWidth: 0 }}
                                transition={{ duration: 0.2, ease: 'easeOut' }}
                                variants={animationVariants.fadeInUp}
                            >
                                <Stack gap={0}>
                                    <Text
                                        fw={700}
                                        size="lg"
                                        style={{
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {song.name}
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
                                        {song.album}
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
                                        {song.artistName}
                                    </Text>
                                </Stack>
                            </motion.div>
                        )
                    )}
                </AnimatePresence>
            </Group>
            {!radioStatus.isActive && id && (
                <Group justify="space-between">
                    {song.releaseDate && (
                        <Text isMuted size="sm">
                            {new Date(song.releaseDate).toLocaleDateString()}
                        </Text>
                    )}
                    <Text isMuted size="sm">
                        Plays: {song.playCount}
                    </Text>
                </Group>
            )}
            {!radioStatus.isActive && (
                <Group gap={0} grow>
                    <ActionIcon
                        disabled={!id}
                        h={48}
                        icon="favorite"
                        iconProps={{
                            fill: song?.userFavorite ? 'primary' : 'default',
                        }}
                        onClick={() => {
                            if (!id) return;

                            send({ event: 'favorite', favorite: !song.userFavorite, id });
                        }}
                        tooltip={{
                            label: song?.userFavorite ? 'Unfavorite' : 'Favorite',
                        }}
                        variant="transparent"
                    />
                    {(song?._serverType === 'navidrome' || song?._serverType === 'subsonic') && (
                        <div style={{ margin: 'auto' }}>
                            <Tooltip label="Double click to clear" openDelay={1000}>
                                <Rating
                                    onChange={debouncedSetRating}
                                    onDoubleClick={() => debouncedSetRating(0)}
                                    style={{ margin: 'auto' }}
                                    value={song.userRating ?? 0}
                                />
                            </Tooltip>
                        </div>
                    )}
                </Group>
            )}
            <Group gap="xs" grow>
                <ActionIcon
                    disabled={!id}
                    h={48}
                    icon="mediaPrevious"
                    iconProps={{
                        fill: 'default',
                        size: 'lg',
                    }}
                    onClick={() => send({ event: 'previous' })}
                    tooltip={{
                        label: 'Previous track',
                    }}
                    variant="default"
                />
                <ActionIcon
                    disabled={!id}
                    h={48}
                    icon={id && status === PlayerStatus.PLAYING ? 'mediaPause' : 'mediaPlay'}
                    iconProps={{
                        fill: 'default',
                        size: 'lg',
                    }}
                    onClick={() => {
                        if (status === PlayerStatus.PLAYING) {
                            send({ event: 'pause' });
                        } else {
                            send({ event: 'play' });
                        }
                    }}
                    tooltip={{
                        label: id && status === PlayerStatus.PLAYING ? 'Pause' : 'Play',
                    }}
                    variant="default"
                />
                <ActionIcon
                    disabled={!id}
                    h={48}
                    icon="mediaNext"
                    iconProps={{
                        fill: 'default',
                        size: 'lg',
                    }}
                    onClick={() => send({ event: 'next' })}
                    tooltip={{
                        label: 'Next track',
                    }}
                    variant="default"
                />
            </Group>
            <Group gap="xs" grow>
                <ActionIcon
                    h={48}
                    icon="mediaShuffle"
                    iconProps={{
                        fill: shuffle ? 'primary' : 'default',
                        size: 'lg',
                    }}
                    onClick={() => send({ event: 'shuffle' })}
                    tooltip={{
                        label: shuffle ? 'Shuffle tracks' : 'Shuffle disabled',
                    }}
                    variant="default"
                />
                <ActionIcon
                    h={48}
                    icon={
                        repeat === undefined || repeat === PlayerRepeat.ONE
                            ? 'mediaRepeatOne'
                            : 'mediaRepeat'
                    }
                    iconProps={{
                        fill:
                            repeat !== undefined && repeat !== PlayerRepeat.NONE
                                ? 'primary'
                                : 'default',
                        size: 'lg',
                    }}
                    onClick={() => send({ event: 'repeat' })}
                    tooltip={{
                        label: `Repeat ${
                            repeat === PlayerRepeat.ONE
                                ? 'One'
                                : repeat === PlayerRepeat.ALL
                                  ? 'all'
                                  : 'none'
                        }`,
                    }}
                    variant="default"
                />
                <ConnectButton />
            </Group>
            <Stack gap="xl" mt="lg">
                {id && position !== undefined && (
                    <WrappedSlider
                        label={(value) => formatDuration(value * 1e3)}
                        leftLabel={formatDuration(position * 1e3)}
                        max={song.duration / 1e3}
                        onChangeEnd={(e) => send({ event: 'position', position: e })}
                        rightLabel={formatDuration(song.duration)}
                        value={position}
                    />
                )}
                <WrappedSlider
                    leftLabel={
                        <button
                            aria-label={volume ? 'Mute' : 'Unmute'}
                            onClick={handleToggleMute}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                padding: 0,
                            }}
                            type="button"
                        >
                            <Icon
                                icon={
                                    !volume
                                        ? 'volumeMute'
                                        : volume > 50
                                          ? 'volumeMax'
                                          : 'volumeNormal'
                                }
                                size={20}
                            />
                        </button>
                    }
                    max={100}
                    onChangeEnd={(e) => send({ event: 'volume', volume: e })}
                    rightLabel={
                        <Text fw={600} size="xs">
                            {volume ?? 0}
                        </Text>
                    }
                    value={volume ?? 0}
                />
            </Stack>
            <ArtworkFullscreen
                album={radioStatus.isActive ? null : song?.album}
                artist={radioStatus.isActive ? null : song?.artistName}
                onClose={() => setIsArtworkOpen(false)}
                opened={isArtworkOpen}
                src={artworkSrc}
                title={radioStatus.isActive ? radioStatus.stationName : (song?.name ?? null)}
            />
        </Stack>
    );
};
