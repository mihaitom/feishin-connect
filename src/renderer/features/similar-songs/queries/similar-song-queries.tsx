import { useQuery } from '@tanstack/react-query';

import { api } from '/@/renderer/api';
import { queryKeys } from '/@/renderer/api/query-keys';
import { QueryHookArgs } from '/@/renderer/lib/react-query';
import { getServerById } from '/@/renderer/store';
import { SimilarSongsQuery } from '/@/shared/types/domain-types';

export const useSimilarSongs = (args: QueryHookArgs<SimilarSongsQuery>) => {
    const { options, query, serverId } = args || {};
    const server = getServerById(serverId);

    return useQuery({
        enabled: !!server,
        queryFn: ({ signal }) => {
            if (!server) throw new Error('Server not found');

            return api.controller.getSimilarSongs({
                apiClientProps: { server, signal },
                query: {
                    albumArtistIds: query.albumArtistIds,
                    count: query.count ?? 50,
                    songId: query.songId,
                },
            });
        },
        queryKey: queryKeys.songs.similar(server?.id || '', query),
        ...options,
    });
};
