import { useMemo, useState } from 'react';
import { useParams } from 'react-router';

import { ListContext } from '/@/renderer/context/list-context';
import { AnimatedPage } from '/@/renderer/features/shared/components/animated-page';
import { LibraryContainer } from '/@/renderer/features/shared/components/library-container';
import { PageErrorBoundary } from '/@/renderer/features/shared/components/page-error-boundary';
import { SongListContent } from '/@/renderer/features/songs/components/song-list-content';
import { SongListHeader } from '/@/renderer/features/songs/components/song-list-header';
import { SongListQuery } from '/@/shared/types/domain-types';
import { ItemListKey } from '/@/shared/types/types';

const getPageKey = (options: { albumArtistId?: string; genreId?: string }) => {
    if (options.albumArtistId) {
        return ItemListKey.ALBUM_ARTIST_SONG;
    }

    if (options.genreId) {
        return ItemListKey.GENRE_SONG;
    }

    return ItemListKey.SONG;
};

const SongListRoute = () => {
    const { albumArtistId, genreId } = useParams();
    const pageKey = getPageKey({ albumArtistId, genreId });

    const [itemCount, setItemCount] = useState<number | undefined>(undefined);

    const customFilters: Partial<SongListQuery> = useMemo(() => {
        return {
            artistIds: albumArtistId ? [albumArtistId] : undefined,
            genreIds: genreId ? [genreId] : undefined,
        };
    }, [albumArtistId, genreId]);

    const providerValue = useMemo(() => {
        return {
            customFilters,
            id: albumArtistId ?? genreId,
            itemCount,
            pageKey,
            setItemCount,
        };
    }, [albumArtistId, customFilters, genreId, itemCount, pageKey]);

    return (
        <AnimatedPage>
            <ListContext.Provider value={providerValue}>
                <LibraryContainer>
                    <SongListHeader />
                    <SongListContent />
                </LibraryContainer>
            </ListContext.Provider>
        </AnimatedPage>
    );
};

const SongListRouteWithBoundary = () => {
    return (
        <PageErrorBoundary>
            <SongListRoute />
        </PageErrorBoundary>
    );
};

export default SongListRouteWithBoundary;
