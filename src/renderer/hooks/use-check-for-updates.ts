import isElectron from 'is-electron';
import { useEffect, useState } from 'react';

import { parseVersionFromTag, useGithubLatestRelease } from '/@/renderer/hooks/use-github-releases';
import { useAppStoreActions, useWindowSettings } from '/@/renderer/store';

const CHECK_FOR_UPDATES_INTERVAL_MS = 6 * 60 * 60 * 1000;

const utils = isElectron() ? window.api?.utils : null;

export const useCheckForUpdates = () => {
    const [enablePeriodicCheck, setEnablePeriodicCheck] = useState(false);
    const { disableAutoUpdate } = useWindowSettings();
    const { setLatestVersion } = useAppStoreActions();

    // We want to skip the first check since it's already checked in the main process when the app is started
    useEffect(() => {
        const timer = setTimeout(() => setEnablePeriodicCheck(true), CHECK_FOR_UPDATES_INTERVAL_MS);
        return () => clearTimeout(timer);
    }, []);

    const isEnabled =
        enablePeriodicCheck &&
        !disableAutoUpdate &&
        Boolean(isElectron() && !utils?.disableAutoUpdates?.());

    const query = useGithubLatestRelease({
        enabled: isEnabled,
        refetchInterval: CHECK_FOR_UPDATES_INTERVAL_MS,
        refetchIntervalInBackground: true,
    });

    useEffect(() => {
        if (query.data) {
            setLatestVersion(parseVersionFromTag(query.data.tag_name));
        }
    }, [query.data, setLatestVersion]);

    return query;
};
