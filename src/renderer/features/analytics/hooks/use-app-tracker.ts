import { mutationOptions, useMutation } from '@tanstack/react-query';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import isElectron from 'is-electron';
import { useEffect } from 'react';

dayjs.extend(utc);
dayjs.extend(timezone);

import packageJson from '../../../../../package.json';

import { isAnalyticsDisabled } from '/@/renderer/features/analytics/hooks/use-analytics-disabled';
import {
    BarAlign,
    PlayerbarSliderType,
    SideQueueType,
    useAuthStore,
    usePlayerStore,
    useSettingsStore,
} from '/@/renderer/store';
import { LogCategory, logFn } from '/@/renderer/utils/logger';
import { logMsg } from '/@/renderer/utils/logger-message';
import { ServerType } from '/@/shared/types/domain-types';
import {
    FontType,
    Platform,
    PlayerQueueType,
    PlayerStyle,
    PlayerType,
} from '/@/shared/types/types';

const utils = isElectron() ? window.api.utils : null;

const getVersion = (): AppTrackerProperties['_version'] => {
    return packageJson.version;
};

const getPlatform = (): AppTrackerProperties['_platform'] => {
    if (!isElectron()) {
        return Platform.WEB;
    }

    if (utils?.isWindows()) {
        return Platform.WINDOWS;
    }

    if (utils?.isMacOS()) {
        return Platform.MACOS;
    }

    if (utils?.isLinux()) {
        return Platform.LINUX;
    }

    return 'unknown';
};

type AppTrackerProperties = {
    _platform: 'unknown' | Platform;
    _version: string;
    player: {
        mediaSession: boolean;
        playerQueueType: PlayerQueueType;
        playerStyle: PlayerStyle;
        playerType: PlayerType;
        transcoding: boolean;
        webAudio: boolean;
    };
    server: {
        [ServerType.JELLYFIN]: number;
        [ServerType.NAVIDROME]: number;
        [ServerType.SUBSONIC]: number;
    };
    settings: {
        albumBackground: boolean;
        albumBackgroundBlur: number;
        artistBackground: boolean;
        artistBackgroundBlur: number;
        customCss: boolean;
        disableAutoUpdate: boolean;
        discord: boolean;
        exitToTray: boolean;
        fontType: FontType;
        globalHotkeys: boolean;
        homeFeature: boolean;
        language: string;
        lastFM: boolean;
        lyricsEnableAutoTranslation: boolean;
        lyricsEnableNeteaseTranslation: boolean;
        lyricsFetch: boolean;
        minimizeToTray: boolean;
        musicBrainz: boolean;
        nativeAspectRatio: boolean;
        playerbarSliderType: PlayerbarSliderType;
        playerbarWaveformAlign: BarAlign;
        playerbarWaveformBarWidth: number;
        playerbarWaveformGap: number;
        playerbarWaveformRadius: number;
        preventSleepOnPlayback: boolean;
        releaseChannel: string;
        resume: boolean;
        scrobbleEnabled: boolean;
        sideQueueType: SideQueueType;
        skipBackwardSeconds: number;
        skipButtons: boolean;
        skipForwardSeconds: number;
        startMinimized: boolean;
        theme: string;
        tray: boolean;
        windowBarStyle: Platform;
        zoomFactor: number;
    };
};

const getPlayerProperties = (): AppTrackerProperties['player'] => {
    const player = usePlayerStore.getState();
    const playbackSettings = useSettingsStore.getState().playback;

    return {
        mediaSession: playbackSettings.mediaSession,
        playerQueueType: player.player.queueType,
        playerStyle: player.player.transitionType,
        playerType: playbackSettings.type,
        transcoding: playbackSettings.transcode.enabled,
        webAudio: playbackSettings.webAudio,
    };
};

