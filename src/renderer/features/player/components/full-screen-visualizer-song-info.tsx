import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

import styles from './full-screen-visualizer.module.css';

import { usePlayerEvents } from '/@/renderer/features/player/audio-player/hooks/use-player-events';
import { usePlayerSong } from '/@/renderer/store/player.store';
import { Stack } from '/@/shared/components/stack/stack';
import { TextTitle } from '/@/shared/components/text-title/text-title';
import { Text } from '/@/shared/components/text/text';

export const FullScreenVisualizerSongInfo = () => {
    const currentSong = usePlayerSong();
    const [showSongInfo, setShowSongInfo] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

    usePlayerEvents(
        {
            onCurrentSongChange: () => {
                setShowSongInfo(true);

                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                }

                timeoutRef.current = setTimeout(() => {
                    setShowSongInfo(false);
                }, 3000);
            },
        },
        [],
    );

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    const overlayVariants = {
        hidden: {
            opacity: 0,
            transition: {
                duration: 1.5,
                ease: 'easeInOut' as const,
            },
        },
        visible: {
            opacity: 1,
            transition: {
                duration: 0.5,
                ease: 'easeInOut' as const,
            },
        },
    };

    if (!currentSong) {
        return null;
    }

    return (
        <>
            <motion.div
                animate={showSongInfo ? 'visible' : 'hidden'}
                className={styles.songInfoBackdrop}
                initial="hidden"
                variants={overlayVariants}
            />
            <motion.div
                animate={showSongInfo ? 'visible' : 'hidden'}
                className={styles.songInfoOverlay}
                initial="hidden"
                variants={overlayVariants}
            >
                <Stack align="center" gap="lg" justify="center">
                    <TextTitle className={styles.songInfoTitle} fw="800" isNoSelect order={1}>
                        {currentSong.name}
                    </TextTitle>
                    {currentSong.artistName && (
                        <Text className={styles.songInfoArtist} isNoSelect>
                            {currentSong.artistName}
                        </Text>
                    )}
                </Stack>
            </motion.div>
        </>
    );
};
