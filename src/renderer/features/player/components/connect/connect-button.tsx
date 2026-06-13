import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuCast } from 'react-icons/lu';

import { ConnectPopover } from './connect-popover';
import { useConnectSessionContext } from './connect-session-context';

export const ConnectButton = () => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [popPos, setPopPos] = useState({ bottom: 0, right: 0 });
    const btnRef = useRef<HTMLButtonElement>(null);

    const session = useConnectSessionContext();

    // Close popover when connection finishes or session becomes inactive
    const prevStatus = useRef(session.status);
    const prevIsActive = useRef(session.isActive);
    useEffect(() => {
        if (prevStatus.current === 'loading' && session.status === 'success') setOpen(false);
        prevStatus.current = session.status;
    }, [session.status]);
    useEffect(() => {
        if (prevIsActive.current && !session.isActive) setOpen(false);
        prevIsActive.current = session.isActive;
    }, [session.isActive]);
    const {
        activeDevice,
        fetchVolume,
        hasApiError,
        hasFfmpegError,
        isActive,
        isEmpty,
        refresh,
        status,
    } = session;

    const handleOpen = () => {
        const hasError = hasApiError || hasFfmpegError;
        if (isEmpty && !hasError) return;
        if (!open && btnRef.current) {
            if (activeDevice?.type === 'sonos' || activeDevice?.type === 'chromecast')
                fetchVolume();
            const rect = btnRef.current.getBoundingClientRect();
            setPopPos({
                bottom: window.innerHeight - rect.top + 40,
                right: window.innerWidth - rect.right - 120,
            });
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
                    cursor: isEmpty ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    justifyContent: 'center',
                    opacity: isEmpty ? 0.3 : 1,
                    padding: '4px',
                    transition: 'color 0.2s',
                }}
                title={
                    isEmpty
                        ? t('player.connect_emptyQueue')
                        : isActive
                          ? `▶ ${activeDevice!.name} · ${nowPlayingTitle}`
                          : t('player.connect_playOnDevice')
                }
            >
                <LuCast size={20} style={{ opacity: isActive ? 1 : 0.7 }} />
            </button>

            {open && <ConnectPopover popPos={popPos} session={session} />}
        </>
    );
};
