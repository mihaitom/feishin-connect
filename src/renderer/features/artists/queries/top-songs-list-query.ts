import type { QueryHookArgs } from '/@/renderer/lib/react-query';
import type { TopSongListQuery } from '/@/shared/types/domain-types';

import { useQuery } from '@tanstack/react-query';

import { api } from '/@/renderer/api';
import { queryKeys } from '/@/renderer/api/query-keys';
import { getServerById } from '/@/renderer/store';

export const useTopSongsList = (args: QueryHookArgs<TopSongListQuery>) => {
    const { options, query, serverId } = args || {};
    const server = getServerById(serverId);

    return useQuery({
        enabled: !!server?.id,
        queryFn: ({ signal }) => {
            if (!server) throw new Error('Server not found');
            return api.controller.getTopSongs({ apiClientProps: { server, signal }, query });
        },
        queryKey: queryKeys.albumArtists.topSongs(server?.id || '', query),
        ...options,
    });
};
