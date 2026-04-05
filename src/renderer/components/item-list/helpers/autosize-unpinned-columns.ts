import { ItemTableListColumnConfig } from '/@/renderer/components/item-list/types';

// Automatically set autoSize for all unpinned columns when auto-fit is off
// This is a view-only helper and does not persist to settings
export const autoSizeUnpinnedColumns = (
    columns: ItemTableListColumnConfig[],
    autoFitColumns: boolean,
): ItemTableListColumnConfig[] => {
    if (autoFitColumns || columns.length === 0) {
        return columns;
    }

    const unpinnedEnabled = columns.filter((c) => c.pinned === null && c.isEnabled !== false);
    if (unpinnedEnabled.length === 0) {
        return columns;
    }
    if (unpinnedEnabled.some((c) => c.autoSize === true)) {
        return columns;
    }

    const idSet = new Set(unpinnedEnabled.map((c) => c.id));
    return columns.map((c) => (idSet.has(c.id) ? { ...c, autoSize: true } : c));
};
