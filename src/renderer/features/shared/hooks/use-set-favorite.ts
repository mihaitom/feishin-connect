import { useCallback } from 'react';

import { useCreateFavorite } from '/@/renderer/features/shared/mutations/create-favorite-mutation';
import { useDeleteFavorite } from '/@/renderer/features/shared/mutations/delete-favorite-mutation';
import { LibraryItem } from '/@/shared/types/domain-types';

export const useSetFavorite = () => {
    const createFavoriteMutation = useCreateFavorite({});
    const deleteFavoriteMutation = useDeleteFavorite({});

    const setFavorite = useCallback(
        (serverId: string, id: string[], itemType: LibraryItem, isFavorite: boolean) => {
            if (isFavorite) {
                createFavoriteMutation.mutate({
                    apiClientProps: { serverId },
                    query: { id, type: itemType },
                });
            } else {
                deleteFavoriteMutation.mutate({
                    apiClientProps: { serverId },
                    query: { id, type: itemType },
                });
            }
        },
        [createFavoriteMutation, deleteFavoriteMutation],
    );

    return setFavorite;
};
