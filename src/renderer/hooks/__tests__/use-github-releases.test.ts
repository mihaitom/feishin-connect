import { describe, expect, it } from 'vitest';

import { renderReleaseNotesHtml, styleGithubAlerts } from '../use-github-releases';

describe('styleGithubAlerts', () => {
    it('restyles a CAUTION alert with its color and label', () => {
        const html = styleGithubAlerts(
            '<blockquote>\n<p>[!CAUTION]\nDo not do this.</p>\n</blockquote>',
        );

        expect(html).toContain('border-left: 3px solid var(--theme-colors-state-error)');
        expect(html).toContain(
            '<strong style="color: var(--theme-colors-state-error)">Caution</strong>',
        );
        expect(html).toContain('Do not do this.');
        expect(html).not.toContain('[!CAUTION]');
    });

    it.each(['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'])(
        'recognizes the %s alert type case-insensitively',
        (type) => {
            const html = styleGithubAlerts(
                `<blockquote>\n<p>[!${type.toLowerCase()}]\nSome text.</p>\n</blockquote>`,
            );

            expect(html).not.toContain('[!');
        },
    );

    it('leaves a plain blockquote (no alert marker) untouched', () => {
        const html = '<blockquote>\n<p>Just a normal quote.</p>\n</blockquote>';
        expect(styleGithubAlerts(html)).toBe(html);
    });
});

describe('renderReleaseNotesHtml', () => {
    it('renders a GitHub alert blockquote from raw markdown', () => {
        const markdown = '> [!WARNING]\n> Be careful.';
        const html = renderReleaseNotesHtml(markdown);

        expect(html).toContain('border-left: 3px solid var(--theme-colors-state-warn)');
        expect(html).toContain('Warning');
        expect(html).toContain('Be careful.');
    });

    it('returns an empty string for null/undefined input', () => {
        expect(renderReleaseNotesHtml(null)).toBe('');
        expect(renderReleaseNotesHtml(undefined)).toBe('');
    });
});
