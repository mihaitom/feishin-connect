import type { FallbackProps } from 'react-error-boundary';

import { Box, Center, Group, Stack } from '@mantine/core';
import { RiErrorWarningLine } from 'react-icons/ri';
import { useRouteError } from 'react-router';
import styled from 'styled-components';

import { Button, Text } from '/@/renderer/components';

const Container = styled(Box)`
    background: var(--main-bg);
`;

export const ErrorFallback = ({ resetErrorBoundary }: FallbackProps) => {
    const error = useRouteError() as any;

    return (
        <Container>
            <Center sx={{ height: '100vh' }}>
                <Stack sx={{ maxWidth: '50%' }}>
                    <Group spacing="xs">
                        <RiErrorWarningLine
                            color="var(--danger-color)"
                            size={30}
                        />
                        <Text size="lg">Something went wrong</Text>
                    </Group>
                    <Text>{error?.message}</Text>
                    <Button
                        onClick={resetErrorBoundary}
                        variant="filled"
                    >
                        Reload
                    </Button>
                </Stack>
            </Center>
        </Container>
    );
};
