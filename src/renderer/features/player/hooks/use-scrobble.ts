import { useCallback, useRef, useState } from 'react';

import { usePlayerEvents } from '/@/renderer/features/player/audio-player/hooks/use-player-events';
import { useSendScrobble } from '/@/renderer/features/player/mutations/scrobble-mutation';
import { useAppStore, usePlaybackSettings, usePlayerStore } from '/@/renderer/store';
import { LogCategory, logFn } from '/@/renderer/utils/logger';
import { logMsg } from '/@/renderer/utils/logger-message';
import { QueueSong, ServerType } from '/@/shared/types/domain-types';
import { PlayerStatus } from '/@/shared/types/types';

/*
 Scrobble Conditions (match any):
  - If the song has been played for the required percentage
  - If the song has been played for the required duration

Scrobble Events:
  - On song timestamp update:
      - If the song has been played for the required percentage
      - If the song has been played for the required duration

  - When the song changes (or is completed):
    - Current song: Sends the 'playing' scrobble event
    - Previous song (if exists): Sends the 'submission' scrobble event if conditions are met AND the 'isCurrentSongScrobbled' state is false
    - Resets the 'isCurrentSongScrobbled' state to false

  - When the song is paused:
    - Sends the 'submission' scrobble event if conditions are met AND the 'isCurrentSongScrobbled' state is false
    - Sends the 'pause' scrobble event (Jellyfin only)

  - When the song is restarted:
    - Sends the 'submission' scrobble event if conditions are met AND the 'isCurrentSongScrobbled' state is false
    - Resets the 'isCurrentSongScrobbled' state to false

  - When the song is seeked:
    - Sends the 'timeupdate' scrobble event (Jellyfin only)


Progress Events:
  - When the song is playing (Jellyfin only):
    - Sends the 'progress' scrobble event on an interval

*/

const checkScrobbleConditions = (args: {
    scrobbleAtDurationMs: number;
    scrobbleAtPercentage: number;
    songCompletedDurationMs: number;
    songDurationMs: number;
}) => {
    const { scrobbleAtDurationMs, scrobbleAtPercentage, songCompletedDurationMs, songDurationMs } =
        args;
    const percentageOfSongCompleted = songDurationMs
        ? (songCompletedDurationMs / songDurationMs) * 100
        : 0;

    const shouldScrobbleBasedOnPercetange = percentageOfSongCompleted >= scrobbleAtPercentage;
    const shouldScrobbleBasedOnDuration = songCompletedDurationMs >= scrobbleAtDurationMs;

    return shouldScrobbleBasedOnPercetange || shouldScrobbleBasedOnDuration;
};

