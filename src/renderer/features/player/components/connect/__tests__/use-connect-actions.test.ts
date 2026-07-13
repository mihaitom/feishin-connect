import type { QueueSong } from '/@/shared/types/domain-types';
import type { MutableRefObject } from 'react';

import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConnectDevice } from '../types';

import { connectFetch } from '../types';
import { useConnectActions } from '../use-connect-actions';

vi.mock('../types', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../types')>();
    return {
        ...actual,
        connectFetch: vi.fn(() => Promise.resolve(new Response('{}'))),
    };
});

const connectFetchMock = connectFetch as unknown as ReturnType<typeof vi.fn>;

const song = (overrides: Partial<QueueSong> = {}): QueueSong =>
    ({
        _uniqueId: 'song-1',
        id: 'track-1',
        ...overrides,
    }) as unknown as QueueSong;

const livingRoom: ConnectDevice = { name: 'Living Room', type: 'sonos' };
const kitchen: ConnectDevice = { name: 'Kitchen', type: 'chromecast' };

const baseArgs = (overrides: Partial<Parameters<typeof useConnectActions>[0]> = {}) => {
    const lastAutoSentRef: MutableRefObject<string> = { current: '' };
    return {
        currentSong: song(),
        currentTrackId: 'track-1' as null | string,
        ensureConfigured: vi.fn(() => Promise.resolve()),
        isActive: false,
        isRadioActive: false,
        lastAutoSentRef,
        mediaPause: vi.fn(),
        pauseRadio: vi.fn(),
        radioStationName: null as null | string,
        radioStreamUrl: null as null | string,
        refresh: vi.fn(),
        selectedForSend: [livingRoom] as ConnectDevice[],
        setActive: vi.fn(),
        setActiveTargets: vi.fn(),
        setSelectedForSend: vi.fn(),
        setStatus: vi.fn(),
        ...overrides,
    };
};

