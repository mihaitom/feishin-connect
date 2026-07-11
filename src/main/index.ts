import { is } from '@electron-toolkit/utils';
import { ChildProcess, spawn } from 'child_process';
import { randomBytes } from 'crypto';
import {
    app,
    BrowserWindow,
    BrowserWindowConstructorOptions,
    desktopCapturer,
    globalShortcut,
    ipcMain,
    Menu,
    nativeImage,
    nativeTheme,
    net,
    powerSaveBlocker,
    protocol,
    Rectangle,
    screen,
    session,
    shell,
    Tray,
} from 'electron';
import electronLocalShortcut from 'electron-localshortcut';
import log from 'electron-log/main';
import { autoUpdater } from 'electron-updater';
import { access, constants, existsSync } from 'fs';
import { request as httpRequest } from 'http';
import { createServer } from 'net';
import path, { join } from 'path';

import { disableMediaKeys, enableMediaKeys } from './features/core/player/media-keys';
import { shutdownServer } from './features/core/remote';
import { store } from './features/core/settings';
import { canHandleVisualizerDisplayMedia } from './features/core/visualizer';
import MenuBuilder, { MenuPlaybackState } from './menu';
import './features';
import { autoUpdaterLogInterface, createLog, hotkeyToElectronAccelerator } from './utils';

import { disableAutoUpdates, isLinux, isMacOS, isWindows } from '/@/main/env';
import { PlayerRepeat, PlayerStatus, PlayerType, TitleTheme } from '/@/shared/types/types';

class AppUpdater {
    constructor() {
        configureUpdater();
        if (isMacOS()) {
            autoUpdater.autoDownload = false;
            autoUpdater
                .checkForUpdates()
                .then((result) => {
                    if (result?.isUpdateAvailable) {
                        getMainWindow()?.webContents.send(
                            'update-available',
                            result.updateInfo.version,
                        );
                    }
                })
                .catch((err) => console.error('Check for updates failed', err));
        } else {
            autoUpdater.checkForUpdatesAndNotify();
        }
    }
}

// Auto-updates only ever target this fork's own GitHub releases (mihaitom/feishin-connect,
// "latest" channel — see electron-builder.yml's `publish` config, which is what
// electron-updater reads by default). There is no alpha/beta channel anymore —
// upstream's nightly (S3) and beta (their own GitHub repo) channels never made
// sense for a fork and were previously misconfigured to point at upstream's
// infrastructure, risking silently overwriting the Connect feature.
function configureUpdater(): void {
    log.transports.file.level = 'info';
    autoUpdater.logger = autoUpdaterLogInterface;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.autoRunAppAfterInstall = true;
}

protocol.registerSchemesAsPrivileged([
    { privileges: { bypassCSP: true, corsEnabled: true }, scheme: 'feishin' },
]);

// ── Connect backend process ───────────────────────────────────────────────────

// Generated once at startup. Passed to the Python process via CONNECT_TOKEN env var
// and exposed to the renderer via the preload script (window.__CONNECT_TOKEN__).
const connectToken = randomBytes(32).toString('hex');
process.env['CONNECT_TOKEN'] = connectToken;

let connectProcess: ChildProcess | null = null;
let connectPort = 9181;

const findFreePort = (): Promise<number> =>
    new Promise((resolve, reject) => {
        const srv = createServer();
        srv.unref();
        srv.on('error', reject);
        srv.listen(0, '127.0.0.1', () => {
            const { port } = srv.address() as { port: number };
            srv.close(() => resolve(port));
        });
    });