const getSettingsProperties = (): AppTrackerProperties['settings'] => {
    const settings = useSettingsStore.getState();

    return {
        albumBackground: settings.general.albumBackground,
        albumBackgroundBlur: settings.general.albumBackgroundBlur,
        artistBackground: settings.general.artistBackground,
        artistBackgroundBlur: settings.general.artistBackgroundBlur,
        customCss: settings.css.enabled,
        disableAutoUpdate: settings.window.disableAutoUpdate,
        discord: settings.discord.enabled,
        exitToTray: settings.window.exitToTray,
        fontType: settings.font.type,
        globalHotkeys: settings.hotkeys.globalMediaHotkeys,
        homeFeature: settings.general.homeFeature,
        language: settings.general.language,
        lastFM: settings.general.lastFM,
        lyricsEnableAutoTranslation: settings.lyrics.enableAutoTranslation,
        lyricsEnableNeteaseTranslation: settings.lyrics.enableNeteaseTranslation,
        lyricsFetch: settings.lyrics.fetch,
        minimizeToTray: settings.window.minimizeToTray,
        musicBrainz: settings.general.musicBrainz,
        nativeAspectRatio: settings.general.nativeAspectRatio,
        playerbarSliderType: settings.general.playerbarSlider.type as PlayerbarSliderType,
        playerbarWaveformAlign: settings.general.playerbarSlider.barAlign as BarAlign,
        playerbarWaveformBarWidth: settings.general.playerbarSlider.barWidth,
        playerbarWaveformGap: settings.general.playerbarSlider.barGap,
        playerbarWaveformRadius: settings.general.playerbarSlider.barRadius,
        preventSleepOnPlayback: settings.window.preventSleepOnPlayback,
        releaseChannel: settings.window.releaseChannel,
        resume: settings.general.resume,
        scrobbleEnabled: settings.playback.scrobble.enabled,
        sideQueueType: settings.general.sideQueueType,
        skipBackwardSeconds: settings.general.skipButtons.skipBackwardSeconds,
        skipButtons: settings.general.skipButtons.enabled,
        skipForwardSeconds: settings.general.skipButtons.skipForwardSeconds,
        startMinimized: settings.window.startMinimized,
        theme: settings.general.theme,
        tray: settings.window.tray,
        windowBarStyle: settings.window.windowBarStyle,
        zoomFactor: settings.general.zoomFactor,
    };
};

const getServerProperties = (): AppTrackerProperties['server'] => {
    const auth = useAuthStore.getState();
    const serverList = auth.serverList;

    return Object.entries(serverList).reduce(
        (acc, [, server]) => {
            if (server.type === ServerType.JELLYFIN) {
                acc[ServerType.JELLYFIN] += 1;
            } else if (server.type === ServerType.NAVIDROME) {
                acc[ServerType.NAVIDROME] += 1;
            } else if (server.type === ServerType.SUBSONIC) {
                acc[ServerType.SUBSONIC] += 1;
            }
            return acc;
        },
        {
            [ServerType.JELLYFIN]: 0,
            [ServerType.NAVIDROME]: 0,
            [ServerType.SUBSONIC]: 0,
        },
    );
};

export const useAppTracker = () => {
    const { mutate: trackAppMutation } = useMutation(appTrackerMutation);

    useEffect(() => {
        if (!window.umami || isAnalyticsDisabled()) {
            return;
        }

        const getProperties = () => {
            const platform = getPlatform();
            const version = getVersion();
            const playerProperties = getPlayerProperties();
            const serverProperties = getServerProperties();
            const settingsProperties = getSettingsProperties();

            const properties: AppTrackerProperties = {
                _platform: platform,
                _version: version,
                player: playerProperties,
                server: serverProperties,
                settings: settingsProperties,
            };

            return properties;
        };

        const checkAndTrack = () => {
            const lastSentDate = localStorage.getItem('analytics_app_tracker_timestamp');
            const todayPST = dayjs().tz('America/Los_Angeles').format('YYYY-MM-DD');

            // Only send if it's a new day in PST
            if (lastSentDate !== todayPST) {
                const properties = getProperties();

                trackAppMutation(properties, {
                    onSettled: () => {
                        logFn.debug(logMsg[LogCategory.ANALYTICS].appTracked, {
                            category: LogCategory.ANALYTICS,
                            meta: { properties },
                        });

                        const pstDate = dayjs().tz('America/Los_Angeles').format('YYYY-MM-DD');
                        localStorage.setItem('analytics_app_tracker_timestamp', pstDate);
                    },
                });
            }
        };

        // Check immediately on mount
        checkAndTrack();

        // Then check every hour
        const interval = setInterval(checkAndTrack, 1000 * 60 * 60);

        return () => clearInterval(interval);
    }, [trackAppMutation]);
};

const appTrackerMutation = mutationOptions({
    mutationFn: (properties: AppTrackerProperties) => {
        try {
            window.umami?.track((props) => ({
                ...props,
                data: properties,
                name: 'app',
            }));
            return Promise.resolve();
        } catch (error) {
            return Promise.reject(error);
        }
    },
    mutationKey: ['analytics', 'settings-tracker'],
    onSuccess: () => {},
    retry: false,
    throwOnError: false,
});
