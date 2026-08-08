import { LuCast } from 'react-icons/lu';

import { ConnectDevices } from '/@/remote/components/connect-devices';
import { useConnectRemoteState } from '/@/remote/store';
import { ActionIcon } from '/@/shared/components/action-icon/action-icon';
import { useDisclosure } from '/@/shared/hooks/use-disclosure';

export const ConnectButton = () => {
    const [opened, handlers] = useDisclosure(false);
    const connectState = useConnectRemoteState();

    return (
        <>
            <ActionIcon
                onClick={handlers.open}
                tooltip={{
                    label: connectState.isActive ? 'Connected' : 'Connect devices',
                }}
                variant="default"
            >
                <LuCast
                    color={connectState.isActive ? 'var(--theme-colors-primary)' : undefined}
                    size={24}
                />
            </ActionIcon>
            <ConnectDevices onClose={handlers.close} opened={opened} />
        </>
    );
};
