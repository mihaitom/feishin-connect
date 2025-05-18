import { useMutation } from '@tanstack/react-query';
import { AxiosError } from 'axios';

import { api } from '/@/renderer/api';
import { AnyLibraryItems, ShareItemArgs, ShareItemResponse } from '/@/renderer/api/types';
import { MutationHookArgs } from '/@/renderer/lib/react-query';
import { getServerById } from '/@/renderer/store';

export const useShareItem = (args: MutationHookArgs) => {
    const { options } = args || {};

    return useMutation<
        ShareItemResponse,
        AxiosError,
        Omit<ShareItemArgs, 'apiClientProps' | 'server'>,
        { previous: undefined | { items: AnyLibraryItems } }
    >({
        mutationFn: (args) => {
            const server = getServerById(args.serverId);
            if (!server) throw new Error('Server not found');
            return api.controller.shareItem({ ...args, apiClientProps: { server } });
        },
        ...options,
    });
};
