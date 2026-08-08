import { useMemo, useState } from 'react';
import { LuAirplay, LuCheck, LuRadioReceiver, LuSpeaker, LuTv } from 'react-icons/lu';
import { RiVolumeUpFill } from 'react-icons/ri';

import { WrappedSlider } from '/@/remote/components/wrapped-slider';
import { useConnectDevices, useConnectRemoteState, useSend } from '/@/remote/store';
import { Button } from '/@/shared/components/button/button';
import { Drawer } from '/@/shared/components/drawer/drawer';
import { Group } from '/@/shared/components/group/group';
import { Modal } from '/@/shared/components/modal/modal';
import { Stack } from '/@/shared/components/stack/stack';
import { Text } from '/@/shared/components/text/text';
import { RemoteConnectDevice, RemoteConnectDeviceRef } from '/@/shared/types/remote-types';

const DEVICE_TYPE_ORDER: RemoteConnectDevice['type'][] = ['sonos', 'chromecast', 'dlna', 'airplay'];

const DEVICE_TYPE_LABEL: Record<RemoteConnectDevice['type'], string> = {
    airplay: 'AirPlay',
    chromecast: 'Chromecast',
    dlna: 'DLNA',
    sonos: 'Sonos',
};

const deviceKey = (device: RemoteConnectDeviceRef) => `${device.type}:${device.name}`;

const DeviceTypeIcon = ({ type }: { type: RemoteConnectDevice['type'] }) => {
    switch (type) {
        case 'chromecast':
            return <LuTv size={22} />;
        case 'dlna':
            return <LuRadioReceiver size={22} />;
        case 'sonos':
            return <LuSpeaker size={22} />;
        default:
            return <LuAirplay size={22} />;
    }
};

interface DeviceRowProps {
    device: RemoteConnectDevice;
    isActive: boolean;
    isSelected: boolean;
    onToggle: () => void;
    onVolumeChange: (volume: number) => void;
}

// A single tap target for the whole row (no separate switch to precisely hit)
// — this is a touch remote, so state is communicated through a generous,
// unambiguous card rather than a small control glued to the text.
const DeviceRow = ({ device, isActive, isSelected, onToggle, onVolumeChange }: DeviceRowProps) => {
    const isClaimedByOther = !!device.claimedByName;
    // AirPlay has no volume control in the backend.
    const volumeSupported = device.type !== 'airplay';
    const highlighted = isActive || isSelected;

    return (
        <Stack gap={0}>
            <Group
                gap="md"
                onClick={onToggle}
                style={{
                    background: highlighted
                        ? 'var(--theme-colors-primary-transparent)'
                        : 'transparent',
                    borderRadius: 12,
                    cursor: 'pointer',
                    minHeight: 64,
                    padding: '14px 16px',
                    userSelect: 'none',
                }}
                wrap="nowrap"
            >
                <span
                    style={{
                        color: highlighted
                            ? 'var(--theme-colors-primary)'
                            : 'var(--theme-colors-text-secondary)',
                        display: 'flex',
                        flexShrink: 0,
                    }}
                >
                    <DeviceTypeIcon type={device.type} />
                </span>
                <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                    <Text
                        fw={isActive ? 700 : 500}
                        style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {device.name}
                    </Text>
                    {isClaimedByOther && (
                        <Text isMuted size="sm">
                            In use by {device.claimedByName}
                        </Text>
                    )}
                </Stack>
                {highlighted && (
                    <span style={{ color: 'var(--theme-colors-primary)', flexShrink: 0 }}>
                        <LuCheck size={22} />
                    </span>
                )}
            </Group>
            {isActive && volumeSupported && (
                <div style={{ padding: '0 16px 12px 52px' }}>
                    <WrappedSlider
                        leftLabel={<RiVolumeUpFill size={16} />}
                        max={100}
                        onChangeEnd={onVolumeChange}
                        rightLabel={<Text size="sm">{device.volume ?? 0}</Text>}
                        thumbSize="1.5rem"
                        trackSize={10}
                        value={device.volume ?? 0}
                    />
                </div>
            )}
        </Stack>
    );
};

interface ConnectDevicesProps {
    onClose: () => void;
    opened: boolean;
}