const startConnectServer = () => {
    const portStr = String(connectPort);
    // Passed to the backend so persistent files (e.g. AirPlay pairing credentials)
    // are written to a stable per-user directory instead of next to the binary —
    // the packaged binary's own folder gets replaced wholesale on every app update.
    const connectDataDir = app.getPath('userData');

    if (app.isPackaged) {
        // Production: use the PyInstaller binary bundled in extraResources
        const binaryName = isWindows() ? 'connect-server.exe' : 'connect-server';
        const binaryPath = join(process.resourcesPath, 'connect-server', binaryName);

        if (!existsSync(binaryPath)) {
            log.warn(`[Connect] Binary nicht gefunden: ${binaryPath}`);
            return;
        }

        connectProcess = spawn(binaryPath, [], {
            env: { ...process.env, CONNECT_DATA_DIR: connectDataDir, PORT: portStr },
            stdio: ['ignore', 'pipe', 'pipe'],
        });
    } else {
        // Development: run via uv from the connect/ source directory
        const connectDir = join(app.getAppPath(), 'connect');
        connectProcess = spawn('uv', ['run', 'python', 'main.py'], {
            cwd: connectDir,
            env: { ...process.env, CONNECT_DATA_DIR: connectDataDir, PORT: portStr },
            stdio: ['ignore', 'pipe', 'pipe'],
        });
    }

    connectProcess.stdout?.on('data', (data: Buffer) => {
        for (const line of data.toString().split('\n')) {
            if (line.trim()) log.info(`[Connect] ${line.trimEnd()}`);
        }
    });
    connectProcess.stderr?.on('data', (data: Buffer) => {
        for (const line of data.toString().split('\n')) {
            if (line.trim()) log.warn(`[Connect] ${line.trimEnd()}`);
        }
    });
    connectProcess.on('error', (err) => {
        log.error(`[Connect] Fehler beim Starten: ${err.message}`);
    });
    connectProcess.on('exit', (code, signal) => {
        log.info(`[Connect] Prozess beendet (code=${code}, signal=${signal})`);
        connectProcess = null;
    });

    log.info(`[Connect] Backend gestartet (port=${portStr})`);
};

const killConnectServer = () => {
    if (connectProcess) {
        connectProcess.kill();
        connectProcess = null;
    }
};

// Fire-and-forget HTTP stop + process kill before the app exits.
const stopConnect = () => {
    try {
        const req = httpRequest({
            headers: { 'X-Connect-Token': connectToken },
            host: '127.0.0.1',
            method: 'POST',
            path: '/stop',
            port: connectPort,
            timeout: 800,
        });
        req.on('error', () => {});
        req.end();
    } catch {
        // ignore — backend may not be running
    }
    killConnectServer();
};

process.on('uncaughtException', (error: any) => {
    console.error('Error in main process', error);
});

if (store.get('ignore_ssl')) {
    app.commandLine.appendSwitch('ignore-certificate-errors');
}

// From https://github.com/tutao/tutanota/commit/92c6ed27625fcf367f0fbcc755d83d7ff8fde94b
if (isLinux() && !process.argv.some((a) => a.startsWith('--password-store='))) {
    const passwordStore = store.get('password_store', 'gnome-libsecret') as string;
    app.commandLine.appendSwitch('password-store', passwordStore);
}

let mainWindow: BrowserWindow | null = null;
let tray: null | Tray = null;
let exitFromTray = false;
let forceQuit = false;
let powerSaveBlockerId: null | number = null;
let menuBuilder: MenuBuilder | null = null;
let currentPlaybackStatus: PlayerStatus = PlayerStatus.PAUSED;
let currentPrivateMode = false;
let currentRepeatMode: PlayerRepeat = PlayerRepeat.NONE;
let currentSidebarCollapsed = false;
let currentShuffleEnabled = false;
let playbackMenuAccelerators: MenuPlaybackState['accelerators'] = {};
let inputFocused = false;

ipcMain.on('input-focus-state', (_event, focused: boolean) => {
    const next = !!focused;
    if (inputFocused === next) return;
    inputFocused = next;
    if (isMacOS()) {
        rebuildMainMenu();
    }
});

if (process.env.NODE_ENV === 'production') {
    import('source-map-support').then((sourceMapSupport) => {
        sourceMapSupport.install();
    });
}

const isDevelopment = process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDevelopment) {
    import('electron-debug').then((electronDebug) => {
        electronDebug.default();
    });
}

const installExtensions = async () => {
    import('electron-devtools-installer').then((installer) => {
        const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
        const extensions = ['REACT_DEVELOPER_TOOLS', 'REDUX_DEVTOOLS'];

        installer
            .installExtension(
                extensions.map((name) => installer[name]),
                { forceDownload },
            )
            .then((installedExtensions) => {
                createLog({
                    message: `Installed extension: ${installedExtensions}`,
                    type: 'info',
                });
            })
            .catch(() => {
                // Ignore
            });
    });
};

const userDataPath = app.getPath('userData');

