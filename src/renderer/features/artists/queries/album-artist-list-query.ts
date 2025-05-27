import type { AlbumArtistListQuery } from '/@/shared/types/domain-types';

import { useQuery } from '@tanstack/react-query';

import { api } from '/@/renderer/api';
import { queryKeys } from '/@/renderer/api/query-keys';
import { QueryHookArgs } from '/@/renderer/lib/react-query';
import { getServerById } from '/@/renderer/store';

export const useAlbumArtistList = (args: QueryHookArgs<AlbumArtistListQuery>) => {
    const { options, query, serverId } = args || {};
    const server = getServerById(serverId);

    return useQuery({
        enabled: !!server?.id,
        queryFn: ({ signal }) => {
            if (!server) throw new Error('Server not found');
            return api.controller.getAlbumArtistList({ apiClientProps: { server, signal }, query });
        },
        queryKey: queryKeys.albumArtists.list(server?.id || '', query),
        ...options,
    });
};
