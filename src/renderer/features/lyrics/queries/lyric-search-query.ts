import { useQuery } from '@tanstack/react-query';
import isElectron from 'is-electron';

import { queryKeys } from '/@/renderer/api/query-keys';
import { QueryHookArgs } from '/@/renderer/lib/react-query';
import {
    InternetProviderLyricSearchResponse,
    LyricSearchQuery,
    LyricSource,
} from '/@/shared/types/domain-types';

const lyricsIpc = isElectron() ? window.api.lyrics : null;

export const useLyricSearch = (args: Omit<QueryHookArgs<LyricSearchQuery>, 'serverId'>) => {
    const { options, query } = args;

    return useQuery<Record<LyricSource, InternetProviderLyricSearchResponse[]>>({
        cacheTime: 1000 * 60 * 1,
        enabled: !!query.artist || !!query.name,
        queryFn: () => {
            if (lyricsIpc) {
                return lyricsIpc.searchRemoteLyrics(query);
            }
            return {} as Record<LyricSource, InternetProviderLyricSearchResponse[]>;
        },
        queryKey: queryKeys.songs.lyricsSearch(query),
        staleTime: 1000 * 60 * 1,
        ...options,
    });
};
