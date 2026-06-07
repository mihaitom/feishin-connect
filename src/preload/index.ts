import { contextBridge, webUtils } from 'electron';

import { autodiscover } from './autodiscover';
import { browser } from './browser';
import { discordRpc } from './discord-rpc';
import { ipc } from './ipc';
import { localSettings } from './local-settings';
import { lyrics } from './lyrics';
import { mpris } from './mpris';
import { mpvPlayer, mpvPlayerListener } from './mpv-player';
import { remote } from './remote';
import { utils } from './utils';
import { visualizer } from './visualizer';

// Custom APIs for renderer
const api = {
    autodiscover,
    browser,
    discordRpc,
    getPathForFile: webUtils.getPathForFile,
    ipc,
    localSettings,
    lyrics,
    mpris,
    mpvPlayer,
    mpvPlayerListener,
    remote,
    utils,
    visualizer,
};

export type PreloadApi = typeof api;

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
const connectUrl = `http://localhost:${process.env['CONNECT_PORT'] || '9181'}`;

if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld('api', api);
        contextBridge.exposeInMainWorld('__CONNECT_TOKEN__', process.env['CONNECT_TOKEN'] || '');
        contextBridge.exposeInMainWorld('__CONNECT_URL__', connectUrl);
    } catch (error) {
        console.error(error);
    }
} else {
    // @ts-ignore (define in dts)
    window.api = api;
    (window as any).__CONNECT_TOKEN__ = process.env['CONNECT_TOKEN'] || '';
    (window as any).__CONNECT_URL__ = connectUrl;
}
