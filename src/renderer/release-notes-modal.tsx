import { closeAllModals, openModal } from '@mantine/modals';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import changelogRaw from '../../CHANGELOG.md?raw';
import packageJson from '../../package.json';

import {
    GITHUB_RELEASES_URL,
    parseVersionFromTag,
    RELEASES_TO_FETCH,
    renderReleaseNotesHtml,
    toTag,
    useGithubReleaseByTag,
    useGithubReleasesList,
} from '/@/renderer/hooks/use-github-releases';
import { formatHrDateTime } from '/@/renderer/utils/format';
import { Button } from '/@/shared/components/button/button';
import { Center } from '/@/shared/components/center/center';
import { Group } from '/@/shared/components/group/group';
import { Icon } from '/@/shared/components/icon/icon';
import { ScrollArea } from '/@/shared/components/scroll-area/scroll-area';
import { Select } from '/@/shared/components/select/select';
import { Spinner } from '/@/shared/components/spinner/spinner';
import { Stack } from '/@/shared/components/stack/stack';
import { Tabs } from '/@/shared/components/tabs/tabs';
import { Text } from '/@/shared/components/text/text';
import { useLocalStorage } from '/@/shared/hooks/use-local-storage';

const GITHUB_COMPARE_URL = 'https://api.github.com/repos/mihaitom/feishin-connect/compare';
const UPSTREAM_GITHUB_RELEASES_URL = 'https://api.github.com/repos/jeffvli/feishin/releases';
const UPSTREAM_REPO_URL = 'https://github.com/jeffvli/feishin';

interface GitHubCompareCommit {
    commit: {
        author: { date: string; name: string };
        message: string;
    };
    html_url: string;
    sha: string;
}

interface GitHubCompareResponse {
    commits: GitHubCompareCommit[];
    total_commits: number;
}

interface ReleaseNotesContentProps {
    onDismiss: () => void;
    onNavigateToUpstream?: (version: string) => void;
    version: string;
}

/**
 * Extract a single version's section from the bundled CHANGELOG.md.
 * Used as a fallback while the GitHub release for a freshly-bumped version
 * is not yet published.
 */
function getLocalChangelogSection(version: string): null | string {
    const matchVersion = (v: string): null | string => {
        const escaped = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(
            `## \\[${escaped}\\][^\\n]*\\n([\\s\\S]*?)(?=\\n## \\[|\\n---\\s*\\n## \\[|$)`,
        );
        const match = changelogRaw.match(re);
        return match?.[1]?.replace(/\n---\s*$/, '').trim() || null;
    };

    // The current unreleased entry keeps the full pre-release string in its
    // header (e.g. "## [0.6.0-dev.1]"), matching package.json's version
    // exactly — try that first. Fall back to the bare version (e.g. "0.3.2")
    // for older/base-only header conventions.
    return matchVersion(version) ?? matchVersion(version.split('-')[0]);
}

function isAlphaVersion(version: string): boolean {
    return version.includes('-alpha');
}

const UPSTREAM_RELEASE_LINK_RE =
    /^https:\/\/github\.com\/jeffvli\/feishin\/releases\/tag\/(v[0-9][\w.-]*)$/;

/**
 * Links to upstream's own release notes (e.g. from a "Merged upstream Feishin
 * vX.Y.Z" changelog entry) shouldn't leave the app — open the Upstream tab at
 * that version instead. Returns the linked version, or null for any other link.
 */
function extractUpstreamVersionFromLink(href: string): null | string {
    return href.match(UPSTREAM_RELEASE_LINK_RE)?.[1] ?? null;
}

