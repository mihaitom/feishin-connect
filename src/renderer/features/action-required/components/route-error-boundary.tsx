import { Box, Center, Divider, Group, Stack } from '@mantine/core';
import { RiArrowLeftSLine, RiErrorWarningLine, RiHome4Line, RiMenuFill } from 'react-icons/ri';
import { useNavigate, useRouteError } from 'react-router';

import { Button, DropdownMenu, Text } from '/@/renderer/components';
import { AppMenu } from '/@/renderer/features/titlebar/components/app-menu';
import { AppRoute } from '/@/renderer/router/routes';

const RouteErrorBoundary = () => {
    const navigate = useNavigate();
    const error = useRouteError() as any;
    console.log('error', error);

    const handleReload = () => {
        navigate(0);
    };

    const handleReturn = () => {
        navigate(-1);
    };

    const handleHome = () => {
        navigate(AppRoute.HOME);
    };

    return (
        <Box bg="var(--main-bg)">
            <Center sx={{ height: '100vh' }}>
                <Stack sx={{ maxWidth: '50%' }}>
                    <Group>
                        <Button
                            onClick={handleReturn}
                            px={10}
                            variant="subtle"
                        >
                            <RiArrowLeftSLine size={20} />
                        </Button>
                        <RiErrorWarningLine
                            color="var(--danger-color)"
                            size={30}
                        />
                        <Text size="lg">Something went wrong</Text>
                    </Group>
                    <Divider my={5} />
                    <Text size="sm">{error?.message}</Text>
                    <Group
                        grow
                        spacing="sm"
                    >
                        <Button
                            leftIcon={<RiHome4Line />}
                            onClick={handleHome}
                            size="md"
                            sx={{ flex: 0.5 }}
                            variant="default"
                        >
                            Go home
                        </Button>
                        <DropdownMenu position="bottom-start">
                            <DropdownMenu.Target>
                                <Button
                                    leftIcon={<RiMenuFill />}
                                    size="md"
                                    sx={{ flex: 0.5 }}
                                    variant="default"
                                >
                                    Menu
                                </Button>
                            </DropdownMenu.Target>
                            <DropdownMenu.Dropdown>
                                <AppMenu />
                            </DropdownMenu.Dropdown>
                        </DropdownMenu>
                    </Group>
                    <Group grow>
                        <Button
                            onClick={handleReload}
                            size="md"
                            variant="filled"
                        >
                            Reload
                        </Button>
                    </Group>
                </Stack>
            </Center>
        </Box>
    );
};

export default RouteErrorBoundary;
