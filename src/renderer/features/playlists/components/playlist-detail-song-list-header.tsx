import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';

import { PageHeader } from '/@/renderer/components/page-header/page-header';
import { useListContext } from '/@/renderer/context/list-context';
import { playlistsQueries } from '/@/renderer/features/playlists/api/playlists-api';
import { PlaylistDetailSongListHeaderFilters } from '/@/renderer/features/playlists/components/playlist-detail-song-list-header-filters';
import { FilterBar } from '/@/renderer/features/shared/components/filter-bar';
import { LibraryHeaderBar } from '/@/renderer/features/shared/components/library-header-bar';
import { ListSearchInput } from '/@/renderer/features/shared/components/list-search-input';
import { useCurrentServer } from '/@/renderer/store';
import { formatDurationString } from '/@/renderer/utils';
import { Stack } from '/@/shared/components/stack/stack';
import { LibraryItem } from '/@/shared/types/domain-types';

interface PlaylistDetailSongListHeaderProps {
    isSmartPlaylist?: boolean;
    onConvertToSmart?: () => void;
    onDelete?: () => void;
    onToggleQueryBuilder?: () => void;
}

export const PlaylistDetailSongListHeader = ({
    isSmartPlaylist: isSmartPlaylistProp,
}: PlaylistDetailSongListHeaderProps) => {
    const { t } = useTranslation();
    const { playlistId } = useParams() as { playlistId: string };
    const { itemCount } = useListContext();
    const server = useCurrentServer();
    const detailQuery = useQuery(
        playlistsQueries.detail({ query: { id: playlistId }, serverId: server?.id }),
    );

    if (detailQuery.isLoading) return null;
    const isSmartPlaylist = isSmartPlaylistProp ?? detailQuery?.data?.rules;
    const playlistDuration = detailQuery?.data?.duration;

    return (
        <Stack gap={0}>
            <PageHeader>
                <LibraryHeaderBar ignoreMaxWidth>
                    <LibraryHeaderBar.PlayButton
                        ids={[playlistId]}
                        itemType={LibraryItem.PLAYLIST}
                    />
                    <LibraryHeaderBar.Title>{detailQuery?.data?.name}</LibraryHeaderBar.Title>
                    {isSmartPlaylist && (
                        <LibraryHeaderBar.Badge>{t('entity.smartPlaylist')}</LibraryHeaderBar.Badge>
                    )}
                    {!!playlistDuration && (
                        <LibraryHeaderBar.Badge>
                            {formatDurationString(playlistDuration)}
                        </LibraryHeaderBar.Badge>
                    )}
                    <LibraryHeaderBar.Badge
                        isLoading={itemCount === null || itemCount === undefined}
                    >
                        {itemCount}
                    </LibraryHeaderBar.Badge>
                </LibraryHeaderBar>
                <ListSearchInput />
            </PageHeader>
            <FilterBar>
                <PlaylistDetailSongListHeaderFilters />
            </FilterBar>
        </Stack>
    );
};
