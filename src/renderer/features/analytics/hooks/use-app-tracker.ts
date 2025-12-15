import { mutationOptions, useMutation } from '@tanstack/react-query';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import isElectron from 'is-electron';
import { useEffect, useRef } from 'react';

dayjs.extend(utc);

import packageJson from '../../../../../package.json';

import { isAnalyticsDisabled } from '/@/renderer/features/analytics/hooks/use-analytics-disabled';
import {
    PlayerbarSliderType,
    SideQueueType,
    useAuthStore,
    usePlayerStore,
    useSettingsStore,
} from '/@/renderer/store';
import { LogCategory, logFn } from '/@/renderer/utils/logger';
import { logMsg } from '/@/renderer/utils/logger-message';
import { LyricSource, ServerType } from '/@/shared/types/domain-types';
import {
    FontType,
    Platform,
    PlayerQueueType,
    PlayerStyle,
    PlayerType,
} from '/@/shared/types/types';

const utils = isElectron() ? window.api.utils : null;
let appTrackerInFlight = false;
let appTrackerLastSentDate: null | string = null;

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

type AppTrackerProperties = PlayerProperties &
    SettingsProperties & {
        _platform: 'unknown' | Platform;
        _server: 'unknown' | ServerType;
        _version: string;
    };

type PlayerProperties = {
    'player.mediaSession': boolean;
    'player.queueType': PlayerQueueType;
    'player.style': PlayerStyle;
    'player.transcoding': boolean;
    'player.type': PlayerType;
    'player.webAudio': boolean;
};

type SettingsProperties = {
    'settings.albumBackground': boolean;
    'settings.artistBackground': boolean;
    'settings.autoDJ': boolean;
    'settings.autoDJItemCount': number;
    'settings.autoDJTiming': number;
    'settings.customCss': boolean;
    'settings.disableAutoUpdate': boolean;
    'settings.discord': boolean;
    'settings.exitToTray': boolean;
    'settings.followSystemTheme': boolean;
    'settings.fontType': FontType;
    'settings.globalHotkeys': boolean;
    'settings.homeFeature': boolean;
    'settings.language': string;
    'settings.lyrics.enableAutoTranslation': boolean;
    'settings.lyrics.enableNeteaseTranslation': boolean;
    'settings.lyrics.fetch': boolean;
    'settings.lyrics.sources.genius': boolean;
    'settings.lyrics.sources.lrclib': boolean;
    'settings.lyrics.sources.netease': boolean;
    'settings.minimizeToTray': boolean;
    'settings.nativeAspectRatio': boolean;
    'settings.playerbarSliderType': PlayerbarSliderType;
    'settings.preventSleepOnPlayback': boolean;
    'settings.releaseChannel': string;
    'settings.resume': boolean;
    'settings.scrobble.enabled': boolean;
    'settings.scrobble.notify': boolean;
    'settings.showLyricsInSidebar': boolean;
    'settings.showVisualizerInSidebar': boolean;
    'settings.sideQueueType': SideQueueType;
    'settings.skipButtons': boolean;
    'settings.startMinimized': boolean;
    'settings.theme': string;
    'settings.themeDark': string;
    'settings.themeLight': string;
    'settings.tray': boolean;
    'settings.useThemeAccentColor': boolean;
    'settings.windowBarStyle': Platform;
    'settings.zoomFactor': number;
};

const getPlayerProperties = (): Pick<
    AppTrackerProperties,
    | 'player.mediaSession'
    | 'player.queueType'
    | 'player.style'
    | 'player.transcoding'
    | 'player.type'
    | 'player.webAudio'
> => {
    const player = usePlayerStore.getState();
    const playbackSettings = useSettingsStore.getState().playback;

    return {
        'player.mediaSession': playbackSettings.mediaSession,
        'player.queueType': player.player.queueType,
        'player.style': player.player.transitionType,
        'player.transcoding': playbackSettings.transcode.enabled,
        'player.type': playbackSettings.type,
        'player.webAudio': playbackSettings.webAudio,
    };
};

