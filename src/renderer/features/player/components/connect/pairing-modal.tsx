import { useEffect, useRef, useState } from 'react';

import { CONNECT_URL, PairingStep } from './types';

interface PairingModalProps {
    deviceName: string;
    onClose: () => void;
    onSuccess: () => void;
}

export const PairingModal = ({ deviceName, onClose, onSuccess }: PairingModalProps) => {
    const [step, setStep] = useState<PairingStep>('idle');
    const [deviceProvidesPin, setDeviceProvidesPin] = useState(false);
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const pinRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        startPairing();
    }, []);

    useEffect(() => {
        if (step === 'needs_pin') pinRef.current?.focus();
    }, [step]);

    const startPairing = async () => {
        setStep('started');
        setError('');
        try {
            const res = await fetch(`${CONNECT_URL}/pair/airplay/start`, {
                body: JSON.stringify({ name: deviceName }),
                headers: { 'Content-Type': 'application/json' },
                method: 'POST',
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error ?? 'Unbekannter Fehler');
                setStep('error');
                return;
            }
            setDeviceProvidesPin(data.device_provides_pin);
            if (data.device_provides_pin) {
                setStep('needs_pin');
            } else {
                await finishPairing(null);
            }
        } catch {
            setError('Backend nicht erreichbar');
            setStep('error');
        }
    };

    const finishPairing = async (pinValue: number | null) => {
        setStep('started');
        try {
            const res = await fetch(`${CONNECT_URL}/pair/airplay/finish`, {
                body: JSON.stringify({ name: deviceName, pin: pinValue }),
                headers: { 'Content-Type': 'application/json' },
                method: 'POST',
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error ?? 'Pairing fehlgeschlagen');
                setStep('error');
                return;
            }
            setStep('success');
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 1200);
        } catch {
            setError('Backend nicht erreichbar');
            setStep('error');
        }
    };

    const overlay: React.CSSProperties = {
        alignItems: 'center',
        background: 'rgba(0,0,0,0.65)',
        bottom: 0,
        display: 'flex',
        justifyContent: 'center',
        left: 0,
        position: 'fixed',
        right: 0,
        top: 0,
        zIndex: 9999,
    };

    const box: React.CSSProperties = {
        background: 'var(--theme-colors-background-2, #1e1e1e)',
        borderRadius: '10px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        maxWidth: '340px',
        padding: '28px 28px 22px',
        width: '100%',
    };

    return (
        <div onClick={onClose} style={overlay}>
            <div onClick={(e) => e.stopPropagation()} style={box}>
                <h3
                    style={{
                        color: 'var(--theme-colors-text-primary)',
                        fontSize: '16px',
                        fontWeight: 600,
                        margin: '0 0 8px',
                    }}
                >
                    AirPlay Pairing
                </h3>
                <p
                    style={{
                        color: 'var(--theme-colors-text-secondary)',
                        fontSize: '13px',
                        margin: '0 0 20px',
                    }}
                >
                    {deviceName}
                </p>

                {step === 'started' && (
                    <p style={{ color: 'var(--theme-colors-text-secondary)', fontSize: '14px' }}>
                        Verbinde…
                    </p>
                )}

                {step === 'needs_pin' && (
                    <>
                        <p
                            style={{
                                color: 'var(--theme-colors-text-secondary)',
                                fontSize: '13px',
                                marginBottom: '14px',
                            }}
                        >
                            Schau auf das Gerät und gib den angezeigten PIN ein.
                        </p>
                        <input
                            inputMode="numeric"
                            maxLength={8}
                            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                            pattern="[0-9]*"
                            placeholder="PIN"
                            ref={pinRef}
                            style={{
                                background: 'rgba(255,255,255,0.07)',
                                border: '1px solid rgba(255,255,255,0.15)',
                                borderRadius: '6px',
                                color: 'var(--theme-colors-text-primary)',
                                fontSize: '20px',
                                letterSpacing: '6px',
                                marginBottom: '16px',
                                padding: '10px 14px',
                                textAlign: 'center',
                                width: '100%',
                            }}
                            value={pin}
                        />
                        <button
                            disabled={pin.length < 4}
                            onClick={() => finishPairing(parseInt(pin, 10))}
                            style={{
                                background: 'var(--theme-colors-primary)',
                                border: 'none',
                                borderRadius: '6px',
                                color: '#fff',
                                cursor: pin.length >= 4 ? 'pointer' : 'not-allowed',
                                fontSize: '14px',
                                opacity: pin.length >= 4 ? 1 : 0.5,
                                padding: '10px 0',
                                width: '100%',
                            }}
                        >
                            Pairen
                        </button>
                    </>
                )}

                {step === 'success' && (
                    <p style={{ color: '#4caf50', fontSize: '14px' }}>
                        ✓ Erfolgreich gepaired!
                    </p>
                )}

                {step === 'error' && (
                    <>
                        <p style={{ color: '#f44336', fontSize: '13px', marginBottom: '14px' }}>
                            {error}
                        </p>
                        <button
                            onClick={startPairing}
                            style={{
                                background: 'rgba(255,255,255,0.08)',
                                border: 'none',
                                borderRadius: '6px',
                                color: 'var(--theme-colors-text-primary)',
                                cursor: 'pointer',
                                fontSize: '13px',
                                padding: '8px 16px',
                            }}
                        >
                            Nochmal versuchen
                        </button>
                    </>
                )}

                <button
                    onClick={onClose}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--theme-colors-text-secondary)',
                        cursor: 'pointer',
                        display: 'block',
                        fontSize: '12px',
                        marginTop: '16px',
                        padding: '4px 0',
                        textAlign: 'center',
                        width: '100%',
                    }}
                >
                    Schließen
                </button>
            </div>
        </div>
    );
};
