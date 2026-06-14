import { closeAllModals, openModal } from '@mantine/modals';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    LuAirplay,
    LuKeyRound,
    LuSpeaker,
    LuTv,
    LuUnlink2,
    LuVolume1,
    LuVolumeX,
} from 'react-icons/lu';

import { PairingModal } from './pairing-modal';
import { ConnectDevice, connectFetch } from './types';

import { CustomPlayerbarSlider } from '/@/renderer/features/player/components/playerbar-slider';
import { ConfirmModal } from '/@/shared/components/modal/modal';
import { Switch } from '/@/shared/components/switch/switch';
import { Text } from '/@/shared/components/text/text';
import { toast } from '/@/shared/components/toast/toast';

interface DeviceItemProps {
    alwaysShowVolume?: boolean;
    device: ConnectDevice;
    isActive: boolean;
    isPaired?: boolean;
    isSelected: boolean;
    onPaired?: () => void;
    onStop: () => void;
    onToggleSelect: () => void;
}

export const DeviceItem = ({
    alwaysShowVolume = false,
    device,
    isActive,
    isPaired,
    isSelected,
    onPaired,
    onStop,
    onToggleSelect,
}: DeviceItemProps) => {
    const { t } = useTranslation();
    const [hovered, setHovered] = useState(false);
    const [volume, setVolume] = useState<null | number>(null);
    const [muted, setMuted] = useState(false);
    const [showPairingModal, setShowPairingModal] = useState(false);
    const preMute = useRef(30);

    const canShowVolume = isActive && (device.type === 'sonos' || device.type === 'chromecast');
    // Single active device: always open. Multiple: accordion on hover.
    const showVolume = canShowVolume && (alwaysShowVolume || hovered);

    useEffect(() => {
        if (!showVolume || volume !== null) return;
        connectFetch(
            `/device-volume?device_type=${device.type}&name=${encodeURIComponent(device.name)}`,
        )
            .then((r) => r.json())
            .then((d) => {
                if (d.volume !== undefined) setVolume(d.volume);
            })
            .catch(() => {});
    }, [showVolume, device.type, device.name, volume]);

    const setDeviceVolume = (v: number) => {
        setVolume(v);
        connectFetch(
            `/device-volume?device_type=${device.type}&name=${encodeURIComponent(device.name)}`,
            {
                body: JSON.stringify({ volume: v }),
                headers: { 'Content-Type': 'application/json' },
                method: 'POST',
            },
        ).catch(() => {});
    };

    const toggleMute = () => {
        if (muted) {
            setMuted(false);
            setDeviceVolume(preMute.current);
        } else {
            preMute.current = volume ?? 30;
            setMuted(true);
            setDeviceVolume(0);
        }
    };

    const handleUnpair = useCallback(async () => {
        try {
            const res = await connectFetch(`/pair/airplay/${encodeURIComponent(device.name)}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            onPaired?.();
        } catch {
            toast.error({ message: t('player.connect_unpair_error', { name: device.name }) });
        } finally {
            closeAllModals();
        }
    }, [device.name, onPaired, t]);

    const openUnpairModal = useCallback(() => {
        openModal({
            children: (
                <ConfirmModal onConfirm={handleUnpair}>
                    <Text>{t('player.connect_unpair_confirm_body', { name: device.name })}</Text>
                </ConfirmModal>
            ),
            title: t('player.connect_unpair_confirm_title'),
        });
    }, [device.name, handleUnpair, t]);

    const checked = isActive || isSelected;
    // Show pair button only for AirPlay 2 devices that haven't been paired yet.
    // Always rendered (visibility:hidden when not hovering) to prevent row-height jumps.
    const showPairButton = device.type === 'airplay' && device.needsPairing && !isPaired;
    const showUnpairButton = device.type === 'airplay' && isPaired;

    return (
        <>
            {showPairingModal && (
                <PairingModal
                    deviceName={device.name}
                    onClose={() => setShowPairingModal(false)}
                    onSuccess={() => onPaired?.()}
                />
            )}
            <div
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                style={{
                    background: hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
                    borderRadius: '4px',
                    marginBottom: alwaysShowVolume && canShowVolume ? '0' : '6px',
                    transition: 'background 0.1s',
                }}
            >
                {/* Header row */}
                <div
                    style={{
                        alignItems: 'center',
                        display: 'flex',
                        gap: '10px',
                        // minHeight reserves space for the (taller) pair/unpair button so
                        // the row doesn't grow/jump when it appears on hover.
                        minHeight: '46px',
                        padding: '10px 12px',
                    }}
                >
                    <Switch
                        checked={checked}
                        onChange={() => (isActive ? onStop() : onToggleSelect())}
                        size="xs"
                        style={{ paddingInline: '5px' }}
                    />

                    <span
                        style={{
                            color: isActive
                                ? 'var(--theme-colors-primary)'
                                : 'var(--theme-colors-text-secondary)',
                            display: 'flex',
                            flexShrink: 0,
                        }}
                    >
                        {device.type === 'sonos' ? (
                            <LuSpeaker size={18} />
                        ) : device.type === 'chromecast' ? (
                            <LuTv size={18} />
                        ) : (
                            <LuAirplay size={18} />
                        )}
                    </span>

                    <span
                        onClick={isActive ? undefined : onToggleSelect}
                        style={{
                            color: isActive
                                ? 'var(--theme-colors-primary)'
                                : isSelected
                                  ? 'var(--theme-colors-text-primary)'
                                  : 'var(--theme-colors-text-secondary)',
                            cursor: isActive ? 'default' : 'pointer',
                            flex: 1,
                            fontSize: '16px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            userSelect: 'none',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {device.name}
                    </span>

                    {/* AirPlay 2 Pair-Button — only shown on hover so the label can use the full width otherwise */}
                    {showPairButton && hovered && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowPairingModal(true);
                            }}
                            style={{
                                alignItems: 'center',
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(255,255,255,0.12)',
                                borderRadius: '4px',
                                color: 'var(--theme-colors-text-secondary)',
                                cursor: 'pointer',
                                display: 'flex',
                                flexShrink: 0,
                                gap: '4px',
                                padding: '3px 7px',
                            }}
                            title={t('player.connect_pair')}
                        >
                            <LuKeyRound size={12} />
                            <span style={{ fontSize: '11px' }}>{t('player.connect_pair')}</span>
                        </button>
                    )}

                    {/* AirPlay 2 Unpair-Button — only shown on hover so the label can use the full width otherwise */}
                    {showUnpairButton && hovered && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                openUnpairModal();
                            }}
                            style={{
                                alignItems: 'center',
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(255,255,255,0.12)',
                                borderRadius: '4px',
                                color: 'var(--theme-colors-text-secondary)',
                                cursor: 'pointer',
                                display: 'flex',
                                flexShrink: 0,
                                gap: '4px',
                                padding: '3px 7px',
                            }}
                            title={t('player.connect_unpair')}
                        >
                            <LuUnlink2 size={12} />
                            <span style={{ fontSize: '11px' }}>{t('player.connect_unpair')}</span>
                        </button>
                    )}
                </div>

                {/* Volume — always visible for single active device, accordion on hover for multiple */}
                <div
                    style={{
                        maxHeight: showVolume ? '44px' : '0px',
                        opacity: showVolume ? 1 : 0,
                        overflow: 'hidden',
                        transition: alwaysShowVolume
                            ? 'none'
                            : 'max-height 0.2s ease, opacity 0.15s ease',
                    }}
                >
                    <div
                        style={{
                            alignItems: 'center',
                            display: 'flex',
                            gap: '8px',
                            padding: '2px 12px 10px 40px',
                        }}
                    >
                        <button
                            onClick={toggleMute}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: muted
                                    ? 'var(--theme-colors-primary)'
                                    : 'var(--icon-color, rgba(255,255,255,0.55))',
                                cursor: 'pointer',
                                display: 'flex',
                                flexShrink: 0,
                                padding: 0,
                            }}
                            title={muted ? t('player.connect_unmute') : t('player.mute')}
                        >
                            {muted ? <LuVolumeX size={15} /> : <LuVolume1 size={15} />}
                        </button>
                        <CustomPlayerbarSlider
                            max={100}
                            min={0}
                            onChange={setDeviceVolume}
                            size={5}
                            style={{ flex: 1 }}
                            value={muted ? 0 : (volume ?? 0)}
                        />
                        <span
                            style={{
                                color: 'var(--theme-colors-text-secondary)',
                                fontSize: '11px',
                                textAlign: 'right',
                                width: '22px',
                            }}
                        >
                            {muted ? 0 : (volume ?? '–')}
                        </span>
                    </div>
                </div>
            </div>
        </>
    );
};
