import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuCast } from 'react-icons/lu';

import { ConnectPopover } from './connect-popover';
import { useConnectSessionContext } from './connect-session-context';
import { computePopoverPosition } from './popover-position';
import { Spinner } from './ui';

import { useCurrentServerId } from '/@/renderer/store';

export const ConnectButton = () => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [popPos, setPopPos] = useState({ bottom: 0, right: 0 });
    const btnRef = useRef<HTMLButtonElement>(null);

    // No server logged in yet (e.g. still on the login screen, which renders
    // the same player bar as the authenticated app) — nothing to cast, and
    // the backend session behind this button isn't authenticated either
    // (see core/session.py's require_authenticated_session).
    const currentServerId = useCurrentServerId();

    const session = useConnectSessionContext();

    const { activeDevice, fetchVolume, hasApiError, hasFfmpegError, isActive, refresh, status } =
        session;

    const handleOpen = () => {
        if (!open && btnRef.current) {
            if (
                activeDevice?.type === 'sonos' ||
                activeDevice?.type === 'chromecast' ||
                activeDevice?.type === 'dlna'
            )
                fetchVolume();
            const rect = btnRef.current.getBoundingClientRect();
            setPopPos(
                computePopoverPosition(rect, {
                    height: window.innerHeight,
                    width: window.innerWidth,
                }),
            );
            refresh();
        }
        setOpen((o) => !o);
    };

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            const pop = document.getElementById('connect-popover');
            const target = e.target as Element;
            if (
                pop &&
                !pop.contains(target) &&
                btnRef.current &&
                !btnRef.current.contains(target) &&
                // Mantine modals/dialogs (e.g. AirPlay pairing) render via a portal
                // outside #connect-popover — don't treat clicks inside them as "outside".
                !target.closest?.('[role="dialog"], .mantine-Overlay-root')
            ) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    if (!currentServerId) return null;

    const nowPlayingTitle =
        session.connectStatus?.current_track?.title ?? session.connectStatus?.radio?.title ?? '…';

    const iconColor =
        status === 'error' || hasApiError || hasFfmpegError
            ? 'var(--theme-colors-warning, #f5a623)'
            : isActive
              ? 'var(--theme-colors-primary)'
              : 'var(--theme-colors-text-secondary)';

    return (
        <>
            <button
                disabled={status === 'loading'}
                onClick={handleOpen}
                ref={btnRef}
                style={{
                    alignItems: 'center',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    color: iconColor,
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'center',
                    padding: '4px',
                    transition: 'color 0.2s',
                }}
                title={
                    isActive
                        ? `▶ ${activeDevice!.name} · ${nowPlayingTitle}`
                        : t('player.connect_playOnDevice')
                }
            >
                {status === 'loading' ? (
                    <Spinner size={16} />
                ) : (
                    <LuCast size={20} style={{ opacity: isActive ? 1 : 0.7 }} />
                )}
            </button>

            {open && (
                <ConnectPopover onClose={() => setOpen(false)} popPos={popPos} session={session} />
            )}
        </>
    );
};
