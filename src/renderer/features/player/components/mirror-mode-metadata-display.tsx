import type { ConnectStatus } from '/@/renderer/features/player/components/connect/types';

import clsx from 'clsx';
import React from 'react';

import styles from './left-controls.module.css';

import { Text } from '/@/shared/components/text/text';
import { PlaybackSelectors } from '/@/shared/constants/playback-selectors';

interface MirrorModeMetadataDisplayProps {
    connectStatus: ConnectStatus | null;
    onStopPropagation: (e?: React.MouseEvent) => void;
}

/**
 * Plain-text title/artist for a 'mirror' tab (see connect.store.ts's
 * ConnectMode docstring) — sourced from the shared session's SSE status, not
 * this tab's own (irrelevant) local queue. No link/context-menu: a mirrored
 * track has no local library id to act on, only the display fields the
 * backend echoes back (see ConnectTrack in connect/types.ts).
 */
export const MirrorModeMetadataDisplay = ({
    connectStatus,
    onStopPropagation,
}: MirrorModeMetadataDisplayProps) => {
    const title = connectStatus?.radio?.title ?? connectStatus?.current_track?.title;
    const artist = connectStatus?.current_track?.artist;

    return (
        <>
            <div className={styles.lineItem} onClick={onStopPropagation}>
                <Text className={PlaybackSelectors.songTitle} fw={500} isNoSelect overflow="hidden">
                    {title || '—'}
                </Text>
            </div>
            <div
                className={clsx(styles.lineItem, styles.secondary, PlaybackSelectors.songArtist)}
                onClick={onStopPropagation}
            >
                <Text isMuted isNoSelect overflow="hidden" size="md">
                    {artist || '—'}
                </Text>
            </div>
        </>
    );
};
