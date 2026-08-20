import merge from 'lodash/merge';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { createWithEqualityFn } from 'zustand/traditional';

import { useRemoteLibraryStore } from '/@/remote/store/library';
import { logger } from '/@/renderer/utils/logger';
import { toast } from '/@/shared/components/toast/toast';
import { ClientEvent, ServerEvent, SongUpdateSocket } from '/@/shared/types/remote-types';

export interface SettingsSlice extends SettingsState {
    actions: {
        reconnect: () => void;
        send: (data: ClientEvent) => void;
        toggleIsDark: () => void;
    };
}

interface SettingsState {
    // The resolved --theme-colors-primary for Default Dark/Light, mirrored
    // from the desktop's actual accent/shade settings — null until the
    // server's first push arrives, since this app runs as its own isolated
    // browser bundle with no other way to see those settings (see
    // use-remote-settings-push.tsx). Applied in app.tsx; while null, the
    // static theme CSS's own default primary color is what shows.
    accentColor: null | { dark: string; light: string };
    // Set only for the codeless/4004 "wrong credentials or auth timed out"
    // close — retrying automatically would just fail again forever, so this
    // is surfaced distinctly instead of looking like an ordinary drop.
    authFailed: boolean;
    // Mirrors the desktop's confirmQueueChanges setting — defaults to `true`
    // (the safer direction to be wrong in) until the server's initial state
    // arrives. Read by play-submenu-items.tsx to ask before a play-now/
    // -shuffle request is even sent, since the desktop-side confirm modal
    // that would otherwise fire has no way to reach the phone.
    confirmQueueChanges: boolean;
    connected: boolean;
    info: Omit<SongUpdateSocket, 'currentTime'>;
    isDark: boolean;
    socket?: StatefulWebSocket;
}

interface StatefulWebSocket extends WebSocket {
    natural: boolean;
}

const initialState: SettingsState = {
    accentColor: null,
    authFailed: false,
    confirmQueueChanges: true,
    connected: false,
    info: {},
    isDark: window.matchMedia('(prefers-color-scheme: dark)').matches,
};

// Close codes that mean "don't retry automatically" — either something else
// already handles it (4001 self-initiated, 4002/4003 trigger a reload),
// there's deliberately nothing to reconnect to (4000, server shut down), or
// retrying wouldn't help (4004, bad credentials). Anything else (in
// particular the heartbeat timeout's codeless/1006 close) is a transient
// drop worth retrying on its own, the way beacon's SSE-based remote does.
const NO_AUTO_RETRY_CODES = new Set([4000, 4001, 4002, 4003, 4004]);
const RECONNECT_DELAY_MS = 2000;

// Not part of the store's reactive state — nothing renders off "is a retry
// pending", and Immer would only complicate scheduling/cancelling a plain
// timer handle for no benefit.
let retryTimer: null | ReturnType<typeof setTimeout> = null;

