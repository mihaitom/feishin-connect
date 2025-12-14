import isElectron from 'is-electron';
import { useEffect, useRef } from 'react';

import { openRestartRequiredToast } from '/@/renderer/features/settings/restart-toast';
import { useSettingsStore } from '/@/renderer/store/settings.store';
import { logFn } from '/@/renderer/utils/logger';
import { logMsg } from '/@/renderer/utils/logger-message';

// Synchronizes settings from the renderer store to the main process electron store
// on app initialization. If there are differences, it updates the main store and shows
// a restart required toast.
export const useSyncSettingsToMain = () => {
    const settings = useSettingsStore((state) => ({
        general: state.general,
        hotkeys: state.hotkeys,
        lyrics: state.lyrics,
        playback: state.playback,
        window: state.window,
    }));

    const hasRunRef = useRef(false);

    useEffect(() => {
        if (hasRunRef.current) {
            return;
        }

        if (!isElectron() || !window.api.localSettings) {
            hasRunRef.current = true;
            return;
        }

        // Wait a small amount of time to ensure the store is hydrated from localStorage
        const timeoutId = setTimeout(() => {
            if (hasRunRef.current) {
                return;
            }
            hasRunRef.current = true;

            const localSettings = window.api.localSettings;
            let hasDifferences = false;

            const settingsMappings: Array<{
                mainStoreKey: string;
                rendererValue: any;
            }> = [
                {
                    mainStoreKey: 'window_window_bar_style',
                    rendererValue: settings.window.windowBarStyle,
                },
                {
                    mainStoreKey: 'window_start_minimized',
                    rendererValue: settings.window.startMinimized,
                },
                {
                    mainStoreKey: 'window_exit_to_tray',
                    rendererValue: settings.window.exitToTray,
                },
                {
                    mainStoreKey: 'window_minimize_to_tray',
                    rendererValue: settings.window.minimizeToTray,
                },
                {
                    mainStoreKey: 'disable_auto_updates',
                    rendererValue: settings.window.disableAutoUpdate,
                },
                {
                    mainStoreKey: 'release_channel',
                    rendererValue: settings.window.releaseChannel,
                },
                {
                    mainStoreKey: 'window_enable_tray',
                    rendererValue: settings.window.tray,
                },
                {
                    mainStoreKey: 'password_store',
                    rendererValue: settings.general.passwordStore,
                },
                {
                    mainStoreKey: 'mediaSession',
                    rendererValue: settings.playback.mediaSession,
                },
                {
                    mainStoreKey: 'playbackType',
                    rendererValue: settings.playback.type,
                },
                {
                    mainStoreKey: 'global_media_hotkeys',
                    rendererValue: settings.hotkeys.globalMediaHotkeys,
                },
                {
                    mainStoreKey: 'enableNeteaseTranslation',
                    rendererValue: settings.lyrics.enableNeteaseTranslation,
                },
            ];

            // Compare and sync each setting
            for (const mapping of settingsMappings) {
                const mainValue = localSettings.get(mapping.mainStoreKey);
                const rendererValue = mapping.rendererValue;

                const mainValueNormalized = mainValue === undefined ? null : mainValue;
                const rendererValueNormalized = rendererValue === undefined ? null : rendererValue;

                if (
                    JSON.stringify(mainValueNormalized) !== JSON.stringify(rendererValueNormalized)
                ) {
                    hasDifferences = true;
                    localSettings.set(mapping.mainStoreKey, rendererValue);
                }
            }

            // Show restart toast if there were differences
            if (hasDifferences) {
                logFn.info(logMsg.system.settingsSynchronized);
                openRestartRequiredToast();
            }
        }, 100);

        return () => {
            clearTimeout(timeoutId);
        };
        // Only run once on mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
};
