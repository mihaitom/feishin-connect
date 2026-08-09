import { Outlet } from 'react-router';

import appIcon from '../../../../assets/icons/64x64.png';

import { ThemeButton } from '/@/renderer/features/mobile/components/theme-button';
import { useConnectSession } from '/@/renderer/features/player/components/connect/use-connect-session';
import { Group } from '/@/shared/components/group/group';
import { TabBar } from '/@/shared/mobile-ui/components/tab-bar';

// Mounts the Connect session once for its side effects (populates the
// Context-free connect.store.ts that this tree's containers read directly —
// see use-mobile-connect-devices.ts and containers/remote-container.tsx —
// plus the session's own background wiring: auto-forwarding local track
// changes to an active cast device, scrobbling, etc.). No Context.Provider
// needed here: unlike the Electron phone-remote bridge (which runs outside
// Playerbar's subtree and had no other way to reach this data), every
// container in this tree already reads the same store/hooks directly,
// exactly like desktop's own player-bar components do.
const ConnectSessionMount = () => {
    useConnectSession();
    return null;
};

// Same header src/remote/components/shell.tsx has (logo + theme toggle),
// minus its ReconnectButton — there's no WebSocket here to reconnect.
export const MobileShell = () => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', width: '100vw' }}>
            <ConnectSessionMount />
            <div
                style={{
                    alignItems: 'center',
                    background: 'var(--theme-colors-surface)',
                    borderBottom: '1px solid var(--theme-colors-border)',
                    display: 'flex',
                    flexShrink: 0,
                    justifyContent: 'space-between',
                    padding: '0.5rem 1rem',
                    paddingTop: 'calc(0.5rem + env(safe-area-inset-top, 0px))',
                }}
            >
                <img alt="Feishin" height={32} src={appIcon} width={32} />
                <Group gap="sm">
                    <ThemeButton />
                </Group>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                <Outlet />
            </div>
            <div
                style={{
                    background: 'var(--theme-colors-surface)',
                    flexShrink: 0,
                    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                }}
            >
                <TabBar />
            </div>
        </div>
    );
};
