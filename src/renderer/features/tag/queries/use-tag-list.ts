import { useQuery } from '@tanstack/react-query';

import { api } from '/@/renderer/api';
import { ServerFeature } from '/@/renderer/api/features-types';
import { queryKeys } from '/@/renderer/api/query-keys';
import { TagQuery } from '/@/renderer/api/types';
import { hasFeature } from '/@/renderer/api/utils';
import { QueryHookArgs } from '/@/renderer/lib/react-query';
import { getServerById } from '/@/renderer/store';

export const useTagList = (args: QueryHookArgs<TagQuery>) => {
    const { options, query, serverId } = args || {};
    const server = getServerById(serverId);

    return useQuery({
        enabled: !!server && hasFeature(server, ServerFeature.TAGS),
        queryFn: ({ signal }) => {
            if (!server) throw new Error('Server not found');
            return api.controller.getTags({ apiClientProps: { server, signal }, query });
        },
        queryKey: queryKeys.tags.list(server?.id || '', query.type),
        staleTime: 1000 * 60,
        ...options,
    });
};
