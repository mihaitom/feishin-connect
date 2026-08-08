import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { connectFetch } from '../types';
import {
    fetchDeviceVolumeIfNeeded,
    getDeviceVolumeEntry,
    setDeviceVolumeImperative,
    subscribeDeviceVolume,
    useDeviceVolume,
} from '../use-device-volume';

vi.mock('../types', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../types')>();
    return {
        ...actual,
        connectFetch: vi.fn(() => Promise.resolve(new Response('{}'))),
    };
});

const connectFetchMock = connectFetch as unknown as ReturnType<typeof vi.fn>;

// Every test uses its own device name so entries never collide — the
// underlying store is module-private (no exported reset), keyed by
// "type:name", so isolating by key is simpler than resetting the module.
let deviceCounter = 0;
const freshDeviceName = () => `Device ${++deviceCounter}`;

const deferred = <T>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => {
        resolve = r;
    });
    return { promise, resolve };
};

describe('use-device-volume', () => {
    afterEach(() => {
        connectFetchMock.mockClear();
        connectFetchMock.mockResolvedValue(new Response('{}'));
    });

    describe('getDeviceVolumeEntry', () => {
        it('returns undefined when type or name is missing', () => {
            expect(getDeviceVolumeEntry(undefined, 'Kitchen')).toBeUndefined();
            expect(getDeviceVolumeEntry('sonos', undefined)).toBeUndefined();
        });

        it('returns undefined for a device that has never been touched', () => {
            expect(getDeviceVolumeEntry('sonos', freshDeviceName())).toBeUndefined();
        });
    });

    describe('setDeviceVolumeImperative', () => {
        it('patches the entry optimistically and POSTs the new volume', () => {
            const name = freshDeviceName();

            setDeviceVolumeImperative('sonos', name, 42);

            expect(getDeviceVolumeEntry('sonos', name)?.volume).toBe(42);
            expect(connectFetchMock).toHaveBeenCalledTimes(1);
            const [path, options] = connectFetchMock.mock.calls[0];
            expect(path).toBe(`/device-volume?device_type=sonos&name=${encodeURIComponent(name)}`);
            expect(options.method).toBe('POST');
            expect(JSON.parse(options.body)).toEqual({ volume: 42 });
        });
    });

    describe('fetchDeviceVolumeIfNeeded', () => {
        it('does nothing for AirPlay (no volume support in the backend)', () => {
            fetchDeviceVolumeIfNeeded('airplay', freshDeviceName());

            expect(connectFetchMock).not.toHaveBeenCalled();
        });

        it('fetches once for a device with no known volume yet', () => {
            const name = freshDeviceName();

            fetchDeviceVolumeIfNeeded('sonos', name);

            expect(connectFetchMock).toHaveBeenCalledTimes(1);
            const [path] = connectFetchMock.mock.calls[0];
            expect(path).toBe(`/device-volume?device_type=sonos&name=${encodeURIComponent(name)}`);
        });

        it('does not re-fetch once a volume is already known', () => {
            const name = freshDeviceName();
            setDeviceVolumeImperative('sonos', name, 10);
            connectFetchMock.mockClear();

            fetchDeviceVolumeIfNeeded('sonos', name);

            expect(connectFetchMock).not.toHaveBeenCalled();
        });

        it('applies the fetched volume when nothing has set it in the meantime', async () => {
            const name = freshDeviceName();
            const { promise, resolve } = deferred<Response>();
            connectFetchMock.mockReturnValueOnce(promise);

            fetchDeviceVolumeIfNeeded('sonos', name);
            resolve(new Response(JSON.stringify({ volume: 55 })));
            await act(async () => {
                await promise;
            });

            expect(getDeviceVolumeEntry('sonos', name)?.volume).toBe(55);
        });

        // Regression test: the fetch fired here can still be in flight when
        // the user drags the volume slider — setDeviceVolumeImperative()
        // patches the store synchronously and fires its own POST, but this
        // GET was already on the wire with the *old* server value. When it
        // finally resolves, it used to unconditionally overwrite the store
        // with that stale value, snapping the phone's slider back to the old
        // number right after the user moved it.
        it('does not clobber a value set while its own GET is still in flight', async () => {
            const name = freshDeviceName();
            const { promise, resolve } = deferred<Response>();
            connectFetchMock.mockReturnValueOnce(promise);

            fetchDeviceVolumeIfNeeded('sonos', name);
            // User drags the slider before the GET above has resolved.
            setDeviceVolumeImperative('sonos', name, 80);
            expect(getDeviceVolumeEntry('sonos', name)?.volume).toBe(80);

            // The in-flight GET now resolves with the stale pre-drag value.
            resolve(new Response(JSON.stringify({ volume: 30 })));
            await act(async () => {
                await promise;
            });

            expect(getDeviceVolumeEntry('sonos', name)?.volume).toBe(80);
        });
    });

    describe('subscribeDeviceVolume', () => {
        it('notifies subscribers when any entry changes', () => {
            const cb = vi.fn();
            const unsubscribe = subscribeDeviceVolume(cb);

            setDeviceVolumeImperative('sonos', freshDeviceName(), 20);

            expect(cb).toHaveBeenCalled();
            unsubscribe();
        });

        it('stops notifying after unsubscribing', () => {
            const cb = vi.fn();
            const unsubscribe = subscribeDeviceVolume(cb);
            unsubscribe();

            setDeviceVolumeImperative('sonos', freshDeviceName(), 20);

            expect(cb).not.toHaveBeenCalled();
        });
    });

    describe('useDeviceVolume', () => {
        it('reports supported=true only for sonos/chromecast/dlna, not airplay', () => {
            const name = freshDeviceName();
            const { result: sonos } = renderHook(() => useDeviceVolume('sonos', name, false));
            const { result: airplay } = renderHook(() =>
                useDeviceVolume('airplay', freshDeviceName(), false),
            );

            expect(sonos.current.supported).toBe(true);
            expect(airplay.current.supported).toBe(false);
        });

        it('fetches the current volume once enabled', async () => {
            const name = freshDeviceName();
            connectFetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ volume: 33 })));

            const { rerender, result } = renderHook(
                ({ enabled }) => useDeviceVolume('sonos', name, enabled),
                { initialProps: { enabled: false } },
            );
            expect(result.current.volume).toBeNull();

            await act(async () => {
                rerender({ enabled: true });
                await Promise.resolve();
            });

            expect(result.current.volume).toBe(33);
        });

        it('setDeviceVolume patches the shared store and POSTs the new value', () => {
            const name = freshDeviceName();
            const { result } = renderHook(() => useDeviceVolume('sonos', name));

            act(() => {
                result.current.setDeviceVolume(70);
            });

            expect(result.current.volume).toBe(70);
            expect(getDeviceVolumeEntry('sonos', name)?.volume).toBe(70);
            const [, options] = connectFetchMock.mock.calls.at(-1)!;
            expect(JSON.parse(options.body)).toEqual({ volume: 70 });
        });

        it('toggleMute mutes to 0 and remembers the pre-mute volume, then restores it', () => {
            const name = freshDeviceName();
            const { result } = renderHook(() => useDeviceVolume('sonos', name));

            act(() => {
                result.current.setDeviceVolume(60);
            });
            act(() => {
                result.current.toggleMute();
            });

            expect(result.current.muted).toBe(true);
            expect(result.current.volume).toBe(0);

            act(() => {
                result.current.toggleMute();
            });

            expect(result.current.muted).toBe(false);
            expect(result.current.volume).toBe(60);
        });

        // Same race as fetchDeviceVolumeIfNeeded, but through the hook's own
        // fetch effect — the shared store means either entry point can hit it.
        it('does not clobber a value set elsewhere while its own fetch is in flight', async () => {
            const name = freshDeviceName();
            const { promise, resolve } = deferred<Response>();
            connectFetchMock.mockReturnValueOnce(promise);

            const { result } = renderHook(() => useDeviceVolume('sonos', name));
            // A concurrent set via the imperative path (e.g. the phone bridge).
            act(() => {
                setDeviceVolumeImperative('sonos', name, 90);
            });

            resolve(new Response(JSON.stringify({ volume: 15 })));
            await act(async () => {
                await promise;
            });

            expect(result.current.volume).toBe(90);
        });
    });
});