if (isDevelopment) {
    const devUserDataPath = `${userDataPath}-dev`;
    app.setPath('userData', devUserDataPath);
}

const RESOURCES_PATH = app.isPackaged
    ? path.join(path.dirname(app.getAppPath()), 'assets')
    : path.join(__dirname, '../../assets');

const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
};

export const getMainWindow = () => {
    return mainWindow;
};

const rebuildMainMenu = () => {
    if (!menuBuilder || !mainWindow) return;

    menuBuilder.buildMenu({
        accelerators: inputFocused ? {} : playbackMenuAccelerators,
        playbackStatus: currentPlaybackStatus,
        privateMode: currentPrivateMode,
        repeatMode: currentRepeatMode,
        shuffleEnabled: currentShuffleEnabled,
        sidebarCollapsed: currentSidebarCollapsed,
    });

    if (process.platform !== 'darwin') {
        Menu.setApplicationMenu(null);
    }
};

export const sendToastToRenderer = ({
    message,
    type,
}: {
    message: string;
    type: 'error' | 'info' | 'success' | 'warning';
}) => {
    getMainWindow()?.webContents.send('toast-from-main', {
        message,
        type,
    });
};

const createWinThumbarButtons = () => {
    if (isWindows()) {
        getMainWindow()?.setThumbarButtons([
            {
                click: () => getMainWindow()?.webContents.send('renderer-player-previous'),
                icon: nativeImage.createFromPath(getAssetPath('skip-previous.png')),
                tooltip: 'Previous Track',
            },
            {
                click: () => getMainWindow()?.webContents.send('renderer-player-play-pause'),
                icon: nativeImage.createFromPath(getAssetPath('play-circle.png')),
                tooltip: 'Play/Pause',
            },
            {
                click: () => getMainWindow()?.webContents.send('renderer-player-next'),
                icon: nativeImage.createFromPath(getAssetPath('skip-next.png')),
                tooltip: 'Next Track',
            },
        ]);
    }
};

const createTray = () => {
    let trayIcon: Electron.NativeImage | string;

    if (isMacOS()) {
        const iconPath = getAssetPath('icons/IconTemplate.png');
        const icon = nativeImage.createFromPath(iconPath);
        icon.setTemplateImage(true);
        trayIcon = icon;
    } else if (isLinux()) {
        trayIcon = getAssetPath('icons/icon.png');
    } else {
        trayIcon = getAssetPath('icons/icon.ico');
    }

    tray = new Tray(trayIcon);

    const contextMenu = Menu.buildFromTemplate([
        {
            click: () => {
                getMainWindow()?.webContents.send('renderer-player-play-pause');
            },
            label: 'Play/Pause',
        },
        {
            click: () => {
                getMainWindow()?.webContents.send('renderer-player-next');
            },
            label: 'Next Track',
        },
        {
            click: () => {
                getMainWindow()?.webContents.send('renderer-player-previous');
            },
            label: 'Previous Track',
        },
        {
            click: () => {
                getMainWindow()?.webContents.send('renderer-player-stop');
            },
            label: 'Stop',
        },
        {
            type: 'separator',
        },
        {
            click: () => {
                if (mainWindow === null) createWindow(false);
                else {
                    mainWindow.show();
                    createWinThumbarButtons();
                }
            },
            label: 'Open main window',
        },
        {
            click: () => {
                exitFromTray = true;
                app.quit();
            },
            label: 'Quit',
        },
    ]);

    if (!isMacOS()) {
        tray.on('click', () => {
            if (store.get('window_minimize_to_tray')) {
                if (mainWindow?.isVisible()) {
                    mainWindow?.hide();
                } else {
                    mainWindow?.show();
                    createWinThumbarButtons();
                }
            } else {
                mainWindow?.show();
                createWinThumbarButtons();
            }
        });
    }

    tray.setToolTip('Feishin');
    tray.setContextMenu(contextMenu);
};

const validateUrl = (url: string): boolean => {
    // Minor security, really. Enforce only loading websites (http/https). file://
    // URLs and the like should've already been blocked, but this is another check.
    // Note that arbitrary web URLs are still allowed under this scheme, although
    // that should really only be hit by Subsonic share url (or if artist homepage
    // is allowed for ND extensions)
    return url.startsWith('http://') || url.startsWith('https://');
};

