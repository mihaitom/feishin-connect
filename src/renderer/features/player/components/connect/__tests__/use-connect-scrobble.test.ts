import type { QueueSong } from '/@/shared/types/domain-types';

import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConnectStatus } from '../types';

import { useConnectScrobble } from '../use-connect-scrobble';

import { ServerType } from '/@/shared/types/domain-types';

const mocks = vi.hoisted(() => ({
    mutate: vi.fn(),
    playbackRate: 1,
    privateMode: false,
    scrobbleEnabled: true,
}));

vi.mock('/@/renderer/features/player/mutations/scrobble-mutation', () => ({
    useSendScrobble: () => ({ mutate: mocks.mutate }),
}));

vi.mock('/@/renderer/store/app.store', () => ({
    useAppStore: (selector: (s: { privateMode: boolean }) => unknown) =>
        selector({ privateMode: mocks.privateMode }),
}));

vi.mock('/@/renderer/store/player.store', () => ({
    usePlayerSpeed: () => mocks.playbackRate,
}));

vi.mock('/@/renderer/store/settings.store', () => ({
    usePlaybackSettings: () => ({ scrobble: { enabled: mocks.scrobbleEnabled } }),
}));

const song = (overrides: Partial<QueueSong> = {}): QueueSong =>
    ({
        _itemType: 'song',
        _serverId: 'server-1',
        _serverType: ServerType.SUBSONIC,
        _uniqueId: 'song-1',
        albumId: 'album-1',
        duration: 200,
        id: 'track-1',
        ...overrides,
    }) as unknown as QueueSong;

const status = (overrides: Partial<ConnectStatus> = {}): ConnectStatus =>
    ({
        current_track: null,
        current_track_index: 0,
        elapsed: 0,
        ended: false,
        paused: false,
        radio: null,
        streaming: false,
        targets: [],
        total_tracks: 1,
        ...overrides,
    }) as ConnectStatus;

const baseArgs = (overrides: Partial<Parameters<typeof useConnectScrobble>[0]> = {}) => ({
    connectStatus: status({ streaming: true }),
    currentSong: song(),
    isActive: true,
    isRadioActive: false,
    ...overrides,
});

describe('useConnectScrobble', () => {
    beforeEach(() => {
        mocks.mutate.mockClear();
        mocks.privateMode = false;
        mocks.scrobbleEnabled = true;
        mocks.playbackRate = 1;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('start (now-playing) scrobble', () => {
        it('sends a start scrobble once a track begins streaming', () => {
            const args = baseArgs();

            renderHook(() => useConnectScrobble(args));

            expect(mocks.mutate).toHaveBeenCalledTimes(1);
            const [call] = mocks.mutate.mock.calls[0];
            expect(call.apiClientProps).toEqual({ serverId: 'server-1' });
            expect(call.query).toMatchObject({
                albumId: 'album-1',
                event: 'start',
                id: 'track-1',
                mediaType: 'song',
                position: 0,
                submission: false,
            });
        });

        it('does not send a start scrobble when scrobbling is disabled', () => {
            mocks.scrobbleEnabled = false;
            const args = baseArgs();

            renderHook(() => useConnectScrobble(args));

            expect(mocks.mutate).not.toHaveBeenCalled();
        });

        it('does not send a start scrobble in private mode', () => {
            mocks.privateMode = true;
            const args = baseArgs();

            renderHook(() => useConnectScrobble(args));

            expect(mocks.mutate).not.toHaveBeenCalled();
        });

        it('does not send a start scrobble while radio is active', () => {
            const args = baseArgs({ isRadioActive: true });

            renderHook(() => useConnectScrobble(args));

            expect(mocks.mutate).not.toHaveBeenCalled();
        });

        it('does not send a start scrobble before streaming begins', () => {
            const args = baseArgs({ connectStatus: status({ streaming: false }) });

            renderHook(() => useConnectScrobble(args));

            expect(mocks.mutate).not.toHaveBeenCalled();
        });

        it('does not re-send a start scrobble for the same track', () => {
            const args = baseArgs();
            const { rerender } = renderHook((props) => useConnectScrobble(props), {
                initialProps: args,
            });

            expect(mocks.mutate).toHaveBeenCalledTimes(1);

            rerender({ ...args });

            expect(mocks.mutate).toHaveBeenCalledTimes(1);
        });
    });

    describe('submission scrobble', () => {
        it('sends a submission scrobble once playback ends', () => {
            const args = baseArgs();
            const { rerender } = renderHook((props) => useConnectScrobble(props), {
                initialProps: args,
            });

            expect(mocks.mutate).toHaveBeenCalledTimes(1);

            rerender({ ...args, connectStatus: status({ ended: true, streaming: false }) });

            expect(mocks.mutate).toHaveBeenCalledTimes(2);
            const [call] = mocks.mutate.mock.calls[1];
            expect(call.query).toMatchObject({
                id: 'track-1',
                position: undefined,
                submission: true,
            });
        });

        it('uses 100ns-tick duration as position for Jellyfin', () => {
            const args = baseArgs({
                currentSong: song({ _serverType: ServerType.JELLYFIN, duration: 200 }),
            });
            const { rerender } = renderHook((props) => useConnectScrobble(props), {
                initialProps: args,
            });

            rerender({ ...args, connectStatus: status({ ended: true, streaming: false }) });

            const [call] = mocks.mutate.mock.calls[1];
            expect(call.query.position).toBe(200 * 1e7);
        });

        it('does not send a submission scrobble twice for the same track', () => {
            const args = baseArgs();
            const { rerender } = renderHook((props) => useConnectScrobble(props), {
                initialProps: args,
            });

            rerender({ ...args, connectStatus: status({ ended: true, streaming: false }) });
            expect(mocks.mutate).toHaveBeenCalledTimes(2);

            rerender({ ...args, connectStatus: status({ ended: true, streaming: false }) });
            expect(mocks.mutate).toHaveBeenCalledTimes(2);
        });

        it('does not send a submission scrobble without a prior start', () => {
            const args = baseArgs({ connectStatus: status({ ended: true, streaming: false }) });

            renderHook(() => useConnectScrobble(args));

            expect(mocks.mutate).not.toHaveBeenCalled();
        });
    });
});
