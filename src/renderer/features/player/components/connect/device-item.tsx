import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuAirplay, LuKeyRound, LuSpeaker, LuVolume1, LuVolumeX } from 'react-icons/lu';

import { PairingModal } from './pairing-modal';
import { CONNECT_URL, ConnectDevice } from './types';

import { CustomPlayerbarSlider } from '/@/renderer/features/player/components/playerbar-slider';
import { Switch } from '/@/shared/components/switch/switch';

interface DeviceItemProps {
    device: ConnectDevice;
    isActive: boolean;
    isPaired?: boolean;
    isSelected: boolean;
    onPaired?: () => void;
    onStop: () => void;
    onToggleSelect: () => void;
}

export const DeviceItem = ({
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

    const canShowVolume = isActive && device.type === 'sonos';

    useEffect(() => {
        if (!hovered || !canShowVolume || volume !== null) return;
        fetch(
            `${CONNECT_URL}/device-volume?device_type=${device.type}&name=${encodeURIComponent(device.name)}`,
        )
            .then((r) => r.json())
            .then((d) => {
                if (d.volume !== undefined) setVolume(d.volume);
            })
            .catch(() => {});
    }, [hovered, canShowVolume, device.type, device.name, volume]);

    const setDeviceVolume = (v: number) => {
        setVolume(v);
        fetch(
            `${CONNECT_URL}/device-volume?device_type=${device.type}&name=${encodeURIComponent(device.name)}`,
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

    const checked = isActive || isSelected;
    const showPairButton = device.type === 'airplay' && !isPaired && hovered;

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
            style={{ marginBottom: '6px' }}
        >
            {/* Header row */}
            <div
                style={{
                    alignItems: 'center',
                    background: hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
                    borderRadius: '4px',
                    display: 'flex',
                    gap: '10px',
                    padding: '10px 12px',
                    transition: 'background 0.1s',
                }}
            >
                <Switch
                    checked={checked}
                    onChange={() => (isActive ? onStop() : onToggleSelect())}
                    size="xs"
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
                    {device.type === 'sonos' ? <LuSpeaker size={18} /> : <LuAirplay size={18} />}
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

                {/* AirPlay 2 Pair-Button — erscheint beim Hover wenn noch nicht gepaired */}
                {showPairButton && (
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
                        title="AirPlay 2 Pairing"
                    >
                        <LuKeyRound size={12} />
                        <span style={{ fontSize: '11px' }}>Pair</span>
                    </button>
                )}
            </div>

            {/* Volume — smooth slide-in on hover for active Sonos */}
            <div
                style={{
                    maxHeight: canShowVolume && hovered ? '44px' : '0px',
                    opacity: canShowVolume && hovered ? 1 : 0,
                    overflow: 'hidden',
                    transition: 'max-height 0.2s ease, opacity 0.15s ease',
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
                        title={
                            muted
                                ? t('player.connect_unmute', { postProcess: 'sentenceCase' })
                                : t('player.mute', { postProcess: 'sentenceCase' })
                        }
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
