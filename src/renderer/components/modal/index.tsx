import {
    Flex,
    Group,
    Modal as MantineModal,
    ModalProps as MantineModalProps,
    Stack,
} from '@mantine/core';
import { closeAllModals, ContextModalProps } from '@mantine/modals';
import React, { ReactNode } from 'react';

import { Button } from '/@/renderer/components/button';

export interface ModalProps extends Omit<MantineModalProps, 'onClose'> {
    children?: ReactNode;
    handlers: {
        close: () => void;
        open: () => void;
        toggle: () => void;
    };
}

export const Modal = ({ children, handlers, ...rest }: ModalProps) => {
    return (
        <MantineModal
            {...rest}
            onClose={handlers.close}
        >
            {children}
        </MantineModal>
    );
};

export type ContextModalVars = {
    context: ContextModalProps['context'];
    id: ContextModalProps['id'];
};

export const BaseContextModal = ({
    context,
    id,
    innerProps,
}: ContextModalProps<{
    modalBody: (vars: ContextModalVars) => React.ReactNode;
}>) => <>{innerProps.modalBody({ context, id })}</>;

interface ConfirmModalProps {
    children: ReactNode;
    disabled?: boolean;
    labels?: {
        cancel?: string;
        confirm?: string;
    };
    loading?: boolean;
    onCancel?: () => void;
    onConfirm: () => void;
}

export const ConfirmModal = ({
    children,
    disabled,
    labels,
    loading,
    onCancel,
    onConfirm,
}: ConfirmModalProps) => {
    const handleCancel = () => {
        if (onCancel) {
            onCancel();
        } else {
            closeAllModals();
        }
    };

    return (
        <Stack>
            <Flex>{children}</Flex>
            <Group position="right">
                <Button
                    data-focus
                    onClick={handleCancel}
                    variant="default"
                >
                    {labels?.cancel ? labels.cancel : 'Cancel'}
                </Button>
                <Button
                    disabled={disabled}
                    loading={loading}
                    onClick={onConfirm}
                    variant="filled"
                >
                    {labels?.confirm ? labels.confirm : 'Confirm'}
                </Button>
            </Group>
        </Stack>
    );
};
