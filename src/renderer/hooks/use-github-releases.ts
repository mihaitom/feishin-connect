import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

export const GITHUB_RELEASES_URL = 'https://api.github.com/repos/mihaitom/feishin-connect/releases';
export const RELEASES_TO_FETCH = 30;

const ALLOWED_RELEASE_NOTES_TAGS = [
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
];

export interface GitHubRelease {
    body: null | string;
    name: null | string;
    prerelease: boolean;
    published_at: string;
    tag_name: string;
}

export function parseVersionFromTag(tagName: string): string {
    return tagName.startsWith('v') ? tagName.slice(1) : tagName;
}

export function toTag(version: string): string {
    return version.startsWith('v') ? version : `v${version}`;
}

export const useGithubReleasesList = (
    releasesUrl: string = GITHUB_RELEASES_URL,
    perPage = RELEASES_TO_FETCH,
) => {
    return useQuery({
        queryFn: async () => {
            const response = await axios.get<GitHubRelease[]>(releasesUrl, {
                params: { per_page: perPage },
            });
            return response.data;
        },
        queryKey: ['github-releases-list', releasesUrl, perPage],
        retry: 2,
    });
};

export const useGithubLatestRelease = (options?: {
    enabled?: boolean;
    refetchInterval?: number;
    refetchIntervalInBackground?: boolean;
}) => {
    return useQuery({
        queryFn: async () => {
            const response = await axios.get<GitHubRelease>(`${GITHUB_RELEASES_URL}/latest`);
            return response.data;
        },
        queryKey: ['github-latest-release'],
        retry: 2,
        ...options,
    });
};

export const useGithubReleaseByTag = (releasesUrl: string, tag: string, enabled = true) => {
    return useQuery({
        enabled: enabled && !!tag,
        queryFn: async () => {
            const response = await axios.get<GitHubRelease>(`${releasesUrl}/tags/${tag}`);
            return response.data;
        },
        queryKey: ['github-release', releasesUrl, tag],
        retry: 2,
    });
};

// Renders release-notes markdown (GFM) to sanitized HTML entirely client-side
// — no network round-trip, so it can't fail from an API outage or the tight
// unauthenticated GitHub rate limit the way a call to GitHub's own /markdown
// endpoint could.
export function renderReleaseNotesHtml(markdown: null | string | undefined): string {
    if (!markdown) return '';
    return sanitizeReleaseNotesHtml(marked.parse(markdown, { async: false }));
}

export function sanitizeReleaseNotesHtml(html: string): string {
    return DOMPurify.sanitize(html, {
        ALLOWED_ATTR: ['alt', 'href', 'src', 'title'],
        ALLOWED_TAGS: ALLOWED_RELEASE_NOTES_TAGS,
    });
}
