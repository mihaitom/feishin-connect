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

// GitHub's alert syntax (`> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`,
// `> [!WARNING]`, `> [!CAUTION]`) is only recognized by GitHub's own
// renderer — marked has no built-in support for it, so it would otherwise
// render as a plain blockquote with the literal "[!CAUTION]" marker as text.
const GITHUB_ALERT_STYLES: Record<string, { color: string; label: string }> = {
    CAUTION: { color: 'var(--theme-colors-state-error)', label: 'Caution' },
    IMPORTANT: { color: 'var(--theme-colors-primary)', label: 'Important' },
    NOTE: { color: 'var(--theme-colors-state-info)', label: 'Note' },
    TIP: { color: 'var(--theme-colors-state-success)', label: 'Tip' },
    WARNING: { color: 'var(--theme-colors-state-warn)', label: 'Warning' },
};

const GITHUB_ALERT_RE = /<blockquote>\s*<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*\n?/gi;

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

// Recognizes the marker in marked's HTML output (rather than pre-processing
// the raw markdown) since marked has already normalized the blockquote's
// structure by then — matching post-render is simpler than re-implementing
// blockquote parsing. `type` only ever comes from the fixed alternation
// above, so the color/label lookup can't be influenced by document content.
export function styleGithubAlerts(html: string): string {
    return html.replace(GITHUB_ALERT_RE, (_match, type: string) => {
        const alert = GITHUB_ALERT_STYLES[type.toUpperCase()];
        return (
            // No stylesheet styles blockquote at all otherwise, so the border
            // needs a width/style, not just a color, to actually show up —
            // margin-left: 0 replaces the default indent with the border instead.
            `<blockquote style="border-left: 3px solid ${alert.color}; margin-left: 0; padding-left: 12px;">` +
            `<p><strong style="color: ${alert.color}">${alert.label}</strong><br>`
        );
    });
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
    const html = marked.parse(markdown, { async: false }) as string;
    return sanitizeReleaseNotesHtml(styleGithubAlerts(html));
}

export function sanitizeReleaseNotesHtml(html: string): string {
    return DOMPurify.sanitize(html, {
        // 'style' is only ever set by styleGithubAlerts() above, from its own
        // fixed color lookup — not from document content — so allowing it
        // here doesn't open up arbitrary inline-style injection from markdown.
        ALLOWED_ATTR: ['alt', 'href', 'src', 'style', 'title'],
        ALLOWED_TAGS: ALLOWED_RELEASE_NOTES_TAGS,
    });
}
