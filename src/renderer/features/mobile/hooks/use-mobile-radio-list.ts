import { useEffect, useState } from 'react';

import { radioQueries } from '/@/renderer/features/radio/api/radio-api';
import { queryClient } from '/@/renderer/lib/react-query';
import { useAuthStore } from '/@/renderer/store/auth.store';
import { MobileRadioItem } from '/@/shared/mobile-ui/types';

// Mirrors use-remote-library.tsx's requestRadio handler — one-shot fetch, no
// search/pagination, matching the shared RadioPage container's contract.
export function useMobileRadioList(): MobileRadioItem[] {
    const [items, setItems] = useState<MobileRadioItem[]>([]);

    useEffect(() => {
        const server = useAuthStore.getState().currentServer;
        if (!server) return;

        let cancelled = false;
        queryClient
            .fetchQuery(radioQueries.list({ query: undefined, serverId: server.id }))
            .then((stations) => {
                if (cancelled) return;
                setItems(
                    stations.map((station) => ({
                        homepageUrl: station.homepageUrl,
                        id: station.id,
                        imageUrl: station.imageUrl ?? null,
                        name: station.name,
                    })),
                );
            })
            .catch(() => {
                if (!cancelled) setItems([]);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    return items;
}
