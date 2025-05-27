import { createContext } from 'react';

import { PlayQueueAddOptions } from '/@/shared/types/types';

export const PlayQueueHandlerContext = createContext<{
    handlePlayQueueAdd: ((options: PlayQueueAddOptions) => void) | undefined;
}>({
    handlePlayQueueAdd: undefined,
});
