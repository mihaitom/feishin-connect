import { ServerType } from '/@/shared/types/types';

export const buildConfigBody = (server: {
    credential?: string;
    displayName?: string;
    type?: ServerType;
    url?: string;
    userId?: null | string;
    username?: string;
}) => ({
    credential: server.credential ?? '',
    server_type: server.type === ServerType.JELLYFIN ? 'jellyfin' : 'subsonic',
    url: server.url ?? '',
    user_id: server.userId ?? '',
    // displayName (Navidrome's separate "Name" field) is shown to other Connect
    // sessions as "in use by {name}" — falls back to username where no display
    // name exists (Jellyfin, plain Subsonic).
    username: server.displayName || server.username || '',
});
