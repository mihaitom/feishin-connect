import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { connectFetch } from '../types';

vi.mock('../types', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../types')>();
    return {
        ...actual,
        connectFetch: vi.fn(),
    };
});

const connectFetchMock = connectFetch as unknown as ReturnType<typeof vi.fn>;

// Imported after the mock so connectFetchEnsured resolves to the mocked
// connectFetch above.
const { connectFetchEnsured } = await import('../connect-request');

const jsonResponse = (body: unknown, ok = true) =>
    new Response(JSON.stringify(body), { status: ok ? 200 : 500 });

describe('connectFetchEnsured', () => {
    let ensureConfigured: () => Promise<void>;
    let forceReconfigure: () => Promise<void>;

    beforeEach(() => {
        connectFetchMock.mockReset();
        ensureConfigured = vi.fn(() => Promise.resolve());
        forceReconfigure = vi.fn(() => Promise.resolve());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('awaits ensureConfigured before the request', async () => {
        connectFetchMock.mockResolvedValue(jsonResponse({ status: 'playing' }));

        await connectFetchEnsured('/play', { method: 'POST' }, ensureConfigured, forceReconfigure);

        expect(ensureConfigured).toHaveBeenCalledTimes(1);
        expect(connectFetchMock).toHaveBeenCalledTimes(1);
        expect(forceReconfigure).not.toHaveBeenCalled();
    });

    it('returns the response as-is on success, without retrying', async () => {
        const res = jsonResponse({ status: 'playing' });
        connectFetchMock.mockResolvedValue(res);

        const result = await connectFetchEnsured(
            '/play',
            { method: 'POST' },
            ensureConfigured,
            forceReconfigure,
        );

        expect(result).toBe(res);
        expect(connectFetchMock).toHaveBeenCalledTimes(1);
    });

    it('does not retry on a logical error unrelated to configuration (e.g. device_in_use)', async () => {
        connectFetchMock.mockResolvedValue(jsonResponse({ error: 'device_in_use' }));

        await connectFetchEnsured('/play', { method: 'POST' }, ensureConfigured, forceReconfigure);

        expect(forceReconfigure).not.toHaveBeenCalled();
        expect(connectFetchMock).toHaveBeenCalledTimes(1);
    });

    it('does not retry on a non-2xx HTTP error', async () => {
        connectFetchMock.mockResolvedValue(new Response('', { status: 500 }));

        await connectFetchEnsured('/play', { method: 'POST' }, ensureConfigured, forceReconfigure);

        expect(forceReconfigure).not.toHaveBeenCalled();
        expect(connectFetchMock).toHaveBeenCalledTimes(1);
    });

    // Regression test: backend sessions are reaped after ~30 min idle
    // (core/session.py's SESSION_IDLE_TIMEOUT), silently forgetting /config
    // even though the frontend's ensureConfigured() still thinks it's done.
    // Before this fix, that left the user stuck with this exact error (and an
    // orange Connect button) until a full page reload.
    it('force-reconfigures and retries once when the backend reports "not configured"', async () => {
        connectFetchMock
            .mockResolvedValueOnce(
                jsonResponse({
                    error: 'Media server not configured — waiting for /config from Feishin',
                }),
            )
            .mockResolvedValueOnce(jsonResponse({ status: 'playing' }));

        const result = await connectFetchEnsured(
            '/play',
            { body: '{"track_ids":["1"]}', method: 'POST' },
            ensureConfigured,
            forceReconfigure,
        );

        expect(forceReconfigure).toHaveBeenCalledTimes(1);
        expect(connectFetchMock).toHaveBeenCalledTimes(2);
        expect(await result.json()).toEqual({ status: 'playing' });
    });

    it('retries with the same path and options', async () => {
        connectFetchMock
            .mockResolvedValueOnce(jsonResponse({ error: 'media server not configured' }))
            .mockResolvedValueOnce(jsonResponse({ status: 'playing' }));
        const options = { body: '{"track_ids":["1"]}', method: 'POST' };

        await connectFetchEnsured('/play', options, ensureConfigured, forceReconfigure);

        expect(connectFetchMock).toHaveBeenNthCalledWith(1, '/play', options);
        expect(connectFetchMock).toHaveBeenNthCalledWith(2, '/play', options);
    });

    it('does not blow up when the response body is not JSON', async () => {
        connectFetchMock.mockResolvedValue(new Response('not json', { status: 200 }));

        const result = await connectFetchEnsured(
            '/play',
            { method: 'POST' },
            ensureConfigured,
            forceReconfigure,
        );

        expect(forceReconfigure).not.toHaveBeenCalled();
        expect(connectFetchMock).toHaveBeenCalledTimes(1);
        expect(await result.text()).toBe('not json');
    });
});
