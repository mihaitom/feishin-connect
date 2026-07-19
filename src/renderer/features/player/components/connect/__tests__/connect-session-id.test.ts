import { describe, expect, it } from 'vitest';

import { computeConnectSessionId } from '../connect-session-id';

import { ServerType } from '/@/shared/types/types';

describe('computeConnectSessionId', () => {
    it('returns the same id for the same login across repeated calls', () => {
        const server = {
            type: ServerType.NAVIDROME,
            url: 'http://nas.local:4533',
            userId: 'user-1',
            username: 'alice',
        };

        expect(computeConnectSessionId(server)).toBe(computeConnectSessionId({ ...server }));
    });

    it('returns different ids for different userIds on the same server', () => {
        const base = { type: ServerType.NAVIDROME, url: 'http://nas.local:4533', username: 'x' };

        const a = computeConnectSessionId({ ...base, userId: 'user-1' });
        const b = computeConnectSessionId({ ...base, userId: 'user-2' });

        expect(a).not.toBe(b);
    });

    it('returns different ids for different server URLs with the same user', () => {
        const base = { type: ServerType.NAVIDROME, userId: 'user-1', username: 'alice' };

        const a = computeConnectSessionId({ ...base, url: 'http://nas-a.local:4533' });
        const b = computeConnectSessionId({ ...base, url: 'http://nas-b.local:4533' });

        expect(a).not.toBe(b);
    });

    it('treats a trailing slash on the server URL as equivalent', () => {
        const base = { type: ServerType.NAVIDROME, userId: 'user-1', username: 'alice' };

        const a = computeConnectSessionId({ ...base, url: 'http://nas.local:4533' });
        const b = computeConnectSessionId({ ...base, url: 'http://nas.local:4533/' });

        expect(a).toBe(b);
    });

    it('falls back to username when userId is null', () => {
        const base = { type: ServerType.NAVIDROME, url: 'http://nas.local:4533', userId: null };

        const a = computeConnectSessionId({ ...base, username: 'alice' });
        const b = computeConnectSessionId({ ...base, username: 'bob' });

        expect(a).not.toBe(b);
    });

    it('returns different ids for different server types with the same url/user', () => {
        const base = { url: 'http://nas.local:4533', userId: 'user-1', username: 'alice' };

        const a = computeConnectSessionId({ ...base, type: ServerType.NAVIDROME });
        const b = computeConnectSessionId({ ...base, type: ServerType.JELLYFIN });

        expect(a).not.toBe(b);
    });
});
