import { useTranslation } from 'react-i18next';
import { LuRefreshCw, LuSquare, LuTriangleAlert } from 'react-icons/lu';

import { DeviceItem } from './device-item';
import { NowPlayingSection } from './now-playing';
import { CONNECT_URL, ConnectSession } from './types';
import { PopButton, PopSection, Spinner } from './ui';

interface ConnectPopoverProps {
    popPos: { bottom: number; right: number };
    session: ConnectSession;
}

export const ConnectPopover = ({ popPos, session }: ConnectPopoverProps) => {
    const { t } = useTranslation();
    const {
        activeTargets,
        addToStream,
        connectStatus,
        devices,
        hasApiError,
        hasFfmpegError,
        isActive,
        isScanning,
        paired,
        refresh,
        refreshPaired,
        selectedForSend,
        sendToSelected,
        stopAllPlayback,
        stopSingleDevice,
        toggleSelectForSend,
        trackLabel,
    } = session;

    return (
        <div
            id="connect-popover"
            style={{
                background: 'var(--theme-colors-background, #1a1a2e)',
                border: '1px solid var(--theme-colors-border)',
                borderRadius: '8px',
                bottom: `${popPos.bottom}px`,
                boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
                overflow: 'hidden',
                position: 'fixed',
                right: `${popPos.right}px`,
                width: '350px',
                zIndex: 9999,
            }}
        >
            {/* Now Playing — track info only; controls are in Feishin's main playerbar */}
            {isActive && <NowPlayingSection connectStatus={connectStatus} />}

            {/* Error banners */}
            {hasApiError && (
                <div
                    style={{
                        alignItems: 'flex-start',
                        background: 'rgba(245,166,35,0.1)',
                        borderBottom: '1px solid rgba(245,166,35,0.2)',
                        display: 'flex',
                        gap: '8px',
                        padding: '10px 12px',
                    }}
                >
                    <LuTriangleAlert
                        size={15}
                        style={{ color: '#f5a623', flexShrink: 0, marginTop: '2px' }}
                    />
                    <div>
                        <div style={{ color: '#f5a623', fontSize: '13px', fontWeight: 600 }}>
                            {t('player.connect_apiUnreachable')}
                        </div>
                        <div
                            style={{
                                color: 'var(--theme-colors-text-secondary)',
                                fontSize: '11px',
                                marginTop: '2px',
                                wordBreak: 'break-all',
                            }}
                        >
                            {t('player.connect_apiUnreachableHint', { url: CONNECT_URL })}
                        </div>
                        <button
                            onClick={() => refresh(true)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#f5a623',
                                cursor: 'pointer',
                                fontSize: '11px',
                                marginTop: '4px',
                                padding: 0,
                            }}
                        >
                            {t('player.connect_scan')}
                        </button>
                    </div>
                </div>
            )}
            {hasFfmpegError && (
                <div
                    style={{
                        alignItems: 'flex-start',
                        background: 'rgba(245,166,35,0.1)',
                        borderBottom: '1px solid rgba(245,166,35,0.2)',
                        display: 'flex',
                        gap: '8px',
                        padding: '10px 12px',
                    }}
                >
                    <LuTriangleAlert
                        size={15}
                        style={{ color: '#f5a623', flexShrink: 0, marginTop: '2px' }}
                    />
                    <div>
                        <div style={{ color: '#f5a623', fontSize: '13px', fontWeight: 600 }}>
                            {t('player.connect_ffmpegMissing')}
                        </div>
                        <div
                            style={{
                                color: 'var(--theme-colors-text-secondary)',
                                fontSize: '11px',
                                marginTop: '2px',
                            }}
                        >
                            {t('player.connect_ffmpegMissingHint')}
                        </div>
                    </div>
                </div>
            )}

            {/* Device list */}
            {!hasApiError && (
                <PopSection
                    label={devices.length === 0 ? '' : (trackLabel ?? t('player.connect_sendTo'))}
                >
                    {devices.length === 0 && (
                        <div
                            style={{
                                color: 'var(--theme-colors-text-secondary)',
                                fontSize: '13px',
                                padding: '8px 12px 12px',
                                textAlign: 'center',
                            }}
                        >
                            {isScanning
                                ? t('player.connect_scanning')
                                : t('player.connect_noDevices')}
                        </div>
                    )}
                    {devices.map((d) => {
                        const key = `${d.type}:${d.name}`;
                        const isDeviceActive = activeTargets.some(
                            (tgt) => tgt.type === d.type && tgt.name === d.name,
                        );
                        const isDeviceSelected = selectedForSend.some(
                            (s) => `${s.type}:${s.name}` === key,
                        );
                        return (
                            <DeviceItem
                                alwaysShowVolume={activeTargets.length === 1}
                                device={d}
                                isActive={isDeviceActive}
                                isPaired={d.type === 'airplay' && paired.includes(d.name)}
                                isSelected={isDeviceSelected}
                                key={key}
                                onPaired={refreshPaired}
                                onStop={() => stopSingleDevice(d)}
                                onToggleSelect={() => toggleSelectForSend(d)}
                            />
                        );
                    })}
                    <button
                        disabled={isScanning}
                        onClick={() => refresh(true)}
                        style={{
                            alignItems: 'center',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--theme-colors-primary)',
                            cursor: isScanning ? 'default' : 'pointer',
                            display: 'flex',
                            fontSize: '12px',
                            gap: '6px',
                            justifyContent: 'center',
                            opacity: isScanning ? 0.6 : 1,
                            padding: '8px 12px',
                            width: '100%',
                        }}
                    >
                        {isScanning ? <Spinner size={12} /> : <LuRefreshCw size={13} />}
                        {t('player.connect_scan')}
                    </button>
                </PopSection>
            )}

            {/* Send / Add button — always rendered, animated open/closed so the
                popover doesn't jump in height when a device gets (de)selected */}
            <div
                style={{
                    maxHeight: selectedForSend.length > 0 ? '50px' : '0px',
                    opacity: selectedForSend.length > 0 ? 1 : 0,
                    overflow: 'hidden',
                    transition: 'max-height 0.2s ease, opacity 0.15s ease',
                }}
            >
                <div style={{ padding: '4px 12px 10px' }}>
                    <button
                        onClick={isActive ? addToStream : sendToSelected}
                        style={{
                            background: 'var(--theme-colors-primary)',
                            border: 'none',
                            borderRadius: '6px',
                            color: 'var(--theme-colors-background)',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 600,
                            padding: '8px 0',
                            width: '100%',
                        }}
                    >
                        {isActive
                            ? t('player.connect_add', { count: selectedForSend.length })
                            : t('player.connect_connect')}
                    </button>
                </div>
            </div>

            {/* Disconnect all */}
            {isActive && (
                <>
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }} />
                    <PopButton
                        danger
                        icon={<LuSquare size={14} />}
                        label={t('player.connect_stopAll')}
                        onClick={stopAllPlayback}
                    />
                </>
            )}
        </div>
    );
};