async function createWindow(first = true): Promise<void> {
    if (isDevelopment) {
        await installExtensions().catch(console.log);
    }

    const nativeFrame = store.get('window_window_bar_style', 'linux') === 'linux';
    store.set('window_has_frame', nativeFrame);

    const nativeFrameConfig: Record<string, BrowserWindowConstructorOptions> = {
        linux: {
            autoHideMenuBar: true,
            frame: true,
        },
        macOS: {
            autoHideMenuBar: true,
            frame: true,
            titleBarStyle: 'default',
            trafficLightPosition: { x: 10, y: 10 },
        },
        windows: {
            autoHideMenuBar: true,
            frame: true,
        },
    };

    // Create the browser window.
    mainWindow = new BrowserWindow({
        autoHideMenuBar: true,
        frame: false,
        height: 900,
        icon: isWindows() ? getAssetPath('icons/icon.ico') : getAssetPath('icons/icon.png'),
        minHeight: 120,
        minWidth: 480,
        show: false,
        webPreferences: {
            allowRunningInsecureContent: !!store.get('ignore_ssl'),
            backgroundThrottling: false,
            contextIsolation: true,
            devTools: true,
            nodeIntegration: false,
            preload: join(__dirname, '../preload/index.js'),
            sandbox: true,
            webSecurity: !store.get('ignore_cors'),
        },
        width: 1440,
        ...(nativeFrame && isLinux() && nativeFrameConfig.linux),
        ...(nativeFrame && isMacOS() && nativeFrameConfig.macOS),
        ...(nativeFrame && isWindows() && nativeFrameConfig.windows),
    });

    // From https://github.com/electron/electron/issues/526#issuecomment-1663959513
    const bounds = store.get('bounds') as Rectangle | undefined;
    if (bounds) {
        const screenArea = screen.getDisplayMatching(bounds).workArea;
        if (
            bounds.x > screenArea.x + screenArea.width ||
            bounds.x < screenArea.x ||
            bounds.y < screenArea.y ||
            bounds.y > screenArea.y + screenArea.height
        ) {
            if (bounds.width < screenArea.width && bounds.height < screenArea.height) {
                mainWindow.setBounds({ height: bounds.height, width: bounds.width });
            } else {
                mainWindow.setBounds({ height: 900, width: 1440 });
            }
        } else {
            mainWindow.setBounds(bounds);
        }
    }

    electronLocalShortcut.register(mainWindow, 'Ctrl+Shift+I', () => {
        mainWindow?.webContents.openDevTools();
    });

    ipcMain.on('window-dev-tools', () => {
        mainWindow?.webContents.openDevTools();
    });

    ipcMain.on('window-maximize', () => {
        mainWindow?.maximize();
    });

    ipcMain.on('window-unmaximize', () => {
        mainWindow?.unmaximize();
    });

    ipcMain.on('window-minimize', () => {
        mainWindow?.minimize();
    });

    ipcMain.on('window-close', () => {
        mainWindow?.close();
    });

    ipcMain.on('window-quit', () => {
        stopConnect();
        shutdownServer();
        mainWindow?.close();
        app.exit();
    });

    ipcMain.handle('window-clear-cache', async () => {
        return mainWindow?.webContents.session.clearCache();
    });

    ipcMain.handle(
        'app-check-for-updates',
        async (): Promise<{ updateAvailable: boolean; version?: string }> => {
            if (disableAutoUpdates() || store.get('disable_auto_updates') === true) {
                console.log('Auto updates are disabled');
                return { updateAvailable: false };
            }

            try {
                console.log('Checking for updates');
                configureUpdater();
                const result = await autoUpdater.checkForUpdates();

                const updateAvailable = result?.isUpdateAvailable ?? false;
                console.log('Update available:', updateAvailable);
                if (updateAvailable) {
                    if (isMacOS()) {
                        getMainWindow()?.webContents.send(
                            'update-available',
                            result?.updateInfo?.version,
                        );
                    } else {
                        console.log('Downloading update');
                        autoUpdater.downloadUpdate();
                    }
                }

                return {
                    updateAvailable,
                    version: result?.updateInfo?.version,
                };
            } catch {
                console.log('Error checking for updates');
                return { updateAvailable: false };
            }
        },
    );

    ipcMain.on('app-restart', () => {
        // Fix for .AppImage
        if (process.env.APPIMAGE) {
            app.exit();
            app.relaunch({
                args: process.argv.slice(1).concat(['--appimage-extract-and-run']),
                execPath: process.env.APPIMAGE,
            });
            app.exit(0);
        } else {
            app.relaunch();
            app.exit(0);
        }
    });

    ipcMain.on('global-media-keys-enable', () => {
        enableMediaKeys(mainWindow);
    });

    ipcMain.on('global-media-keys-disable', () => {
        disableMediaKeys();
    });

    ipcMain.on('download-url', (_event, url: string) => {
        mainWindow?.webContents.downloadURL(url);
    });

    const globalMediaKeysEnabled = store.get('global_media_hotkeys', true) as boolean;

    if (globalMediaKeysEnabled) {
        enableMediaKeys(mainWindow);
    }

    const startWindowMinimized = store.get('window_start_minimized', false) as boolean;

    mainWindow.on('ready-to-show', () => {
        // mainWindow.show()

        if (!mainWindow) {
            throw new Error('"mainWindow" is not defined');
        }

        if (!first || !startWindowMinimized) {
            const maximized = store.get('maximized');
            const fullScreen = store.get('fullscreen');

            if (maximized) {
                mainWindow.maximize();
            }
            if (fullScreen) {
                mainWindow.setFullScreen(true);
            }

            mainWindow.show();
            createWinThumbarButtons();
        }
    });

    mainWindow.on('closed', () => {
        ipcMain.removeHandler('window-clear-cache');
        ipcMain.removeHandler('app-check-for-updates');
        mainWindow = null;
    });

    mainWindow.on('close', (event) => {
        store.set('bounds', mainWindow?.getNormalBounds());
        store.set('maximized', mainWindow?.isMaximized());
        store.set('fullscreen', mainWindow?.isFullScreen());

        if (!exitFromTray && store.get('window_exit_to_tray')) {
            event.preventDefault();
            mainWindow?.hide();
        }

        if (forceQuit) {
            app.exit();
        }
    });

    (mainWindow as any).on('minimize', (event: any) => {
        if (store.get('window_minimize_to_tray') === true) {
            event.preventDefault();
            mainWindow?.hide();
        }
    });

    if (isWindows()) {
        app.setAppUserModelId('io.github.mihaitom.feishin-connect');
    }

    if (isMacOS()) {
        app.on('before-quit', () => {
            stopConnect();
            forceQuit = true;
        });
    }

    menuBuilder = new MenuBuilder(mainWindow);
    rebuildMainMenu();

    // Open URLs in the user's browser
    mainWindow.webContents.setWindowOpenHandler((edata) => {
        if (validateUrl(edata.url)) {
            shell.openExternal(edata.url);
        }
        return { action: 'deny' };
    });

    mainWindow.webContents.session.setDisplayMediaRequestHandler((_request, callback) => {
        if (!canHandleVisualizerDisplayMedia()) {
            callback({});
            return;
        }

        if (!isMacOS()) {
            callback({ audio: 'loopback' });
            return;
        }

        desktopCapturer
            .getSources({ thumbnailSize: { height: 0, width: 0 }, types: ['screen'] })
            .then((sources) => {
                const source = sources[0];
                if (!source) {
                    callback({});
                    return;
                }

                callback({ audio: 'loopback', video: source });
            })
            .catch((err) => {
                log.warn('desktopCapturer.getSources failed', err);
                callback({});
            });
    });

    if (!disableAutoUpdates() && store.get('disable_auto_updates') !== true) {
        new AppUpdater();
    }

    const theme = store.get('theme') as TitleTheme | undefined;
    nativeTheme.themeSource = theme || 'dark';

    mainWindow.webContents.setWindowOpenHandler((details) => {
        if (validateUrl(details.url)) {
            shell.openExternal(details.url);
        }
        return { action: 'deny' };
    });

    // HMR for renderer base on electron-vite cli.
    // Load the remote URL for development or the local html file for production.
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
    }
}

