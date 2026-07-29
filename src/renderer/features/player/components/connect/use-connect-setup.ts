import { useCallback, useEffect, useMemo, useRef } from 'react';

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

    // Sends /config for whatever server we currently know about. Shared by
    // the mount effect, ensureConfigured()'s fallback, and forceReconfigure()
    // — the actual POST is identical everywhere, only when it's triggered differs.
    const sendConfig = async (current = serverRef.current) => {
        if (!current?.url || !current?.credential) return;
        setConnectSessionId(computeConnectSessionId(current));
        await connectFetch(`/config`, {
            body: JSON.stringify(buildConfigBody(current)),
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
        });
        configuredRef.current = true;
    };

    // ── Server config ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (!server?.url || !server?.credential) return;
        sendConfig(server).catch(() => {});
        // Deliberately narrower than [server]: the auth store hands out a new
        // `currentServer` object on nearly every Navidrome response (it also
        // carries ndCredential, refreshed constantly) even though none of the
        // fields /config actually cares about changed. Depending on the whole
        // object re-sent /config on every unrelated store update — up to
        // several times a second during a page load's request burst.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [server?.url, server?.credential, server?.type, server?.userId, server?.username]);

    // useCallback with empty deps: this only closes over refs, so it's safe to
    // keep a stable identity — callers (use-connect-playback.ts's auto-forward
    // effects) depend on it and would otherwise re-run on every render.
    const ensureConfigured = useCallback(async () => {
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
        await sendConfig();
    }, []);

    // Backend sessions are reaped after ~30 min of no request/SSE activity
    // (see core/session.py's SESSION_IDLE_TIMEOUT) — a tab left open without
    // actively casting can outlive that easily. configuredRef has no way to
    // know this happened, so it keeps reporting "configured" forever once
    // /config has succeeded once, even after the backend has silently
    // forgotten this session entirely. Callers that get back the resulting
    // "media server not configured" error call this to force a fresh /config
    // and retry, instead of leaving the user stuck until a page reload.
    const forceReconfigure = useCallback(async () => {
        configuredRef.current = false;
        await sendConfig();
    }, []);

    return { ensureConfigured, forceReconfigure, mySessionId };
};
