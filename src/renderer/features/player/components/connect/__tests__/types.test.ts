import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * CONNECT_URL / CONNECT_TOKEN are read from `window.__CONNECT_*__` once at
 * module load (Electron injects these globals before the renderer starts).
 * Each test sets the globals and re-imports the module fresh via
 * `vi.resetModules()` to exercise both the token and no-token paths.
 */
describe('connect/types', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        vi.resetModules();
        delete (window as any).__CONNECT_URL__;
        delete (window as any).__CONNECT_TOKEN__;
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    describe('connectFetch', () => {
        it('calls the configured CONNECT_URL without an auth header when no token is set', async () => {
            (window as any).__CONNECT_URL__ = 'http://example.test:9181';
            const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
            global.fetch = fetchMock as unknown as typeof fetch;

            const { connectFetch } = await import('../types');
            await connectFetch('/status');

            expect(fetchMock).toHaveBeenCalledTimes(1);
            const [url, options] = fetchMock.mock.calls[0];
            expect(url).toBe('http://example.test:9181/status');
            expect(
                (options?.headers as Record<string, string>)?.['X-Connect-Token'],
            ).toBeUndefined();
        });

        it('adds the X-Connect-Token header when a token is configured', async () => {
            (window as any).__CONNECT_URL__ = 'http://example.test:9181';
            (window as any).__CONNECT_TOKEN__ = 'secret-token';
            const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
            global.fetch = fetchMock as unknown as typeof fetch;

            const { connectFetch } = await import('../types');
            await connectFetch('/status');

            const [, options] = fetchMock.mock.calls[0];
            expect((options?.headers as Record<string, string>)['X-Connect-Token']).toBe(
                'secret-token',
            );
        });

        it('preserves caller-supplied headers alongside the auth header', async () => {
            (window as any).__CONNECT_URL__ = 'http://example.test:9181';
            (window as any).__CONNECT_TOKEN__ = 'secret-token';
            const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
            global.fetch = fetchMock as unknown as typeof fetch;

            const { connectFetch } = await import('../types');
            await connectFetch('/config', {
                headers: { 'Content-Type': 'application/json' },
                method: 'POST',
            });

            const [, options] = fetchMock.mock.calls[0];
            const headers = options?.headers as Record<string, string>;
            expect(headers['Content-Type']).toBe('application/json');
            expect(headers['X-Connect-Token']).toBe('secret-token');
            expect(options?.method).toBe('POST');
        });
    });

    describe('connectEventSource', () => {
        it('builds a plain URL when no token is configured', async () => {
            (window as any).__CONNECT_URL__ = 'http://example.test:9181';

            const { connectEventSource } = await import('../types');
            const es = connectEventSource('/events');

            expect(es.url).toBe('http://example.test:9181/events');
            es.close();
        });

        it('appends the token as a query param when configured', async () => {
            (window as any).__CONNECT_URL__ = 'http://example.test:9181';
            (window as any).__CONNECT_TOKEN__ = 'secret token';

            const { connectEventSource } = await import('../types');
            const es = connectEventSource('/events');

            expect(es.url).toBe('http://example.test:9181/events?token=secret%20token');
            es.close();
        });
    });
});