// Only allow hardware media key handling if:
// 1. The "Enable Media Session" setting is enabled
// 2. The playback type is WEB (mpv not supported)
// 3. The platform is not Linux (because we are using mpris instead)
const enableMediaSession = store.get('mediaSession', false) as boolean;
const playbackType = store.get('playbackType', PlayerType.WEB) as PlayerType;
const shouldDisableMediaFeatures =
    isLinux() || !enableMediaSession || playbackType !== PlayerType.WEB;

const chromiumDisabledFeatures: string[] = [];
// Fractional scaling on Wayland: https://github.com/jeffvli/feishin/issues/1271#issuecomment-4063326712
if (isLinux()) {
    chromiumDisabledFeatures.push('WaylandFractionalScaleV1');
}
if (shouldDisableMediaFeatures) {
    chromiumDisabledFeatures.push('HardwareMediaKeyHandling', 'MediaSessionService');
}

if (chromiumDisabledFeatures.length > 0) {
    app.commandLine.appendSwitch('disable-features', chromiumDisabledFeatures.join(','));
}

// https://github.com/electron/electron/issues/46538#issuecomment-2808806722
app.commandLine.appendSwitch('gtk-version', '3');

// Enable garbage collection API
app.commandLine.appendSwitch('js-flags', '--expose-gc');

