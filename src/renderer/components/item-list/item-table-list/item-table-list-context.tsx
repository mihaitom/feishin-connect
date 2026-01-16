import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { useSyncExternalStore } from 'react';

import { ItemListStateActions } from '/@/renderer/components/item-list/helpers/item-list-state';
import { ItemControls, ItemTableListColumnConfig } from '/@/renderer/components/item-list/types';
import { PlayerContext } from '/@/renderer/features/player/context/player-context';
import { LibraryItem } from '/@/shared/types/domain-types';

/**
 * Stage A/B: Provide table-scoped config + external stores so churny values can update
 * without forcing `cellProps` identity changes (and therefore without rerendering every visible cell).
 */

export type ItemTableListConfig = {
    cellPadding: 'lg' | 'md' | 'sm' | 'xl' | 'xs';
    columns: ItemTableListColumnConfig[];
    controls: ItemControls;
    enableHeader: boolean;
    enableRowHoverHighlight: boolean;
    enableSelection: boolean;
    internalState: ItemListStateActions;
    itemType: LibraryItem;
    playerContext: PlayerContext;
    size: 'compact' | 'default' | 'large';
    startRowIndex?: number;
    tableId: string;
};

const ItemTableListConfigContext = createContext<ItemTableListConfig | null>(null);

export const ItemTableListConfigProvider = ({
    children,
    value,
}: {
    children: React.ReactNode;
    value: ItemTableListConfig;
}) => {
    // Keep reference stable when the input reference is stable.
    const memoValue = useMemo(() => value, [value]);
    return (
        <ItemTableListConfigContext.Provider value={memoValue}>
            {children}
        </ItemTableListConfigContext.Provider>
    );
};

export const useItemTableListConfig = (): ItemTableListConfig | null => {
    return useContext(ItemTableListConfigContext);
};

type ItemTableListStoreContextValue = {
    activeRowStore: ActiveRowStore;
};

class ActiveRowStore {
    private activeRowId: null | string = null;
    private listeners = new Set<() => void>();

    getActiveRowId(): null | string {
        return this.activeRowId;
    }

    setActiveRowId(next: null | string | undefined): void {
        const normalized = next ?? null;
        if (this.activeRowId === normalized) return;
        this.activeRowId = normalized;
        this.listeners.forEach((l) => l());
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
}

const ItemTableListStoreContext = createContext<ItemTableListStoreContextValue | null>(null);

export const ItemTableListStoreProvider = ({
    activeRowId,
    children,
}: {
    activeRowId?: string;
    children: React.ReactNode;
}) => {
    const storeRef = useRef<ActiveRowStore | null>(null);
    if (!storeRef.current) {
        storeRef.current = new ActiveRowStore();
    }
    const store = storeRef.current;

    useEffect(() => {
        store.setActiveRowId(activeRowId);
    }, [activeRowId, store]);

    const value = useMemo<ItemTableListStoreContextValue>(
        () => ({ activeRowStore: store }),
        [store],
    );

    return (
        <ItemTableListStoreContext.Provider value={value}>
            {children}
        </ItemTableListStoreContext.Provider>
    );
};

export const useItemTableListStore = (): ItemTableListStoreContextValue | null => {
    return useContext(ItemTableListStoreContext);
};

export const useActiveRowSubscription = <T,>(selector: (activeRowId: null | string) => T): T => {
    const store = useItemTableListStore()?.activeRowStore ?? null;

    return useSyncExternalStore(store?.subscribe.bind(store) || (() => () => {}), () =>
        selector(store?.getActiveRowId() ?? null),
    );
};

export const useIsActiveRow = (...rowIds: Array<string | undefined>): boolean => {
    return useActiveRowSubscription((activeRowId) =>
        rowIds.some((id) => !!id && id === activeRowId),
    );
};
