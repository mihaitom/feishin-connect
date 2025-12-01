import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './lyrics.module.css';

import { queryKeys } from '/@/renderer/api/query-keys';
import { translateLyrics } from '/@/renderer/features/lyrics/api/lyric-translate';
import { lyricsQueries } from '/@/renderer/features/lyrics/api/lyrics-api';
import { LyricsActions } from '/@/renderer/features/lyrics/lyrics-actions';
import {
    SynchronizedLyrics,
    SynchronizedLyricsProps,
} from '/@/renderer/features/lyrics/synchronized-lyrics';
import {
    UnsynchronizedLyrics,
    UnsynchronizedLyricsProps,
} from '/@/renderer/features/lyrics/unsynchronized-lyrics';
import { usePlayerEvents } from '/@/renderer/features/player/audio-player/hooks/use-player-events';
import { ComponentErrorBoundary } from '/@/renderer/features/shared/components/component-error-boundary';
import { queryClient } from '/@/renderer/lib/react-query';
import { useLyricsSettings, usePlayerSong } from '/@/renderer/store';
import { Center } from '/@/shared/components/center/center';
import { Group } from '/@/shared/components/group/group';
import { Spinner } from '/@/shared/components/spinner/spinner';
import { Text } from '/@/shared/components/text/text';
import { FullLyricsMetadata, LyricSource, LyricsOverride } from '/@/shared/types/domain-types';

