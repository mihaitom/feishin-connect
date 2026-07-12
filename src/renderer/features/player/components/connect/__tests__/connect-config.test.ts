import { describe, expect, it } from 'vitest';

import { buildConfigBody } from '../connect-config';

import { ServerType } from '/@/shared/types/types';

describe('buildConfigBody', () => {
    it('maps a Jellyfin server to the jellyfin server_type', () => {
        const body = buildConfigBody({
            credential: 'token-123',
            type: ServerType.JELLYFIN,
            url: 'https://jellyfin.example',
            userId: 'user-1',
            username: 'alice',
        });

        expect(body).toEqual({
            credential: 'token-123',
            server_type: 'jellyfin',
            url: 'https://jellyfin.example',
            user_id: 'user-1',
            username: 'alice',
        });
    });

    it('maps any non-Jellyfin server to the subsonic server_type', () => {
        const body = buildConfigBody({
            credential: 'token-456',
            type: ServerType.NAVIDROME,
            url: 'https://navidrome.example',
            userId: 'user-2',
        });

        expect(body.server_type).toBe('subsonic');
    });

    it('prefers displayName over username when both are set', () => {
        const body = buildConfigBody({
            displayName: 'Thomas',
            type: ServerType.NAVIDROME,
            username: 'thomas.m',
        });

        expect(body.username).toBe('Thomas');
    });

    it('falls back to username when displayName is not set (Jellyfin/plain Subsonic)', () => {
        const body = buildConfigBody({
            type: ServerType.JELLYFIN,
            username: 'thomas.m',
        });

        expect(body.username).toBe('thomas.m');
    });

    it('falls back to username when displayName is an empty string', () => {
        const body = buildConfigBody({
            displayName: '',
            username: 'thomas.m',
        });

        expect(body.username).toBe('thomas.m');
    });

    it('fills in empty strings for missing fields', () => {
        const body = buildConfigBody({});

        expect(body).toEqual({
            credential: '',
            server_type: 'subsonic',
            url: '',
            user_id: '',
            username: '',
        });
    });
});