// Must duplicate with the one in renderer process settings.store.ts
enum BindingActions {
    GLOBAL_SEARCH = 'globalSearch',
    LOCAL_SEARCH = 'localSearch',
    MUTE = 'volumeMute',
    NEXT = 'next',
    PAUSE = 'pause',
    PLAY = 'play',
    PLAY_PAUSE = 'playPause',
    PREVIOUS = 'previous',
    SHUFFLE = 'toggleShuffle',
    SKIP_BACKWARD = 'skipBackward',
    SKIP_FORWARD = 'skipForward',
    STOP = 'stop',
    TOGGLE_FULLSCREEN_PLAYER = 'toggleFullscreenPlayer',
    TOGGLE_QUEUE = 'toggleQueue',
    TOGGLE_REPEAT = 'toggleRepeat',
    VOLUME_DOWN = 'volumeDown',
    VOLUME_UP = 'volumeUp',
}

const getMenuAccelerator = (
    data: Record<BindingActions, { allowGlobal: boolean; hotkey: string; isGlobal: boolean }>,
    action: BindingActions,
) => {
    const hotkey = data[action]?.hotkey;

    if (!hotkey) return undefined;

    return hotkeyToElectronAccelerator(hotkey);
};

const HOTKEY_ACTIONS: Record<BindingActions, () => void> = {
    [BindingActions.GLOBAL_SEARCH]: () => {},
    [BindingActions.LOCAL_SEARCH]: () => {},
    [BindingActions.MUTE]: () => getMainWindow()?.webContents.send('renderer-player-volume-mute'),
    [BindingActions.NEXT]: () => getMainWindow()?.webContents.send('renderer-player-next'),
    [BindingActions.PAUSE]: () => getMainWindow()?.webContents.send('renderer-player-pause'),
    [BindingActions.PLAY]: () => getMainWindow()?.webContents.send('renderer-player-play'),
    [BindingActions.PLAY_PAUSE]: () =>
        getMainWindow()?.webContents.send('renderer-player-play-pause'),
    [BindingActions.PREVIOUS]: () => getMainWindow()?.webContents.send('renderer-player-previous'),
    [BindingActions.SHUFFLE]: () =>
        getMainWindow()?.webContents.send('renderer-player-toggle-shuffle'),
    [BindingActions.SKIP_BACKWARD]: () =>
        getMainWindow()?.webContents.send('renderer-player-skip-backward'),
    [BindingActions.SKIP_FORWARD]: () =>
        getMainWindow()?.webContents.send('renderer-player-skip-forward'),
    [BindingActions.STOP]: () => getMainWindow()?.webContents.send('renderer-player-stop'),
    [BindingActions.TOGGLE_FULLSCREEN_PLAYER]: () => {},
    [BindingActions.TOGGLE_QUEUE]: () => {},
    [BindingActions.TOGGLE_REPEAT]: () =>
        getMainWindow()?.webContents.send('renderer-player-toggle-repeat'),
    [BindingActions.VOLUME_DOWN]: () =>
        getMainWindow()?.webContents.send('renderer-player-volume-down'),
    [BindingActions.VOLUME_UP]: () =>
        getMainWindow()?.webContents.send('renderer-player-volume-up'),
};

