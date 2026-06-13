import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { connectFetch, PairingStep } from './types';

import { Button } from '/@/shared/components/button/button';
import { Group } from '/@/shared/components/group/group';
import { Icon } from '/@/shared/components/icon/icon';
import { Modal } from '/@/shared/components/modal/modal';
import { Spinner } from '/@/shared/components/spinner/spinner';
import { Stack } from '/@/shared/components/stack/stack';
import { TextInput } from '/@/shared/components/text-input/text-input';
import { Text } from '/@/shared/components/text/text';

interface PairingModalProps {
    deviceName: string;
    onClose: () => void;
    onSuccess: () => void;
}

const noop = () => {};

export const PairingModal = ({ deviceName, onClose, onSuccess }: PairingModalProps) => {
    const { t } = useTranslation();
    const [step, setStep] = useState<PairingStep>('idle');
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const pinRef = useRef<HTMLInputElement>(null);

    const finishPairing = useCallback(
        async (pinValue: null | number) => {
            setStep('started');
            try {
                const res = await connectFetch(`/pair/airplay/finish`, {
                    body: JSON.stringify({ name: deviceName, pin: pinValue }),
                    headers: { 'Content-Type': 'application/json' },
                    method: 'POST',
                });
                const data = await res.json();
                if (!res.ok) {
                    setError(data.error ?? t('player.connect_pairing_error_failed'));
                    setStep('error');
                    return;
                }
                setStep('success');
                setTimeout(() => {
                    onSuccess();
                    onClose();
                }, 1200);
            } catch {
                setError(t('player.connect_pairing_error_backend'));
                setStep('error');
            }
        },
        [deviceName, onClose, onSuccess, t],
    );

    const startPairing = useCallback(
        async (force = false) => {
            setStep('started');
            setError('');
            setPin('');
            try {
                const res = await connectFetch(`/pair/airplay/start`, {
                    body: JSON.stringify({ force, name: deviceName }),
                    headers: { 'Content-Type': 'application/json' },
                    method: 'POST',
                });
                const data = await res.json();
                if (!res.ok) {
                    setError(data.error ?? t('player.connect_pairing_error_failed'));
                    setStep('error');
                    return;
                }
                if (data.device_provides_pin) {
                    setStep('needs_pin');
                } else {
                    await finishPairing(null);
                }
            } catch {
                setError(t('player.connect_pairing_error_backend'));
                setStep('error');
            }
        },
        [deviceName, finishPairing, t],
    );

    useEffect(() => {
        startPairing();
    }, [startPairing]);

    useEffect(() => {
        if (step === 'needs_pin') pinRef.current?.focus();
    }, [step]);

    return (
        <Modal
            closeOnClickOutside={false}
            handlers={{ close: onClose, open: noop, toggle: noop }}
            opened
            size="sm"
            title={t('player.connect_pairing_title')}
        >
            <Stack gap="md">
                <Text isMuted size="sm">
                    {deviceName}
                </Text>

                {(step === 'idle' || step === 'started') && (
                    <Group gap="sm" justify="center" py="md" wrap="nowrap">
                        <Spinner size={18} />
                        <Text size="sm">{t('player.connect_pairing_connecting')}</Text>
                    </Group>
                )}

                {step === 'needs_pin' && (
                    <Stack gap="sm">
                        <Text isMuted size="sm">
                            {t('player.connect_pairing_pin_hint')}
                        </Text>
                        <TextInput
                            inputMode="numeric"
                            maxLength={8}
                            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                            pattern="[0-9]*"
                            placeholder="••••"
                            ref={pinRef}
                            size="lg"
                            styles={{
                                input: {
                                    fontSize: 'var(--mantine-font-size-xl)',
                                    letterSpacing: '0.5em',
                                    textAlign: 'center',
                                },
                            }}
                            value={pin}
                        />
                        <Button
                            disabled={pin.length < 4}
                            fullWidth
                            onClick={() => finishPairing(parseInt(pin, 10))}
                            variant="filled"
                        >
                            {t('player.connect_pairing_confirm')}
                        </Button>
                    </Stack>
                )}

                {step === 'success' && (
                    <Group gap="sm" py="md" wrap="nowrap">
                        <Icon color="success" icon="success" />
                        <Text size="sm">{t('player.connect_pairing_success')}</Text>
                    </Group>
                )}

                {step === 'error' && (
                    <Stack gap="sm">
                        <Group gap="sm" py="sm" wrap="nowrap">
                            <Icon color="error" icon="xCircle" />
                            <Text size="sm" weight={600}>
                                {t('player.connect_pairing_error_title')}
                            </Text>
                        </Group>
                        <Text
                            isMuted
                            py="sm"
                            size="xs"
                            style={{
                                maxHeight: '120px',
                                overflowY: 'auto',
                                wordBreak: 'break-word',
                            }}
                        >
                            {error}
                        </Text>
                        <Button fullWidth onClick={() => startPairing(true)} variant="default">
                            {t('player.connect_pairing_retry')}
                        </Button>
                    </Stack>
                )}
            </Stack>
        </Modal>
    );
};
