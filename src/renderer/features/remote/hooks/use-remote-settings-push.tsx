import isElectron from 'is-electron';
import { useEffect } from 'react';

import { useGeneralSettings, useRemoteSettings } from '/@/renderer/store/settings.store';

const remote = isElectron() ? window.api.remote : null;

/**
 * Pushes desktop settings the phone needs to know about to behave
 * consistently with it — currently just `confirmQueueChanges`, so
 * `play-submenu-items.tsx` can ask "discard the current queue?" itself
 * before ever sending a play-now/-shuffle request, instead of that request
 * silently landing on a confirm modal that only opens on the desktop screen
 * (see use-remote-library.tsx's `skipConfirmation` calls).
 */
export const useRemoteSettingsPush = () => {
    const isRemoteEnabled = useRemoteSettings().enabled;
    const confirmQueueChanges = useGeneralSettings().confirmQueueChanges;

    useEffect(() => {
        if (!isRemoteEnabled || !remote) return;
        remote.updateConfirmQueueChangesSetting(confirmQueueChanges);
    }, [isRemoteEnabled, confirmQueueChanges]);
};

export const RemoteSettingsPushHook = () => {
    useRemoteSettingsPush();
    return null;
};
