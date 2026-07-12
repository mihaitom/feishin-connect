import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import isElectron from 'is-electron';
import { useTranslation } from 'react-i18next';

import packageJson from '../../package.json';

import { Button } from '/@/shared/components/button/button';
import { Dialog } from '/@/shared/components/dialog/dialog';
import { Group } from '/@/shared/components/group/group';
import { Icon } from '/@/shared/components/icon/icon';
import { Stack } from '/@/shared/components/stack/stack';
import { Text } from '/@/shared/components/text/text';
import { useLocalStorage } from '/@/shared/hooks/use-local-storage';

const GITHUB_LATEST_RELEASE_URL =
    'https://api.github.com/repos/mihaitom/feishin-connect/releases/latest';
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

// The web/Docker build has no main process to run electron-updater, so
// there's no way to auto-download an update — this just points the user at
// the releases page, same as `?debugUpdateBanner=1` for previewing it.
const forcedForTesting = new URLSearchParams(window.location.search).has('debugUpdateBanner');

interface GitHubRelease {
    tag_name: string;
}

function isNewerVersion(latest: string, current: string): boolean {
    const toParts = (v: string) =>
        v
            .split('-')[0]
            .split('.')
            .map((n) => parseInt(n, 10) || 0);
    const [latestMajor, latestMinor, latestPatch] = toParts(latest);
    const [currentMajor, currentMinor, currentPatch] = toParts(current);

    if (latestMajor !== currentMajor) return latestMajor > currentMajor;
    if (latestMinor !== currentMinor) return latestMinor > currentMinor;
    return latestPatch > currentPatch;
}

function parseVersionFromTag(tagName: string): string {
    return tagName.startsWith('v') ? tagName.slice(1) : tagName;
}

export const WebUpdateBanner = () => {
    const { t } = useTranslation();
    const [versionDismissed, setVersionDismissed] = useLocalStorage<string>({
        key: 'web_update_dismissed',
    });

    // Pre-release/dev builds are already ahead of the last tagged release, so
    // a plain version comparison would false-positive on every load. Docker
    // images are built from tagged releases anyway, so this only matters for
    // those. `forcedForTesting` bypasses this to preview the banner.
    const isPrerelease = /-(dev|alpha|beta)/.test(packageJson.version);

    const { data: latestRelease } = useQuery({
        enabled: !isElectron() && (forcedForTesting || !isPrerelease),
        queryFn: async () => {
            const response = await axios.get<GitHubRelease>(GITHUB_LATEST_RELEASE_URL);
            return response.data;
        },
        queryKey: ['web-latest-release'],
        refetchInterval: CHECK_INTERVAL_MS,
        refetchIntervalInBackground: true,
        retry: 2,
    });

    if (isElectron() || !latestRelease) return null;

    const latestVersion = parseVersionFromTag(latestRelease.tag_name);
    const shouldShow = forcedForTesting || isNewerVersion(latestVersion, packageJson.version);

    if (!shouldShow || versionDismissed === latestVersion) return null;

    const handleDismiss = () => setVersionDismissed(latestVersion);

    return (
        <Dialog
            onClose={handleDismiss}
            opened
            position={{ right: 12, top: 12 }}
            radius="md"
            size="lg"
            withCloseButton
        >
            <Stack gap="md">
                <Text fw={700} size="md">
                    {t('common.newVersionAvailable')} - {latestVersion}
                </Text>
                <Group justify="flex-end">
                    <Button onClick={handleDismiss} size="xs" variant="default">
                        {t('common.dismiss')}
                    </Button>
                    <Button
                        component="a"
                        href="https://github.com/mihaitom/feishin-connect/releases/latest"
                        onClick={handleDismiss}
                        rightSection={<Icon icon="externalLink" size="sm" />}
                        size="xs"
                        target="_blank"
                        variant="filled"
                    >
                        {t('action.viewMore')}
                    </Button>
                </Group>
            </Stack>
        </Dialog>
    );
};
