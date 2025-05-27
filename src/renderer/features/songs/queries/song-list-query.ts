import type { QueryHookArgs } from '/@/renderer/lib/react-query';
import type { SongListQuery } from '/@/shared/types/domain-types';

import { useQuery } from '@tanstack/react-query';

import { controller } from '/@/renderer/api/controller';
import { queryKeys } from '/@/renderer/api/query-keys';
import { getServerById } from '/@/renderer/store';

export const useSongList = (args: QueryHookArgs<SongListQuery>, imageSize?: number) => {
    const { options, query, serverId } = args || {};
    const server = getServerById(serverId);

    return useQuery({
        enabled: !!server?.id,
        queryFn: ({ signal }) => {
            if (!server) throw new Error('Server not found');
            return controller.getSongList({
                apiClientProps: { server, signal },
                query: { ...query, imageSize },
            });
        },
        queryKey: queryKeys.songs.list(server?.id || '', { ...query, imageSize }),
        ...options,
    });
};
