import { create } from 'zustand';

import {
    RemotePlaylistItem,
    RemoteQueueItem,
    RemoteRadioItem,
    RemoteTrackItem,
    ServerRadioStatus,
} from '/@/shared/types/remote-types';

// Transient session data (not persisted, unlike store/index.ts's settings) —
// tracks/playlists browsing results, the one-shot radio station list, live
// queue state, and radio-active status. Written by store/index.ts's existing
// WS message handler (same socket, no second connection), read by the
// tab pages via the selector hooks below.
interface LibraryListState<T> {
    hasMore: boolean;
    items: T[];
    // Tracks which request this data answers, so callers (useRemoteQuery) can
    // tell a fresh response apart from a stale one still in flight.
    requestId: null | string;
}

interface LibrarySlice extends LibraryState {
    actions: {
        setPlaylistsResponse: (
            requestId: string,
            hasMore: boolean,
            items: RemotePlaylistItem[],
        ) => void;
        setQueueState: (state: QueueState) => void;
        setRadioResponse: (requestId: string, items: RemoteRadioItem[]) => void;
        setRadioStatus: (status: ServerRadioStatus['data']) => void;
        setTracksResponse: (requestId: string, hasMore: boolean, items: RemoteTrackItem[]) => void;
    };
}

interface LibraryState {
    playlists: LibraryListState<RemotePlaylistItem>;
    queue: QueueState;
    radio: { items: RemoteRadioItem[]; requestId: null | string };
    radioStatus: ServerRadioStatus['data'];
    tracks: LibraryListState<RemoteTrackItem>;
}

interface QueueState {
    currentUniqueId: null | string;
    items: RemoteQueueItem[];
}

export const useRemoteLibraryStore = create<LibrarySlice>((set) => ({
    actions: {
        setPlaylistsResponse: (requestId, hasMore, items) =>
            set({ playlists: { hasMore, items, requestId } }),
        setQueueState: (state) => set({ queue: state }),
        setRadioResponse: (requestId, items) => set({ radio: { items, requestId } }),
        setRadioStatus: (status) => set({ radioStatus: status }),
        setTracksResponse: (requestId, hasMore, items) =>
            set({ tracks: { hasMore, items, requestId } }),
    },
    playlists: { hasMore: false, items: [], requestId: null },
    queue: { currentUniqueId: null, items: [] },
    radio: { items: [], requestId: null },
    radioStatus: { isActive: false },
    tracks: { hasMore: false, items: [], requestId: null },
}));

export const usePlaylistsResponse = () => useRemoteLibraryStore((state) => state.playlists);

export const useQueueState = () => useRemoteLibraryStore((state) => state.queue);

export const useRadioResponse = () => useRemoteLibraryStore((state) => state.radio);

export const useRadioStatus = () => useRemoteLibraryStore((state) => state.radioStatus);

export const useTracksResponse = () => useRemoteLibraryStore((state) => state.tracks);