export const Lyrics = () => {
    const currentSong = usePlayerSong();
    const {
        enableAutoTranslation,
        translationApiKey,
        translationApiProvider,
        translationTargetLanguage,
    } = useLyricsSettings();
    const { t } = useTranslation();
    const [index, setIndex] = useState(0);
    const [translatedLyrics, setTranslatedLyrics] = useState<null | string>(null);
    const [showTranslation, setShowTranslation] = useState(false);

    const { data, isInitialLoading } = useQuery(
        lyricsQueries.songLyrics(
            {
                query: { songId: currentSong?.id || '' },
                serverId: currentSong?._serverId || '',
            },
            currentSong,
        ),
    );

    const [override, setOverride] = useState<LyricsOverride | undefined>(undefined);

    const { data: overrideData, isInitialLoading: isOverrideLoading } = useQuery(
        lyricsQueries.songLyricsByRemoteId({
            options: {
                enabled: !!override,
            },
            query: {
                remoteSongId: override?.id,
                remoteSource: override?.source as LyricSource | undefined,
                song: currentSong,
            },
            serverId: currentSong?._serverId || '',
        }),
    );

    const [lyrics, synced] = useMemo(() => {
        // If override data is available, use it
        if (override && overrideData) {
            const overrideLyrics: FullLyricsMetadata = {
                artist: override.artist,
                lyrics: overrideData,
                name: override.name,
                remote: override.remote ?? true,
                source: override.source,
            };
            return [overrideLyrics, Array.isArray(overrideData)];
        }

        // Otherwise, use the regular data
        if (Array.isArray(data)) {
            if (data.length > 0) {
                const selectedLyric = data[Math.min(index, data.length - 1)];
                return [selectedLyric, selectedLyric.synced];
            }
        } else if (data?.lyrics) {
            return [data, Array.isArray(data.lyrics)];
        }

        return [undefined, false];
    }, [data, index, override, overrideData]);

    const handleOnSearchOverride = useCallback((params: LyricsOverride) => {
        setOverride(params);
    }, []);

    // Persist override lyrics to cache
    useEffect(() => {
        if (override && overrideData && currentSong) {
            const persistedLyrics: FullLyricsMetadata = {
                artist: override.artist,
                lyrics: overrideData,
                name: override.name,
                remote: override.remote ?? true,
                source: override.source,
            };

            queryClient.setQueryData(
                queryKeys.songs.lyrics(currentSong._serverId, { songId: currentSong.id }),
                persistedLyrics,
            );
        }
    }, [override, overrideData, currentSong]);

    const handleOnResetLyric = useCallback(() => {
        setOverride(undefined);
        queryClient.invalidateQueries({
            exact: true,
            queryKey: queryKeys.songs.lyrics(currentSong?._serverId, { songId: currentSong?.id }),
        });
    }, [currentSong?.id, currentSong?._serverId]);

    const handleOnRemoveLyric = useCallback(() => {
        queryClient.setQueryData(
            queryKeys.songs.lyrics(currentSong?._serverId, { songId: currentSong?.id }),
            (prev: FullLyricsMetadata | undefined) => {
                if (!prev) {
                    return undefined;
                }

                return {
                    ...prev,
                    lyrics: '',
                };
            },
        );
    }, [currentSong?.id, currentSong?._serverId]);

    const fetchTranslation = useCallback(async () => {
        if (!lyrics) return;
        const originalLyrics = Array.isArray(lyrics.lyrics)
            ? lyrics.lyrics.map(([, line]) => line).join('\n')
            : lyrics.lyrics;
        const TranslatedText: null | string = await translateLyrics(
            originalLyrics,
            translationApiKey,
            translationApiProvider,
            translationTargetLanguage,
        );
        setTranslatedLyrics(TranslatedText);
        setShowTranslation(true);
    }, [lyrics, translationApiKey, translationApiProvider, translationTargetLanguage]);

    const handleOnTranslateLyric = useCallback(async () => {
        if (translatedLyrics) {
            setShowTranslation(!showTranslation);
            return;
        }
        await fetchTranslation();
    }, [translatedLyrics, showTranslation, fetchTranslation]);

    usePlayerEvents(
        {
            onCurrentSongChange: () => {
                setOverride(undefined);
                setIndex(0);
                setShowTranslation(false);
                setTranslatedLyrics(null);
            },
        },
        [],
    );

    useEffect(() => {
        if (lyrics && !translatedLyrics && enableAutoTranslation) {
            fetchTranslation();
        }
    }, [lyrics, translatedLyrics, enableAutoTranslation, fetchTranslation]);

    const languages = useMemo(() => {
        if (Array.isArray(data)) {
            return data.map((lyric, idx) => ({ label: lyric.lang, value: idx.toString() }));
        }
        return [];
    }, [data]);

    const isLoadingLyrics = isInitialLoading || isOverrideLoading;

    const hasNoLyrics = !lyrics;
    const [shouldFadeOut, setShouldFadeOut] = useState(false);

    // Trigger fade out after a few seconds when no lyrics are found
    useEffect(() => {
        if (!isLoadingLyrics && hasNoLyrics) {
            // Start fade out after 3 seconds (message visible for 3s, then 0.5s fade)
            const timer = setTimeout(() => {
                setShouldFadeOut(true);
            }, 3000);

            return () => clearTimeout(timer);
        }

        if (!hasNoLyrics) {
            setShouldFadeOut(false);
        }

        return undefined;
    }, [isLoadingLyrics, hasNoLyrics]);

    return (
        <ComponentErrorBoundary>
            <div className={styles.lyricsContainer}>
                {isLoadingLyrics ? (
                    <Spinner container size={25} />
                ) : (
                    <AnimatePresence mode="sync">
                        {hasNoLyrics ? (
                            <Center w="100%">
                                <motion.div
                                    animate={{ opacity: shouldFadeOut ? 0 : 1 }}
                                    initial={{ opacity: 1 }}
                                    transition={{ duration: 0.5 }}
                                >
                                    <Group>
                                        <Text fw={500}>
                                            {t('page.fullscreenPlayer.noLyrics', {
                                                postProcess: 'sentenceCase',
                                            })}
                                        </Text>
                                    </Group>
                                </motion.div>
                            </Center>
                        ) : (
                            <motion.div
                                animate={{ opacity: 1 }}
                                className={styles.scrollContainer}
                                initial={{ opacity: 0 }}
                                transition={{ duration: 0.5 }}
                            >
                                {synced ? (
                                    <SynchronizedLyrics
                                        {...(lyrics as SynchronizedLyricsProps)}
                                        translatedLyrics={showTranslation ? translatedLyrics : null}
                                    />
                                ) : (
                                    <UnsynchronizedLyrics
                                        {...(lyrics as UnsynchronizedLyricsProps)}
                                        translatedLyrics={showTranslation ? translatedLyrics : null}
                                    />
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                )}
                <div className={styles.actionsContainer}>
                    <LyricsActions
                        index={index}
                        languages={languages}
                        onRemoveLyric={handleOnRemoveLyric}
                        onResetLyric={handleOnResetLyric}
                        onSearchOverride={handleOnSearchOverride}
                        onTranslateLyric={
                            translationApiProvider && translationApiKey
                                ? handleOnTranslateLyric
                                : undefined
                        }
                        setIndex={setIndex}
                    />
                </div>
            </div>
        </ComponentErrorBoundary>
    );
};
