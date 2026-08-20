import { Flex, Grid, Image } from '@mantine/core';

import { ReconnectButton } from '/@/remote/components/buttons/reconnect-button';
import { ThemeButton } from '/@/remote/components/buttons/theme-button';
import { MiniPlayerBar } from '/@/remote/components/mini-player-bar';
import { TabBar } from '/@/remote/components/tab-bar';
import { RemoteRoutes } from '/@/remote/router';
import { useConnected } from '/@/remote/store';
import { Center } from '/@/shared/components/center/center';
import { Group } from '/@/shared/components/group/group';
import { Spinner } from '/@/shared/components/spinner/spinner';

// A plain flex column instead of Mantine's <AppShell> — AppShell's header/
// footer are `position: fixed` with Main just carrying compensating padding,
// which assumes the *page* scrolls underneath them. The shared global.css
// sets `html, body { overflow: hidden }` for the desktop shell (which this
// app inherits too), so that assumption doesn't hold here: Main has to be
// its own bounded, scrollable flex child instead, which a plain three-row
// flex column (header/main/footer) gives for free — no manual offset
// bookkeeping against Mantine's internal CSS variables required.
export const Shell = () => {
    const connected = useConnected();

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', width: '100vw' }}>
            <div
                style={{
                    background: 'var(--theme-colors-surface)',
                    borderBottom: '1px solid var(--theme-colors-border)',
                    flexShrink: 0,
                }}
            >
                <Grid px="md" py="sm">
                    <Grid.Col span={4}>
                        <Flex
                            align="center"
                            direction="row"
                            h="100%"
                            justify="flex-start"
                            style={{
                                justifySelf: 'flex-start',
                            }}
                        >
                            <Image fit="contain" height={32} src="/favicon.ico" width={32} />
                        </Flex>
                    </Grid.Col>
                    <Grid.Col span={8}>
                        <Group gap="sm" justify="flex-end" wrap="nowrap">
                            <ReconnectButton />
                            <ThemeButton />
                        </Group>
                    </Grid.Col>
                </Grid>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                {connected ? (
                    <RemoteRoutes />
                ) : (
                    <Center h="100%" w="100%">
                        <Spinner />
                    </Center>
                )}
            </div>
            {connected && <MiniPlayerBar />}
            {connected && (
                <div
                    style={{
                        background: 'var(--theme-colors-surface)',
                        flexShrink: 0,
                        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                    }}
                >
                    <TabBar />
                </div>
            )}
        </div>
    );
};
