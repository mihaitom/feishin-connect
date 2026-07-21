import { connectFetch } from './types';

// Exact substring of the error connect/routes/playback.py's /play returns
// when session.media.base_url is empty — the one case a fresh /config can
// actually fix. Other logical errors (device_in_use, track not found, …)
// aren't retried: reconfiguring wouldn't change their outcome.
const NOT_CONFIGURED_ERROR = 'not configured';

/**
 * connectFetch(), but self-healing against a specific stale-session race:
 * backend sessions are reaped after ~30 min idle (see core/session.py's
 * SESSION_IDLE_TIMEOUT), which silently forgets a session's /config even
 * though the frontend's `ensureConfigured()` has no way to know and keeps
 * reporting "already configured" for the rest of the tab's lifetime. Before
 * this fix, that left the user stuck with a "media server not configured"
 * error (and an orange Connect button) until a full page reload. Call sites
 * that already call ensureConfigured() should use this in place of a plain
 * connectFetch() for any request that can plausibly hit that error.
 */
export async function connectFetchEnsured(
    path: string,
    options: RequestInit,
    ensureConfigured: () => Promise<void>,
    forceReconfigure: () => Promise<void>,
): Promise<Response> {
    await ensureConfigured();
    const res = await connectFetch(path, options);
    if (!res.ok) return res;

    const body = await res
        .clone()
        .json()
        .catch(() => null);
    if (
        typeof body?.error !== 'string' ||
        !body.error.toLowerCase().includes(NOT_CONFIGURED_ERROR)
    ) {
        return res;
    }

    await forceReconfigure();
    return connectFetch(path, options);
}
