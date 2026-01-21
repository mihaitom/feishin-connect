import { useCallback } from 'react';

import { useSetRatingMutation } from '/@/renderer/features/shared/mutations/set-rating-mutation';
import { LibraryItem } from '/@/shared/types/domain-types';

export const useSetRating = () => {
    const setRatingMutation = useSetRatingMutation({});

    const setRating = useCallback(
        (serverId: string, id: string[], itemType: LibraryItem, rating: number) => {
            setRatingMutation.mutate({
                apiClientProps: { serverId },
                query: { id, rating, type: itemType },
            });
        },
        [setRatingMutation],
    );

    return setRating;
};
