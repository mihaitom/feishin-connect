import { ElectronAPI } from '@electron-toolkit/preload';

import { PreloadApi } from './index';

declare global {
    interface Window {
        api: PreloadApi;
        electron: ElectronAPI;
    }
}
