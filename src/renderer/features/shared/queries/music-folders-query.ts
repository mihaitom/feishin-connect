import { useQuery } from '@tanstack/react-query';

import { api } from '/@/renderer/api';
import { queryKeys } from '/@/renderer/api/query-keys';
import { QueryHookArgs } from '/@/renderer/lib/react-query';
import { getServerById } from '/@/renderer/store';
import { MusicFolderListQuery } from '/@/shared/types/domain-types';

export const useMusicFolders = (args: QueryHookArgs<MusicFolderListQuery>) => {
    const { options, serverId } = args || {};
    const server = getServerById(serverId);

    const query = useQuery({
        enabled: !!server,
        queryFn: ({ signal }) => {
            if (!server) throw new Error('Server not found');
            return api.controller.getMusicFolderList({ apiClientProps: { server, signal } });
        },
        queryKey: queryKeys.musicFolders.list(server?.id || ''),
        ...options,
    });

    return query;
};
