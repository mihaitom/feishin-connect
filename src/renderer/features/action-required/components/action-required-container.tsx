import { Group, Stack } from '@mantine/core';
import { ReactNode } from 'react';
import { RiAlertFill } from 'react-icons/ri';

import { Text } from '/@/renderer/components';

interface ActionRequiredContainerProps {
    children: ReactNode;
    title: string;
}

export const ActionRequiredContainer = ({ children, title }: ActionRequiredContainerProps) => (
    <Stack sx={{ cursor: 'default', maxWidth: '700px' }}>
        <Group>
            <RiAlertFill
                color="var(--warning-color)"
                size={30}
            />
            <Text
                size="xl"
                sx={{ textTransform: 'uppercase' }}
            >
                {title}
            </Text>
        </Group>
        <Stack>{children}</Stack>
    </Stack>
);
