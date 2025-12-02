import { createContext, useContext } from 'react';

import { ItemListKey } from '/@/shared/types/types';

interface ListContextProps {
    customFilters?: Record<string, unknown>;
    id?: string;
    itemCount?: number;
    pageKey: ItemListKey | string;
    setItemCount?: (itemCount: number) => void;
}

export const ListContext = createContext<ListContextProps>({
    pageKey: '',
});

export const useListContext = () => {
    const ctxValue = useContext(ListContext);
    return ctxValue;
};
