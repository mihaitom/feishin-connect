import { useConnectDevices, useConnectRemoteState, useSend } from '/@/remote/store';
import { ConnectDevices as SharedConnectDevices } from '/@/shared/mobile-ui/containers/connect-devices';

interface ConnectDevicesProps {
    onClose: () => void;
    opened: boolean;
}

export const ConnectDevices = ({ onClose, opened }: ConnectDevicesProps) => {
    const devices = useConnectDevices();
    const connectState = useConnectRemoteState();
    const send = useSend();

    return (
        <SharedConnectDevices
            connectState={connectState}
            devices={devices}
            onClose={onClose}
            onConnect={(targets, force) =>
                send({ devices: targets, event: 'connect-connect', force })
            }
            onDisconnect={(device) => send({ device, event: 'connect-disconnect' })}
            onRescan={() => send({ event: 'connect-discover', fresh: true })}
            onVolumeChange={(device, volume) =>
                send({ device, event: 'connect-set-volume', volume })
            }
            opened={opened}
        />
    );
};
