import { useEffect, useRef, useState } from 'react';

import { ConnectDevice, connectFetch } from './types';

export interface ConnectHealth {
    apiReachable: boolean;
    ffmpegFound: boolean;
    unauthorized: boolean;
}

class HttpStatusError extends Error {
    status: number;
    constructor(status: number) {
        super(`HTTP ${status}`);
        this.status = status;
    }
}

export const useConnectDevices = (ensureConfigured: () => Promise<void>) => {
    const [devices, setDevices] = useState<ConnectDevice[]>([]);
    const [health, setHealth] = useState<ConnectHealth | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    // Ref (not the `devices` state directly) so refresh() doesn't capture
    // reactive state — keeps its identity closure-safe for the mount effect
    // below without needing `devices`/`refresh` itself in a dependency array.
    const devicesRef = useRef<ConnectDevice[]>(devices);
    devicesRef.current = devices;

    const refresh = (fresh = false) => {
        // /discover already skips a real re-scan for a plain (non-fresh) call
        // once a cached device list exists — it serves that cache instantly
        // and only recomputes the live claim/track annotations (see
        // routes/devices.py). So reopening the popover to pick up fresh "in
        // use by"/"playing" labels shouldn't flash the scanning spinner and
        // disable "Scan again" every time — only an explicit fresh scan, or
        // the very first load (nothing cached client-side yet either), does.
        const showScanning = fresh || devicesRef.current.length === 0;
        if (showScanning) setIsScanning(true);
        // A non-2xx response (e.g. 401 from a wrong/missing CONNECT_TOKEN) is
        // still valid JSON — parsing it as if it were a real /health or
        // /discover body would silently produce bogus fields (e.g. "ffmpeg
        // missing") instead of surfacing the actual connectivity problem.
        const parseOk = (r: Response) => {
            if (!r.ok) throw new HttpStatusError(r.status);
            return r.json();
        };
        Promise.all([
            connectFetch(`/discover${fresh ? '?fresh=true' : ''}`).then(parseOk),
            connectFetch(`/health`).then(parseOk),
        ])
            .then(([discoverData, healthData]) => {
                const claimFields = (x: any) => ({
                    claimedByName: x.in_use_by_name ?? null,
                    claimedBySessionId: x.in_use_by_session_id ?? null,
                    claimedByTrack: x.in_use_by_track ?? null,
                });
                const sonos: ConnectDevice[] = (discoverData.sonos ?? []).map((x: any) => ({
                    ...claimFields(x),
                    name: x.name,
                    type: 'sonos' as const,
                }));
                const chromecast: ConnectDevice[] = (discoverData.chromecast ?? []).map(
                    (x: any) => ({
                        ...claimFields(x),
                        name: x.name,
                        type: 'chromecast' as const,
                    }),
                );
                const airplay: ConnectDevice[] = (discoverData.airplay ?? []).map((x: any) => ({
                    ...claimFields(x),
                    name: x.name,
                    needsPairing: x.needs_pairing ?? false,
                    type: 'airplay' as const,
                }));
                const dlna: ConnectDevice[] = (discoverData.dlna ?? []).map((x: any) => ({
                    ...claimFields(x),
                    name: x.name,
                    type: 'dlna' as const,
                }));
                const sort = (a: ConnectDevice, b: ConnectDevice) => a.name.localeCompare(b.name);
                setDevices([
                    ...sonos.sort(sort),
                    ...chromecast.sort(sort),
                    ...airplay.sort(sort),
                    ...dlna.sort(sort),
                ]);
                setHealth({
                    apiReachable: true,
                    ffmpegFound: healthData.ffmpeg ?? false,
                    unauthorized: false,
                });
            })
            .catch((e) => {
                setHealth({
                    apiReachable: false,
                    ffmpegFound: false,
                    unauthorized: e instanceof HttpStatusError && e.status === 401,
                });
            })
            .finally(() => setIsScanning(false));
    };

    useEffect(() => {
        // Waits for /config so this doesn't race it and misreport a fresh,
        // not-yet-authenticated session as a token mismatch (see
        // require_authenticated_session in core/session.py) — most visible in
        // Electron, where the backend is a cold process on every launch and
        // device discovery alone can take several seconds. Manual refresh()
        // calls (e.g. reopening the popover later) skip this — by then
        // /config has long since completed.
        ensureConfigured().then(() => refresh());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { devices, health, isScanning, refresh };
};