export const ConnectDevices = ({ onClose, opened }: ConnectDevicesProps) => {
    const devices = useConnectDevices();
    const connectState = useConnectRemoteState();
    const send = useSend();

    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [pendingConfirm, setPendingConfirm] = useState<null | RemoteConnectDevice[]>(null);

    const activeKeys = useMemo(
        () => new Set(connectState.activeTargets.map(deviceKey)),
        [connectState.activeTargets],
    );

    const grouped = useMemo(() => {
        const map = new Map<RemoteConnectDevice['type'], RemoteConnectDevice[]>();
        for (const type of DEVICE_TYPE_ORDER) map.set(type, []);
        for (const device of devices) {
            map.get(device.type)?.push(device);
        }
        return map;
    }, [devices]);

    const toggleSelect = (device: RemoteConnectDevice) => {
        const key = deviceKey(device);
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const sendConnect = (targets: RemoteConnectDevice[], force: boolean) => {
        send({
            devices: targets.map((d) => ({ name: d.name, type: d.type })),
            event: 'connect-connect',
            force,
        });
        setSelected(new Set());
    };

    const handleConnect = () => {
        const targets = devices.filter((d) => selected.has(deviceKey(d)));
        if (targets.length === 0) return;

        const claimedByOther = targets.some(
            (d) => d.claimedBySessionId && d.claimedBySessionId !== connectState.mySessionId,
        );
        if (claimedByOther) {
            setPendingConfirm(targets);
            return;
        }
        sendConnect(targets, false);
    };

    const handleDisconnect = (device: RemoteConnectDeviceRef) => {
        send({ device, event: 'connect-disconnect' });
    };

    const handleRowToggle = (device: RemoteConnectDevice) => {
        const key = deviceKey(device);
        const isClaimedByOther =
            !!device.claimedBySessionId && device.claimedBySessionId !== connectState.mySessionId;

        if (activeKeys.has(key)) {
            handleDisconnect(device);
        } else if (isClaimedByOther) {
            setPendingConfirm([device]);
        } else {
            toggleSelect(device);
        }
    };

    return (
        <>
            <Drawer
                onClose={onClose}
                opened={opened}
                padding="lg"
                position="bottom"
                size="85%"
                styles={{ content: { borderRadius: '20px 20px 0 0' } }}
                title={
                    <Text fw={700} size="lg">
                        Connect Devices
                    </Text>
                }
            >
                <Stack gap="lg">
                    <Group grow>
                        <Button
                            onClick={() => send({ event: 'connect-discover', fresh: true })}
                            size="md"
                            variant="default"
                        >
                            Rescan
                        </Button>
                        {connectState.isActive && (
                            <Button
                                onClick={() => send({ event: 'connect-disconnect' })}
                                size="md"
                                variant="default"
                            >
                                Disconnect all
                            </Button>
                        )}
                    </Group>
                    {devices.length === 0 && (
                        <Text isMuted ta="center">
                            No devices found
                        </Text>
                    )}
                    {DEVICE_TYPE_ORDER.map((type) => {
                        const list = grouped.get(type) ?? [];
                        if (list.length === 0) return null;

                        return (
                            <Stack gap="xs" key={type}>
                                <Text fw={600} isMuted size="sm" tt="uppercase">
                                    {DEVICE_TYPE_LABEL[type]}
                                </Text>
                                <Stack gap="xs">
                                    {list.map((device) => {
                                        const key = deviceKey(device);
                                        return (
                                            <DeviceRow
                                                device={device}
                                                isActive={activeKeys.has(key)}
                                                isSelected={selected.has(key)}
                                                key={key}
                                                onToggle={() => handleRowToggle(device)}
                                                onVolumeChange={(volume) =>
                                                    send({
                                                        device,
                                                        event: 'connect-set-volume',
                                                        volume,
                                                    })
                                                }
                                            />
                                        );
                                    })}
                                </Stack>
                            </Stack>
                        );
                    })}
                    {selected.size > 0 && (
                        <Button fullWidth onClick={handleConnect} size="lg">
                            Connect ({selected.size})
                        </Button>
                    )}
                </Stack>
            </Drawer>
            <Modal
                handlers={{
                    close: () => setPendingConfirm(null),
                    open: () => {},
                    toggle: () => {},
                }}
                opened={!!pendingConfirm}
                title="Device in use"
            >
                <Stack gap="lg">
                    <Text>
                        {pendingConfirm?.length === 1
                            ? `"${pendingConfirm[0].name}" is in use by ${pendingConfirm[0].claimedByName}. Take over?`
                            : 'One or more selected devices are in use by someone else. Take over?'}
                    </Text>
                    <Group grow>
                        <Button onClick={() => setPendingConfirm(null)} size="md" variant="default">
                            Cancel
                        </Button>
                        <Button
                            onClick={() => {
                                if (pendingConfirm) sendConnect(pendingConfirm, true);
                                setPendingConfirm(null);
                            }}
                            size="md"
                        >
                            Take over
                        </Button>
                    </Group>
                </Stack>
            </Modal>
        </>
    );
};
