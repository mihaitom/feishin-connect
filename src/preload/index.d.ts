import { ElectronAPI } from '@electron-toolkit/preload';

import { PreloadApi } from './index';

declare global {
    interface Window {
        api: PreloadApi;
        electron: ElectronAPI;
        queryLocalFonts?: () => Promise<Font[]>;
        LEGACY_AUTHENTICATION?: boolean;
        SERVER_LOCK?: boolean;
        SERVER_NAME?: string;
        SERVER_TYPE?: ServerType;
        SERVER_URL?: string;
    }
}