describe('useConnectActions', () => {
    beforeEach(() => {
        connectFetchMock.mockClear();
        connectFetchMock.mockResolvedValue(new Response('{}'));
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('sendToSelected', () => {
        // Regression test: previously only takeoverDevice() had a claimOnly()
        // fallback for "nothing loaded yet" — the plain "Connect" button just
        // let sendTo() refuse with no visible error and never claimed anything.
        it('claims the selection instead of failing when nothing is loaded to play', async () => {
            const args = baseArgs({ currentTrackId: null, isRadioActive: false });
            const { result } = renderHook(() => useConnectActions(args));

            await result.current.sendToSelected();

            expect(connectFetchMock).toHaveBeenCalledTimes(1);
            const [path] = connectFetchMock.mock.calls[0];
            expect(path).toBe('/claim');
            // /claim never starts playback.
            expect(args.mediaPause).not.toHaveBeenCalled();
        });

        it('sends the queued track when one is loaded', async () => {
            const args = baseArgs();
            const { result } = renderHook(() => useConnectActions(args));

            await result.current.sendToSelected();

            const [path] = connectFetchMock.mock.calls[0];
            expect(path).toBe('/play');
        });

        it('sends the radio stream when radio is active', async () => {
            const args = baseArgs({
                currentTrackId: null,
                isRadioActive: true,
                radioStreamUrl: 'https://stream.example/radio',
            });
            const { result } = renderHook(() => useConnectActions(args));

            await result.current.sendToSelected();

            const [path] = connectFetchMock.mock.calls[0];
            expect(path).toBe('/play-url');
        });
    });

    describe('addToStream / joinTo', () => {
        it('does nothing when nothing is selected', async () => {
            const args = baseArgs({ selectedForSend: [] });
            const { result } = renderHook(() => useConnectActions(args));

            await result.current.addToStream();

            expect(connectFetchMock).not.toHaveBeenCalled();
        });

        it('POSTs /join for every selected device', async () => {
            const args = baseArgs({ selectedForSend: [livingRoom, kitchen] });
            const { result } = renderHook(() => useConnectActions(args));

            await result.current.addToStream();

            expect(connectFetchMock).toHaveBeenCalledTimes(2);
            const [path1, options1] = connectFetchMock.mock.calls[0];
            expect(path1).toBe('/join');
            expect(JSON.parse(options1.body)).toEqual({
                force: false,
                target_name: 'Living Room',
                target_type: 'sonos',
            });
        });

        it('appends newly-joined devices to the existing active targets without duplicating', async () => {
            const args = baseArgs({ selectedForSend: [livingRoom] });
            const { result } = renderHook(() => useConnectActions(args));

            await result.current.addToStream();

            const updater = (args.setActiveTargets as unknown as ReturnType<typeof vi.fn>).mock
                .calls[0][0] as (prev: ConnectDevice[]) => ConnectDevice[];
            expect(updater([kitchen])).toEqual([kitchen, livingRoom]);
            expect(updater([livingRoom])).toEqual([livingRoom]);
        });

        it('removes joined devices from the selection', async () => {
            const args = baseArgs({ selectedForSend: [livingRoom] });
            const { result } = renderHook(() => useConnectActions(args));

            await result.current.addToStream();

            const updater = (args.setSelectedForSend as unknown as ReturnType<typeof vi.fn>).mock
                .calls[0][0] as (prev: ConnectDevice[]) => ConnectDevice[];
            expect(updater([livingRoom, kitchen])).toEqual([kitchen]);
        });
    });

    describe('takeoverDevice', () => {
        it('joins the active stream and refreshes the device list when already connected', async () => {
            const args = baseArgs({ isActive: true });
            const { result } = renderHook(() => useConnectActions(args));

            await result.current.takeoverDevice(livingRoom);

            const [path, options] = connectFetchMock.mock.calls[0];
            expect(path).toBe('/join');
            expect(JSON.parse(options.body).force).toBe(true);
            expect(args.refresh).toHaveBeenCalledTimes(1);
        });

        it('starts playback with force=true when not connected but content is loaded', async () => {
            const args = baseArgs({ isActive: false });
            const { result } = renderHook(() => useConnectActions(args));

            await result.current.takeoverDevice(livingRoom);

            const [path, options] = connectFetchMock.mock.calls[0];
            expect(path).toBe('/play');
            expect(JSON.parse(options.body).force).toBe(true);
            expect(args.refresh).toHaveBeenCalledTimes(1);
        });

        it('claims (without playing) when not connected and nothing is loaded', async () => {
            const args = baseArgs({
                currentTrackId: null,
                isActive: false,
                isRadioActive: false,
            });
            const { result } = renderHook(() => useConnectActions(args));

            await result.current.takeoverDevice(livingRoom);

            const [path, options] = connectFetchMock.mock.calls[0];
            expect(path).toBe('/claim');
            expect(JSON.parse(options.body).force).toBe(true);
            expect(args.refresh).toHaveBeenCalledTimes(1);
        });

        it('throws and does not refresh when the takeover is refused', async () => {
            connectFetchMock.mockResolvedValueOnce(
                new Response(JSON.stringify({ error: 'device_in_use' })),
            );
            const args = baseArgs({ isActive: false });
            const { result } = renderHook(() => useConnectActions(args));

            await expect(result.current.takeoverDevice(livingRoom)).rejects.toThrow(
                'device_in_use',
            );
            expect(args.refresh).not.toHaveBeenCalled();
        });
    });

    describe('toggleSelectForSend', () => {
        it('adds a device that is not yet selected', () => {
            const args = baseArgs({ selectedForSend: [] });
            const { result } = renderHook(() => useConnectActions(args));

            result.current.toggleSelectForSend(livingRoom);

            const updater = (args.setSelectedForSend as unknown as ReturnType<typeof vi.fn>).mock
                .calls[0][0] as (prev: ConnectDevice[]) => ConnectDevice[];
            expect(updater([])).toEqual([livingRoom]);
        });

        it('removes a device that is already selected', () => {
            const args = baseArgs({ selectedForSend: [livingRoom] });
            const { result } = renderHook(() => useConnectActions(args));

            result.current.toggleSelectForSend(livingRoom);

            const updater = (args.setSelectedForSend as unknown as ReturnType<typeof vi.fn>).mock
                .calls[0][0] as (prev: ConnectDevice[]) => ConnectDevice[];
            expect(updater([livingRoom, kitchen])).toEqual([kitchen]);
        });
    });
});
