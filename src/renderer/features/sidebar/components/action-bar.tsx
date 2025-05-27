import { Grid, Group } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { RiArrowLeftSLine, RiArrowRightSLine, RiMenuFill, RiSearchLine } from 'react-icons/ri';
import { useNavigate } from 'react-router';
import styled from 'styled-components';

import { Button, DropdownMenu, TextInput } from '/@/renderer/components';
import { AppMenu } from '/@/renderer/features/titlebar/components/app-menu';
import { useContainerQuery } from '/@/renderer/hooks';
import { useCommandPalette } from '/@/renderer/store';

const ActionsContainer = styled.div`
    display: flex;
    align-items: center;
    height: 70px;
    -webkit-app-region: drag;

    input {
        -webkit-app-region: no-drag;
    }
`;

export const ActionBar = () => {
    const { t } = useTranslation();
    const cq = useContainerQuery({ md: 300 });
    const navigate = useNavigate();
    const { open } = useCommandPalette();

    return (
        <ActionsContainer ref={cq.ref}>
            {cq.isMd ? (
                <Grid
                    display="flex"
                    gutter="sm"
                    px="1rem"
                    w="100%"
                >
                    <Grid.Col span={6}>
                        <TextInput
                            icon={<RiSearchLine />}
                            onClick={open}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    open();
                                }
                            }}
                            placeholder={t('common.search', { postProcess: 'titleCase' })}
                            readOnly
                            size="md"
                        />
                    </Grid.Col>
                    <Grid.Col span={6}>
                        <Group
                            grow
                            noWrap
                            spacing="sm"
                        >
                            <DropdownMenu position="bottom-start">
                                <DropdownMenu.Target>
                                    <Button
                                        p="0.5rem"
                                        size="md"
                                        variant="default"
                                    >
                                        <RiMenuFill size="1rem" />
                                    </Button>
                                </DropdownMenu.Target>
                                <DropdownMenu.Dropdown>
                                    <AppMenu />
                                </DropdownMenu.Dropdown>
                            </DropdownMenu>
                            <Button
                                onClick={() => navigate(-1)}
                                p="0.5rem"
                                size="md"
                                variant="default"
                            >
                                <RiArrowLeftSLine size="1.5rem" />
                            </Button>
                            <Button
                                onClick={() => navigate(1)}
                                p="0.5rem"
                                size="md"
                                variant="default"
                            >
                                <RiArrowRightSLine size="1.5rem" />
                            </Button>
                        </Group>
                    </Grid.Col>
                </Grid>
            ) : (
                <Group
                    grow
                    px="1rem"
                    spacing="sm"
                    w="100%"
                >
                    <Button
                        onClick={open}
                        p="0.5rem"
                        size="md"
                        variant="default"
                    >
                        <RiSearchLine size="1rem" />
                    </Button>
                    <DropdownMenu position="bottom-start">
                        <DropdownMenu.Target>
                            <Button
                                p="0.5rem"
                                size="md"
                                variant="default"
                            >
                                <RiMenuFill size="1rem" />
                            </Button>
                        </DropdownMenu.Target>
                        <DropdownMenu.Dropdown>
                            <AppMenu />
                        </DropdownMenu.Dropdown>
                    </DropdownMenu>
                    <Button
                        onClick={() => navigate(-1)}
                        p="0.5rem"
                        size="md"
                        variant="default"
                    >
                        <RiArrowLeftSLine size="1.5rem" />
                    </Button>
                    <Button
                        onClick={() => navigate(1)}
                        p="0.5rem"
                        size="md"
                        variant="default"
                    >
                        <RiArrowRightSLine size="1.5rem" />
                    </Button>
                </Group>
            )}
        </ActionsContainer>
    );
};
