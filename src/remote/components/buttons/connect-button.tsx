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
                h={48}
                onClick={handlers.open}
                tooltip={{
                    label: connectState.isActive ? 'Connected' : 'Connect devices',
                }}
                variant="default"
            >
                <LuCast
                    color={
                        connectState.isActive
                            ? 'var(--theme-colors-primary)'
                            : 'var(--theme-colors-text-secondary)'
                    }
                    size={24}
                    style={{ opacity: connectState.isActive ? 1 : 0.7 }}
                />
            </ActionIcon>
            <ConnectDevices onClose={handlers.close} opened={opened} />
        </>
    );
};
