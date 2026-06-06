import { createWithEqualityFn } from 'zustand/traditional';

interface LibraryScanState {
    // Server whose scan is in progress. Set on request, cleared on completion or
    // failure. Lives in a global store (not the trigger menu) so the spinner and
    // completion toast survive that menu unmounting when it closes.
    serverId: null | string;
    // Flipped true once the server accepted startScan → begin polling its status.
    started: boolean;
    // Bumped per request so the status query never reads a previous scan's cache.
    token: number;
}

const initialState: LibraryScanState = {
    serverId: null,
    started: false,
    token: 0,
};

export const useLibraryScanStore = createWithEqualityFn<LibraryScanState>()(() => initialState);

export const requestLibraryScan = (serverId: string) =>
    useLibraryScanStore.setState((state) => ({
        serverId,
        started: false,
        token: state.token + 1,
    }));

export const markLibraryScanStarted = () => useLibraryScanStore.setState({ started: true });

export const clearLibraryScan = () =>
    useLibraryScanStore.setState({ serverId: null, started: false });