ipcMain.on(
    'set-global-shortcuts',
    (
        _event,
        data: Record<BindingActions, { allowGlobal: boolean; hotkey: string; isGlobal: boolean }>,
    ) => {
        // Since we're not tracking the previous shortcuts, we need to unregister all of them
        globalShortcut.unregisterAll();

        for (const shortcut of Object.keys(data)) {
            const isGlobalHotkey = data[shortcut as BindingActions].isGlobal;
            const isValidHotkey =
                data[shortcut as BindingActions].hotkey &&
                data[shortcut as BindingActions].hotkey !== '';

            if (isGlobalHotkey && isValidHotkey) {
                const accelerator = hotkeyToElectronAccelerator(
                    data[shortcut as BindingActions].hotkey,
                );

                globalShortcut.register(accelerator, () => {
                    HOTKEY_ACTIONS[shortcut as BindingActions]();
                });
            }
        }

        playbackMenuAccelerators = {
            next: getMenuAccelerator(data, BindingActions.NEXT),
            playPause:
                getMenuAccelerator(data, BindingActions.PLAY_PAUSE) ||
                getMenuAccelerator(data, BindingActions.PLAY) ||
                getMenuAccelerator(data, BindingActions.PAUSE),
            previous: getMenuAccelerator(data, BindingActions.PREVIOUS),
            repeat: getMenuAccelerator(data, BindingActions.TOGGLE_REPEAT),
            seekBackward: getMenuAccelerator(data, BindingActions.SKIP_BACKWARD),
            seekForward: getMenuAccelerator(data, BindingActions.SKIP_FORWARD),
            shuffle: getMenuAccelerator(data, BindingActions.SHUFFLE),
            stop: getMenuAccelerator(data, BindingActions.STOP),
            volumeDown: getMenuAccelerator(data, BindingActions.VOLUME_DOWN),
            volumeUp: getMenuAccelerator(data, BindingActions.VOLUME_UP),
        };

        if (isMacOS()) {
            rebuildMainMenu();
        }

        const globalMediaKeysEnabled = store.get('global_media_hotkeys', true) as boolean;

        if (globalMediaKeysEnabled) {
            enableMediaKeys(mainWindow);
        }
    },
);

ipcMain.on(
    'logger',
    (
        _event,
        data: {
            message: string;
            type: 'debug' | 'error' | 'info' | 'success' | 'verbose' | 'warning';
        },
    ) => {
        createLog(data);
    },
);

ipcMain.handle('power-save-blocker-start', (_event, { full }: { full: boolean }) => {
    if (powerSaveBlockerId !== null) {
        return powerSaveBlockerId;
    }

    powerSaveBlockerId = powerSaveBlocker.start(
        full ? 'prevent-display-sleep' : 'prevent-app-suspension',
    );
    return powerSaveBlockerId;
});

ipcMain.handle('power-save-blocker-stop', () => {
    if (powerSaveBlockerId !== null) {
        const stopped = powerSaveBlocker.stop(powerSaveBlockerId);
        powerSaveBlockerId = null;
        return stopped;
    }
    return false;
});

ipcMain.handle('power-save-blocker-is-started', () => {
    return powerSaveBlockerId !== null && powerSaveBlocker.isStarted(powerSaveBlockerId);
});

app.on('window-all-closed', () => {
    globalShortcut.unregisterAll();
    // Respect the OSX convention of having the application in memory even
    // after all windows have been closed
    if (isMacOS()) {
        mainWindow = null;
    } else {
        stopConnect();
        app.quit();
    }
});

const FONT_HEADERS = new Set([
    'font/collection',
    'font/otf',
    'font/sfnt',
    'font/ttf',
    'font/woff',
    'font/woff2',
]);

const bytesToInt = (array: Uint8Array, length: number): number => {
    let value = 0;
    for (let i = 0; i < length; i++) {
        value = (value << 8) + array[i];
    }

    return value;
};

const FONT_FOUR_BYTE_MAGIC_NUMBERS = new Set([
    0x4f54544f, // font/otf
    0x774f4632, // font/woff2
    0x774f4646, // font/woff
]);

const FONT_FIVE_BYTE_MAGIC_NUMBERS = new Set([
    0x0001000000, // ttf, collection, sfnt
]);

const singleInstance = isDevelopment ? true : app.requestSingleInstanceLock();

