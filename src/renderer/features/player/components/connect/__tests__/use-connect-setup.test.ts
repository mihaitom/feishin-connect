import type { ServerListItemWithCredential } from '/@/shared/types/domain-types';

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { connectFetch, getConnectSessionId } from '../types';
import { useConnectSetup } from '../use-connect-setup';

import { useAuthStore } from '/@/renderer/store/auth.store';
import { ServerType } from '/@/shared/types/types';

vi.mock('../types', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../types')>();
    return {
        ...actual,
        connectFetch: vi.fn(() => Promise.resolve(new Response('{}'))),
    };
});

const connectFetchMock = connectFetch as unknown as ReturnType<typeof vi.fn>;

const server = (
    overrides: Partial<ServerListItemWithCredential> = {},
): ServerListItemWithCredential => ({
    credential: 'token-abc',
    id: 'server-1',
    name: 'My Navidrome',
    type: ServerType.SUBSONIC,
    url: 'http://nas.local:4533',
    userId: 'user-1',
    username: 'alice',
    ...overrides,
});

const setCurrentServer = (s: null | ServerListItemWithCredential) =>
    useAuthStore.setState((state) => {
        state.currentServer = s;
    });

// Flushes pending microtasks (e.g. the effect's own connectFetch().then())
// without advancing any fake timers.
const flushMicrotasks = () => act(() => Promise.resolve());

describe('useConnectSetup', () => {
    beforeEach(() => {
        connectFetchMock.mockClear();
        connectFetchMock.mockResolvedValue(new Response('{}'));
        setCurrentServer(null);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    describe('mySessionId', () => {
        it('is empty when no server is configured', () => {
            const { result } = renderHook(() => useConnectSetup());
            expect(result.current.mySessionId).toBe('');
        });

        it('is a stable, non-empty id once a server is set', () => {
            setCurrentServer(server());
            const { result } = renderHook(() => useConnectSetup());
            expect(result.current.mySessionId).not.toBe('');
        });
    });

    describe('server config effect', () => {
        it('POSTs /config as soon as the server has a credential', async () => {
            setCurrentServer(server());
            renderHook(() => useConnectSetup());
            await flushMicrotasks();

            expect(connectFetchMock).toHaveBeenCalledTimes(1);
            const [path, options] = connectFetchMock.mock.calls[0];
            expect(path).toBe('/config');
            expect(JSON.parse(options.body)).toMatchObject({
                credential: 'token-abc',
                url: 'http://nas.local:4533',
                user_id: 'user-1',
                username: 'alice',
            });
            expect(getConnectSessionId()).not.toBe('');
        });

        it('does not fire /config while the credential is not yet available', async () => {
            setCurrentServer(server({ credential: '' }));
            renderHook(() => useConnectSetup());
            await flushMicrotasks();

            expect(connectFetchMock).not.toHaveBeenCalled();
        });

        it('does not re-fire on an unrelated field change (e.g. musicFolderId)', async () => {
            setCurrentServer(server());
            renderHook(() => useConnectSetup());
            await flushMicrotasks();
            expect(connectFetchMock).toHaveBeenCalledTimes(1);

            // The auth store hands out a new object reference on nearly every
            // Navidrome response — only url/credential/type/userId/username
            // changes should re-trigger /config.
            setCurrentServer(server({ musicFolderId: ['1', '2'] }));
            await flushMicrotasks();

            expect(connectFetchMock).toHaveBeenCalledTimes(1);
        });

        it('re-fires when the credential itself changes', async () => {
            setCurrentServer(server({ credential: 'old-token' }));
            renderHook(() => useConnectSetup());
            await flushMicrotasks();
            expect(connectFetchMock).toHaveBeenCalledTimes(1);

            setCurrentServer(server({ credential: 'new-token' }));
            await flushMicrotasks();

            expect(connectFetchMock).toHaveBeenCalledTimes(2);
        });
    });

    describe('ensureConfigured', () => {
        it('resolves immediately once the server effect has already configured', async () => {
            setCurrentServer(server());
            const { result } = renderHook(() => useConnectSetup());
            await flushMicrotasks();

            connectFetchMock.mockClear();
            await result.current.ensureConfigured();

            // No duplicate /config call — already configured via the effect.
            expect(connectFetchMock).not.toHaveBeenCalled();
        });

        // Regression test: right after a page reload, server.credential can
        // still be hydrating (useServerAuthenticated re-validates it). This
        // used to mean sendTo()/claimOnly() raced straight into /play against
        // an unconfigured backend session and failed with no visible error.
        it('waits for the server to become ready instead of giving up immediately', async () => {
            vi.useFakeTimers();
            setCurrentServer(null);
            const { result } = renderHook(() => useConnectSetup());

            const ensurePromise = result.current.ensureConfigured();

            // Not ready yet — credential arrives moments later, simulating
            // useServerAuthenticated's re-validation completing.
            await act(async () => {
                await vi.advanceTimersByTimeAsync(300);
            });
            expect(connectFetchMock).not.toHaveBeenCalled();

            act(() => setCurrentServer(server()));
            await act(async () => {
                await vi.advanceTimersByTimeAsync(300);
            });

            await ensurePromise;

            expect(connectFetchMock).toHaveBeenCalledTimes(1);
            const [path] = connectFetchMock.mock.calls[0];
            expect(path).toBe('/config');
        });

        it('gives up quietly (no throw) if the server never becomes ready', async () => {
            vi.useFakeTimers();
            setCurrentServer(null);
            const { result } = renderHook(() => useConnectSetup());

            const ensurePromise = result.current.ensureConfigured();
            await act(async () => {
                await vi.advanceTimersByTimeAsync(10_000);
            });

            await expect(ensurePromise).resolves.toBeUndefined();
            expect(connectFetchMock).not.toHaveBeenCalled();
        });

        it('falls back to configuring itself if the effect landed on an error', async () => {
            vi.useFakeTimers();
            connectFetchMock.mockRejectedValueOnce(new Error('network down'));
            setCurrentServer(server());
            const { result } = renderHook(() => useConnectSetup());
            // Let the effect's own (failing) /config attempt run and reject.
            await act(async () => {
                await vi.advanceTimersByTimeAsync(0);
            });
            expect(connectFetchMock).toHaveBeenCalledTimes(1);

            const ensurePromise = result.current.ensureConfigured();
            await act(async () => {
                await vi.advanceTimersByTimeAsync(10_000);
            });
            await ensurePromise;

            // The fallback's own attempt, on top of the effect's failed one.
            expect(connectFetchMock).toHaveBeenCalledTimes(2);
        });
    });
});
