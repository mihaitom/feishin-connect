import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    connectFetch: vi.fn(),
}));

vi.mock('/@/renderer/features/player/components/connect/types', () => ({
    connectFetch: mocks.connectFetch,
}));

// `connectLyricsApi` is the Connect-backend fallback used by the web/Docker
// build (no Electron main process to run the kuroshiro-based IPC handlers) —
// the actual fork-specific behavior worth pinning down.
import { connectLyricsApi } from '../use-furigana-lyrics';

const jsonResponse = (body: unknown, ok = true) =>
    new Response(JSON.stringify(body), { status: ok ? 200 : 404 });

describe('connectLyricsApi (Connect backend furigana/romaji fallback)', () => {
    beforeEach(() => {
        mocks.connectFetch.mockReset();
    });

    it('convertFurigana posts { text } and returns the parsed body', async () => {
        mocks.connectFetch.mockResolvedValue(
            jsonResponse('<ruby>食<rp>(</rp><rt>た</rt><rp>)</rp></ruby>べる'),
        );

        const result = await connectLyricsApi.convertFurigana('食べる');

        expect(mocks.connectFetch).toHaveBeenCalledTimes(1);
        const [path, options] = mocks.connectFetch.mock.calls[0];
        expect(path).toBe('/lyrics/furigana');
        expect(options.method).toBe('POST');
        expect(JSON.parse(options.body)).toEqual({ text: '食べる' });
        expect(result).toBe('<ruby>食<rp>(</rp><rt>た</rt><rp>)</rp></ruby>べる');
    });

    it('convertFurigana falls back to the original text on a non-ok response', async () => {
        mocks.connectFetch.mockResolvedValue(jsonResponse(null, false));

        const result = await connectLyricsApi.convertFurigana('食べる');

        expect(result).toBe('食べる');
    });

    it('convertFurigana falls back to the original text when the request throws', async () => {
        mocks.connectFetch.mockRejectedValue(new Error('network error'));

        const result = await connectLyricsApi.convertFurigana('食べる');

        expect(result).toBe('食べる');
    });

    it('convertRomaji falls back to an empty string on failure', async () => {
        mocks.connectFetch.mockResolvedValue(jsonResponse(null, false));

        const result = await connectLyricsApi.convertRomaji('好き');

        expect(result).toBe('');
    });

    it('parseLyricsTextTokens posts to /lyrics/tokens and falls back to []', async () => {
        mocks.connectFetch.mockResolvedValueOnce(
            jsonResponse([{ endChar: 2, startChar: 0, text: '音楽' }]),
        );
        const found = await connectLyricsApi.parseLyricsTextTokens('音楽');
        expect(mocks.connectFetch.mock.calls[0][0]).toBe('/lyrics/tokens');
        expect(found).toEqual([{ endChar: 2, startChar: 0, text: '音楽' }]);

        mocks.connectFetch.mockRejectedValueOnce(new Error('network error'));
        const failed = await connectLyricsApi.parseLyricsTextTokens('音楽');
        expect(failed).toEqual([]);
    });

    it('convertRomajiTokens posts to /lyrics/romaji-tokens and falls back to []', async () => {
        mocks.connectFetch.mockResolvedValue(jsonResponse(null, false));

        const result = await connectLyricsApi.convertRomajiTokens('好き');

        expect(mocks.connectFetch.mock.calls[0][0]).toBe('/lyrics/romaji-tokens');
        expect(result).toEqual([]);
    });
});