if (!singleInstance) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) {
                mainWindow.restore();
            } else if (!mainWindow.isVisible()) {
                mainWindow.show();
            }

            mainWindow.focus();
        }
    });

    app.whenReady()
        .then(async () => {
            connectPort = await findFreePort();
            process.env['CONNECT_PORT'] = String(connectPort);
            startConnectServer();

            protocol.handle('feishin', async () => {
                const filePath = store.get('local_font_path');
                if (typeof filePath !== 'string') {
                    getMainWindow()?.webContents.send('custom-font-error', filePath);

                    return new Response(null, {
                        status: 403,
                        statusText: 'Forbidden',
                    });
                }

                const response = await net.fetch('file:' + filePath);
                const contentType = response.headers.get('content-type');

                // On Linux, the mime type is included in the response header
                // In this case, we can forward the response with no further processing
                if (contentType && FONT_HEADERS.has(contentType)) {
                    return response;
                }

                // Otherwise, let's check the magic number to see if
                // the file is a font type. This is either four or five bytes
                const payload = await response.arrayBuffer();
                const magicNumber = new Uint8Array(payload.slice(0, 5));
                const fiveHex = bytesToInt(magicNumber, 5);
                const fourHex = bytesToInt(magicNumber, 4);

                if (
                    FONT_FIVE_BYTE_MAGIC_NUMBERS.has(fiveHex) ||
                    FONT_FOUR_BYTE_MAGIC_NUMBERS.has(fourHex)
                ) {
                    // We have to create a new response with the payload, since it has been read now
                    return new Response(payload, {
                        headers: response.headers,
                    });
                }

                getMainWindow()?.webContents.send('custom-font-error', filePath);

                return new Response(null, {
                    status: 403,
                    statusText: 'Forbidden',
                });
            });

            session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
                callback({
                    responseHeaders: {
                        ...details.responseHeaders,
                        'Content-Security-Policy': [
                            "script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline' https://umami.jeffvli.org; style-src 'self' 'unsafe-inline'; media-src 'self' http: https: data: blob:; img-src 'self' http: https: data: blob:; connect-src 'self' http: https: ws: wss:; default-src 'self';",
                        ],
                    },
                });
            });

            createWindow();
            if (store.get('window_enable_tray', true)) {
                createTray();
            }
            app.on('activate', () => {
                // On macOS it's common to re-create a window in the app when the
                // dock icon is clicked and there are no other windows open.
                if (mainWindow === null) createWindow(false);
                else if (!mainWindow.isVisible()) {
                    mainWindow.show();
                    createWinThumbarButtons();
                }
            });
        })
        .catch(console.log);
}

// Register 'open-item' handler globally, ensuring it is only registered once
if (!ipcMain.eventNames().includes('open-item')) {
    ipcMain.handle('open-item', async (_event, path: string) => {
        return new Promise<void>((resolve, reject) => {
            access(path, constants.F_OK, (error) => {
                if (error) {
                    reject(error);
                    return;
                }

                shell.showItemInFolder(path);
                resolve();
            });
        });
    });
}

// Register 'open-application-directory' handler globally, ensuring it is only registered once
if (!ipcMain.eventNames().includes('open-application-directory')) {
    ipcMain.handle('open-application-directory', async () => {
        const userDataPath = app.getPath('userData');
        shell.openPath(userDataPath);
    });
}

ipcMain.on('update-playback', (_event, status: PlayerStatus) => {
    currentPlaybackStatus = status;

    if (!isMacOS()) return;

    rebuildMainMenu();
});

ipcMain.on('update-repeat', (_event, repeat: PlayerRepeat) => {
    currentRepeatMode = repeat;

    if (!isMacOS()) return;

    rebuildMainMenu();
});

ipcMain.on('update-shuffle', (_event, shuffle: boolean) => {
    currentShuffleEnabled = shuffle;

    if (!isMacOS()) return;

    rebuildMainMenu();
});

ipcMain.on('update-private-mode', (_event, privateMode: boolean) => {
    currentPrivateMode = privateMode;

    if (!isMacOS()) return;

    rebuildMainMenu();
});

ipcMain.on('update-sidebar-collapsed', (_event, collapsedSidebar: boolean) => {
    currentSidebarCollapsed = collapsedSidebar;

    if (!isMacOS()) return;

    rebuildMainMenu();
});
