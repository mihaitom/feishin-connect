import isElectron from 'is-electron';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import {
    SettingOption,
    SettingsSection,
} from '/@/renderer/features/settings/components/settings-section';
import { useSettingsStoreActions, useWindowSettings } from '/@/renderer/store';
import { Switch } from '/@/shared/components/switch/switch';

const localSettings = isElectron() ? window.api.localSettings : null;
const utils = isElectron() ? window.api.utils : null;

function disableAutoUpdates(): boolean {
    return Boolean(!isElectron() || utils?.disableAutoUpdates());
}

export const UpdateSettings = memo(() => {
    const { t } = useTranslation();
    const settings = useWindowSettings();
    const { setSettings } = useSettingsStoreActions();

    const updateOptions: SettingOption[] = [
        {
            control: (
                <Switch
                    aria-label={t('setting.automaticUpdates')}
                    defaultChecked={!settings.disableAutoUpdate}
                    disabled={disableAutoUpdates()}
                    onChange={(e) => {
                        if (!e) return;
                        const enabled = e.currentTarget.checked;
                        localSettings?.set('disable_auto_updates', !enabled);
                        setSettings({
                            window: {
                                disableAutoUpdate: !enabled,
                            },
                        });
                    }}
                />
            ),
            description: t('setting.automaticUpdates', {
                context: 'description',
            }),
            isHidden: disableAutoUpdates(),
            title: t('setting.automaticUpdates'),
        },
    ];

    return <SettingsSection options={updateOptions} title={t('page.setting.updates')} />;
});