const getSettingsProperties = (): SettingsProperties => {
    const settings = useSettingsStore.getState();

    return {
        'settings.albumBackground': settings.general.albumBackground,
        // 'settings.albumBackgroundBlur': settings.general.albumBackgroundBlur,
        'settings.artistBackground': settings.general.artistBackground,
        // 'settings.artistBackgroundBlur': settings.general.artistBackgroundBlur,
        'settings.autoDJ': settings.autoDJ.enabled,
        'settings.autoDJItemCount': settings.autoDJ.itemCount,
        'settings.autoDJTiming': settings.autoDJ.timing,
        'settings.customCss': settings.css.enabled,
        'settings.disableAutoUpdate': settings.window.disableAutoUpdate,
        'settings.discord': settings.discord.enabled,
        'settings.exitToTray': settings.window.exitToTray,
        'settings.followSystemTheme': settings.general.followSystemTheme,
        'settings.fontType': settings.font.type,
        'settings.globalHotkeys': settings.hotkeys.globalMediaHotkeys,
        'settings.homeFeature': settings.general.homeFeature,
        'settings.language': settings.general.language,
        // 'settings.lastFM': settings.general.lastFM,
        'settings.lyrics.enableAutoTranslation': settings.lyrics.enableAutoTranslation,
        'settings.lyrics.enableNeteaseTranslation': settings.lyrics.enableNeteaseTranslation,
        'settings.lyrics.fetch': settings.lyrics.fetch,
        'settings.lyrics.sources.genius': settings.lyrics.sources.includes(LyricSource.GENIUS),
        'settings.lyrics.sources.lrclib': settings.lyrics.sources.includes(LyricSource.LRCLIB),
        'settings.lyrics.sources.netease': settings.lyrics.sources.includes(LyricSource.NETEASE),
        'settings.minimizeToTray': settings.window.minimizeToTray,
        // 'settings.musicBrainz': settings.general.musicBrainz,
        'settings.nativeAspectRatio': settings.general.nativeAspectRatio,
        'settings.playerbarSliderType': settings.general.playerbarSlider
            .type as PlayerbarSliderType,
        // 'settings.playerbarWaveformAlign': settings.general.playerbarSlider.barAlign as BarAlign,
        // 'settings.playerbarWaveformBarWidth': settings.general.playerbarSlider.barWidth,
        // 'settings.playerbarWaveformGap': settings.general.playerbarSlider.barGap,
        // 'settings.playerbarWaveformRadius': settings.general.playerbarSlider.barRadius,
        'settings.preventSleepOnPlayback': settings.window.preventSleepOnPlayback,
        'settings.releaseChannel': settings.window.releaseChannel,
        'settings.resume': settings.general.resume,
        'settings.scrobble.enabled': settings.playback.scrobble.enabled,
        'settings.scrobble.notify': settings.playback.scrobble.notify,
        'settings.showLyricsInSidebar': settings.general.showLyricsInSidebar,
        'settings.showVisualizerInSidebar': settings.general.showVisualizerInSidebar,
        'settings.sideQueueType': settings.general.sideQueueType,
        // 'settings.skipBackwardSeconds': settings.general.skipButtons.skipBackwardSeconds,
        'settings.skipButtons': settings.general.skipButtons.enabled,
        // 'settings.skipForwardSeconds': settings.general.skipButtons.skipForwardSeconds,
        'settings.startMinimized': settings.window.startMinimized,
        'settings.theme': settings.general.theme,
        'settings.themeDark': settings.general.themeDark,
        'settings.themeLight': settings.general.themeLight,
        'settings.tray': settings.window.tray,
        'settings.useThemeAccentColor': settings.general.useThemeAccentColor,
        'settings.windowBarStyle': settings.window.windowBarStyle,
        'settings.zoomFactor': settings.general.zoomFactor,
    };
};

const getServer = (): 'unknown' | ServerType => {
    const auth = useAuthStore.getState();
    const currentServer = auth.currentServer;
    return currentServer?.type || 'unknown';
};

export const useAppTracker = () => {
    const { mutate: trackAppMutation } = useMutation(appTrackerMutation);
    const hasRunOnMountRef = useRef(false);

    useEffect(() => {
        if (!window.umami || isAnalyticsDisabled()) {
            return;
        }

        const getProperties = () => {
            const platform = getPlatform();
            const version = getVersion();
            const server = getServer();
            const playerProperties = getPlayerProperties();
            const settingsProperties = getSettingsProperties();

            const properties: AppTrackerProperties = {
                _platform: platform,
                _server: server,
                _version: version,
                ...playerProperties,
                ...settingsProperties,
            };

            return properties;
        };

        const checkAndTrack = () => {
            // Prevent multiple simultaneous requests
            if (appTrackerInFlight) {
                return;
            }

            const lastSentDate = localStorage.getItem('analytics_app_tracker_timestamp');
            const lastTrackedDate = appTrackerLastSentDate ?? lastSentDate;
            const todayUTC = dayjs.utc().format('YYYY-MM-DD');

            // Only send if it's a new day in UTC (ensures once per 24 hours)
            if (lastTrackedDate !== todayUTC) {
                appTrackerInFlight = true;
                const properties = getProperties();
                logFn.info(logMsg[LogCategory.ANALYTICS].appTracked, {
                    category: LogCategory.ANALYTICS,
                    meta: { properties, todayUTC },
                });

                trackAppMutation(properties, {
                    onError: () => {},
                    onSettled: () => {
                        appTrackerInFlight = false;
                    },
                    onSuccess: () => {
                        // Only update timestamp on success to ensure we only send once per 24 hours
                        const utcDate = dayjs.utc().format('YYYY-MM-DD');
                        appTrackerLastSentDate = utcDate;
                        localStorage.setItem('analytics_app_tracker_timestamp', utcDate);

                        logFn.debug(logMsg[LogCategory.ANALYTICS].appTracked, {
                            category: LogCategory.ANALYTICS,
                            meta: { properties },
                        });
                    },
                });
            }
        };

        // Check immediately on mount
        if (!hasRunOnMountRef.current) {
            hasRunOnMountRef.current = true;
            checkAndTrack();
        }

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
