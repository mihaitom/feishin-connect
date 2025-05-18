import type { PlaylistDetailQuery } from '/@/renderer/api/types';
import type { QueryHookArgs } from '/@/renderer/lib/react-query';

import { useQuery } from '@tanstack/react-query';

import { api } from '/@/renderer/api';
import { queryKeys } from '/@/renderer/api/query-keys';
import { getServerById } from '/@/renderer/store';

export const usePlaylistDetail = (args: QueryHookArgs<PlaylistDetailQuery>) => {
    const { options, query, serverId } = args || {};
    const server = getServerById(serverId);

    return useQuery({
        enabled: !!server?.id,
        queryFn: ({ signal }) => {
            if (!server) throw new Error('Server not found');
            return api.controller.getPlaylistDetail({ apiClientProps: { server, signal }, query });
        },
        queryKey: queryKeys.playlists.detail(server?.id || '', query.id, query),
        ...options,
    });
};
