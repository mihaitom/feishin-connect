import { Stack } from '@mantine/core';
import isElectron from 'is-electron';

import { HotkeyManagerSettings } from '/@/renderer/features/settings/components/hotkeys/hotkey-manager-settings';
import { WindowHotkeySettings } from '/@/renderer/features/settings/components/hotkeys/window-hotkey-settings';

export const HotkeysTab = () => {
    return (
        <Stack spacing="md">
            {isElectron() && <WindowHotkeySettings />}
            <HotkeyManagerSettings />
        </Stack>
    );
};
