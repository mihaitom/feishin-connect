// Auto-updates target this fork's own GitHub releases (see main/index.ts) — this
// is purely an opt-out for self-hosters who don't want the app to check GitHub
// at all (e.g. a private/internal build). Most users don't need to set this.
export const disableAutoUpdates = () => {
    return Boolean(process.env['DISABLE_AUTO_UPDATES']);
};

export const isMacOS = () => {
    return process.platform === 'darwin';
};

export const isWindows = () => {
    return process.platform === 'win32';
};

export const isLinux = () => {
    return process.platform === 'linux';
};
