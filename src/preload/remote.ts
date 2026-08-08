import { ipcRenderer } from 'electron';

import { QueueSong } from '/@/shared/types/domain-types';
import { RemoteConnectDevice, RemoteConnectDeviceRef } from '/@/shared/types/remote-types';
import { PlayerStatus } from '/@/shared/types/types';

const requestConnectConnect = (
    cb: (data: { devices: RemoteConnectDeviceRef[]; force: boolean }) => void,
) => {
    ipcRenderer.on('request-connect-connect', (_, data) => cb(data));
};

const requestConnectDisconnect = (cb: (data: { device?: RemoteConnectDeviceRef }) => void) => {
    ipcRenderer.on('request-connect-disconnect', (_, data) => cb(data));
};

const requestConnectDiscover = (cb: (data: { fresh?: boolean }) => void) => {
    ipcRenderer.on('request-connect-discover', (_, data) => cb(data));
};

const requestConnectSetVolume = (
    cb: (data: { device: RemoteConnectDeviceRef; volume: number }) => void,
) => {
    ipcRenderer.on('request-connect-set-volume', (_, data) => cb(data));
};

const requestFavorite = (
    cb: (data: { favorite: boolean; id: string; serverId: string }) => void,
) => {
    ipcRenderer.on('request-favorite', (_, data) => cb(data));
};

const requestPosition = (cb: (data: { position: number }) => void) => {
    ipcRenderer.on('request-position', (_, data) => cb(data));
};

const requestRating = (cb: (data: { id: string; rating: number; serverId: string }) => void) => {
    ipcRenderer.on('request-rating', (_, data) => cb(data));
};

const requestSeek = (cb: (data: { offset: number }) => void) => {
    ipcRenderer.on('request-seek', (_, data) => cb(data));
};

const requestVolume = (cb: (data: { volume: number }) => void) => {
    ipcRenderer.on('request-volume', (_, data) => cb(data));
};

const setRemoteEnabled = (enabled: boolean): Promise<null | string> => {
    const result = ipcRenderer.invoke('remote-enable', enabled);
    return result;
};

const setRemotePort = (port: number): Promise<null | string> => {
    const result = ipcRenderer.invoke('remote-port', port);
    return result;
};

const updateConnectDevices = (devices: RemoteConnectDevice[]) => {
    ipcRenderer.send('update-connect-devices', devices);
};

const updateConnectState = (state: {
    activeTargets: RemoteConnectDevice[];
    isActive: boolean;
    mySessionId: string;
}) => {
    ipcRenderer.send('update-connect-state', state);
};

const sendConnectError = (message: string) => {
    ipcRenderer.send('remote-connect-error', message);
};

const updateFavorite = (favorite: boolean, serverId: string, ids: string[]) => {
    ipcRenderer.send('update-favorite', favorite, serverId, ids);
};

const updatePassword = (password: string) => {
    ipcRenderer.send('remote-password', password);
};

const updatePlayback = (playback: PlayerStatus) => {
    ipcRenderer.send('update-playback', playback);
};

const updateSetting = (
    enabled: boolean,
    port: number,
    username: string,
    password: string,
): Promise<null | string> => {
    return ipcRenderer.invoke('remote-settings', enabled, port, username, password);
};

const updateRating = (rating: number, serverId: string, ids: string[]) => {
    ipcRenderer.send('update-rating', rating, serverId, ids);
};

const updateRepeat = (repeat: string) => {
    ipcRenderer.send('update-repeat', repeat);
};

const updateShuffle = (shuffle: boolean) => {
    ipcRenderer.send('update-shuffle', shuffle);
};

const updateSong = (song: QueueSong | undefined, imageUrl?: null | string) => {
    ipcRenderer.send('update-song', song, imageUrl);
};

const updateUsername = (username: string) => {
    ipcRenderer.send('remote-username', username);
};

const updateVolume = (volume: number) => {
    ipcRenderer.send('update-volume', volume);
};

const updatePosition = (timeSec: number) => {
    ipcRenderer.send('update-position', timeSec);
};

export const remote = {
    requestConnectConnect,
    requestConnectDisconnect,
    requestConnectDiscover,
    requestConnectSetVolume,
    requestFavorite,
    requestPosition,
    requestRating,
    requestSeek,
    requestVolume,
    sendConnectError,
    setRemoteEnabled,
    setRemotePort,
    updateConnectDevices,
    updateConnectState,
    updateFavorite,
    updatePassword,
    updatePlayback,
    updatePosition,
    updateRating,
    updateRepeat,
    updateSetting,
    updateShuffle,
    updateSong,
    updateUsername,
    updateVolume,
};

export type Remote = typeof remote;
