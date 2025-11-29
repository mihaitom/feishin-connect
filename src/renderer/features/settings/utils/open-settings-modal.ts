import { openContextModal } from '@mantine/modals';

export const openSettingsModal = () => {
    openContextModal({
        innerProps: {},
        modalKey: 'settings',
        overlayProps: {
            opacity: 1,
        },
        size: '2xl',
        styles: {
            content: {
                height: 'calc(100dvh - 160px)',
                maxWidth: '960px',
                minHeight: '540px',
            },
        },
        transitionProps: {
            transition: 'pop',
        },
    });
};
