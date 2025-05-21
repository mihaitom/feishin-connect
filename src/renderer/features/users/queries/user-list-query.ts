import type { QueryHookArgs } from '/@/renderer/lib/react-query';
import type { UserListQuery } from '/@/shared/types/domain-types';

import { useQuery } from '@tanstack/react-query';

import { api } from '/@/renderer/api';
import { queryKeys } from '/@/renderer/api/query-keys';
import { getServerById } from '/@/renderer/store';

export const useUserList = (args: QueryHookArgs<UserListQuery>) => {
    const { options, query, serverId } = args || {};
    const server = getServerById(serverId);

    return useQuery({
        enabled: !!server,
        queryFn: ({ signal }) => {
            if (!server) throw new Error('Server not found');
            api.controller.getUserList({ apiClientProps: { server, signal }, query });
        },
        queryKey: queryKeys.users.list(server?.id || '', query),
        ...options,
    });
};
