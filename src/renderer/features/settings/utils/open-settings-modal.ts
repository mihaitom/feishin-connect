import { openContextModal } from '@mantine/modals';

export const openSettingsModal = () => {
    openContextModal({
        fullScreen: true,
        innerProps: {},
        modalKey: 'settings',
    });
};
