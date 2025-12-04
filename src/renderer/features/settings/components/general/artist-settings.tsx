import { useMemo } from 'react';

import { DraggableItems } from '/@/renderer/features/settings/components/general/draggable-items';
import {
    ArtistItem,
    SortableItem,
    useGeneralSettings,
    useSettingsStoreActions,
} from '/@/renderer/store';

const ARTIST_ITEMS: Array<[ArtistItem, string]> = [
    [ArtistItem.BIOGRAPHY, 'table.column.biography'],
    [ArtistItem.TOP_SONGS, 'page.albumArtistDetail.topSongs'],
    [ArtistItem.RECENT_ALBUMS, 'page.albumArtistDetail.recentReleases'],
    [ArtistItem.COMPILATIONS, 'page.albumArtistDetail.appearsOn'],
    [ArtistItem.SIMILAR_ARTISTS, 'page.albumArtistDetail.relatedArtists'],
];

export const ArtistSettings = () => {
    const { artistItems } = useGeneralSettings();
    const { setArtistItems } = useSettingsStoreActions();

    const mergedArtistItems = useMemo(() => {
        const settingsMap = new Map(
            artistItems.map((item) => [item.id, item as SortableItem<ArtistItem>]),
        );

        const merged = ARTIST_ITEMS.map(([itemId]) => {
            const artistItemId = itemId as ArtistItem;
            const existing = settingsMap.get(artistItemId);
            if (existing) {
                return {
                    ...existing,
                    id: artistItemId,
                };
            }

            // Item not in settings, add it as disabled
            return {
                disabled: true,
                id: artistItemId,
            };
        });

        // Add any items from settings that aren't in ARTIST_ITEMS (for backwards compatibility)
        artistItems.forEach((item) => {
            const existsInArtistItems = ARTIST_ITEMS.some(([itemId]) => itemId === item.id);
            if (!existsInArtistItems) {
                merged.push({
                    ...item,
                    id: item.id as ArtistItem,
                });
            }
        });

        return merged;
    }, [artistItems]);

    return (
        <DraggableItems
            description="setting.artistConfiguration"
            itemLabels={ARTIST_ITEMS}
            setItems={setArtistItems}
            settings={mergedArtistItems}
            title="setting.artistConfiguration"
        />
    );
};