const ReleaseNotesContent = ({
    onDismiss,
    onNavigateToUpstream,
    version,
}: ReleaseNotesContentProps) => {
    const { t } = useTranslation();
    const [selectedVersion, setSelectedVersion] = useState(version);
    const isAlpha = isAlphaVersion(selectedVersion);

    // Fetch list of recent releases for the selector
    const { data: releasesList = [] } = useGithubReleasesList();

    const latestStableRelease = useMemo(() => {
        return releasesList.find((r) => !r.prerelease);
    }, [releasesList]);

    const releaseOptions = useMemo(() => {
        const options = releasesList.slice(0, RELEASES_TO_FETCH).map((r) => {
            const v = parseVersionFromTag(r.tag_name);
            const dateStr = formatHrDateTime(r.published_at);
            return {
                label: dateStr ? `${v} - ${dateStr}` : v,
                value: v,
            };
        });
        const versions = options.map((o) => o.value);
        if (!versions.includes(version)) {
            options.unshift({ label: version, value: version });
        }
        return options;
    }, [releasesList, version]);

    // For alpha: fetch commits between latest stable and development branch
    const {
        data: compareData,
        isError: isCompareError,
        isLoading: isCompareLoading,
    } = useQuery({
        enabled: isAlpha && !!latestStableRelease,
        queryFn: async () => {
            const base = latestStableRelease!.tag_name;
            const head = 'development';
            const response = await axios.get<GitHubCompareResponse>(
                `${GITHUB_COMPARE_URL}/${base}...${head}`,
                { params: { per_page: 100 } },
            );
            return response.data;
        },
        queryKey: ['github-compare', latestStableRelease?.tag_name, 'development'],
        retry: 2,
    });

    // For non-alpha: fetch release by tag
    const {
        data: releaseData,
        isError,
        isLoading,
    } = useGithubReleaseByTag(GITHUB_RELEASES_URL, toTag(selectedVersion), !isAlpha);

    // Fall back to the bundled CHANGELOG.md when the GitHub release for this
    // version isn't published yet (e.g. immediately after a version bump).
    const localChangelogBody = useMemo(
        () => (isAlpha ? null : getLocalChangelogSection(selectedVersion)),
        [isAlpha, selectedVersion],
    );
    const effectiveBody = releaseData?.body || localChangelogBody;

    const sanitizedHtml = useMemo(() => renderReleaseNotesHtml(effectiveBody), [effectiveBody]);

    const handleContentClick = (event: MouseEvent<HTMLElement>) => {
        if (!onNavigateToUpstream) return;
        const anchor = (event.target as HTMLElement).closest('a');
        const href = anchor?.getAttribute('href');
        if (!href) return;
        const upstreamVersion = extractUpstreamVersionFromLink(href);
        if (upstreamVersion) {
            event.preventDefault();
            onNavigateToUpstream(upstreamVersion);
        }
    };

    const isLoadingState = isAlpha ? isCompareLoading : isLoading;
    // Only show the error fallback if there's nothing to render — i.e. GitHub
    // failed AND we don't have a local CHANGELOG section to display.
    const isErrorState = isAlpha
        ? isCompareError
        : (isError || !releaseData) && !localChangelogBody;

    if (isLoadingState) {
        return (
            <Center h={400}>
                <Spinner />
            </Center>
        );
    }

    if (isErrorState) {
        const showCompareError = isAlpha && latestStableRelease;
        return (
            <Stack gap="md">
                {releaseOptions.length > 1 && (
                    <Select
                        data={releaseOptions}
                        onChange={(v) => v && setSelectedVersion(v)}
                        value={selectedVersion}
                    />
                )}
                <Text size="sm">{t('error.genericError')}</Text>
                <Group justify="flex-end">
                    <Button
                        component="a"
                        href={
                            showCompareError
                                ? `https://github.com/mihaitom/feishin-connect/compare/${latestStableRelease.tag_name}...${toTag(selectedVersion)}`
                                : `https://github.com/mihaitom/feishin-connect/releases/tag/${toTag(selectedVersion)}`
                        }
                        onClick={onDismiss}
                        rightSection={<Icon icon="externalLink" />}
                        target="_blank"
                        variant="filled"
                    >
                        {t('common.viewReleaseNotes')}
                    </Button>
                    <Button onClick={onDismiss} variant="default">
                        {t('common.dismiss')}
                    </Button>
                </Group>
            </Stack>
        );
    }

    if (isAlpha && !latestStableRelease) {
        return (
            <Stack gap="md">
                {releaseOptions.length > 1 && (
                    <Select
                        data={releaseOptions}
                        onChange={(v) => v && setSelectedVersion(v)}
                        value={selectedVersion}
                    />
                )}
                <Text isMuted size="sm">
                    {t('page.releasenotes.noStableReleaseToCompare')}
                </Text>
                <Group justify="flex-end">
                    <Button
                        component="a"
                        href={`https://github.com/mihaitom/feishin-connect/releases/tag/${toTag(selectedVersion)}`}
                        onClick={onDismiss}
                        rightSection={<Icon icon="externalLink" />}
                        target="_blank"
                        variant="subtle"
                    >
                        {t('action.viewMore')}
                    </Button>
                    <Button onClick={onDismiss} variant="filled">
                        {t('common.dismiss')}
                    </Button>
                </Group>
            </Stack>
        );
    }

    if (isAlpha && compareData) {
        const commits = compareData.commits ?? [];
        const compareUrl = `https://github.com/mihaitom/feishin-connect/compare/${latestStableRelease?.tag_name}...development`;
        return (
            <Stack gap="md">
                {releaseOptions.length > 1 && (
                    <Select
                        data={releaseOptions}
                        onChange={(v) => v && setSelectedVersion(v)}
                        value={selectedVersion}
                    />
                )}
                <Text isMuted size="sm">
                    {t('page.releasenotes.commitsSinceStable', {
                        stable: latestStableRelease
                            ? parseVersionFromTag(latestStableRelease.tag_name)
                            : '',
                    })}
                </Text>
                <ScrollArea
                    style={{
                        height: '400px',
                    }}
                >
                    <Stack gap="xs">
                        {commits.length === 0 ? (
                            <Text isMuted size="sm">
                                {t('page.releasenotes.noNewCommits')}
                            </Text>
                        ) : (
                            commits.map((c) => {
                                const firstLine = c.commit.message.split('\n')[0];
                                return (
                                    <Group
                                        gap="sm"
                                        key={c.sha}
                                        style={{ alignItems: 'flex-start' }}
                                        wrap="nowrap"
                                    >
                                        <Text
                                            size="sm"
                                            style={{ flex: 1 }}
                                            title={c.commit.message}
                                            truncate
                                        >
                                            {firstLine}
                                        </Text>
                                        <Text isMuted size="xs">
                                            {formatHrDateTime(c.commit.author.date)}
                                        </Text>
                                        <Button
                                            component="a"
                                            href={c.html_url}
                                            rightSection={<Icon icon="externalLink" />}
                                            size="compact-xs"
                                            target="_blank"
                                            variant="subtle"
                                        >
                                            {t('common.view')}
                                        </Button>
                                    </Group>
                                );
                            })
                        )}
                    </Stack>
                </ScrollArea>
                <Group justify="flex-end">
                    <Button
                        component="a"
                        href={compareUrl}
                        onClick={onDismiss}
                        rightSection={<Icon icon="externalLink" />}
                        target="_blank"
                        variant="subtle"
                    >
                        {t('action.viewMore')}
                    </Button>
                    <Button onClick={onDismiss} variant="filled">
                        {t('common.dismiss')}
                    </Button>
                </Group>
            </Stack>
        );
    }

    return (
        <Stack gap="md">
            {releaseOptions.length > 1 && (
                <Select
                    data={releaseOptions}
                    onChange={(v) => v && setSelectedVersion(v)}
                    value={selectedVersion}
                />
            )}
            <ScrollArea
                style={{
                    height: '400px',
                }}
            >
                <Text
                    dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                    fw={400}
                    lh="1.5"
                    onClick={handleContentClick}
                    size="md"
                />
            </ScrollArea>
            <Group justify="flex-end">
                <Button
                    component="a"
                    href={`https://github.com/mihaitom/feishin-connect/releases/tag/${toTag(selectedVersion)}`}
                    onClick={onDismiss}
                    rightSection={<Icon icon="externalLink" />}
                    target="_blank"
                    variant="subtle"
                >
                    {t('action.viewMore')}
                </Button>
                <Button onClick={onDismiss} variant="filled">
                    {t('common.dismiss')}
                </Button>
            </Group>
        </Stack>
    );
};

