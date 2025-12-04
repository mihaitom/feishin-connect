import { useMemo } from 'react';

import { DraggableItems } from '/@/renderer/features/settings/components/general/draggable-items';
import {
    sidebarItems as defaultSidebarItems,
    useGeneralSettings,
    useSettingsStoreActions,
} from '/@/renderer/store';

const SIDEBAR_ITEMS: Array<[string, string]> = [
    ['Albums', 'page.sidebar.albums'],
    ['Artists', 'page.sidebar.albumArtists'],
    ['Artists-all', 'page.sidebar.artists'],
    ['Favorites', 'page.sidebar.favorites'],
    ['Folders', 'page.sidebar.folders'],
    ['Genres', 'page.sidebar.genres'],
    ['Home', 'page.sidebar.home'],
    ['Now Playing', 'page.sidebar.nowPlaying'],
    ['Playlists', 'page.sidebar.playlists'],
    ['Search', 'page.sidebar.search'],
    ['Settings', 'page.sidebar.settings'],
    ['Tracks', 'page.sidebar.tracks'],
];

export const SidebarReorder = () => {
    const { sidebarItems } = useGeneralSettings();
    const { setSidebarItems } = useSettingsStoreActions();

    const mergedSidebarItems = useMemo(() => {
        const settingsMap = new Map(sidebarItems.map((item) => [item.id, item]));
        const defaultMap = new Map(defaultSidebarItems.map((item) => [item.id, item]));

        const merged = SIDEBAR_ITEMS.map(([itemId]) => {
            const existing = settingsMap.get(itemId);
            if (existing) {
                return {
                    ...existing,
                    id: itemId,
                };
            }

            // Item not in settings, get default values and add it as disabled
            const defaultItem = defaultMap.get(itemId);
            return {
                disabled: true,
                id: itemId,
                label: defaultItem?.label ?? itemId,
                route: defaultItem?.route ?? '',
            };
        });

        // Add any items from settings that aren't in SIDEBAR_ITEMS (for backwards compatibility)
        sidebarItems.forEach((item) => {
            const existsInSidebarItems = SIDEBAR_ITEMS.some(([itemId]) => itemId === item.id);
            if (!existsInSidebarItems) {
                merged.push({
                    ...item,
                    id: item.id,
                });
            }
        });

        return merged;
    }, [sidebarItems]);

    return (
        <DraggableItems
            description="setting.sidebarCollapsedNavigation"
            itemLabels={SIDEBAR_ITEMS}
            setItems={setSidebarItems}
            settings={mergedSidebarItems}
            title="setting.sidebarConfiguration"
        />
    );
};
