import { useQuery } from '@tanstack/react-query';
import { QueryHookArgs } from '/@/renderer/lib/react-query';
import { getServerById } from '/@/renderer/store';
import { api } from '/@/renderer/api';
import { queryKeys } from '/@/renderer/api/query-keys';
import { hasFeature } from '/@/renderer/api/utils';
import { ServerFeature } from '/@/renderer/api/features-types';
import { TagQuery } from '/@/renderer/api/types';

export const useTagList = (args: QueryHookArgs<TagQuery>) => {
    const { query, options, serverId } = args || {};
    const server = getServerById(serverId);

    return useQuery({
        enabled: !!server && hasFeature(server, ServerFeature.TAGS),
        queryFn: ({ signal }) => {
            if (!server) throw new Error('Server not found');
            return api.controller.getTags({ apiClientProps: { server, signal }, query });
        },
        queryKey: queryKeys.tags.list(server?.id || ''),
        staleTime: 1000 * 60,
        ...options,
    });
};
