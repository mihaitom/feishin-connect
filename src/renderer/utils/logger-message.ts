import { LogCategory } from '/@/renderer/utils/logger';

export const logMsg = {
    [LogCategory.ANALYTICS]: {
        appTracked: 'App tracked',
        pageViewTracked: 'Page view tracked',
    },
    [LogCategory.API]: {},
    [LogCategory.OTHER]: {},
    [LogCategory.PLAYER]: {},
    [LogCategory.SYSTEM]: {},
};
