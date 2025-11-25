import { useMemo, useState } from 'react';

import { ListContext } from '/@/renderer/context/list-context';
import { AnimatedPage } from '/@/renderer/features/shared/components/animated-page';
import { LibraryContainer } from '/@/renderer/features/shared/components/library-container';
import { PageErrorBoundary } from '/@/renderer/features/shared/components/page-error-boundary';
import { SongListContent } from '/@/renderer/features/songs/components/song-list-content';
import { SongListHeader } from '/@/renderer/features/songs/components/song-list-header';

const SongListRoute = () => {
    const pageKey = 'song';

    const [itemCount, setItemCount] = useState<number | undefined>(undefined);

    const providerValue = useMemo(() => {
        return {
            id: undefined,
            itemCount,
            pageKey,
            setItemCount,
        };
    }, [itemCount, pageKey, setItemCount]);

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
