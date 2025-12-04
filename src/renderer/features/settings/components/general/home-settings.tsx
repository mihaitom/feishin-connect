import { useMemo } from 'react';

import { DraggableItems } from '/@/renderer/features/settings/components/general/draggable-items';
import {
    HomeItem,
    SortableItem,
    useGeneralSettings,
    useSettingsStoreActions,
} from '/@/renderer/store';

const HOME_ITEMS: Array<[string, string]> = [
    [HomeItem.GENRES, 'page.home.genres'],
    [HomeItem.RANDOM, 'page.home.explore'],
    [HomeItem.RECENTLY_PLAYED, 'page.home.recentlyPlayed'],
    [HomeItem.RECENTLY_ADDED, 'page.home.newlyAdded'],
    [HomeItem.RECENTLY_RELEASED, 'page.home.recentlyReleased'],
    [HomeItem.MOST_PLAYED, 'page.home.mostPlayed'],
];

export const HomeSettings = () => {
    const { homeItems } = useGeneralSettings();
    const { setHomeItems } = useSettingsStoreActions();

    const mergedHomeItems = useMemo(() => {
        const settingsMap = new Map(
            homeItems.map((item) => [item.id, item as SortableItem<HomeItem>]),
        );

        const merged = HOME_ITEMS.map(([itemId]) => {
            const homeItemId = itemId as HomeItem;
            const existing = settingsMap.get(homeItemId);
            if (existing) {
                return {
                    ...existing,
                    id: homeItemId,
                };
            }

            // Item not in settings, add it as disabled
            return {
                disabled: true,
                id: homeItemId,
            };
        });

        // Add any items from settings that aren't in HOME_ITEMS (for backwards compatibility)
        homeItems.forEach((item) => {
            const existsInHomeItems = HOME_ITEMS.some(([itemId]) => itemId === item.id);
            if (!existsInHomeItems) {
                merged.push({
                    ...item,
                    id: item.id as HomeItem,
                });
            }
        });

        return merged;
    }, [homeItems]);

    return (
        <DraggableItems
            description="setting.homeConfiguration"
            itemLabels={HOME_ITEMS}
            setItems={setHomeItems}
            settings={mergedHomeItems}
            title="setting.homeConfiguration"
        />
    );
};
