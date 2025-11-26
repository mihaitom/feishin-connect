import { openContextModal } from '@mantine/modals';

export const openSettingsModal = () => {
    openContextModal({
        innerProps: {},
        modalKey: 'settings',
        overlayProps: {
            opacity: 1,
        },
        size: 'xl',
        styles: {
            content: {
                height: 'calc(100vh - 400px)',
                minHeight: '540px',
            },
        },
        transitionProps: {
            transition: 'pop',
        },
    });
};
