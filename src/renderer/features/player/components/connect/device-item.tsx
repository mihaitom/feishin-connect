import { useEffect, useRef, useState } from 'react';
import { LuAirplay, LuCheck, LuSpeaker, LuVolume1, LuVolumeX } from 'react-icons/lu';

import { CONNECT_URL, ConnectDevice } from './types';

import { CustomPlayerbarSlider } from '/@/renderer/features/player/components/playerbar-slider';

interface DeviceItemProps {
    device: ConnectDevice;
    isActive: boolean;
    isSelected: boolean;
    onStop: () => void;
    onToggleSelect: () => void;
}

export const DeviceItem = ({
    device,
    isActive,
    isSelected,
    onStop,
    onToggleSelect,
}: DeviceItemProps) => {
    const [hovered, setHovered] = useState(false);
    const [volume, setVolume] = useState<null | number>(null);
    const [muted, setMuted] = useState(false);
    const preMute = useRef(30);

    const canShowVolume = isActive && device.type === 'sonos';

    // Fetch volume when row is hovered and active Sonos
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
    const checkColor = isActive
        ? 'var(--theme-colors-primary)'
        : 'var(--theme-colors-text-secondary)';

    return (
        <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
            {/* Header row */}
            <div
                style={{
                    alignItems: 'center',
                    background: hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
                    display: 'flex',
                    gap: '8px',
                    padding: '10px 12px',
                    transition: 'background 0.1s',
                }}
            >
                {/* Checkbox — click stops device when active, toggles selection when inactive */}
                <div
                    onClick={isActive ? onStop : onToggleSelect}
                    style={{
                        alignItems: 'center',
                        background: isActive ? 'var(--theme-colors-primary)' : 'transparent',
                        border: `1.5px solid ${checked ? 'var(--theme-colors-primary)' : 'rgba(255,255,255,0.25)'}`,
                        borderRadius: '3px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexShrink: 0,
                        height: '15px',
                        justifyContent: 'center',
                        width: '15px',
                    }}
                    title={isActive ? `${device.name} stoppen` : undefined}
                >
                    {checked && (
                        <LuCheck
                            size={10}
                            style={{
                                color: isActive ? 'var(--theme-colors-background)' : checkColor,
                            }}
                        />
                    )}
                </div>

                {/* Device type icon */}
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

                {/* Device name */}
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
            </div>

            {/* Volume — shown on hover for active Sonos */}
            {canShowVolume && hovered && (
                <div
                    style={{
                        alignItems: 'center',
                        display: 'flex',
                        gap: '8px',
                        padding: '2px 12px 10px 36px',
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
                        title={muted ? 'Ton einschalten' : 'Stummschalten'}
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
            )}
        </div>
    );
};
