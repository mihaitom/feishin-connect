import { useMobileConnectDevices } from '/@/renderer/features/mobile/hooks/use-mobile-connect-devices';
import { ConnectDevices as SharedConnectDevices } from '/@/shared/mobile-ui/containers/connect-devices';

interface ConnectDevicesProps {
    onClose: () => void;
    opened: boolean;
}

export const ConnectDevices = ({ onClose, opened }: ConnectDevicesProps) => {
    const { connectState, devices, onConnect, onDisconnect, onRescan, onVolumeChange } =
        useMobileConnectDevices();

    return (
        <SharedConnectDevices
            connectState={connectState}
            devices={devices}
            onClose={onClose}
            onConnect={onConnect}
            onDisconnect={onDisconnect}
            onRescan={onRescan}
            onVolumeChange={onVolumeChange}
            opened={opened}
        />
    );
};
