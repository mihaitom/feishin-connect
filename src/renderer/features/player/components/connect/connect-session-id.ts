import { normalizeServerUrl } from '/@/renderer/utils/normalize-server-url';
import { ServerType } from '/@/shared/types/types';

// Synchronous FNV-1a hash — deliberately not crypto.subtle.digest, which is
// only available in secure contexts (HTTPS/localhost) and would be undefined
// on this project's plain-HTTP LAN Docker deployments.
const fnv1aHash = (input: string): string => {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16);
};

const memo = new Map<string, string>();

// Identifies a Connect session by media-server login, not by browser/device —
// the same login sharing across tabs/devices lands in the same session, so
// independent logins get independent playback (see the multi-user support plan).
export const computeConnectSessionId = (server: {
    type: ServerType;
    url: string;
    userId: null | string;
    username: string;
}): string => {
    const composite = `${normalizeServerUrl(server.url)}::${server.type}::${server.userId || server.username}`;
    const cached = memo.get(composite);
    if (cached) return cached;
    const id = fnv1aHash(composite);
    memo.set(composite, id);
    return id;
};
