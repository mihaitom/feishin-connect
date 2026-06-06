import { Loader } from '@mantine/core';
import { useState } from 'react';

export const Spinner = ({ size = 14 }: { size?: number }) => <Loader size={size} />;

export const PopSection = ({ children, label }: { children: React.ReactNode; label?: string }) => (
    <div>
        {label && (
            <div
                style={{
                    color: 'var(--theme-colors-text-secondary)',
                    fontSize: '11px',
                    letterSpacing: '0.06em',
                    padding: '10px 12px 4px',
                    textTransform: 'uppercase',
                }}
            >
                {label}
            </div>
        )}
        {children}
    </div>
);

export const PopButton = ({
    active = false,
    danger = false,
    icon,
    label,
    onClick,
}: {
    active?: boolean;
    danger?: boolean;
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
}) => {
    const [hover, setHover] = useState(false);
    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                alignItems: 'center',
                background: hover || active ? 'rgba(255,255,255,0.07)' : 'transparent',
                border: 'none',
                color: danger
                    ? '#f55'
                    : active
                      ? 'var(--theme-colors-primary)'
                      : 'var(--theme-colors-text-primary)',
                cursor: 'pointer',
                display: 'flex',
                fontSize: '13px',
                gap: '8px',
                padding: '7px 12px',
                transition: 'background 0.1s',
                width: '100%',
            }}
        >
            {icon}
            {label}
        </button>
    );
};

export const ControlButton = ({
    children,
    disabled = false,
    onClick,
    primary = false,
    title,
}: {
    children: React.ReactNode;
    disabled?: boolean;
    onClick: () => void;
    primary?: boolean;
    title?: string;
}) => {
    const [hover, setHover] = useState(false);
    return (
        <button
            disabled={disabled}
            onClick={onClick}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                alignItems: 'center',
                background:
                    primary && hover
                        ? 'var(--theme-colors-primary)'
                        : hover
                          ? 'rgba(255,255,255,0.08)'
                          : 'transparent',
                border: primary ? '1px solid var(--theme-colors-primary)' : 'none',
                borderRadius: primary ? '50%' : '4px',
                color: primary ? 'var(--theme-colors-primary)' : 'var(--theme-colors-text-primary)',
                cursor: disabled ? 'default' : 'pointer',
                display: 'flex',
                height: primary ? '36px' : '30px',
                justifyContent: 'center',
                opacity: disabled ? 0.3 : 1,
                padding: 0,
                transition: 'background 0.15s, color 0.15s',
                width: primary ? '36px' : '30px',
            }}
            title={title}
        >
            {children}
        </button>
    );
};
