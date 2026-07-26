import { useCallback, useEffect, useState } from 'react';

import { connectFetch } from './types';

export const usePairedDevices = () => {
    const [paired, setPaired] = useState<string[]>([]);

    const refresh = useCallback(() => {
        connectFetch(`/pair/airplay`)
            .then((r) => r.json())
            .then((d) => setPaired(d.paired ?? []))
            .catch(() => {});
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const unpair = useCallback(
        (name: string) =>
            connectFetch(`/pair/airplay/${encodeURIComponent(name)}`, { method: 'DELETE' })
                .then(() => refresh())
                .catch(() => {}),
        [refresh],
    );

    return { paired, refresh, unpair };
};
