import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useConnectPlayerStore } from '../connect.store';
import { connectEventSource, connectFetch, ConnectStatus } from '../types';

vi.mock('../types', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../types')>();
    return {
        ...actual,
        connectEventSource: vi.fn(actual.connectEventSource),
        connectFetch: vi.fn(() => Promise.resolve(new Response('{}'))),
    };
});

import { useConnectStatus } from '../hooks';

const connectFetchMock = connectFetch as unknown as ReturnType<typeof vi.fn>;
const connectEventSourceMock = connectEventSource as unknown as ReturnType<typeof vi.fn>;

const setVisibility = (state: DocumentVisibilityState) =>
    Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: state,
    });

const statusPayload = (overrides: Partial<ConnectStatus> = {}): ConnectStatus => ({
    current_track: { artist: 'A', cover_art_url: null, duration: 200, title: 'T' },
    current_track_index: 0,
    elapsed: 5,
    ended: false,
    local_owner_client_id: null,
    paused: false,
    queue_track_ids: [],
    radio: null,
    streaming: true,
    targets: [],
    total_tracks: 1,
    ...overrides,
});

describe('useConnectStatus', () => {
    beforeEach(() => {
        connectFetchMock.mockClear();
        connectFetchMock.mockResolvedValue(new Response('{}'));
        connectEventSourceMock.mockClear();
        setVisibility('visible');
        useConnectPlayerStore.setState({
            duration: 0,
            elapsed: 0,
            handlers: null,
            isActive: false,
            isPlaying: false,
            isStreaming: false,
            syncTime: 0,
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('does not subscribe when inactive', () => {
        renderHook(() => useConnectStatus(false));
        expect(connectEventSourceMock).not.toHaveBeenCalled();
    });

    it('applies SSE messages to status and the player store', () => {
        const { result } = renderHook(() => useConnectStatus(true));
        const es = connectEventSourceMock.mock.results[0].value;

        act(() => {
            es.onmessage({ data: JSON.stringify(statusPayload()) } as MessageEvent);
        });

        expect(result.current?.streaming).toBe(true);
        expect(useConnectPlayerStore.getState().duration).toBe(200);
    });

    // Regression test: a backgrounded tab can get frozen, silently killing the
    // SSE connection without the browser's own reconnect ever running. Coming
    // back to the foreground should immediately re-sync via a plain fetch
    // instead of waiting indefinitely on the dead EventSource.
    it('refetches /status when the tab becomes visible again', async () => {
        const { result } = renderHook(() => useConnectStatus(true));
        connectFetchMock.mockResolvedValueOnce(
            new Response(JSON.stringify(statusPayload({ ended: true, streaming: false }))),
        );

        setVisibility('visible');
        await act(async () => {
            document.dispatchEvent(new Event('visibilitychange'));
            await Promise.resolve();
        });

        expect(connectFetchMock).toHaveBeenCalledWith('/status');
        expect(result.current?.ended).toBe(true);
        expect(result.current?.streaming).toBe(false);
    });

    it('does not refetch when the tab becomes hidden', async () => {
        renderHook(() => useConnectStatus(true));
        connectFetchMock.mockClear();

        setVisibility('hidden');
        await act(async () => {
            document.dispatchEvent(new Event('visibilitychange'));
            await Promise.resolve();
        });

        expect(connectFetchMock).not.toHaveBeenCalled();
    });

    it('stops listening for visibility changes after unmount', async () => {
        const { unmount } = renderHook(() => useConnectStatus(true));
        unmount();
        connectFetchMock.mockClear();

        setVisibility('visible');
        await act(async () => {
            document.dispatchEvent(new Event('visibilitychange'));
            await Promise.resolve();
        });

        expect(connectFetchMock).not.toHaveBeenCalled();
    });
});