interface UpstreamChangesPanelProps {
    onDismiss: () => void;
    onVersionChange: (version: string) => void;
    version: string;
}

const UpstreamChangesPanel = ({
    onDismiss,
    onVersionChange,
    version,
}: UpstreamChangesPanelProps) => {
    const { t } = useTranslation();
    const upstreamTag = toTag(version);
    const releaseUrl = `${UPSTREAM_REPO_URL}/releases/tag/${upstreamTag}`;

    // Fetch list of upstream releases for the selector — same GitHub API,
    // just pointed at jeffvli/feishin instead of our own repo.
    const { data: releasesList = [] } = useGithubReleasesList(UPSTREAM_GITHUB_RELEASES_URL);

    const releaseOptions = useMemo(() => {
        const options = releasesList.slice(0, RELEASES_TO_FETCH).map((r) => {
            const v = parseVersionFromTag(r.tag_name);
            const dateStr = formatHrDateTime(r.published_at);
            return {
                label: dateStr ? `${v} - ${dateStr}` : v,
                value: v,
            };
        });
        const versions = options.map((o) => o.value);
        if (!versions.includes(version)) {
            options.unshift({ label: version, value: version });
        }
        return options;
    }, [releasesList, version]);

    const {
        data: releaseData,
        isError,
        isLoading,
    } = useGithubReleaseByTag(UPSTREAM_GITHUB_RELEASES_URL, upstreamTag);

    const sanitizedHtml = useMemo(
        () => renderReleaseNotesHtml(releaseData?.body),
        [releaseData?.body],
    );

    const versionSelect = releaseOptions.length > 1 && (
        <Select data={releaseOptions} onChange={(v) => v && onVersionChange(v)} value={version} />
    );

    if (isLoading) {
        return (
            <Center h={400}>
                <Spinner />
            </Center>
        );
    }

    if (isError || !releaseData) {
        return (
            <Stack gap="md">
                {versionSelect}
                <Text size="sm">{t('error.genericError')}</Text>
                <Group justify="flex-end">
                    <Button
                        component="a"
                        href={releaseUrl}
                        onClick={onDismiss}
                        rightSection={<Icon icon="externalLink" />}
                        target="_blank"
                        variant="filled"
                    >
                        {t('common.viewReleaseNotes')}
                    </Button>
                    <Button onClick={onDismiss} variant="default">
                        {t('common.dismiss')}
                    </Button>
                </Group>
            </Stack>
        );
    }

    return (
        <Stack gap="md">
            {versionSelect}
            <ScrollArea
                style={{
                    height: '400px',
                }}
            >
                <Text
                    dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                    fw={400}
                    lh="1.5"
                    size="md"
                />
            </ScrollArea>
            <Group justify="flex-end">
                <Button
                    component="a"
                    href={releaseUrl}
                    onClick={onDismiss}
                    rightSection={<Icon icon="externalLink" />}
                    target="_blank"
                    variant="subtle"
                >
                    {t('action.viewMore')}
                </Button>
                <Button onClick={onDismiss} variant="filled">
                    {t('common.dismiss')}
                </Button>
            </Group>
        </Stack>
    );
};

