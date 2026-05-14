import { createContext, useContext } from 'react';

import type { ConnectSession } from './types';

export const ConnectSessionContext = createContext<ConnectSession | null>(null);

export const useConnectSessionContext = (): ConnectSession => {
    const ctx = useContext(ConnectSessionContext);
    if (!ctx) throw new Error('ConnectSessionContext not provided');
    return ctx;
};