export const useScrobble = () => {
    const scrobbleSettings = usePlaybackSettings().scrobble;
    const isScrobbleEnabled = scrobbleSettings?.enabled;
    const isPrivateModeEnabled = useAppStore((state) => state.privateMode);
    const sendScrobble = useSendScrobble();

    const [isCurrentSongScrobbled, setIsCurrentSongScrobbled] = useState(false);
    const previousSongRef = useRef<QueueSong | undefined>(undefined);
    const previousTimestampRef = useRef<number>(0);
    const lastProgressEventRef = useRef<number>(0);
    const lastSeekEventRef = useRef<number>(0);
    const songChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const notifyTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const handleScrobbleFromProgress = useCallback(
        (properties: { timestamp: number }, prev: { timestamp: number }) => {
            if (!isScrobbleEnabled || isPrivateModeEnabled) return;

            const currentSong = usePlayerStore.getState().getCurrentSong();
            const currentStatus = usePlayerStore.getState().player.status;

            if (!currentSong?.id || currentStatus !== PlayerStatus.PLAYING) return;

            const currentTime = properties.timestamp;
            const previousTime = prev.timestamp;

            // Detect song restart: timestamp resets to 0 (or goes backwards significantly) while song stays the same
            // This happens when pressing "Previous Track" and the song restarts (if >= 10 seconds)
            if (
                currentTime < previousTime &&
                currentTime < 5 && // Reset to near 0
                previousTime >= 10 && // Was playing for at least 10 seconds
                currentSong._uniqueId === previousSongRef.current?._uniqueId
            ) {
                // Send start event for Jellyfin on restart
                if (currentSong._serverType === ServerType.JELLYFIN) {
                    sendScrobble.mutate(
                        {
                            apiClientProps: { serverId: currentSong._serverId || '' },
                            query: {
                                event: 'start',
                                id: currentSong.id,
                                position: 0,
                                submission: false,
                            },
                        },
                        {
                            onSuccess: () => {
                                logFn.debug(logMsg[LogCategory.SCROBBLE].scrobbledStart, {
                                    category: LogCategory.SCROBBLE,
                                    meta: {
                                        id: currentSong.id,
                                    },
                                });
                            },
                        },
                    );
                }

                setIsCurrentSongScrobbled(false);
                lastProgressEventRef.current = 0;
                previousTimestampRef.current = 0;
                return;
            }

            // Send Jellyfin progress events every 10 seconds
            if (currentSong._serverType === ServerType.JELLYFIN) {
                const timeSinceLastProgress = currentTime - lastProgressEventRef.current;
                if (timeSinceLastProgress >= 10) {
                    const position = currentTime * 1e7;
                    sendScrobble.mutate(
                        {
                            apiClientProps: { serverId: currentSong._serverId || '' },
                            query: {
                                event: 'timeupdate',
                                id: currentSong.id,
                                position,
                                submission: false,
                            },
                        },
                        {
                            onSuccess: () => {
                                logFn.debug(logMsg[LogCategory.SCROBBLE].scrobbledTimeupdate, {
                                    category: LogCategory.SCROBBLE,
                                    meta: {
                                        id: currentSong.id,
                                    },
                                });
                            },
                        },
                    );
                    lastProgressEventRef.current = currentTime;
                }
            }

            const preventScrobbleFromProgress = currentSong._serverType === ServerType.JELLYFIN;

            // Check if we should submit scrobble based on conditions
            if (!isCurrentSongScrobbled && !preventScrobbleFromProgress) {
                const shouldSubmitScrobble = checkScrobbleConditions({
                    scrobbleAtDurationMs: (scrobbleSettings?.scrobbleAtDuration ?? 0) * 1000,
                    scrobbleAtPercentage: scrobbleSettings?.scrobbleAtPercentage,
                    songCompletedDurationMs: currentTime * 1000,
                    songDurationMs: currentSong.duration,
                });

                if (shouldSubmitScrobble) {
                    const position =
                        currentSong._serverType === ServerType.JELLYFIN
                            ? currentTime * 1e7
                            : undefined;

                    sendScrobble.mutate(
                        {
                            apiClientProps: { serverId: currentSong._serverId || '' },
                            query: {
                                id: currentSong.id,
                                position,
                                submission: true,
                            },
                        },
                        {
                            onSuccess: () => {
                                logFn.debug(logMsg[LogCategory.SCROBBLE].scrobbledSubmission, {
                                    category: LogCategory.SCROBBLE,
                                    meta: {
                                        id: currentSong.id,
                                        reason: 'from song progress',
                                    },
                                });
                            },
                        },
                    );

                    setIsCurrentSongScrobbled(true);
                }
            }
        },
        [
            isScrobbleEnabled,
            isPrivateModeEnabled,
            scrobbleSettings?.scrobbleAtDuration,
            scrobbleSettings?.scrobbleAtPercentage,
            isCurrentSongScrobbled,
            sendScrobble,
        ],
    );

    const handleScrobbleFromSongChange = useCallback(
        (
            properties: { index: number; song: QueueSong | undefined },
            prev: { index: number; song: QueueSong | undefined },
        ) => {
            const currentSong = properties.song;
            const previousSong = previousSongRef.current;
            const previousTimestamp = previousTimestampRef.current;

            // Handle notifications
            if (scrobbleSettings?.notify && currentSong?.id) {
                clearTimeout(notifyTimeoutRef.current);
                notifyTimeoutRef.current = setTimeout(() => {
                    if (
                        currentSong._uniqueId !== previousSong?._uniqueId ||
                        properties.index !== prev.index
                    ) {
                        const artists =
                            currentSong.artists?.length > 0
                                ? currentSong.artists.map((artist) => artist.name).join(' · ')
                                : currentSong.artistName;

                        new Notification(`${currentSong.name}`, {
                            body: `${artists}\n${currentSong.album}`,
                            icon: currentSong.imageUrl || undefined,
                            silent: true,
                        });
                    }
                }, 1000);
            }

            if (!isScrobbleEnabled || isPrivateModeEnabled) {
                previousSongRef.current = currentSong;
                previousTimestampRef.current = 0;
                return;
            }

            // Send completion scrobble for previous song
            if (previousSong?.id) {
                const shouldSubmitScrobble = checkScrobbleConditions({
                    scrobbleAtDurationMs: (scrobbleSettings?.scrobbleAtDuration ?? 0) * 1000,
                    scrobbleAtPercentage: scrobbleSettings?.scrobbleAtPercentage,
                    songCompletedDurationMs: previousTimestamp * 1000,
                    songDurationMs: previousSong.duration,
                });

                if (
                    (!isCurrentSongScrobbled && shouldSubmitScrobble) ||
                    previousSong._serverType === ServerType.JELLYFIN
                ) {
                    const position =
                        previousSong._serverType === ServerType.JELLYFIN
                            ? previousTimestamp * 1e7
                            : undefined;

                    sendScrobble.mutate(
                        {
                            apiClientProps: { serverId: previousSong._serverId || '' },
                            query: {
                                id: previousSong.id,
                                position,
                                submission: true,
                            },
                        },
                        {
                            onSuccess: () => {
                                logFn.debug(logMsg[LogCategory.SCROBBLE].scrobbledStart, {
                                    category: LogCategory.SCROBBLE,
                                    meta: {
                                        id: previousSong.id,
                                        reason: 'from song change',
                                    },
                                });
                            },
                        },
                    );
                }
            }

            setIsCurrentSongScrobbled(false);
            lastProgressEventRef.current = 0;

            // Use a timeout to prevent spamming the server when switching songs quickly
            clearTimeout(songChangeTimeoutRef.current);
            songChangeTimeoutRef.current = setTimeout(() => {
                const currentStatus = usePlayerStore.getState().player.status;

                // Send start scrobble when song changes and the new song is playing
                if (currentStatus === PlayerStatus.PLAYING && currentSong?.id) {
                    sendScrobble.mutate(
                        {
                            apiClientProps: { serverId: currentSong._serverId || '' },
                            query: {
                                event: 'start',
                                id: currentSong.id,
                                position: 0,
                                submission: false,
                            },
                        },
                        {
                            onSuccess: () => {
                                logFn.debug(logMsg[LogCategory.SCROBBLE].scrobbledStart, {
                                    category: LogCategory.SCROBBLE,
                                    meta: {
                                        id: currentSong.id,
                                    },
                                });
                            },
                        },
                    );
                }
            }, 2000);

            previousSongRef.current = currentSong;
            previousTimestampRef.current = 0;
        },
        [
            scrobbleSettings?.notify,
            scrobbleSettings?.scrobbleAtDuration,
            scrobbleSettings?.scrobbleAtPercentage,
            isScrobbleEnabled,
            isPrivateModeEnabled,
            isCurrentSongScrobbled,
            sendScrobble,
        ],
    );

    // const handleScrobbleFromStatusChange = useCallback(
    //     // eslint-disable-next-line @typescript-eslint/no-unused-vars
    //     (properties: { status: PlayerStatus }, _prev: { status: PlayerStatus }) => {
    //         if (!isScrobbleEnabled || isPrivateModeEnabled) return;

    //         const currentSong = usePlayerStore.getState().getCurrentSong();
    //         const currentTimestamp =
    //             usePlayerStore.getState().player.index >= 0 ? previousTimestampRef.current : 0;

    //         if (!currentSong?.id) return;

    //         const position =
    //             currentSong._serverType === ServerType.JELLYFIN
    //                 ? currentTimestamp * 1e7
    //                 : undefined;

    //         const currentStatus = properties.status;

    //         if (currentStatus === PlayerStatus.PLAYING) {
    //             // Send unpause event
    //             sendScrobble.mutate(
    //                 {
    //                     apiClientProps: { serverId: currentSong._serverId || '' },
    //                     query: {
    //                         event: 'unpause',
    //                         id: currentSong.id,
    //                         position,
    //                         submission: false,
    //                     },
    //                 },
    //                 {
    //                     onSuccess: () => {
    //                         logFn.debug(logMsg[LogCategory.SCROBBLE].scrobbledUnpause, {
    //                             category: LogCategory.SCROBBLE,
    //                             meta: {
    //                                 id: currentSong.id,
    //                             },
    //                         });
    //                     },
    //                 },
    //             );
    //         } else if (currentSong._serverType === ServerType.JELLYFIN) {
    //             // Send pause event for Jellyfin
    //             sendScrobble.mutate(
    //                 {
    //                     apiClientProps: { serverId: currentSong._serverId || '' },
    //                     query: {
    //                         event: 'pause',
    //                         id: currentSong.id,
    //                         position,
    //                         submission: false,
    //                     },
    //                 },
    //                 {
    //                     onSuccess: () => {
    //                         logFn.debug(logMsg[LogCategory.SCROBBLE].scrobbledPause, {
    //                             category: LogCategory.SCROBBLE,
    //                             meta: {
    //                                 id: currentSong.id,
    //                             },
    //                         });
    //                     },
    //                 },
    //             );
    //         } else {
    //             // For non-Jellyfin servers, check scrobble conditions on pause
    //             const isLastTrackInQueue = usePlayerStore.getState().isLastTrackInQueue();
    //             const isFirstTrackInQueue = usePlayerStore.getState().isFirstTrackInQueue();
    //             const previousTimestamp = previousTimestampRef.current;

    //             const shouldSubmitScrobble = checkScrobbleConditions({
    //                 scrobbleAtDurationMs: (scrobbleSettings?.scrobbleAtDuration ?? 0) * 1000,
    //                 scrobbleAtPercentage: scrobbleSettings?.scrobbleAtPercentage,
    //                 // If scrobbling the last song in the queue, use the previous time
    //                 // Note: if queue has one item (both first and last), use current time
    //                 songCompletedDurationMs:
    //                     (isLastTrackInQueue && !isFirstTrackInQueue
    //                         ? previousTimestamp
    //                         : currentTimestamp) * 1000,
    //                 songDurationMs: currentSong.duration,
    //             });

    //             if (!isCurrentSongScrobbled && shouldSubmitScrobble) {
    //                 sendScrobble.mutate(
    //                     {
    //                         apiClientProps: { serverId: currentSong._serverId || '' },
    //                         query: {
    //                             id: currentSong.id,
    //                             submission: true,
    //                         },
    //                     },
    //                     {
    //                         onSuccess: () => {
    //                             logFn.debug(logMsg[LogCategory.SCROBBLE].scrobbledSubmission, {
    //                                 category: LogCategory.SCROBBLE,
    //                                 meta: {
    //                                     id: currentSong.id,
    //                                     reason: 'from status change',
    //                                 },
    //                             });
    //                         },
    //                     },
    //                 );

    //                 setIsCurrentSongScrobbled(true);
    //             }
    //         }
    //     },
    //     [
    //         isScrobbleEnabled,
    //         isPrivateModeEnabled,
    //         scrobbleSettings?.scrobbleAtDuration,
    //         scrobbleSettings?.scrobbleAtPercentage,
    //         isCurrentSongScrobbled,
    //         sendScrobble,
    //     ],
    // );

    const handleScrobbleFromSeek = useCallback(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        (properties: { timestamp: number }, _prev: { timestamp: number }) => {
            if (!isScrobbleEnabled || isPrivateModeEnabled) return;

            const currentSong = usePlayerStore.getState().getCurrentSong();

            if (!currentSong?.id || currentSong._serverType !== ServerType.JELLYFIN) return;

            const now = Date.now();
            const timeSinceLastSeek = now - lastSeekEventRef.current;

            // Only allow seek scrobble once per second
            if (timeSinceLastSeek < 1000) {
                return;
            }

            const position = properties.timestamp * 1e7;

            lastProgressEventRef.current = properties.timestamp;
            lastSeekEventRef.current = now;

            sendScrobble.mutate(
                {
                    apiClientProps: { serverId: currentSong._serverId || '' },
                    query: {
                        event: 'timeupdate',
                        id: currentSong.id,
                        position,
                        submission: false,
                    },
                },
                {
                    onSuccess: () => {
                        logFn.debug(logMsg[LogCategory.SCROBBLE].scrobbledTimeupdate, {
                            category: LogCategory.SCROBBLE,
                            meta: {
                                id: currentSong.id,
                            },
                        });
                    },
                },
            );
        },
        [isScrobbleEnabled, isPrivateModeEnabled, sendScrobble],
    );

    // Update previous timestamp on progress for use in status change handler
    const handleProgressUpdate = useCallback(
        (properties: { timestamp: number }, prev: { timestamp: number }) => {
            previousTimestampRef.current = properties.timestamp;
            handleScrobbleFromProgress(properties, prev);
        },
        [handleScrobbleFromProgress],
    );

    usePlayerEvents(
        {
            onCurrentSongChange: handleScrobbleFromSongChange,
            onPlayerProgress: handleProgressUpdate,
            onPlayerSeekToTimestamp: handleScrobbleFromSeek,
        },
        [handleScrobbleFromSongChange, handleProgressUpdate, handleScrobbleFromSeek],
    );
};
