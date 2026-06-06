import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '/@/renderer/api';
import { useStartScan } from '/@/renderer/features/servers/mutations/start-scan-mutation';
import { clearLibraryScan, markLibraryScanStarted, useLibraryScanStore } from '/@/renderer/store';
import { toast } from '/@/shared/components/toast/toast';

/**
 * Drives a library scan to completion independent of any UI.
 *
 * The scan is triggered from the server-selector dropdown, which unmounts the
 * moment it closes — so polling and the completion toast cannot live there.
 * This component is mounted in the always-present layout and owns the whole
 * lifecycle, reading the request from the global store.
 */
export const LibraryScanWatcher = () => {
    const { t } = useTranslation();
    const serverId = useLibraryScanStore((state) => state.serverId);
    const started = useLibraryScanStore((state) => state.started);
    const token = useLibraryScanStore((state) => state.token);
    const { mutate: startScan } = useStartScan();
    const firedToken = useRef<null | number>(null);

    // Trigger the actual scan once per request, then flip to the polling phase.
    useEffect(() => {
        if (!serverId || started || firedToken.current === token) return;
        firedToken.current = token;
        startScan(
            { apiClientProps: { serverId } },
            {
                onError: () => {
                    toast.error({ message: t('page.manageServers.scanLibraryFailed') });
                    clearLibraryScan();
                },
                onSuccess: () => {
                    toast.success({ message: t('page.manageServers.scanLibraryStarted') });
                    markLibraryScanStarted();
                },
            },
        );
    }, [serverId, started, token, startScan, t]);

    const statusQuery = useQuery({
        enabled: started && !!serverId,
        gcTime: 0,
        queryFn: () => api.controller.getScanStatus!({ apiClientProps: { serverId: serverId! } }),
        queryKey: ['scanStatus', serverId, token],
        refetchInterval: (query) => (query.state.data?.scanning ? 1500 : false),
        staleTime: 0,
    });

    // The scan is done when a fresh poll reports scanning=false.
    useEffect(() => {
        if (!started || !statusQuery.isSuccess) return;
        if (statusQuery.data?.scanning === false) {
            toast.success({ message: t('page.manageServers.scanLibraryComplete') });
            clearLibraryScan();
        }
    }, [started, statusQuery.isSuccess, statusQuery.data?.scanning, statusQuery.dataUpdatedAt, t]);

    return null;
};
