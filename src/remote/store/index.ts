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
    connected: boolean;
    info: Omit<SongUpdateSocket, 'currentTime'>;
    isDark: boolean;
    socket?: StatefulWebSocket;
}

interface StatefulWebSocket extends WebSocket {
    natural: boolean;
}

const initialState: SettingsState = {
    connected: false,
    info: {},
    isDark: window.matchMedia('(prefers-color-scheme: dark)').matches,
};

export const useRemoteStore = createWithEqualityFn<SettingsSlice>()(
    persist(
        devtools(
            immer((set, get) => ({
                actions: {
                    reconnect: async () => {
                        logger.info('Reconnect initiated');
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
                                set({ connected: true });
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
                                    set({ connected: false, info: {} });
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
                if (persistedState && typeof persistedState === 'object') {
                    delete (persistedState as Record<string, unknown>).showImage;
                }
                return persistedState;
            },
            name: 'store_settings',
            version: 8,
        },
    ),
);

export const useConnected = () => useRemoteStore((state) => state.connected);

export const useInfo = () => useRemoteStore((state) => state.info);

export const useIsDark = () => useRemoteStore((state) => state.isDark);

export const useReconnect = () => useRemoteStore((state) => state.actions.reconnect);

export const useSend = () => useRemoteStore((state) => state.actions.send);

export const useToggleDark = () => useRemoteStore((state) => state.actions.toggleIsDark);
