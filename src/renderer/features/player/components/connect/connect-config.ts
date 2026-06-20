import { ServerType } from '/@/shared/types/types';

export const buildConfigBody = (server: {
    credential?: string;
    type?: ServerType;
    url?: string;
    userId?: null | string;
}) => ({
    credential: server.credential ?? '',
    server_type: server.type === ServerType.JELLYFIN ? 'jellyfin' : 'subsonic',
    url: server.url ?? '',
    user_id: server.userId ?? '',
});
