import { beforeEach, describe, expect, it } from 'vitest';

import {
    clearLibraryScan,
    markLibraryScanStarted,
    requestLibraryScan,
    useLibraryScanStore,
} from '../library-scan.store';

describe('library-scan.store', () => {
    beforeEach(() => {
        useLibraryScanStore.setState({ serverId: null, started: false, token: 0 });
    });

    it('requestLibraryScan sets the server, resets started and bumps the token', () => {
        requestLibraryScan('server-1');

        expect(useLibraryScanStore.getState()).toMatchObject({
            serverId: 'server-1',
            started: false,
            token: 1,
        });
    });

    it('requestLibraryScan increments the token on repeated requests', () => {
        requestLibraryScan('server-1');
        requestLibraryScan('server-1');

        expect(useLibraryScanStore.getState().token).toBe(2);
    });

    it('requestLibraryScan resets started for a scan in progress', () => {
        useLibraryScanStore.setState({ serverId: 'server-1', started: true, token: 1 });

        requestLibraryScan('server-2');

        expect(useLibraryScanStore.getState()).toMatchObject({
            serverId: 'server-2',
            started: false,
            token: 2,
        });
    });

    it('markLibraryScanStarted flips started without touching serverId/token', () => {
        requestLibraryScan('server-1');

        markLibraryScanStarted();

        expect(useLibraryScanStore.getState()).toMatchObject({
            serverId: 'server-1',
            started: true,
            token: 1,
        });
    });

    it('clearLibraryScan resets serverId and started but preserves the token', () => {
        requestLibraryScan('server-1');
        markLibraryScanStarted();

        clearLibraryScan();

        expect(useLibraryScanStore.getState()).toEqual({
            serverId: null,
            started: false,
            token: 1,
        });
    });
});
