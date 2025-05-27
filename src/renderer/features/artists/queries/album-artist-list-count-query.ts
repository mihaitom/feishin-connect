import { useQuery } from '@tanstack/react-query';

import { api } from '/@/renderer/api';
import { queryKeys } from '/@/renderer/api/query-keys';
import { QueryHookArgs } from '/@/renderer/lib/react-query';
import { getServerById } from '/@/renderer/store';
import { AlbumArtistListQuery } from '/@/shared/types/domain-types';

export const useAlbumArtistListCount = (args: QueryHookArgs<AlbumArtistListQuery>) => {
    const { options, query, serverId } = args;
    const server = getServerById(serverId);

    return useQuery({
        enabled: !!serverId,
        queryFn: ({ signal }) => {
            if (!server) throw new Error('Server not found');
            return api.controller.getAlbumArtistListCount({
                apiClientProps: {
                    server,
                    signal,
                },
                query,
            });
        },
        queryKey: queryKeys.albumArtists.count(
            serverId || '',
            Object.keys(query).length === 0 ? undefined : query,
        ),
        ...options,
    });
};
