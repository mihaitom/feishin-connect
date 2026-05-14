import { LuVolume1, LuVolumeX } from 'react-icons/lu';

import { PopSection } from './ui';

import { CustomPlayerbarSlider } from '/@/renderer/features/player/components/playerbar-slider';

interface VolumeControlProps {
    deviceName: string;
    muted: boolean;
    onToggleMute: () => void;
    onVolumeChange: (v: number) => void;
    volume: number;
}

export const VolumeControl = ({
    deviceName,
    muted,
    onToggleMute,
    onVolumeChange,
    volume,
}: VolumeControlProps) => (
    <PopSection label={`Lautstärke · ${deviceName}`}>
        <div
            style={{
                alignItems: 'center',
                display: 'flex',
                gap: '8px',
                padding: '2px 12px 10px',
            }}
        >
            <button
                onClick={onToggleMute}
                style={{
                    background: 'transparent',
                    border: 'none',
                    color: muted
                        ? 'var(--theme-colors-primary)'
                        : 'var(--icon-color, rgba(255,255,255,0.55))',
                    cursor: 'pointer',
                    display: 'flex',
                    padding: 0,
                }}
                title={muted ? 'Ton einschalten' : 'Stummschalten'}
            >
                {muted ? <LuVolumeX size={14} /> : <LuVolume1 size={14} />}
            </button>
            <CustomPlayerbarSlider
                max={100}
                min={0}
                onChange={onVolumeChange}
                size={6}
                style={{ flex: 1 }}
                value={muted ? 0 : volume}
            />
            <span
                style={{
                    color: 'var(--theme-colors-text-primary)',
                    fontSize: '11px',
                    textAlign: 'right',
                }}
            >
                {muted ? 0 : volume}
            </span>
        </div>
    </PopSection>
);
