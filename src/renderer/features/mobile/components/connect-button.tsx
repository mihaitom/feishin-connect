import { LuCast } from 'react-icons/lu';
import { useShallow } from 'zustand/shallow';

import { ConnectDevices } from '/@/renderer/features/mobile/containers/connect-devices';
import { useConnectPlayerStore } from '/@/renderer/features/player/components/connect/connect.store';
import { ActionIcon } from '/@/shared/components/action-icon/action-icon';
import { useDisclosure } from '/@/shared/hooks/use-disclosure';

export const ConnectButton = () => {
    const [opened, handlers] = useDisclosure(false);
    const isActive = useConnectPlayerStore(useShallow((s) => s.isActive));

    return (
        <>
            <ActionIcon
                h={48}
                onClick={handlers.open}
                tooltip={{
                    label: isActive ? 'Connected' : 'Connect devices',
                }}
                variant="default"
            >
                <LuCast
                    color={
                        isActive
                            ? 'var(--theme-colors-primary)'
                            : 'var(--theme-colors-text-secondary)'
                    }
                    size={24}
                    style={{ opacity: isActive ? 1 : 0.7 }}
                />
            </ActionIcon>
            <ConnectDevices onClose={handlers.close} opened={opened} />
        </>
    );
};
