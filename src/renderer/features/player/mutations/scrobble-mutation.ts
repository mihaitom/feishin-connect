import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';

import { api } from '/@/renderer/api';
import { queryKeys } from '/@/renderer/api/query-keys';
import { MutationOptions } from '/@/renderer/lib/react-query';
import { incrementQueuePlayCount } from '/@/renderer/store/player.store';
import { ScrobbleArgs, ScrobbleResponse } from '/@/shared/types/domain-types';

export const useSendScrobble = (options?: MutationOptions) => {
    const queryClient = useQueryClient();

    return useMutation<ScrobbleResponse, AxiosError, ScrobbleArgs, null>({
        mutationFn: (args) => {
            return api.controller.scrobble({
                ...args,
                apiClientProps: { serverId: args.apiClientProps.serverId },
            });
        },
        onSuccess: (_data, variables) => {
            // Manually increment the play count for the song in the queue if scrobble was submitted
            if (variables.query.submission) {
                incrementQueuePlayCount([variables.query.id]);

                // Invalidate the album detail query for the song's album
                if (variables.query.albumId && variables.apiClientProps.serverId) {
                    queryClient.invalidateQueries({
                        queryKey: queryKeys.albums.detail(variables.apiClientProps.serverId, {
                            id: variables.query.albumId,
                        }),
                    });
                }
            }
        },
        ...options,
    });
};
