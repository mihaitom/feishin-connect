import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';

import { api } from '/@/renderer/api';
import { queryKeys } from '/@/renderer/api/query-keys';
import { infiniteLoaderDataQueryKey } from '/@/renderer/components/item-list/helpers/item-list-infinite-loader';
import { MutationHookArgs } from '/@/renderer/lib/react-query';
import {
    CreatePlaylistArgs,
    CreatePlaylistResponse,
    LibraryItem,
} from '/@/shared/types/domain-types';

export const useCreatePlaylist = (args: MutationHookArgs) => {
    const { options } = args || {};
    const queryClient = useQueryClient();

    return useMutation<CreatePlaylistResponse, AxiosError, CreatePlaylistArgs, null>({
        mutationFn: (args) => {
            return api.controller.createPlaylist({
                ...args,
                apiClientProps: { serverId: args.apiClientProps.serverId },
            });
        },
        ...options,
        onSuccess: (data, variables, context) => {
            const { serverId } = variables.apiClientProps;
            queryClient.invalidateQueries({
                exact: false,
                queryKey: queryKeys.playlists.root(serverId),
            });

            queryClient.invalidateQueries({
                exact: false,
                queryKey: infiniteLoaderDataQueryKey(serverId, LibraryItem.PLAYLIST),
            });
            options?.onSuccess?.(data, variables, context);
        },
    });
};