const WAIT_FOR_LOCAL_STORAGE = 1000 * 2;

interface ReleaseNotesModalContentWrapperProps {
    setDismissRef?: (fn: (() => void) | undefined) => void;
}

const ReleaseNotesModalContentWrapper = ({
    setDismissRef,
}: ReleaseNotesModalContentWrapperProps) => {
    const { t } = useTranslation();
    const { version } = packageJson;
    const [, setValue] = useLocalStorage({ key: 'version' });
    const [activeTab, setActiveTab] = useState<'connect' | 'upstream'>('connect');
    const [upstreamVersion, setUpstreamVersion] = useState(packageJson.feishinUpstreamVersion);

    const handleDismiss = useCallback(() => {
        setValue(version);
        closeAllModals();
    }, [setValue, version]);

    useEffect(() => {
        setDismissRef?.(handleDismiss);
        return () => setDismissRef?.(undefined);
    }, [handleDismiss, setDismissRef]);

    // Clicking an upstream release-notes link inside our own changelog (e.g.
    // "Merged upstream Feishin vX.Y.Z") switches to the Upstream tab at that
    // version instead of leaving the app.
    const handleNavigateToUpstream = useCallback((linkedVersion: string) => {
        setUpstreamVersion(linkedVersion);
        setActiveTab('upstream');
    }, []);

    return (
        <Tabs
            keepMounted={false}
            onChange={(value) => value && setActiveTab(value as 'connect' | 'upstream')}
            value={activeTab}
        >
            <Tabs.List>
                <Tabs.Tab value="connect">{t('page.releasenotes.tabConnect')}</Tabs.Tab>
                <Tabs.Tab value="upstream">{t('page.releasenotes.tabUpstream')}</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel pt="md" value="connect">
                <ReleaseNotesContent
                    onDismiss={handleDismiss}
                    onNavigateToUpstream={handleNavigateToUpstream}
                    version={version}
                />
            </Tabs.Panel>
            <Tabs.Panel pt="md" value="upstream">
                <UpstreamChangesPanel
                    onDismiss={handleDismiss}
                    onVersionChange={setUpstreamVersion}
                    version={upstreamVersion}
                />
            </Tabs.Panel>
        </Tabs>
    );
};

export const openReleaseNotesModal = (title: string) => {
    const dismissRef = { current: null as (() => void) | null };

    openModal({
        children: (
            <ReleaseNotesModalContentWrapper
                setDismissRef={(fn) => {
                    dismissRef.current = fn ?? null;
                }}
            />
        ),
        onClose: () => dismissRef.current?.(),
        size: 'xl',
        title,
    });
};

export const ReleaseNotesModal = () => {
    const { version } = packageJson;
    const { t } = useTranslation();
    const dismissRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            const valueFromLocalStorage = localStorage.getItem('version');
            const versionString = `"${version}"`;

            // Only show modal if the stored version is different from current version
            if (valueFromLocalStorage !== versionString) {
                openModal({
                    children: (
                        <ReleaseNotesModalContentWrapper
                            setDismissRef={(fn) => {
                                dismissRef.current = fn ?? null;
                            }}
                        />
                    ),
                    onClose: () => dismissRef.current?.(),
                    size: 'xl',
                    title: t('common.newVersion', { version }) as string,
                });
            }
        }, WAIT_FOR_LOCAL_STORAGE);

        return () => {
            clearTimeout(timeoutId);
        };
    }, [t, version]);

    return null;
};
