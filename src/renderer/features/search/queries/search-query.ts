import { useQuery } from '@tanstack/react-query';

import { api } from '/@/renderer/api';
import { queryKeys } from '/@/renderer/api/query-keys';
import { QueryHookArgs } from '/@/renderer/lib/react-query';
import { getServerById } from '/@/renderer/store';
import { SearchQuery } from '/@/shared/types/domain-types';

export const useSearch = (args: QueryHookArgs<SearchQuery>) => {
    const { options, query, serverId } = args;
    const server = getServerById(serverId);

    return useQuery({
        enabled: !!serverId,
        queryFn: ({ signal }) => {
            if (!server) throw new Error('Server not found');
            return api.controller.search({
                apiClientProps: {
                    server,
                    signal,
                },
                query,
            });
        },
        queryKey: queryKeys.search.list(serverId || '', query),
        ...options,
    });
};
