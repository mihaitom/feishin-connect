import isElectron from 'is-electron';

import { useGeneralSettings, useSettingsStoreActions } from '/@/renderer/store/settings.store';
import { useColorScheme, useSetColorScheme } from '/@/renderer/themes/use-app-theme';
import { ActionIcon } from '/@/shared/components/action-icon/action-icon';
import { Icon } from '/@/shared/components/icon/icon';
import { getAppTheme } from '/@/shared/themes/app-theme';

const localSettings = isElectron() ? window.api.localSettings : null;

// Same toggle desktop's own settings screen offers via a theme picker (see
// theme-settings.tsx), just condensed into a single light/dark flip instead
// of a full theme list — swaps to the user's saved "other mode" theme
// (themeDark/themeLight) rather than a fixed default, and turns off
// followSystemTheme so the manual choice actually sticks.
export const ThemeButton = () => {
    const { followSystemTheme, themeDark, themeLight } = useGeneralSettings();
    const { setSettings } = useSettingsStoreActions();
    const { setColorScheme } = useSetColorScheme();
    const colorScheme = useColorScheme();

    const handleToggleTheme = () => {
        const nextTheme = colorScheme === 'dark' ? themeLight : themeDark;
        const nextMode = getAppTheme(nextTheme).mode ?? (colorScheme === 'dark' ? 'light' : 'dark');

        setSettings({
            general: {
                ...(followSystemTheme ? { followSystemTheme: false } : {}),
                theme: nextTheme,
            },
        });
        setColorScheme(nextMode);
        localSettings?.themeSet(nextMode);
    };

    return (
        <ActionIcon
            onClick={handleToggleTheme}
            tooltip={{
                label: 'Toggle Theme',
            }}
            variant="default"
        >
            {colorScheme === 'dark' ? (
                <Icon icon="themeLight" size={30} />
            ) : (
                <Icon icon="themeDark" size={30} />
            )}
        </ActionIcon>
    );
};