export const useRemoteStore = createWithEqualityFn<SettingsSlice>()(
    persist(
        devtools(
            immer((set, get) => ({
                actions: {
                    reconnect: async () => {
                        logger.info('Reconnect initiated');

                        // A manual tap (or a fresh auto-retry firing) always
                        // supersedes whatever retry was still pending —
                        // without this, a manual reconnect during the 2s
                        // wait would leave the old timer to fire later and
                        // open a second, overlapping connection attempt.
                        if (retryTimer !== null) {
                            clearTimeout(retryTimer);
                            retryTimer = null;
                        }

                        const existing = get().socket;

                        if (existing) {
                            if (
                                existing.readyState === WebSocket.OPEN ||
                                existing.readyState === WebSocket.CONNECTING
                            ) {
                                logger.debug('Closing existing socket', {
                                    readyState: existing.readyState,
                                });
                                existing.natural = true;
                                existing.close(4001);
                            }
                        }

                        let authHeader: string | undefined;

                        try {
                            logger.debug('Fetching credentials');
                            const credentials = await fetch('/credentials');
                            authHeader = await credentials.text();
                            logger.debug('Credentials fetched', { hasAuthHeader: !!authHeader });
                        } catch (error) {
                            logger.error('Failed to get credentials', { error });
                        }

                        set((state) => {
                            // Use location.origin, not location.href — HashRouter puts
                            // the current route in the URL fragment (e.g. "#/tracks"),
                            // and WebSocket URLs must not contain a fragment (Firefox
                            // throws "SyntaxError: An invalid or illegal string was
                            // specified" if they do; other engines are lenient but it's
                            // not spec-legal either way).
                            const wsUrl = location.origin.replace(/^http/, 'ws');
                            logger.info('Creating new WebSocket', { url: wsUrl });
                            const socket = new WebSocket(wsUrl) as StatefulWebSocket;

                            socket.natural = false;

                            socket.addEventListener('message', (message) => {
                                const { data, event } = JSON.parse(message.data) as ServerEvent;

                                logger.debug('WebSocket message received', { data, event });

                                switch (event) {
                                    case 'accent-color': {
                                        set((state) => {
                                            state.accentColor = data;
                                        });
                                        break;
                                    }
                                    case 'albums-response': {
                                        useRemoteLibraryStore
                                            .getState()
                                            .actions.setAlbumsResponse(
                                                data.requestId,
                                                data.hasMore,
                                                data.items,
                                            );
                                        break;
                                    }
                                    case 'confirm-queue-changes-setting': {
                                        set((state) => {
                                            state.confirmQueueChanges = data;
                                        });
                                        break;
                                    }
                                    case 'error': {
                                        logger.error('WebSocket error event', { data });
                                        toast.error({ message: data, title: 'Socket error' });
                                        break;
                                    }
                                    case 'favorite': {
                                        logger.debug('Favorite event received', {
                                            favorite: data.favorite,
                                            id: data.id,
                                        });
                                        set((state) => {
                                            if (state.info.song?.id === data.id) {
                                                state.info.song.userFavorite = data.favorite;
                                            }
                                        });
                                        break;
                                    }
                                    case 'playback': {
                                        logger.debug('Playback event received', { status: data });
                                        set((state) => {
                                            state.info.status = data;
                                        });
                                        break;
                                    }
                                    case 'playlists-response': {
                                        useRemoteLibraryStore
                                            .getState()
                                            .actions.setPlaylistsResponse(
                                                data.requestId,
                                                data.hasMore,
                                                data.items,
                                            );
                                        break;
                                    }
                                    case 'position': {
                                        logger.debug('Position event received', { position: data });
                                        set((state) => {
                                            state.info.position = data;
                                        });
                                        break;
                                    }
                                    case 'proxy': {
                                        logger.debug('Proxy event received (image update)', {
                                            dataLength: data?.length,
                                            hasData: !!data,
                                        });
                                        set((state) => {
                                            if (state.info.song) {
                                                state.info.song.imageUrl = `data:image/jpeg;base64,${data}`;
                                            }
                                        });
                                        break;
                                    }
                                    case 'queue-state': {
                                        useRemoteLibraryStore
                                            .getState()
                                            .actions.setQueueState(data);
                                        break;
                                    }
                                    case 'radio-response': {
                                        useRemoteLibraryStore
                                            .getState()
                                            .actions.setRadioResponse(data.requestId, data.items);
                                        break;
                                    }
                                    case 'radio-status': {
                                        useRemoteLibraryStore
                                            .getState()
                                            .actions.setRadioStatus(data);
                                        break;
                                    }
                                    case 'rating': {
                                        logger.debug('Rating event received', {
                                            id: data.id,
                                            rating: data.rating,
                                        });
                                        set((state) => {
                                            if (state.info.song?.id === data.id) {
                                                state.info.song.userRating = data.rating;
                                            }
                                        });
                                        break;
                                    }
                                    case 'repeat': {
                                        logger.debug('Repeat event received', { repeat: data });
                                        set((state) => {
                                            state.info.repeat = data;
                                        });
                                        break;
                                    }
                                    case 'shuffle': {
                                        logger.debug('Shuffle event received', { shuffle: data });
                                        set((state) => {
                                            state.info.shuffle = data;
                                        });
                                        break;
                                    }
                                    case 'song': {
                                        logger.debug('Song event received', {
                                            artistName: data?.artistName,
                                            id: data?.id,
                                            name: data?.name,
                                        });
                                        set((state) => {
                                            state.info.song = data;
                                        });
                                        break;
                                    }
                                    case 'state': {
                                        logger.debug('State event received (full state update)', {
                                            hasSong: !!data.song,
                                            position: data.position,
                                            status: data.status,
                                            volume: data.volume,
                                        });
                                        set((state) => {
                                            state.info = data;
                                        });
                                        break;
                                    }
                                    case 'tracks-response': {
                                        useRemoteLibraryStore
                                            .getState()
                                            .actions.setTracksResponse(
                                                data.requestId,
                                                data.hasMore,
                                                data.items,
                                            );
                                        break;
                                    }
                                    case 'volume': {
                                        logger.debug('Volume event received', { volume: data });
                                        set((state) => {
                                            state.info.volume = data;
                                        });
                                    }
                                }
                            });

                            socket.addEventListener('open', () => {
                                logger.info('WebSocket opened', {
                                    hasAuthHeader: !!authHeader,
                                    readyState: socket.readyState,
                                });
                                if (authHeader) {
                                    logger.debug('Sending authentication');
                                    socket.send(
                                        JSON.stringify({
                                            event: 'authenticate',
                                            header: authHeader,
                                        }),
                                    );
                                }
                                set({ authFailed: false, connected: true });
                            });

                            socket.addEventListener('close', (reason) => {
                                logger.info('WebSocket closed', {
                                    code: reason.code,
                                    natural: socket.natural,
                                    reason: reason.reason,
                                    wasClean: reason.wasClean,
                                });
                                if (reason.code === 4002 || reason.code === 4003) {
                                    logger.debug('Reloading page due to close code', {
                                        code: reason.code,
                                    });
                                    location.reload();
                                } else if (reason.code === 4000) {
                                    logger.warn('Server is down');
                                    toast.warn({
                                        message: 'Feishin remote server is down',
                                        title: 'Connection closed',
                                    });
                                } else if (reason.code === 4004) {
                                    logger.warn('Authentication failed');
                                    toast.error({
                                        message: 'Check the remote password and reconnect manually',
                                        title: 'Authentication failed',
                                    });
                                } else if (reason.code !== 4001 && !socket.natural) {
                                    logger.error('Socket closed unexpectedly', {
                                        code: reason.code,
                                        reason: reason.reason,
                                    });
                                    toast.error({
                                        message: 'Socket closed for unexpected reason',
                                        title: 'Connection closed',
                                    });
                                }

                                if (!socket.natural) {
                                    set({
                                        authFailed: reason.code === 4004,
                                        connected: false,
                                        info: {},
                                    });

                                    if (!NO_AUTO_RETRY_CODES.has(reason.code)) {
                                        logger.debug('Scheduling automatic reconnect', {
                                            delayMs: RECONNECT_DELAY_MS,
                                        });
                                        retryTimer = setTimeout(() => {
                                            retryTimer = null;
                                            get().actions.reconnect();
                                        }, RECONNECT_DELAY_MS);
                                    }
                                }
                            });

                            state.socket = socket;
                        });
                    },
                    send: (data: ClientEvent) => {
                        const socket = get().socket;
                        if (socket) {
                            logger.debug('Sending event to server', {
                                data: data,
                                event: data.event,
                                readyState: socket.readyState,
                            });
                            socket.send(JSON.stringify(data));
                        } else {
                            logger.warn('Cannot send event - socket not available', {
                                event: data.event,
                            });
                        }
                    },
                    toggleIsDark: () => {
                        set((state) => {
                            state.isDark = !state.isDark;
                        });
                    },
                },
                ...initialState,
            })),
            { name: 'store_settings' },
        ),
        {
            merge: (persistedState, currentState) => merge(currentState, persistedState),
            migrate: (persistedState) => {
                // v7 -> v8: showImage/toggleShowImage were removed when the
                // artwork toggle button was replaced by tap-to-fullscreen —
                // strip the now-meaningless key instead of leaving it to
                // linger forever in localStorage.
                // v8 -> v9: only `isDark` should ever have been persisted
                // (see `partialize` below) — normalize any older snapshot
                // down to just that. In particular, older builds persisted
                // `socket` too: JSON.stringify reduces a live WebSocket to
                // just its own `natural` flag (methods live on the
                // prototype, not as own properties), so a stale one
                // rehydrated back into state.socket on this load is a
                // plain, methodless object masquerading as a socket — the
                // next `send()` call throws "send is not a function" the
                // moment reconnect()'s real socket gets raced/overwritten
                // by it.
                if (persistedState && typeof persistedState === 'object') {
                    const state = persistedState as Record<string, unknown>;
                    return { isDark: state.isDark };
                }
                return persistedState;
            },
            name: 'store_settings',
            // Only `isDark` is a genuine user preference worth surviving a
            // reload — everything else here is either a live connection
            // object or state the server re-pushes on every connect anyway
            // (connected/authFailed/confirmQueueChanges/accentColor/info),
            // and must never be loaded stale from a previous session.
            partialize: (state) => ({ isDark: state.isDark }),
            version: 9,
        },
    ),
);

export const useAccentColor = () => useRemoteStore((state) => state.accentColor);

export const useAuthFailed = () => useRemoteStore((state) => state.authFailed);

export const useConfirmQueueChanges = () => useRemoteStore((state) => state.confirmQueueChanges);

export const useConnected = () => useRemoteStore((state) => state.connected);

export const useInfo = () => useRemoteStore((state) => state.info);

export const useIsDark = () => useRemoteStore((state) => state.isDark);

export const useReconnect = () => useRemoteStore((state) => state.actions.reconnect);

export const useSend = () => useRemoteStore((state) => state.actions.send);

export const useToggleDark = () => useRemoteStore((state) => state.actions.toggleIsDark);
