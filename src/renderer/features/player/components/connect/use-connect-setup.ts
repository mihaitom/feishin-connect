import { useEffect, useMemo, useRef } from 'react';

import { buildConfigBody } from './connect-config';
import { computeConnectSessionId } from './connect-session-id';
import { connectFetch, setConnectSessionId } from './types';

import { useCurrentServerWithCredential } from '/@/renderer/store/auth.store';

/**
 * Session-id + backend /config bootstrapping. Fires /config as soon as the
 * logged-in server's credential is available, and exposes ensureConfigured()
 * for callers (sendTo/claimOnly in use-connect-actions.ts) that need to
 * guarantee it's done before issuing a request of their own.
 */
export const useConnectSetup = () => {
    const server = useCurrentServerWithCredential();
    const configuredRef = useRef(false);
    const serverRef = useRef(server);
    serverRef.current = server;

    const mySessionId = useMemo(
        () => (server?.url ? computeConnectSessionId(server) : ''),
        [server],
    );

    // ── Server config ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (!server?.url || !server?.credential) return;
        // Must be set before the first /config call so it — and every request
        // after it — is scoped to this login's session from the start.
        setConnectSessionId(computeConnectSessionId(server));
        connectFetch(`/config`, {
            body: JSON.stringify(buildConfigBody(server)),
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
        })
            .then(() => {
                configuredRef.current = true;
            })
            .catch(() => {});
        // Deliberately narrower than [server]: the auth store hands out a new
        // `currentServer` object on nearly every Navidrome response (it also
        // carries ndCredential, refreshed constantly) even though none of the
        // fields /config actually cares about changed. Depending on the whole
        // object re-sent /config on every unrelated store update — up to
        // several times a second during a page load's request burst.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [server?.url, server?.credential, server?.type, server?.userId, server?.username]);

    const ensureConfigured = async () => {
        if (configuredRef.current) return;
        // The effect above fires /config itself as soon as server.url/credential
        // are ready and flips configuredRef once it lands — credential can still
        // be hydrating right after a page reload (useServerAuthenticated
        // re-validates it against the media server on startup). Wait for that
        // instead of racing it with a second /config call: sendTo()'s caller
        // already shows a loading spinner while this runs, so there's no need
        // to rush or duplicate the request.
        for (let attempt = 0; attempt < 100 && !configuredRef.current; attempt++) {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
        if (configuredRef.current) return;
        // Fallback in case the effect never got a usable server either — do it
        // ourselves rather than leaving a slow-to-hydrate session stuck.
        const current = serverRef.current;
        if (!current?.url || !current?.credential) return;
        setConnectSessionId(computeConnectSessionId(current));
        await connectFetch(`/config`, {
            body: JSON.stringify(buildConfigBody(current)),
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
        });
        configuredRef.current = true;
    };

    return { ensureConfigured, mySessionId };
};
