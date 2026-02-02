import { closeAllModals, openModal } from '@mantine/modals';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import DOMPurify from 'dompurify';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import packageJson from '../../package.json';

import { formatHrDateTime } from '/@/renderer/utils/format';
import { Button } from '/@/shared/components/button/button';
import { Center } from '/@/shared/components/center/center';
import { Group } from '/@/shared/components/group/group';
import { Icon } from '/@/shared/components/icon/icon';
import { ScrollArea } from '/@/shared/components/scroll-area/scroll-area';
import { Select } from '/@/shared/components/select/select';
import { Spinner } from '/@/shared/components/spinner/spinner';
import { Stack } from '/@/shared/components/stack/stack';
import { Text } from '/@/shared/components/text/text';
import { useLocalStorage } from '/@/shared/hooks/use-local-storage';

const GITHUB_RELEASES_URL = 'https://api.github.com/repos/jeffvli/feishin/releases';
const RELEASES_TO_FETCH = 30;

interface GitHubRelease {
    body: null | string;
    name: null | string;
    published_at: string;
    tag_name: string;
}

interface ReleaseNotesContentProps {
    onDismiss: () => void;
    version: string;
}

function parseVersionFromTag(tagName: string): string {
    return tagName.startsWith('v') ? tagName.slice(1) : tagName;
}

const ReleaseNotesContent = ({ onDismiss, version }: ReleaseNotesContentProps) => {
    const { t } = useTranslation();
    const [selectedVersion, setSelectedVersion] = useState(version);

    // Fetch list of recent releases for the selector
    const { data: releasesList = [] } = useQuery({
        queryFn: async () => {
            const response = await axios.get<GitHubRelease[]>(GITHUB_RELEASES_URL, {
                params: { per_page: RELEASES_TO_FETCH },
            });
            return response.data;
        },
        queryKey: ['github-releases-list'],
        retry: 2,
    });

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
    } = useQuery({
        queryFn: async () => {
            const response = await axios.get<GitHubRelease>(
                `${GITHUB_RELEASES_URL}/tags/v${selectedVersion}`,
            );
            return response.data;
        },
        queryKey: ['github-release', selectedVersion],
        retry: 2,
    });

    // Convert markdown to HTML using GitHub's markdown API
    const { data: htmlContent, isLoading: isConverting } = useQuery({
        enabled: !!releaseData?.body,
        queryFn: async () => {
            const response = await axios.post(
                'https://api.github.com/markdown',
                {
                    mode: 'gfm',
                    text: releaseData?.body ?? '',
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    responseType: 'text',
                },
            );
            return response.data;
        },
        queryKey: ['github-markdown', releaseData?.body],
        retry: 2,
    });

    const sanitizedHtml = useMemo(() => {
        if (!htmlContent) return '';
        return DOMPurify.sanitize(htmlContent, {
            ALLOWED_ATTR: ['alt', 'href', 'src', 'title'],
            ALLOWED_TAGS: [
                'a',
                'blockquote',
                'br',
                'code',
                'em',
                'h1',
                'h2',
                'h3',
                'h4',
                'h5',
                'h6',
                'img',
                'li',
                'ol',
                'p',
                'pre',
                'strong',
                'u',
                'ul',
            ],
        });
    }, [htmlContent]);

    if (isLoading || isConverting) {
        return (
            <Center h={400}>
                <Spinner />
            </Center>
        );
    }

    if (isError || !releaseData) {
        return (
            <Stack gap="md">
                {releaseOptions.length > 1 && (
                    <Select
                        data={releaseOptions}
                        onChange={(v) => v && setSelectedVersion(v)}
                        value={selectedVersion}
                    />
                )}
                <Text size="sm">{t('error.genericError', { postProcess: 'sentenceCase' })}</Text>
                <Group justify="flex-end">
                    <Button
                        component="a"
                        href={`https://github.com/jeffvli/feishin/releases/tag/v${selectedVersion}`}
                        onClick={onDismiss}
                        rightSection={<Icon icon="externalLink" />}
                        target="_blank"
                        variant="filled"
                    >
                        {t('common.viewReleaseNotes', { postProcess: 'sentenceCase' })}
                    </Button>
                    <Button onClick={onDismiss} variant="default">
                        {t('common.dismiss', { postProcess: 'titleCase' })}
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
                    size="md"
                />
            </ScrollArea>
            <Group justify="flex-end">
                <Button
                    component="a"
                    href={`https://github.com/jeffvli/feishin/releases/tag/v${selectedVersion}`}
                    onClick={onDismiss}
                    rightSection={<Icon icon="externalLink" />}
                    target="_blank"
                    variant="subtle"
                >
                    {t('action.viewMore', { postProcess: 'sentenceCase' })}
                </Button>
                <Button onClick={onDismiss} variant="filled">
                    {t('common.dismiss', { postProcess: 'titleCase' })}
                </Button>
            </Group>
        </Stack>
    );
};

const WAIT_FOR_LOCAL_STORAGE = 1000 * 2;

export const ReleaseNotesModal = () => {
    const { version } = packageJson;
    const { t } = useTranslation();

    const [, setValue] = useLocalStorage({ key: 'version' });

    const handleDismiss = useCallback(() => {
        setValue(version);
        closeAllModals();
    }, [setValue, version]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            const valueFromLocalStorage = localStorage.getItem('version');
            const versionString = `"${version}"`;

            // Only show modal if the stored version is different from current version
            if (valueFromLocalStorage !== versionString) {
                openModal({
                    children: <ReleaseNotesContent onDismiss={handleDismiss} version={version} />,
                    onClose: handleDismiss,
                    size: 'xl',
                    title: t('common.newVersion', {
                        postProcess: 'sentenceCase',
                        version,
                    }) as string,
                });
            }
        }, WAIT_FOR_LOCAL_STORAGE);

        return () => {
            clearTimeout(timeoutId);
        };
    }, [handleDismiss, t, version]);

    return null;
};
