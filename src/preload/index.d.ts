import { PreloadApi } from './index';

declare global {
    interface Window {
        __CONNECT_TOKEN__: string;
        __CONNECT_URL__: string;
        api: PreloadApi;
        LEGACY_AUTHENTICATION?: boolean;
        queryLocalFonts?: () => Promise<Font[]>;
        REMOTE_URL?: string;
        SERVER_LOCK?: boolean;
        SERVER_NAME?: string;
        SERVER_TYPE?: ServerType;
        SERVER_URL?: string;
    }
}
