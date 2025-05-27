import type { QueryHookArgs } from '/@/renderer/lib/react-query';
import type { AlbumDetailQuery } from '/@/shared/types/domain-types';

import { useQuery } from '@tanstack/react-query';

import { controller } from '/@/renderer/api/controller';
import { queryKeys } from '/@/renderer/api/query-keys';
import { getServerById } from '/@/renderer/store';

export const useAlbumDetail = (args: QueryHookArgs<AlbumDetailQuery>) => {
    const { options, query, serverId } = args;
    const server = getServerById(serverId);

    return useQuery({
        queryFn: ({ signal }) => {
            if (!server) throw new Error('Server not found');
            return controller.getAlbumDetail({ apiClientProps: { server, signal }, query });
        },
        queryKey: queryKeys.albums.detail(server?.id || '', query),
        ...options,
    });
};
